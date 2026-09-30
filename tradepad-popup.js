/* ============================================================
   FIJI TRADE PAD · TOKEN POPUP
   Load AFTER tradepad.js:
     <script src="tradepad.js"></script>
     <script src="tradepad-popup.js"></script>

   What it does:
   - Hides the swap board until a coin is clicked.
   - Opens a popup: token status, live chart, then the swap board.
   - Status data: RugCheck (holders, dev, insiders, risks) and
     DexScreener (dex paid). Both are free, no key needed.
   Nothing in index.html or tradepad.js is changed.
   ============================================================ */
(function(){
'use strict';

const C=window.FIJI_CORE||{},T=window.FIJI_TRADE;
if(!T){console.warn('tradepad-popup: tradepad.js must load first');return}
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const RC='https://api.rugcheck.xyz/v1/tokens/';
const DSO='https://api.dexscreener.com/orders/v1/solana/';

/* ---------------- styles (same sticker look as the site) ---------------- */
const css=document.createElement('style');
css.textContent=`
#trade .tlayout{grid-template-columns:1fr}
#trade .selected-card{display:none}
#tradeList{grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.tm-modal{position:fixed;inset:0;background:rgba(18,48,92,.45);z-index:450;display:none;align-items:center;justify-content:center;padding:16px}
.tm-modal.on{display:flex}
.tm-sheet{width:100%;max-width:480px;max-height:94vh;overflow-y:auto;padding:14px;background:var(--bg)}
.tm-head{display:flex;align-items:center;gap:10px}
.tm-head img{width:48px;height:48px;border-radius:50%;border:3px solid var(--ink);object-fit:cover;background:var(--sb);flex:none}
.tm-title{flex:1;min-width:0}
.tm-title b{display:block;font:700 24px Fredoka;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-title span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-ib{width:40px;height:40px;border:2.5px solid var(--ink);border-radius:50%;background:#fff;cursor:pointer;font:600 18px Fredoka;flex:none}
.tm-ib.on{background:var(--sun)}
.tm-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:7px;margin:12px 0 8px}
.tm-c{background:var(--sb);border:2px solid var(--ink);border-radius:13px;padding:7px 8px;min-width:0}
.tm-c b{display:block;font:600 15px Fredoka;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tm-c span{display:block;font-size:11px;opacity:.7}
.tm-c.good{background:#B8F5D2}
.tm-c.warn{background:#FFF1B8}
.tm-c.bad{background:#FFD0D8}
.tm-c.na{opacity:.6}
.tm-risks{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.tm-r{border:2px solid var(--ink);border-radius:99px;padding:1px 10px;font:600 12px Fredoka;background:#fff}
.tm-r.danger{background:#FFD0D8}
.tm-r.warn{background:#FFF1B8}
.tm-r.ok{background:#B8F5D2}
.tm-chart{height:260px;border:3px solid var(--ink);border-radius:18px;background:#fff;overflow:hidden;margin:0 0 12px;display:flex;align-items:center;justify-content:center;text-align:center;padding:0}
.tm-chart span{padding:16px;font:600 14px Fredoka;opacity:.65}
.tm-chart iframe{width:100%;height:100%;border:0;display:block}
.tm-note{font-size:12px;opacity:.7;margin-bottom:10px}
.tm-slot aside{order:0}
.tm-slot .swap-card{position:static}
@media(max-width:760px){
 .tm-modal{align-items:flex-end;padding:10px 10px calc(10px + env(safe-area-inset-bottom))}
 .tm-chart{height:230px}
}
`;
document.head.appendChild(css);

/* ---------------- popup shell ---------------- */
const modal=document.createElement('div');
modal.className='tm-modal';
modal.innerHTML=`<div class="sticker tm-sheet" role="dialog" aria-label="Token details">
 <div class="tm-head">
  <img id="tmIcon" src="fiji.png" alt="">
  <div class="tm-title"><b id="tmSym">…</b><span class="small" id="tmName"></span></div>
  <button class="tm-ib" id="tmStar" type="button" aria-label="Watchlist">☆</button>
  <button class="tm-ib" id="tmX" type="button" aria-label="Close">✕</button>
 </div>
 <div class="tm-stats" id="tmStats"></div>
 <div class="tm-risks" id="tmRisks"></div>
 <div class="tm-chart" id="tmChart"></div>
 <p class="tm-note">Status data comes from RugCheck and DexScreener. It is informational only and can be wrong or late.</p>
 <div class="tm-slot" id="tmSlot"></div>
</div>`;
document.body.appendChild(modal);

const aside=document.querySelector('#trade aside');
if(aside)$('tmSlot').appendChild(aside);   // swap board + Token Check now live in the popup

/* ---------------- helpers ---------------- */
async function getJson(url){
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),10000);
  try{const r=await fetch(url,{signal:ac.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}
  finally{clearTimeout(t)}
}
function fmtAge(ts){
  const n=Number(ts);if(!n)return '—';
  const s=Math.max(1,Math.floor((Date.now()-(n<1e12?n*1000:n))/1000));
  const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
  return d?d+'d '+h+'h':h?h+'h '+m+'m':m?m+'m '+(s%60)+'s':s+'s';
}
const cell=(label,val,tone,tip)=>`<div class="tm-c ${tone||''}"${tip?` title="${esc(tip)}"`:''}><b>${esc(val)}</b><span>${label}</span></div>`;

/* ---------------- security data ---------------- */
const cache=new Map();
async function getSec(mint,force){
  const c=cache.get(mint);
  if(!force&&c&&Date.now()-c.t<60000)return c.d;
  const [a,b]=await Promise.allSettled([getJson(RC+encodeURIComponent(mint)+'/report'),getJson(DSO+encodeURIComponent(mint))]);
  const d={rc:a.status==='fulfilled'?a.value:null,ord:b.status==='fulfilled'&&Array.isArray(b.value)?b.value:null};
  cache.set(mint,{t:Date.now(),d});
  return d;
}

let curMint='',curPair='',secData=null,tick=0,timer=null;

function loadSec(mint,force){
  getSec(mint,force).then(d=>{
    if(mint!==curMint)return;
    secData=d;
    const p=T.getState().selected;if(p)paintStats(p);
  }).catch(()=>{});
}

/* ---------------- painting ---------------- */
function paintStats(p){
  const loading=!secData,rc=secData&&secData.rc;
  const pick=f=>loading?['…','']:rc?f(rc):['—','na','Security data unavailable right now'];
  const known=rc?.knownAccounts||{};
  const isPool=h=>{const k=known[h.address]||known[h.owner];return k&&/amm|pool|lp/i.test((k.type||'')+' '+(k.name||''))};

  const top=pick(r=>{
    const hs=(r.topHolders||[]).filter(h=>!isPool(h));
    if(!hs.length)return ['—','na','No holder data'];
    const t=hs.slice(0,10).reduce((s,h)=>s+(Number(h.pct)||0),0);
    return [t.toFixed(1)+'%',t>50?'bad':t>30?'warn':'good','Top 10 wallets, liquidity pools excluded'];
  });
  const dev=pick(r=>{
    const cr=r.creator;let v=null;
    const hit=(r.topHolders||[]).find(h=>cr&&(h.address===cr||h.owner===cr));
    if(hit)v=Number(hit.pct);
    else if(r.creatorBalance!=null&&r.token&&Number(r.token.supply)>0)v=Number(r.creatorBalance)/Number(r.token.supply)*100;
    if(v===null||!isFinite(v))return ['—','na','Dev wallet not found'];
    return [v.toFixed(1)+'%',v>10?'bad':v>3?'warn':'good','Share of supply held by the creator wallet'];
  });
  const bundles=pick(r=>{
    const w=Number(r.graphInsidersDetected)||0,nets=(r.insiderNetworks||[]).length;
    const pct=(r.topHolders||[]).filter(h=>h.insider).reduce((s,h)=>s+(Number(h.pct)||0),0);
    if(!w&&!nets)return ['None','good','No linked insider wallets detected'];
    return [w+' wallets',w>=5||pct>15?'bad':'warn',nets+' network(s) · '+pct.toFixed(1)+'% held by top insider holders'];
  });
  const risks=(rc&&rc.risks)||[];
  const danger=risks.filter(x=>x.level==='danger').length,warn=risks.filter(x=>x.level==='warn').length;
  const flags=pick(r=>{
    if(r.rugged)return ['Rugged','bad','RugCheck marks this token as rugged'];
    return [danger?danger+' found':'None',danger?'bad':'good','Danger-level flags from RugCheck'];
  });
  const risk=pick(r=>{
    if(r.rugged)return ['Rugged','bad'];
    return danger?['High','bad']:warn?['Medium','warn']:['Low','good'];
  });
  const paid=loading?['…','']:secData.ord==null?['—','na','DexScreener orders unavailable']:(()=>{
    const ok=secData.ord.filter(o=>o.status==='approved');
    return ok.length?['Paid ✔','good',ok.map(o=>o.type).join(', ')]:['Not paid','warn','No approved DexScreener orders'];
  })();

  $('tmStats').innerHTML=
    cell('Age',fmtAge(p.pairCreatedAt),'','Since the pair or launch was created')+
    cell('Top 10',top[0],top[1],top[2])+
    cell('Dev holding',dev[0],dev[1],dev[2])+
    cell('Snipers','n/a','na','Sniper counts need a paid on-chain data source')+
    cell('Scam flags',flags[0],flags[1],flags[2])+
    cell('Risk',risk[0],risk[1])+
    cell('Bundles',bundles[0],bundles[1],bundles[2])+
    cell('Dex paid',paid[0],paid[1],paid[2]);

  const order={danger:0,warn:1};
  const list=risks.slice().sort((a,b)=>(order[a.level]??2)-(order[b.level]??2)).slice(0,4);
  $('tmRisks').innerHTML=loading?'':rc?(list.length
    ?list.map(x=>`<span class="tm-r ${esc(x.level)}" title="${esc(x.description||'')}">${esc(x.name)}</span>`).join('')
    :'<span class="tm-r ok">No risks flagged</span>'):'';
}

function paintChart(p){
  const pa=p.pairAddress||'',box=$('tmChart');
  if(pa===curPair&&box.firstChild)return;
  curPair=pa;
  if(!/^[A-Za-z0-9]{20,}$/.test(pa)){
    box.innerHTML='<span>The live chart appears as soon as this token has a DexScreener pair 💧</span>';
    return;
  }
  box.innerHTML='<iframe title="Live chart" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" src="https://dexscreener.com/solana/'+pa+'?embed=1&theme=light&trades=0&info=0"></iframe>';
}

function paintStar(p){
  const w=T.getState().watch,on=Boolean(p&&w&&w.has('solana:'+(p.baseToken?.address||'')));
  const b=$('tmStar');b.classList.toggle('on',on);b.textContent=on?'★':'☆';
}

function paint(){
  const p=T.getState().selected;
  if(!p)return;
  const mint=p.baseToken?.address||'';
  if(mint!==curMint){curMint=mint;curPair='';secData=null;$('tmChart').innerHTML='';loadSec(mint)}
  const img=$('tmIcon'),src=p.info?.imageUrl||'';
  img.src=/^https?:\/\//i.test(src)?src:'fiji.png';
  $('tmSym').textContent=p.baseToken?.symbol||'TOKEN';
  $('tmName').textContent=(p.baseToken?.name||'')+' · '+(p.dexId||'Solana');
  paintStats(p);paintChart(p);paintStar(p);
}

/* ---------------- open / close ---------------- */
function openModal(){
  curMint='';
  $('tmSym').textContent='…';$('tmName').textContent='Loading token…';
  $('tmStats').innerHTML='';$('tmRisks').innerHTML='';$('tmChart').innerHTML='';
  modal.classList.add('on');
  document.body.style.overflow='hidden';
  clearInterval(timer);tick=0;
  timer=setInterval(()=>{
    tick++;
    const p=T.getState().selected;if(!p)return;
    if(tick%10===0&&curMint)loadSec(curMint,true);   // refresh status every ~30s
    paintStats(p);paintChart(p);paintStar(p);          // keeps age ticking and picks up a new pair
  },3000);
}
function closeModal(){
  modal.classList.remove('on');
  document.body.style.overflow='';
  clearInterval(timer);timer=null;
  $('tmChart').innerHTML='';curPair='';
}
$('tmX').onclick=closeModal;
modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('on'))closeModal()});
$('tmStar').onclick=()=>{Promise.resolve(window.tradeToggleWatch()).then(()=>paintStar(T.getState().selected))};

/* ---------------- hook: clicking a coin card ---------------- */
const original=window.tradeSelectByKey;
window.tradeSelectByKey=async function(key){
  openModal();
  try{await original(key)}catch(e){console.warn('Token select failed',e)}
  paint();
};

})();
