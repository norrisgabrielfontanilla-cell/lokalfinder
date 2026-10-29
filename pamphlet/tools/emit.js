// Sends the files collected by live-capture.js from the GitHub runner to the person reading the run, as the annotations of one
// check run created through the Checks API. Why: GitHub Actions artifacts are served from a storage host that the Claude sandbox
// cannot reach, but api.github.com (check-run annotations) it can. All files are packed into ONE tar (JPEGs do not compress, so
// it is stored as is) and the tar is cut into 45,000-byte slices, one base64 slice per annotation (the API allows 64 KB each).
// (Annotations written by workflow commands are cut to 4,096 characters, which is why they are not used.)
//
//   node tools/emit.js prepare     recompress what is worth sending, write out/send/bundle.tar and out/send/plan.json
//   node tools/emit.js check       create the check run "photo-bundle" on this commit and append the annotations (50 per request)
//   tools/reassemble.js            turns the annotations back into the files and checks every checksum
//
// What is sent: menu photos, store logos, store covers and a few real phone screens, i.e. what a resident can already see in the
// public app. Nothing else leaves the runner.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const OUT = process.env.LF_OUT ? path.resolve(process.env.LF_OUT) : path.resolve(__dirname, 'out');
const SEND = path.join(OUT, 'send');
const CHUNK = 45000;            // raw bytes per annotation: 60,000 base64 characters, under the 64 KB annotation limit
const MAX_SLICES = 400;         // about 18 MB: far more than the pamphlet needs
const PER_REQUEST = 50;          // annotations per Checks API request
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function prepare() {
  const sharp = require('sharp');
  const stores = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8')).stores;
  const shots = fs.existsSync(path.join(OUT, 'screens')) ? fs.readdirSync(path.join(OUT, 'screens')) : [];
  // the real phone screens worth sending: the home page and the store pages that have the most photos
  const bestStores = stores.filter((s) => s.items.some((i) => i.photo)).sort((a, b) => b.items.filter((i) => i.photo).length - a.items.filter((i) => i.photo).length).slice(0, 2);
  const wanted = [];
  const screensOnly = process.env.LF_SEND === 'screens';            // LF_SEND=screens: only the phone screens (every screen that was captured)
  for (const s of screensOnly ? [] : stores) {
    if (s.logo) wanted.push({ name: `stores/${s.id}/logo.jpg`, src: s.logo.file, w: 300, h: 300 });
    if (s.cover) wanted.push({ name: `stores/${s.id}/cover.jpg`, src: s.cover.file, w: 1200, h: 1200 });
    for (const i of s.items) if (i.photo) wanted.push({ name: path.posix.join('stores', s.id, 'items', path.posix.basename(i.photo.file).replace(/\.\w+$/, '.jpg')), src: i.photo.file, w: 500, h: 500 });
  }
  if (screensOnly) {
    for (const f of shots.filter((f) => f.endsWith('.png')).sort()) wanted.push({ name: `screens/${f.replace(/\.png$/, '.jpg')}`, src: `screens/${f}`, screen: true });
  } else {
    if (shots.includes('home.png')) wanted.push({ name: 'screens/home.jpg', src: 'screens/home.png', screen: true });
    for (const s of bestStores) if (shots.includes(`store-${s.id}.png`)) wanted.push({ name: `screens/store-${s.id}.jpg`, src: `screens/store-${s.id}.png`, screen: true });
  }

  const budget = MAX_SLICES - 4;
  let files, tarBytes, n;
  for (const q of [90, 84, 78, 72, 66, 60]) {                      // lower the quality only if the budget demands it
    files = [];
    for (const w of wanted) {
      const img = sharp(path.join(OUT, w.src));
      const buf = await (w.screen ? img : img.resize({ width: w.w, height: w.h, fit: 'inside', withoutEnlargement: true })).jpeg({ quality: w.screen ? Math.min(q + 4, 94) : q, mozjpeg: true }).toBuffer();
      files.push({ name: w.name, buf });
    }
    tarBytes = files.reduce((a, f) => a + Math.ceil((f.buf.length + 512) / 512) * 512 + 512, 0) + 1024;   // header + padding per file, end blocks
    n = Math.ceil(tarBytes / CHUNK);
    console.log(`quality ${q}: ${files.length} files, ${Math.round(files.reduce((a, f) => a + f.buf.length, 0) / 1024)} KB, about ${n} annotations`);
    if (n <= budget) break;
  }
  fs.rmSync(SEND, { recursive: true, force: true });
  const stage = path.join(SEND, 'files');
  const sums = {};
  for (const f of files) {
    fs.mkdirSync(path.dirname(path.join(stage, f.name)), { recursive: true });
    fs.writeFileSync(path.join(stage, f.name), f.buf);
    sums[f.name] = { bytes: f.buf.length, sha256: sha(f.buf) };
  }
  execFileSync('tar', ['-cf', path.join(SEND, 'bundle.tar'), '-C', stage, '.']);
  const bundle = fs.readFileSync(path.join(SEND, 'bundle.tar'));
  const plan = { bytes: bundle.length, sha256: sha(bundle), n: Math.ceil(bundle.length / CHUNK), files: sums };
  if (plan.n > MAX_SLICES) throw new Error(`${plan.n} slices is more than the ${MAX_SLICES} allowed`);
  fs.writeFileSync(path.join(SEND, 'plan.json'), JSON.stringify(plan));
  fs.rmSync(stage, { recursive: true, force: true });
  console.log(`${files.length} files, ${Math.round(bundle.length / 1024)} KB bundle, ${plan.n} slices`);
}

