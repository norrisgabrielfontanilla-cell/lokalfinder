// Sends the files collected by live-capture.js from the GitHub runner to the person reading the run, through the runs'
// annotations (the check-run annotations API). Why: GitHub Actions artifacts are served from a storage host that the Claude
// sandbox cannot reach, but api.github.com (annotations) it can. All files are packed into ONE tar (JPEGs do not compress, so it
// is stored as is) and the tar is cut into 45,000-byte slices, one base64 slice per annotation.
//
//   node tools/emit.js prepare              recompress what is worth sending, write out/send/bundle.tar and out/send/plan.json
//   node tools/emit.js sums                 print the one annotation that carries the checksums
//   node tools/emit.js send <part> <step>   print the annotations of one step of one sender job (4 steps x 10 slices per job)
//   tools/reassemble.js                     turns the annotations back into the files and checks every checksum
//
// GitHub keeps 10 annotations per level per step and about 50 per job, so a sender job sends at most 40 slices and the work is
// spread over parallel jobs. What is sent: menu photos, store logos, store covers and a few real phone screens, i.e. what a
// resident can already see in the public app. Nothing else leaves the runner.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const OUT = process.env.LF_OUT ? path.resolve(process.env.LF_OUT) : path.resolve(__dirname, 'out');
const SEND = path.join(OUT, 'send');
const CHUNK = 45000;            // raw bytes per annotation: 60,000 base64 characters, under the 64 KB annotation limit
const PER_STEP = 10;
const STEPS = 4;
const PER_JOB = PER_STEP * STEPS;
const JOBS = 3;
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

async function prepare() {
  const sharp = require('sharp');
  const stores = JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8')).stores;
  const shots = fs.existsSync(path.join(OUT, 'screens')) ? fs.readdirSync(path.join(OUT, 'screens')) : [];
  // the real phone screens worth sending: the home page and the store pages that have the most photos
  const bestStores = stores.filter((s) => s.items.some((i) => i.photo)).sort((a, b) => b.items.filter((i) => i.photo).length - a.items.filter((i) => i.photo).length).slice(0, 2);
  const wanted = [];
  for (const s of stores) {
    if (s.logo) wanted.push({ name: `stores/${s.id}/logo.jpg`, src: s.logo.file, w: 300, h: 300 });
    if (s.cover) wanted.push({ name: `stores/${s.id}/cover.jpg`, src: s.cover.file, w: 1200, h: 1200 });
    for (const i of s.items) if (i.photo) wanted.push({ name: path.posix.join('stores', s.id, 'items', path.posix.basename(i.photo.file).replace(/\.\w+$/, '.jpg')), src: i.photo.file, w: 500, h: 500 });
  }
  if (shots.includes('home.png')) wanted.push({ name: 'screens/home.jpg', src: 'screens/home.png', screen: true });
  for (const s of bestStores) if (shots.includes(`store-${s.id}.png`)) wanted.push({ name: `screens/store-${s.id}.jpg`, src: `screens/store-${s.id}.png`, screen: true });

  const budget = JOBS * PER_JOB - 4;
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
  if (plan.n > JOBS * PER_JOB) throw new Error(`${plan.n} slices is more than ${JOBS} jobs can send`);
  fs.writeFileSync(path.join(SEND, 'plan.json'), JSON.stringify(plan));
  fs.rmSync(stage, { recursive: true, force: true });
  console.log(`${files.length} files, ${Math.round(bundle.length / 1024)} KB bundle, ${plan.n} slices (${Math.ceil(plan.n / PER_JOB)} sender job(s) needed of ${JOBS})`);
}

function plan() { return JSON.parse(fs.readFileSync(path.join(SEND, 'plan.json'), 'utf8')); }

function sums() {
  console.log(`::notice title=SUMS::${Buffer.from(JSON.stringify(plan())).toString('base64')}`);
}

function send(part, step) {
  const p = plan();
  const bundle = fs.readFileSync(path.join(SEND, 'bundle.tar'));
  const from = part * PER_JOB + step * PER_STEP, to = Math.min(from + PER_STEP, p.n);
  let sent = 0;
  for (let i = from; i < to; i++) {
    console.log(`::notice title=B|${i}|${p.n}::${bundle.subarray(i * CHUNK, Math.min((i + 1) * CHUNK, bundle.length)).toString('base64')}`);
    sent++;
  }
  console.error(`part ${part} step ${step}: sent ${sent} slices (${from}..${to - 1} of ${p.n})`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'prepare') prepare().catch((e) => { console.error(e); process.exit(1); });
else if (cmd === 'sums') sums();
else if (cmd === 'send') send(Number(a || 0), Number(b || 0));
else { console.error('usage: node tools/emit.js prepare | sums | send <part> <step>'); process.exit(2); }
