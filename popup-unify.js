/* ============================================================
   FIJI TRADE PAD · UNIFIED COIN POPUP  v1
   Load RIGHT AFTER tradepad-popup.js (before tradepad-gate.js):
     <script src="tradepad.js"></script>
     <script src="tradepad-popup.js"></script>
     <script src="popup-unify.js"></script>
     <script src="tradepad-gate.js"></script>

   Gives EVERY coin the same popup (New, Trending, Bonding,
   Migrated, Watchlist and All coins):

     Logo | Ticker · Age                  ☆ | ✕
     Contract address  [Copy]
     Market cap | Price | 1h volume
     DexScreener chart
     Risk status (cells + flags)
     X | Telegram | Website

   - Solana coins keep the full RugCheck cells, the RUGGED! stamp
     and the swap box from tradepad-popup.js. This file only
     re-orders them and adds age, 1h volume and the social links.
   - Other chains (ETH, BNB, Base...) open in the same popup, view
     only, with the market-data risk flags. window.FIJI_OPEN_VIEW
     is what all-coins.js calls for them.
   Nothing in tradepad-popup.js is changed.
   ============================================================ */
(function(){
'use strict';
const C=window.FIJI_CORE||{},T=window.FIJI_TRADE;
const $=id=>document.getElementById(id);
const modal=document.querySelector('.tm-modal');
if(!T||!modal||!$('tmStats')){console.warn('popup-unify: load it after tradepad-popup.js');return}
const toast=C.toast||(m=>console.log('[FIJI]',m));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};
const https=u=>/^https:\/\//i.test(u||'')?String(u):'';
const fmUsd=v=>{const n=num(v);if(n===null||n<=0)return '—';return '$'+(n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':n.toFixed(0))};
function fmPrice(v){
 const n=num(v);if(n===null||n<=0)return '—';
 if(n>=1000)return '$'+n.toLocaleString(undefined,{maximumFractionDigits:2});
 if(n>=1)return '$'+n.toFixed(n>=10?2:3);
 if(n>=0.01)return '$'+n.toFixed(4);
 const m=n.toFixed(20).match(/^0\.(0+)(\d{1,4})/);
 if(m&&m[1].length>=3)return '$0.0<sub>'+m[1].length+'</sub>'+m[2];
 return '$'+n.toPrecision(3);
}
function fmtAge(ts){
 const n=Number(ts);if(!n)return '';
 const s=Math.max(1,Math.floor((Date.now()-(n<1e12?n*1000:n))/1000));
 const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
 return d?d+'d '+h+'h':h?h+'h '+m+'m':m?m+'m':s+'s';
}
const cls=v=>{const n=num(v);return n===null||Math.abs(n)<0.05?'flat':n>0?'up':'dn'};
const DEX={pumpfun:'Pump.fun',pumpswap:'PumpSwap',raydium:'Raydium',meteora:'Meteora',orca:'Orca',uniswap:'Uniswap',pancakeswap:'PancakeSwap',aerodrome:'Aerodrome'};
const dexName=id=>DEX[id]||(id?id.charAt(0).toUpperCase()+id.slice(1):'—');
const CHAIN_NAMES={solana:'Solana',ethereum:'Ethereum',bsc:'BNB Chain',base:'Base',arbitrum:'Arbitrum',polygon:'Polygon',avalanche:'Avalanche'};
const WATCH_CHAINS=['solana','ethereum','bsc','base'];   // chains the watchlist SQL accepts

/* ---------------- styles ---------------- */
const css=document.createElement('style');
css.textContent=`
.tm-live{grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important}
.tm-lv{padding:7px 9px!important}
.tm-lv span{font-size:11px!important}
.tm-lv b{font-size:18px!important}
.tm-trow{display:flex;align-items:center;gap:8px;min-width:0}
.tm-trow b{min-width:0;flex:0 1 auto}
.tm-age{flex:none;border:2px solid var(--ink);border-radius:99px;padding:0 9px;font:600 12px Fredoka,sans-serif;background:#fff}
.tm-age:empty{display:none}
.tm-sec{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:6px 0;font:600 17px Fredoka,sans-serif}
.tm-secb{font:600 12px Fredoka,sans-serif;border:2px solid var(--ink);border-radius:99px;padding:0 10px;background:#fff}
.tm-secb:empty{display:none}
.tm-secb.good{background:#B8F5D2}.tm-secb.warn{background:#FFF1B8}.tm-secb.bad{background:#FFD0D8}
.tm-soc{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
.tm-sb{display:inline-flex;align-items:center;gap:5px;border:2.5px solid var(--ink);border-radius:99px;padding:5px 14px;background:var(--sun);color:var(--ink);text-decoration:none;font:600 14px Fredoka,sans-serif}
.tm-sb.off{background:#fff;opacity:.45}
.tm-vnote{display:none;font-size:12px;opacity:.75;margin:6px 0 4px}
.tm-view #tmSlot,.tm-view .tm-note{display:none}
.tm-view .tm-vnote{display:block}
`;
document.head.appendChild(css);

/* ---------------- re-order + add pieces ---------------- */
const sym=$('tmSym'),chart=$('tmChart'),stats=$('tmStats'),risks=$('tmRisks');
const row=document.createElement('div');row.className='tm-trow';
sym.parentNode.insertBefore(row,sym);row.appendChild(sym);
const ageEl=document.createElement('span');ageEl.className='tm-age';ageEl.id='tmAge';row.appendChild(ageEl);

const vol1=document.createElement('div');
vol1.className='tm-lv';vol1.innerHTML='<span>1h volume</span><b id="tmV1">…</b>';
document.querySelector('.tm-live').appendChild(vol1);

const sec=document.createElement('div');sec.className='tm-sec';
sec.innerHTML='<span>🛡 Risk status</span><span class="tm-secb" id="tmSecB"></span>';
stats.before(chart);          // chart first
chart.after(sec);             // then Risk status
const soc=document.createElement('div');soc.className='tm-soc';soc.id='tmSoc';
risks.after(soc);             // then X | TG | Website
const vnote=document.createElement('p');vnote.className='tm-vnote';
vnote.textContent='Trading and the holder, bundle and fresh-wallet checks are Solana-only, so this coin is view-only here. Flags come from DexScreener market data and are not a guarantee.';
soc.after(vnote);

/* ---------------- socials ---------------- */
const meta=new Map();
function ensureMeta(p){
 const m=p.baseToken&&p.baseToken.address,u=p.metadataUri;
 if(!m||!u||meta.has(m))return;
 meta.set(m,{});
 fetch(u,{signal:AbortSignal.timeout?AbortSignal.timeout(6000):undefined}).then(r=>r.ok?r.json():null)
  .then(j=>{if(j)meta.set(m,{twitter:https(j.twitter),telegram:https(j.telegram),website:https(j.website)})}).catch(()=>{});
}
function socials(p){
 const i=p.info||{},s=Array.isArray(i.socials)?i.socials:[],w=Array.isArray(i.websites)?i.websites:[];
 const l=Array.isArray(p.profile&&p.profile.links)?p.profile.links:[];
 const m=meta.get(p.baseToken&&p.baseToken.address)||{};
 const find=t=>{
  const a=s.find(x=>String(x.type).toLowerCase()===t)||l.find(x=>String(x.type).toLowerCase()===t||String(x.label).toLowerCase()===t);
  return https(a&&a.url);
 };
 const web=https(w[0]&&w[0].url)||https((l.find(x=>/website/i.test(x.type+' '+x.label))||{}).url)||m.website||'';
 return {x:find('twitter')||m.twitter||'',tg:find('telegram')||m.telegram||'',web};
}
function paintSoc(p){
 ensureMeta(p);
 const s=socials(p);
 const item=(url,ic,lb)=>url?`<a class="tm-sb" href="${esc(url)}" target="_blank" rel="noopener">${ic} ${lb}</a>`:`<span class="tm-sb off" title="Not linked">${ic} ${lb}</span>`;
 const html=item(s.x,'𝕏','X')+item(s.tg,'✈️','Telegram')+item(s.web,'🌐','Website');
 if(soc.__h!==html){soc.innerHTML=html;soc.__h=html}
}

/* ---------------- shared painting (age, 1h volume, risk badge, socials) ---------------- */
let view=null,viewRisk=null,viewChart='';
function paintExtras(p){
 ageEl.textContent=fmtAge(p.pairCreatedAt);
 const v=fmUsd(p.volume&&p.volume.h1);
 if($('tmV1').textContent!==v)$('tmV1').textContent=v;
 paintSoc(p);
 if(!view){   // Solana: mirror the Risk cell into the heading badge
  const c=[...stats.querySelectorAll('.tm-c')].find(e=>e.lastElementChild&&e.lastElementChild.textContent==='Risk');
  const b=$('tmSecB');
  if(c){b.textContent=c.firstElementChild.textContent;b.className='tm-secb '+(['good','warn','bad'].find(t=>c.classList.contains(t))||'')}
  else{b.textContent='';b.className='tm-secb'}
 }
}

/* ---------------- view-only popup (other chains) ---------------- */
let vTimer=null,vTick=0;
const cell=(label,val,tone,tip)=>`<div class="tm-c ${tone||''}"${tip?` title="${esc(tip)}"`:''}><b>${esc(val)}</b><span>${label}</span></div>`;
function setHtml(el,html){if(el.__h!==html){el.innerHTML=html;el.__h=html}}

function paintStarView(){
 const b=$('tmStar');if(!view)return;
 const ok=WATCH_CHAINS.includes(view.chainId);
 b.style.display=ok?'':'none';
 const on=Boolean(ok&&T.getState().watch.has(view.chainId+':'+view.baseToken.address));
 b.classList.toggle('on',on);b.textContent=on?'★':'☆';
}
function paintView(){
 const p=view;if(!p)return;
 const mint=p.baseToken.address,pc=p.priceChange||{},t=(p.txns&&p.txns.h24)||{};
 const src=https(p.info&&p.info.imageUrl);
 const img=$('tmIcon');if(img.getAttribute('src')!==(src||'fiji.png'))img.src=src||'fiji.png';
 sym.textContent=p.baseToken.symbol||'TOKEN';
 $('tmName').textContent=(p.baseToken.name||'')+' · '+(CHAIN_NAMES[p.chainId]||p.chainId)+' · '+dexName(p.dexId);
 $('tmCA').textContent=mint;
 $('tmMc').innerHTML=fmUsd(p.marketCap||p.fdv);
 $('tmPrice').innerHTML=fmPrice(p.priceUsd);
 const h24=num(pc.h24),chip=$('tmChg');
 chip.className='pill mk-chip '+cls(h24);
 chip.textContent='24h '+(h24===null?'—':(h24>0?'+':'')+h24.toFixed(Math.abs(h24)>=100?0:1)+'%');
 $('tmLiveTxt').textContent='live · '+(CHAIN_NAMES[p.chainId]||p.chainId);
 const okC=/^[a-z0-9-]+$/i.test(p.chainId||''),okP=/^[A-Za-z0-9]+$/.test(p.pairAddress||'');
 const key=okC&&okP?p.chainId+'/'+p.pairAddress:'';
 if(viewChart!==key||!chart.firstChild){
  viewChart=key;
  chart.innerHTML=key?'<iframe title="Live chart" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" src="https://dexscreener.com/'+key+'?embed=1&theme=light&trades=0&info=0"></iframe>'
   :'<span>The live chart appears as soon as this token has a DexScreener pair 💧</span>';
 }
 const r=viewRisk,tone=r?{low:'good',med:'warn',high:'bad'}[r.level]:'';
 const word=r?{low:'Lower',med:'Medium',high:'High'}[r.level]:'—';
 const liq=num(p.liquidity&&p.liquidity.usd);
 setHtml(stats,
  cell('Liquidity',fmUsd(liq))+cell('Volume 24h',fmUsd(p.volume&&p.volume.h24))+
  cell('Buys / sells',(t.buys==null?'–':t.buys)+' / '+(t.sells==null?'–':t.sells))+
  cell('FDV',fmUsd(p.fdv))+cell('Platform',dexName(p.dexId))+cell('Risk',word,tone));
 const flags=r?r.why.slice(0,5).map(w=>`<span class="tm-r warn">${esc(w)}</span>`).join('')+r.good.slice(0,3).map(w=>`<span class="tm-r ok">${esc(w)}</span>`).join(''):'';
 setHtml(risks,flags);
 const b=$('tmSecB');b.textContent=r?r.label:'';b.className='tm-secb '+(tone||'');
 paintStarView();
 paintExtras(p);
}
async function refreshView(){
 const p=view;if(!p||!/^[A-Za-z0-9]+$/.test(p.pairAddress||'')||!/^[a-z0-9-]+$/i.test(p.chainId||''))return;
 try{
  const ac=new AbortController(),to=setTimeout(()=>ac.abort(),8000);
  const r=await fetch('https://api.dexscreener.com/latest/dex/pairs/'+p.chainId+'/'+p.pairAddress,{signal:ac.signal});
  clearTimeout(to);
  if(!r.ok)return;
  const d=await r.json(),b=d&&d.pairs&&d.pairs[0];
  if(b&&view===p)['priceUsd','marketCap','fdv','liquidity','volume','priceChange','txns'].forEach(k=>{if(b[k]!=null)p[k]=b[k]});
 }catch(e){}
}
function openView(p,riskObj){
 if(!p||!p.baseToken||!p.baseToken.address)return;
 if(modal.classList.contains('on'))$('tmX').click();   // lets tradepad-popup.js clean up first
 view=p;viewRisk=riskObj||null;viewChart='';vTick=0;
 modal.classList.add('tm-view','on');
 document.body.style.overflow='hidden';
 $('tmRug').style.display='none';
 chart.innerHTML='';
 paintView();
 clearInterval(vTimer);
 vTimer=setInterval(()=>{vTick++;if(vTick%5===0)refreshView();paintView()},1000);
 refreshView();
}
window.FIJI_OPEN_VIEW=openView;

/* ---------------- button overrides that must know about view mode ---------------- */
const star=$('tmStar'),origStar=star.onclick;
star.onclick=async function(){
 if(!view)return origStar&&origStar.apply(this,arguments);
 const wallet=C.getWallet&&C.getWallet(),db=C.getSupabase&&C.getSupabase();
 if(!wallet)return toast('Connect your wallet first');
 if(!db)return toast('Supabase is unavailable');
 try{
  const {data,error}=await db.rpc('fiji_watch_toggle',{p_wallet:wallet,p_chain:view.chainId,p_mint:view.baseToken.address});
  if(error)throw error;
  const set=T.getState().watch,k=view.chainId+':'+view.baseToken.address;
  if(data===true){set.add(k);toast('Added to watchlist ⭐')}else{set.delete(k);toast('Removed from watchlist')}
  paintStarView();
 }catch(e){toast('Watchlist error: '+(e.message||e))}
};

const copyBtn=$('tmCopy');
copyBtn.onclick=async()=>{
 const t=($('tmCA').textContent||'').trim();
 if(!t||t==='…'||t==='—')return toast('Token address is not ready yet');
 let ok=false;
 try{await navigator.clipboard.writeText(t);ok=true}
 catch(e){try{const a=document.createElement('textarea');a.value=t;a.style.cssText='position:fixed;opacity:0';document.body.appendChild(a);a.select();ok=document.execCommand('copy');a.remove()}catch(x){}}
 toast(ok?'Contract copied 💧':'Copy failed. Press and hold the address instead.');
 if(ok){copyBtn.textContent='Copied ✓';setTimeout(()=>copyBtn.textContent='Copy',1400)}
};

/* normal (Solana) selections leave view mode */
const origSelect=window.tradeSelectByKey;
window.tradeSelectByKey=function(){
 if(view){view=null;viewRisk=null;clearInterval(vTimer);modal.classList.remove('tm-view');$('tmStar').style.display=''}
 return origSelect.apply(this,arguments);
};

/* ---------------- one timer for Solana popups + clean-up on close ---------------- */
setInterval(()=>{
 if(!modal.classList.contains('on')||view)return;
 const p=T.getState().selected;
 if(p)paintExtras(p);
},1000);

new MutationObserver(()=>{
 const on=modal.classList.contains('on');
 if(!on){
  clearInterval(vTimer);vTimer=null;view=null;viewRisk=null;viewChart='';
  modal.classList.remove('tm-view');$('tmStar').style.display='';
 }else if(!view){   // a Solana popup just opened: drop leftovers from the previous coin
  ageEl.textContent='';$('tmV1').textContent='…';soc.innerHTML='';soc.__h=null;$('tmSecB').textContent='';
 }
}).observe(modal,{attributes:true,attributeFilter:['class']});
})();
