// Rebuilds the files that tools/emit.js sent as annotations, and checks every checksum.
//
//   tools/fetch-run.sh RUN_ID out-dir          (gets every job's annotations with `gh api`, then runs this)
//   node tools/reassemble.js annotations.json out-dir
//
// It also reads the plain log form (lines such as "::notice title=B|0|3::BASE64"), which is how the local test checks the round trip.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) { console.error('usage: node tools/reassemble.js <annotations.json | log.txt> <out-dir>'); process.exit(2); }
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

const raw = fs.readFileSync(input, 'utf8');
let items = [];
if (/^\s*[\[{]/.test(raw)) {
  // `gh api --paginate` prints one JSON array per page, back to back
  items = JSON.parse(raw.trim().replace(/\]\s*\[/g, ',')).map((a) => ({ title: a.title, message: a.message }));
} else {
  for (const line of raw.split(/\r?\n/)) {
    const m = /::notice title=([^:]+)::(.*)$/.exec(line);
    if (m) items.push({ title: m[1], message: m[2] });
  }
}

let plan = null;
const slices = {};
for (const a of items) {
  if (a.title === 'SUMS') { plan = JSON.parse(Buffer.from(a.message, 'base64').toString('utf8')); continue; }
  const m = /^B\|(\d+)\|(\d+)$/.exec(a.title || '');
  if (m) slices[Number(m[1])] = a.message;
}
if (!plan) { console.error('no SUMS annotation: the first job did not finish, or GitHub dropped it'); process.exit(1); }

const missing = [];
for (let i = 0; i < plan.n; i++) if (slices[i] === undefined) missing.push(i);
if (missing.length) { console.error(`MISSING slices (${missing.length} of ${plan.n}): ${missing.slice(0, 20).join(', ')}`); process.exit(1); }
const bundle = Buffer.concat(Array.from({ length: plan.n }, (_, i) => Buffer.from(slices[i], 'base64')));
if (bundle.length !== plan.bytes || sha(bundle) !== plan.sha256) { console.error(`CHECKSUM of the bundle differs (got ${bundle.length} bytes)`); process.exit(1); }

fs.mkdirSync(outDir, { recursive: true });
const tarFile = path.join(outDir, '.bundle.tar');
fs.writeFileSync(tarFile, bundle);
execFileSync('tar', ['-xf', tarFile, '-C', outDir]);
fs.rmSync(tarFile);

let bad = 0, ok = 0;
for (const [name, want] of Object.entries(plan.files)) {
  const f = path.join(outDir, name);
  if (!fs.existsSync(f)) { console.error(`MISSING ${name}`); bad++; continue; }
  const buf = fs.readFileSync(f);
  if (buf.length !== want.bytes || sha(buf) !== want.sha256) { console.error(`CHECKSUM ${name}`); bad++; continue; }
  ok++;
}
console.log(`${ok} files rebuilt and verified (${plan.n} slices, ${Math.round(plan.bytes / 1024)} KB), ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
