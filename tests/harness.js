// Hermetic test harness for LokalFinder.
// CRITICAL: the app writes to a LIVE production Firebase RTDB. Every request to
// that host is intercepted here and served from an in-memory fake, so no test
// order or booking can ever reach real vendor data.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = require('path').resolve(__dirname, '..');
const FB_HOST = 'lokalfinder-ec57f-default-rtdb.asia-southeast1.firebasedatabase.app';

// ── in-memory fake Realtime Database ──────────────────────────────
let DB = {};
const seg = p => p.split('/').filter(Boolean);
function get(p){
  let n = DB;
  for(const k of seg(p)){ if(n==null || typeof n!=='object') return null; n = n[k]; }
  return n === undefined ? null : n;
}
function set(p, val){
  const s = seg(p);
  if(!s.length){ DB = val; return; }
  let n = DB;
  for(let i=0;i<s.length-1;i++){ if(typeof n[s[i]]!=='object'||n[s[i]]===null) n[s[i]]={}; n=n[s[i]]; }
  // RTDB semantics: writing null (or []) deletes the key.
  if(val===null || (Array.isArray(val)&&val.length===0)) delete n[s[s.length-1]];
  else n[s[s.length-1]] = val;
}
function patch(p, val){
  const cur = get(p);
  set(p, Object.assign({}, (cur&&typeof cur==='object')?cur:{}, val));
}

function startServer(){
  return new Promise(res=>{
    const srv = http.createServer((req,rs)=>{
      const url = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, url === '/' ? 'index.html' : url);
      if(!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()){
        rs.writeHead(404); rs.end('nf'); return;
      }
      const ct = f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'application/javascript'
               : f.endsWith('.json') ? 'application/json' : 'text/plain';
      rs.writeHead(200,{'Content-Type':ct}); rs.end(fs.readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', ()=>res(srv));
  });
}

async function makePage(browser, log){
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();

  // Fake RTDB
  await page.route(`**://${FB_HOST}/**`, async route => {
    const req = route.request();
    const u = new URL(req.url());
    // Real RTDB REST requires a .json suffix. The old stub accepted paths
    // without one and returned 200, which made a silently-failing write look
    // like a successful write to a truncated key. Reject them, like the real
    // API does, so a bug of that shape can never pass a test again.
    if(!/\.json$/.test(u.pathname)){
      return route.fulfill({status:404, contentType:'text/plain',
        body:'stub: RTDB requires a .json suffix — got '+u.pathname});
    }
    const p = u.pathname.replace(/\.json$/, '');
    const m = req.method();
    let body = null;
    try{ body = req.postData() ? JSON.parse(req.postData()) : null; }catch(e){}
    if(m==='GET')         { return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify(get(p))}); }
    if(m==='PUT')         { set(p, body);   return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify(body)}); }
    if(m==='PATCH')       { patch(p, body); return route.fulfill({status:200, contentType:'application/json', body:JSON.stringify(body)}); }
    if(m==='DELETE')      { set(p, null);   return route.fulfill({status:200, contentType:'application/json', body:'null'}); }
    return route.fulfill({status:200, body:'null'});
  });

  // Block external CDNs (fonts, firebase sdk, onesignal) — keeps the run hermetic
  await page.route('**://fonts.googleapis.com/**', r=>r.abort());
  await page.route('**://fonts.gstatic.com/**',    r=>r.abort());
  await page.route('**://www.gstatic.com/**',      r=>r.fulfill({status:200,contentType:'application/javascript',body:'/*stub*/'}));
  await page.route('**://cdn.onesignal.com/**',    r=>r.fulfill({status:200,contentType:'application/javascript',body:'/*stub*/'}));

  page.on('pageerror', e => log.errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if(m.type()==='error') log.console.push(m.text()); });
  return { ctx, page };
}

// The installed playwright package pins a newer browser build than the image
// ships, so launch the pre-installed Chromium explicitly (per environment docs).
const EXEC = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const launch = () => chromium.launch(fs.existsSync(EXEC) ? { executablePath: EXEC } : {});

module.exports = { startServer, makePage, chromium, launch, DB:()=>DB, resetDB:()=>{DB={};} };
