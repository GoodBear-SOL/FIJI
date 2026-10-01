/* ============================================================
   FIJI TRADE PAD · TOKEN POPUP  v2
   Load AFTER tradepad.js (and BEFORE tradepad-gate.js):
     <script src="tradepad.js"></script>
     <script src="tradepad-popup.js"></script>
     <script src="tradepad-gate.js"></script>

   What's new in v2:
   - Contract address row with a Copy button.
   - Live market cap + price (DexScreener every 3s, plus a live
     trade stream for Pump bonding-curve tokens).
   - Holder count (RugCheck) next to the other status cells.
   - Sell side: if the wallet holds none of the token, the presets
     and the sell button are blocked, and a hint shows what you hold.
   - Styled confirm / pending / success / error windows for trades
     (window.FIJI_TRADE_UI). Used by the patched executeTrade().
   - Extra slippage options (15%, 25%).
   ============================================================ */
(function(){
'use strict';

const C=window.FIJI_CORE||{},T=window.FIJI_TRADE;
if(!T){console.warn('tradepad-popup: tradepad.js must load first');return}

const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast=C.toast||(m=>console.log('[FIJI]',m));
const num=v=>{if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};

const RC='https://api.rugcheck.xyz/v1/tokens/';
const DSO='https://api.dexscreener.com/orders/v1/solana/';
const DST='https://api.dexscreener.com/tokens/v1/solana/';
const SOL_MINT='So11111111111111111111111111111111111111112';

/* ---------------- formatters ---------------- */
const fmUsd=v=>{const n=num(v);if(n===null||n<=0)return '—';return '$'+(n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':n.toFixed(0))};
const fmNum=v=>{const n=num(v);return n===null?'—':n.toLocaleString(undefined,{maximumFractionDigits:n>=100?0:4})};
function fmPrice(v){
  const n=num(v);if(n===null||n<=0)return '—';
  if(n>=1000)return '$'+n.toLocaleString(undefined,{maximumFractionDigits:2});
  if(n>=1)return '$'+n.toFixed(n>=10?2:3);
  if(n>=0.01)return '$'+n.toFixed(4);
  const m=n.toFixed(20).match(/^0\.(0+)(\d{1,4})/);
  if(m&&m[1].length>=3)return '$0.0<sub>'+m[1].length+'</sub>'+m[2];
  return '$'+n.toPrecision(3);
}
const cls=v=>{const n=num(v);return n===null||Math.abs(n)<0.05?'flat':n>0?'up':'dn'};
function fmtAge(ts){
  const n=Number(ts);if(!n)return '—';
  const s=Math.max(1,Math.floor((Date.now()-(n<1e12?n*1000:n))/1000));
  const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
  return d?d+'d '+h+'h':h?h+'h '+m+'m':m?m+'m '+(s%60)+'s':s+'s';
}
const liq=p=>num(p&&p.liquidity&&p.liquidity.usd)||0;

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
.tm-ca{margin:12px 0 8px;font-size:12px;padding:8px 10px;gap:8px}
.tm-live{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 6px}
.tm-lv{background:#fff;border:2.5px solid var(--ink);border-radius:16px;padding:8px 12px;min-width:0}
.tm-lv span{display:block;font-size:12px;opacity:.7}
.tm-lv b{display:block;font:700 24px/1.15 Fredoka;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:color .3s}
.tm-lv b.tm-up{color:var(--upi)}
.tm-lv b.tm-dn{color:var(--dni)}
.tm-meta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.tm-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:7px;margin:8px 0}
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

/* trade confirm / progress / result windows */
.tx-modal{position:fixed;inset:0;background:rgba(18,48,92,.6);z-index:520;display:none;align-items:center;justify-content:center;padding:16px}
.tx-modal.on{display:flex}
.tx-sheet{width:100%;max-width:400px;max-height:92vh;overflow-y:auto;padding:20px;background:var(--bg);text-align:center}
.tx-ico{font-size:46px;display:block;line-height:1.2}
.tx-ico.spin{animation:float 1.6s ease-in-out infinite}
.tx-sheet h3{font-size:26px;margin:4px 0 2px}
.tx-tok{display:inline-flex;align-items:center;gap:8px;margin-top:4px;font:600 15px Fredoka}
.tx-tok img{width:26px;height:26px;border-radius:50%;border:2px solid var(--ink);object-fit:cover;background:var(--sb)}
.tx-rows{background:#fff;border:2.5px dashed var(--ink);border-radius:16px;padding:4px 12px;margin:14px 0;text-align:left}
.tx-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;font-size:14px;border-bottom:2px dashed var(--line)}
.tx-row:last-child{border-bottom:0}
.tx-row b{font-family:Fredoka;text-align:right;word-break:break-word}
.tx-acts{display:grid;gap:10px;margin-top:8px}
.tx-raw{font-size:11px;opacity:.65;word-break:break-all;margin-top:12px;text-align:left;background:#fff;border:2px dashed var(--line);border-radius:12px;padding:8px}
.tx-sheet p{margin:6px 0}
@media(max-width:760px){
 .tm-modal{align-items:flex-end;padding:10px 10px calc(10px + env(safe-area-inset-bottom))}
 .tx-modal{align-items:flex-end;padding:10px 10px calc(10px + env(safe-area-inset-bottom))}
 .tm-chart{height:230px}
 .tm-lv b{font-size:21px}
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
 <div class="mint tm-ca"><code id="tmCA">…</code><button class="btn sm alt" id="tmCopy" type="button">Copy</button></div>
 <div class="tm-live">
  <div class="tm-lv"><span>Market cap</span><b id="tmMc">…</b></div>
  <div class="tm-lv"><span>Price</span><b id="tmPrice">…</b></div>
 </div>
 <div class="tm-meta"><span class="live"><i></i><span id="tmLiveTxt">connecting…</span></span><span class="pill mk-chip flat" id="tmChg">24h —</span></div>
 <div class="tm-stats" id="tmStats"></div>
 <div class="tm-risks" id="tmRisks"></div>
 <div class="tm-chart" id="tmChart"></div>
 <p class="tm-note">Status data comes from RugCheck and DexScreener. It is informational only and can be wrong or late.</p>
 <div class="tm-slot" id="tmSlot"></div>
</div>`;
document.body.appendChild(modal);

const aside=document.querySelector('#trade aside');
if(aside)$('tmSlot').appendChild(aside);   // swap board + Token Check live in the popup

/* extra slippage options */
const slipSel=$('tradeSlippage');
if(slipSel&&!slipSel.querySelector('option[value="15"]')){
  ['15','25'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v+'%';slipSel.appendChild(o)});
}

/* sell hint line (under the % presets) */
const presetBox=document.querySelector('.presets');
if(presetBox){
  const h=document.createElement('div');
  h.id='tmSellHint';h.className='small';h.style.cssText='display:none;margin:-2px 0 8px';
  presetBox.insertAdjacentElement('afterend',h);
}

/* ---------------- helpers ---------------- */
async function getJson(url){
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),10000);
  try{const r=await fetch(url,{signal:ac.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}
  finally{clearTimeout(t)}
}
async function copyText(t){
  try{await navigator.clipboard.writeText(t);return true}
  catch(e){
    try{const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';document.body.appendChild(a);a.select();const ok=document.execCommand('copy');a.remove();return ok}
    catch(x){return false}
  }
}
const cell=(label,val,tone,tip)=>`<div class="tm-c ${tone||''}"${tip?` title="${esc(tip)}"`:''}><b>${esc(val)}</b><span>${label}</span></div>`;
function put(id,html){const el=$(id);if(el&&el.__h!==html){el.innerHTML=html;el.__h=html}}
function held(mint){
  const toks=(T.getState().portfolio&&T.getState().portfolio.tokens)||[];
  return toks.filter(t=>t&&t.mint===mint).reduce((s,t)=>s+(Number(t.tokenAmount&&t.tokenAmount.uiAmount)||0),0);
}

/* ---------------- state ---------------- */
let curMint='',curPair='',secData=null,tick=0,timer=null;
let live=null,liveAt=0,solUsd=null,stream=null,lastVal={};
let hooked=null,subMint='';
const secCache=new Map();

/* ---------------- security data (RugCheck + DexScreener orders) ---------------- */
async function getSec(mint,force){
  const c=secCache.get(mint);
  if(!force&&c&&Date.now()-c.t<60000)return c.d;
  const [a,b]=await Promise.allSettled([getJson(RC+encodeURIComponent(mint)+'/report'),getJson(DSO+encodeURIComponent(mint))]);
  const d={rc:a.status==='fulfilled'?a.value:null,ord:b.status==='fulfilled'&&Array.isArray(b.value)?b.value:null};
  secCache.set(mint,{t:Date.now(),d});
  return d;
}
function loadSec(mint,force){
  getSec(mint,force).then(d=>{
    if(mint!==curMint)return;
    secData=d;
    const p=T.getState().selected;if(p)paintStats(p);
  }).catch(()=>{});
}

/* ---------------- live market data ---------------- */
function mergeLive(sel,b){
  ['priceUsd','marketCap','fdv','liquidity','volume','priceChange','txns'].forEach(k=>{if(b[k]!=null)sel[k]=b[k]});
  if(!sel.pairAddress&&b.pairAddress)sel.pairAddress=b.pairAddress;
}
async function refreshLive(){
  const mint=curMint;if(!mint)return;
  try{
    const d=await getJson(DST+encodeURIComponent(mint));
    if(mint!==curMint)return;
    const pairs=(Array.isArray(d)?d:[]).filter(x=>x&&x.baseToken&&x.baseToken.address===mint);
    const b=pairs.reduce((m,x)=>!m||liq(x)>liq(m)?x:m,null);
    if(b){
      live=b;liveAt=Date.now();
      const sel=T.getState().selected;
      if(sel&&sel.baseToken&&sel.baseToken.address===mint)mergeLive(sel,b);
    }
  }catch(e){}
  paintLive();
}
async function refreshSol(){
  try{
    const d=await getJson(DST+SOL_MINT);
    const a=(Array.isArray(d)?d:[]).filter(x=>x&&x.baseToken&&x.baseToken.address===SOL_MINT&&Number(x.priceUsd)>0);
    const b=a.reduce((m,x)=>!m||liq(x)>liq(m)?x:m,null);
    if(b)solUsd=Number(b.priceUsd);
  }catch(e){}
}

/* Pump bonding-curve tokens: reuse tradepad.js's live socket (one connection only). */
function isCurve(p){
  const base=Boolean(p&&((p.bonding&&!p.migrated)||p.dexId==='pumpfun'));
  return base&&!(live&&live.dexId&&live.dexId!=='pumpfun');
}
function onMsg(ev){
  let d;try{d=JSON.parse(ev.data)}catch(e){return}
  if(!d||d.mint!==curMint||d.marketCapSol==null)return;
  const mc=Number(d.marketCapSol);if(!isFinite(mc)||mc<=0)return;
  stream={mcSol:mc,t:Date.now()};
  const sel=T.getState().selected;
  if(sel&&sel.baseToken&&sel.baseToken.address===curMint){
    const vs=Number(d.vSolInBondingCurve),vt=Number(d.vTokensInBondingCurve);
    if(isFinite(vs)&&vs>0)sel.vSolInBondingCurve=vs;
    if(isFinite(vt)&&vt>0)sel.vTokensInBondingCurve=vt;
    sel.marketCapSol=mc;
  }
  liveAt=Date.now();
  paintLive();
}
function unhook(){
  if(hooked){
    try{
      hooked.removeEventListener('message',onMsg);
      if(hooked.readyState===1&&subMint)hooked.send(JSON.stringify({method:'unsubscribeTokenTrade',keys:[subMint]}));
    }catch(e){}
  }
  hooked=null;subMint='';stream=null;
}
function syncStream(p){
  const sock=T.getState().ws;
  if(!isCurve(p)||!sock||sock.readyState!==1){if(hooked)unhook();return}
  if(hooked===sock&&subMint===curMint)return;
  unhook();
  hooked=sock;subMint=curMint;
  try{
    sock.addEventListener('message',onMsg);
    sock.send(JSON.stringify({method:'subscribeTokenTrade',keys:[curMint]}));
  }catch(e){hooked=null;subMint=''}
}

/* ---------------- painting ---------------- */
function metrics(p){
  let price=num(p.priceUsd),mc=num(p.marketCap)||num(p.fdv);
  if(stream&&solUsd&&isCurve(p)){
    const m=stream.mcSol*solUsd;
    if(m>0){mc=m;price=m/1e9}   // Pump tokens have 1B supply
  }
  return {price,mc};
}
function setLv(id,html,val){
  const el=$(id);if(!el)return;
  if(el.__h===html)return;
  const prev=lastVal[id];
  el.innerHTML=html;el.__h=html;
  if(prev!=null&&val!=null&&val!==prev){
    el.classList.remove('tm-up','tm-dn');void el.offsetWidth;
    el.classList.add(val>prev?'tm-up':'tm-dn');
    clearTimeout(el.__t);el.__t=setTimeout(()=>el.classList.remove('tm-up','tm-dn'),800);
  }
  lastVal[id]=val;
}
function paintLive(){
  const p=T.getState().selected;if(!p)return;
  const m=metrics(p);
  setLv('tmMc',fmUsd(m.mc),m.mc);
  setLv('tmPrice',fmPrice(m.price),m.price);
  const ch=num(p.priceChange&&p.priceChange.h24),chip=$('tmChg');
  if(chip){
    chip.className='pill mk-chip '+cls(ch);
    chip.textContent='24h '+(ch===null?'—':(ch>0?'+':'')+ch.toFixed(Math.abs(ch)>=100?0:1)+'%');
  }
  const sec=liveAt?Math.max(0,Math.round((Date.now()-liveAt)/1000)):null;
  $('tmLiveTxt').textContent=stream?'live · bonding curve trades':sec===null?'connecting…':'live · updated '+sec+'s ago';
}

function paintStats(p){
  const loading=!secData,rc=secData&&secData.rc;
  const pick=f=>loading?['…','']:rc?f(rc):['—','na','Security data unavailable right now'];
  const known=rc?.knownAccounts||{};
  const isPool=h=>{const k=known[h.address]||known[h.owner];return k&&/amm|pool|lp/i.test((k.type||'')+' '+(k.name||''))};

  const holders=pick(r=>{
    const n=num(r.totalHolders);
    return n===null?['—','na','Holder count not available yet']:[n.toLocaleString(),'','Total holder wallets (RugCheck)'];
  });
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

  put('tmStats',
    cell('Liquidity',fmUsd(liq(p)))+
    cell('Volume 24h',fmUsd(p.volume&&p.volume.h24))+
    cell('Holders',holders[0],holders[1],holders[2])+
    cell('Age',fmtAge(p.pairCreatedAt),'','Since the pair or launch was created')+
    cell('Top 10',top[0],top[1],top[2])+
    cell('Dev holding',dev[0],dev[1],dev[2])+
    cell('Bundles',bundles[0],bundles[1],bundles[2])+
    cell('Snipers','n/a','na','Sniper counts need a paid on-chain data source')+
    cell('Scam flags',flags[0],flags[1],flags[2])+
    cell('Risk',risk[0],risk[1])+
    cell('Dex paid',paid[0],paid[1],paid[2]));

  const order={danger:0,warn:1};
  const list=risks.slice().sort((a,b)=>(order[a.level]??2)-(order[b.level]??2)).slice(0,4);
  put('tmRisks',loading?'':rc?(list.length
    ?list.map(x=>`<span class="tm-r ${esc(x.level)}" title="${esc(x.description||'')}">${esc(x.name)}</span>`).join('')
    :'<span class="tm-r ok">No risks flagged</span>'):'');
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

/* Sell side: stop people from "selling" a token they don't hold. */
let sellBlocked=false;
function paintSell(){
  const st=T.getState(),p=st.selected,hint=$('tmSellHint'),btn=$('tradeExecuteButton');
  const sym=(p&&p.baseToken&&p.baseToken.symbol)||'TOKEN';
  let blocked=false;
  if(hint){
    if(p&&st.action==='sell'){
      const have=C.getWallet&&C.getWallet();
      if(!have){hint.textContent='Connect your wallet to sell.';hint.style.display='block'}
      else{
        const h=held(p.baseToken.address);
        if(h<=0){
          blocked=true;
          hint.innerHTML='You don’t hold any <b>'+esc(sym)+'</b>, so there is nothing to sell.';
          hint.style.display='block';
          const a=$('tradeAmount');
          if(a&&a.value!==''){a.value='';a.dispatchEvent(new Event('input'))}
        }else{
          const pct=num($('tradeAmount')&&$('tradeAmount').value);
          hint.innerHTML='You hold <b>'+fmNum(h)+' '+esc(sym)+'</b>'+(pct>0&&pct<=100?' · '+pct+'% ≈ <b>'+fmNum(h*pct/100)+'</b>':'');
          hint.style.display='block';
        }
      }
    }else hint.style.display='none';
  }
  document.querySelectorAll('.presets .preset').forEach(b=>{b.style.opacity=blocked?'.4':''});
  if(btn){
    if(blocked){btn.disabled=true;btn.textContent='No '+sym+' to sell';sellBlocked=true}
    else if(sellBlocked){
      btn.disabled=false;sellBlocked=false;
      btn.textContent=p?(st.action==='buy'?'BUY NOW':'SELL NOW'):'Select a token';
    }
  }
}

function paint(){
  const p=T.getState().selected;
  if(!p)return;
  const mint=p.baseToken?.address||'';
  if(mint!==curMint){
    curMint=mint;curPair='';secData=null;live=null;liveAt=0;lastVal={};
    unhook();
    $('tmChart').innerHTML='';
    loadSec(mint);refreshLive();
    if(!solUsd)refreshSol();
  }
  const img=$('tmIcon'),src=p.info?.imageUrl||'';
  img.src=/^https?:\/\//i.test(src)?src:'fiji.png';
  $('tmSym').textContent=p.baseToken?.symbol||'TOKEN';
  $('tmName').textContent=(p.baseToken?.name||'')+' · '+(p.dexId||'Solana');
  $('tmCA').textContent=mint||'—';
  paintStats(p);paintLive();paintChart(p);paintStar(p);paintSell();
}

/* ---------------- open / close ---------------- */
function openModal(){
  curMint='';live=null;liveAt=0;lastVal={};
  unhook();
  $('tmSym').textContent='…';$('tmName').textContent='Loading token…';$('tmCA').textContent='…';
  ['tmMc','tmPrice'].forEach(id=>{const e=$(id);if(e){e.innerHTML='…';e.__h='…'}});
  put('tmStats','');put('tmRisks','');$('tmChart').innerHTML='';
  modal.classList.add('on');
  document.body.style.overflow='hidden';
  clearInterval(timer);tick=0;
  timer=setInterval(()=>{
    tick++;
    const p=T.getState().selected;if(!p)return;
    if(tick%3===0)refreshLive();                              // market cap + price every ~3s
    if(tick%30===0&&curMint)loadSec(curMint,true);            // status every ~30s
    if(tick%30===1||(!solUsd&&tick%5===0))refreshSol();       // SOL price for curve market cap
    syncStream(p);
    paintStats(p);paintLive();paintChart(p);paintStar(p);paintSell();
  },1000);
}
function closeModal(){
  modal.classList.remove('on');
  document.body.style.overflow='';
  clearInterval(timer);timer=null;
  unhook();live=null;
  $('tmChart').innerHTML='';curPair='';
}
$('tmX').onclick=closeModal;
modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('on')&&!$$tx.classList.contains('on'))closeModal()});
$('tmStar').onclick=()=>{Promise.resolve(window.tradeToggleWatch()).then(()=>paintStar(T.getState().selected))};

/* copy contract address */
$('tmCopy').onclick=async()=>{
  if(!curMint)return toast('Token address is not ready yet');
  const ok=await copyText(curMint);
  const b=$('tmCopy');
  toast(ok?'Contract copied 💧':'Copy failed. Press and hold the address instead.');
  if(ok){b.textContent='Copied ✓';setTimeout(()=>b.textContent='Copy',1400)}
};
$('tmCA').onclick=()=>$('tmCopy').click();

/* ---------------- hooks into tradepad.js ---------------- */
const origSelect=window.tradeSelectByKey;
window.tradeSelectByKey=async function(key){
  openModal();
  try{await origSelect(key)}catch(e){console.warn('Token select failed',e)}
  paint();
};

const origPreset=window.tradeSetPreset;
window.tradeSetPreset=function(){
  const st=T.getState(),p=st.selected;
  if(st.action==='sell'&&p&&C.getWallet&&C.getWallet()&&held(p.baseToken.address)<=0){
    toast('You don’t hold any '+(p.baseToken.symbol||'of this token')+' to sell');
    paintSell();return;
  }
  const r=origPreset.apply(this,arguments);
  paintSell();
  return r;
};

const origAction=window.tradeSetAction;
window.tradeSetAction=function(){const r=origAction.apply(this,arguments);paintSell();return r};
const origFlip=window.tradeFlipSide;
window.tradeFlipSide=function(){const r=origFlip.apply(this,arguments);paintSell();return r};

const origExec=window.tradeExecute;
window.tradeExecute=function(){
  const st=T.getState(),p=st.selected;
  if(st.action==='sell'&&p&&C.getWallet&&C.getWallet()&&held(p.baseToken.address)<=0){
    toast('You don’t hold any '+(p.baseToken.symbol||'of this token')+' to sell');
    paintSell();return;
  }
  return origExec.apply(this,arguments);
};
const amtBox=$('tradeAmount');
if(amtBox)amtBox.addEventListener('input',paintSell);

/* ============================================================
   TRADE WINDOWS: confirm, progress, success, error
   Used by executeTrade() in tradepad.js (see the patch notes).
============================================================ */
const tx=document.createElement('div');
tx.className='tx-modal';
tx.innerHTML='<div class="sticker tx-sheet" role="dialog" aria-modal="true"></div>';
document.body.appendChild(tx);
const $$tx=tx;                       // used by the Escape handler above
const sheet=tx.firstChild;
let txResolve=null,txCanClose=false;

function txOpen(){tx.classList.add('on')}
function txClose(){
  tx.classList.remove('on');
  if(txResolve){const r=txResolve;txResolve=null;r(false)}
}
tx.addEventListener('click',e=>{if(e.target===tx&&txCanClose)txClose()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&tx.classList.contains('on')&&txCanClose)txClose()});

const row=(k,v)=>v?`<div class="tx-row"><span>${esc(k)}</span><b>${esc(v)}</b></div>`:'';
const tokChip=info=>{
  const img=/^https?:\/\//i.test((info&&info.image)||'')?`<img src="${esc(info.image)}" alt="">`:'';
  return `<div class="tx-tok">${img}<span>${esc((info&&info.symbol)||'TOKEN')} · Solana</span></div>`;
};
const scan=sig=>sig?`<a class="btn sm alt" href="https://solscan.io/tx/${encodeURIComponent(sig)}" target="_blank" rel="noopener">View on Solscan</a>`:'';

function uiConfirm(info){
  return new Promise(res=>{
    const buy=info.side==='buy';
    txCanClose=true;txResolve=res;
    sheet.innerHTML=
      `<span class="tx-ico">${buy?'🛒':'💰'}</span><h3>${buy?'Confirm buy':'Confirm sell'}</h3>${tokChip(info)}
       <div class="tx-rows">
        ${row('You pay',info.pay)}
        ${row('You receive (est.)',info.receive?info.receive+' '+(buy?info.symbol:'SOL'):'')}
        ${row('Slippage',info.slippage)}
        ${row('Route',info.route)}
        ${row('FIJI fee',info.fijiFee)}
        ${row('Provider fee',info.provFee)}
       </div>
       <p class="small">Your wallet will ask you to sign next. FIJI never has your private key.</p>
       <div class="tx-acts">
        <button class="btn" type="button" data-ok style="background:${buy?'#2FCB7B':'#FF5C7A'};color:var(--ink)">${buy?'Confirm buy':'Confirm sell'}</button>
        <button class="btn alt" type="button" data-no>Cancel</button>
       </div>`;
    sheet.querySelector('[data-ok]').onclick=()=>{txResolve=null;res(true)};
    sheet.querySelector('[data-no]').onclick=()=>txClose();
    txOpen();
  });
}

function uiPending(info,title,text,sig){
  txCanClose=false;txResolve=null;
  sheet.innerHTML=
    `<span class="tx-ico spin">💧</span><h3>${esc(title)}</h3>${tokChip(info)}
     <p>${esc(text||'')}</p>
     ${sig?`<div class="tx-acts">${scan(sig)}</div>`:''}`;
  txOpen();
}

function uiResult(o){
  txCanClose=true;txResolve=null;
  const info=o.info||{},icon=o.ok===true?'🎉':o.ok===null?'⏳':'😵';
  sheet.innerHTML=
    `<span class="tx-ico">${icon}</span><h3>${esc(o.title||'')}</h3>${tokChip(info)}
     <p>${esc(o.text||'')}</p>
     ${o.ok===true?`<div class="tx-rows">${row(info.side==='buy'?'Paid':'Sold',info.pay)}${row('Slippage',info.slippage)}</div>`:''}
     ${o.raw?`<div class="tx-raw">${esc(o.raw)}</div>`:''}
     <div class="tx-acts">${scan(o.sig)}<button class="btn" type="button" data-done>${o.ok===true?'Done':'Close'}</button></div>`;
  sheet.querySelector('[data-done]').onclick=()=>txClose();
  txOpen();
}

function explain(err){
  const m=String((err&&err.message)||err||'');
  if((err&&err.code===4001)||/reject|denied|declin|cancel/i.test(m))return {cancel:true};
  if(/0x1771|0x1772|0x1773|"Custom":\s*600[123]|slippage|TooMuchSolRequired|TooLittleSolReceived/i.test(m))
    return {title:'Price moved too fast',text:'The price changed before your trade landed. Try again with higher slippage. New tokens usually need 15% or 25%.'};
  if(/insufficient (lamports|funds)|custom program error: 0x1\b|not enough sol/i.test(m))
    return {title:'Not enough SOL',text:'Your wallet does not have enough SOL for this trade plus network fees. Try a smaller amount.'};
  if(/blockhash|expired|block height/i.test(m))
    return {title:'Transaction expired',text:'It took too long to approve. Please try again and approve quickly.'};
  if(/no route|could_not_find|not tradable|route not found/i.test(m))
    return {title:'No route found',text:'There is no swap route for this token right now. It may be too new or have no liquidity yet.'};
  if(/failed to fetch|networkerror|load failed|timed out/i.test(m))
    return {title:'Could not reach the trade router',text:'Check your connection and try again. If it keeps happening, the router may be offline.'};
  if(/not configured|JUPITER_API_KEY|FEE_ACCOUNT/i.test(m))
    return {title:'Trade router is not ready',text:'The trade router is missing some setup on the server. Please try again later.'};
  return {title:'Trade failed',text:'Something went wrong while building or sending your trade.'};
}

function uiFail(err,info,sig){
  const e=explain(err);
  if(e.cancel){txClose();toast('Trade cancelled');return}
  uiResult({ok:false,info,sig,title:e.title,text:e.text,raw:String((err&&err.message)||err||'')});
}

window.FIJI_TRADE_UI={
  confirm:uiConfirm,
  pending:uiPending,
  result:uiResult,
  fail:uiFail,
  close:txClose
};

})();
