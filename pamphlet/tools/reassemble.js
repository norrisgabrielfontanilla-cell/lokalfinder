// Rebuilds the files that tools/emit.js sent as annotations, and checks every checksum.
//
//   gh api "repos/OWNER/REPO/check-runs/JOB_ID/annotations?per_page=100" --paginate > annotations.json
//   node tools/reassemble.js annotations.json out-dir
//
// It also reads the plain log form (lines such as "::notice title=F|name|0|3::BASE64"), which is how the local test checks the round trip.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) { console.error('usage: node tools/reassemble.js <annotations.json | log.txt> <out-dir>'); process.exit(2); }

const raw = fs.readFileSync(input, 'utf8');
let items = [];
if (/^\s*[\[{]/.test(raw)) {
  // `gh api --paginate` prints one JSON array per page, back to back
  const text = raw.trim().replace(/\]\s*\[/g, ',');
  items = JSON.parse(text).map((a) => ({ title: a.title, message: a.message }));
} else {
  for (const line of raw.split(/\r?\n/)) {
    const m = /::notice title=([^:]+)::(.*)$/.exec(line);
    if (m) items.push({ title: m[1], message: m[2] });
  }
}

const parts = {};
let sums = null;
for (const a of items) {
  if (a.title === 'SUMS') { sums = JSON.parse(Buffer.from(a.message, 'base64').toString('utf8')); continue; }
  const m = /^F\|(.+)\|(\d+)\|(\d+)$/.exec(a.title || '');
  if (!m) continue;
  (parts[m[1]] = parts[m[1]] || { n: Number(m[3]), chunks: {} }).chunks[Number(m[2])] = a.message;
}
if (!sums) { console.error('no SUMS annotation: the run did not finish sending, or GitHub dropped it'); process.exit(1); }

let bad = 0, ok = 0;
fs.mkdirSync(outDir, { recursive: true });
for (const [name, want] of Object.entries(sums)) {
  const p = parts[name];
  const have = p ? Object.keys(p.chunks).length : 0;
  if (!p || have !== p.n) { console.error(`MISSING ${name}: ${have}/${p ? p.n : '?'} slices`); bad++; continue; }
  const buf = Buffer.concat(Array.from({ length: p.n }, (_, i) => Buffer.from(p.chunks[i], 'base64')));
  const got = crypto.createHash('sha256').update(buf).digest('hex');
  if (got !== want.sha256 || buf.length !== want.bytes) { console.error(`CHECKSUM ${name}`); bad++; continue; }
  const dest = path.join(outDir, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  ok++;
}
console.log(`${ok} files rebuilt and verified, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