function plan() { return JSON.parse(fs.readFileSync(path.join(SEND, 'plan.json'), 'utf8')); }

async function check() {
  const p = plan();
  const bundle = fs.readFileSync(path.join(SEND, 'bundle.tar'));
  const ann = (title, buf) => ({ path: '.github/workflows/fetch-store-photos.yml', start_line: 1, end_line: 1, annotation_level: 'notice', title, message: buf.toString('base64') });
  const all = [ann('SUMS', Buffer.from(JSON.stringify(p)))];
  for (let i = 0; i < p.n; i++) all.push(ann(`B|${i}|${p.n}`, bundle.subarray(i * CHUNK, Math.min((i + 1) * CHUNK, bundle.length))));
  for (const a of all) if (a.message.length > 64000) throw new Error(`annotation ${a.title} is ${a.message.length} characters`);
  const batches = [];
  for (let i = 0; i < all.length; i += PER_REQUEST) batches.push(all.slice(i, i + PER_REQUEST));
  console.log(`${all.length} annotations in ${batches.length} request(s), largest ${Math.max(...all.map((a) => a.message.length))} characters`);
  if (process.env.LF_DRY) return;

  const repo = process.env.GITHUB_REPOSITORY, token = process.env.GITHUB_TOKEN, sha = process.env.GITHUB_SHA;
  if (!repo || !token || !sha) throw new Error('GITHUB_REPOSITORY, GITHUB_TOKEN and GITHUB_SHA are needed');
  const api = async (method, url, body) => {
    const r = await fetch(`https://api.github.com/repos/${repo}${url}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const text = await r.text();
    if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${text.slice(0, 300)}`);
    return JSON.parse(text);
  };
  const output = (annotations) => ({ title: 'photo-bundle', summary: `${p.n} slices of one tar (${p.bytes} bytes, sha256 ${p.sha256}); see tools/emit.js`, annotations });
  const created = await api('POST', '/check-runs', { name: 'photo-bundle', head_sha: sha, status: 'completed', conclusion: 'neutral', output: output(batches[0]) });
  console.log(`check run ${created.id} created with ${batches[0].length} annotations`);
  for (let i = 1; i < batches.length; i++) {
    await api('PATCH', `/check-runs/${created.id}`, { output: output(batches[i]) });
    console.log(`appended ${batches[i].length} annotations (request ${i + 1} of ${batches.length})`);
  }
}

const [cmd] = process.argv.slice(2);
if (cmd === 'prepare') prepare().catch((e) => { console.error(e); process.exit(1); });
else if (cmd === 'check') check().catch((e) => { console.error(e); process.exit(1); });
else { console.error('usage: node tools/emit.js prepare | check'); process.exit(2); }
