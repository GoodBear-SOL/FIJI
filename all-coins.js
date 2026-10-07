/* ============================================================
   FIJI ALL COINS v2.2  (replaces the All coins UI)

   Load AFTER trade-all.js and popup-unify.js:
     <script src="trade-all.js"></script>
     <script src="all-coins.js"></script>

   v2.2 change (one popup for every coin):
   - Non-Solana coins (ETH, BNB, Base, ...) now open in the SAME
     popup as every other coin, through window.FIJI_OPEN_VIEW
     (provided by popup-unify.js). The old separate "detail sheet"
     is kept only as a fallback if popup-unify.js is missing.
   - Nothing else in this file was changed.

   - Filters: Chain, Time, Trending, Platform (+ the shared search bar)
   - Every coin (big or new) uses the same card with a risk badge
     and its linked X account / post / community
   - Tap a card for the full risk check, socials, chart
   - No extra Refresh button: the header refresh icon (mobile) and
     the normal Refresh button (desktop) refresh this view
   Needs window.FIJI_CORE from index.html (getConnection, getSupabase).
   ============================================================ */
(function(){
'use strict';
const CORE=window.FIJI_CORE||{};
const $=CORE.$||(id=>document.getElementById(id));
const toast=CORE.toast||(m=>console.log('[FIJI]',m));
const DS='https://api.dexscreener.com';

/* ---------- CONFIG ----------
   Chain ids must match DexScreener's. Add more chains here (e.g. 'robinhood'
   if DexScreener lists it). Bitcoin is not a DexScreener chain. */
const CHAINS=[
 {id:'all',name:'All chains',em:'🌍'},
 {id:'solana',name:'Solana',em:'◎',quote:'SOL',list:['BONK','WIF','POPCAT','FARTCOIN','PNUT','MEW','GOAT','MOODENG']},
 {id:'ethereum',name:'Ethereum',em:'⟠',quote:'WETH',list:['PEPE','SHIB','FLOKI','MOG','TURBO']},
 {id:'bsc',name:'BNB Chain',em:'🔶',quote:'WBNB',list:['FLOKI','BabyDoge','DOGE','SHIB','PEPE']},
 {id:'base',name:'Base',em:'🔵',quote:'WETH',list:['BRETT','DEGEN','TOSHI','KEYCAT','MIGGLES']},
 {id:'arbitrum',name:'Arbitrum',em:'🔷',quote:'WETH',list:[]},
 {id:'polygon',name:'Polygon',em:'🟣',quote:'WMATIC',list:[]},
 {id:'avalanche',name:'Avalanche',em:'🔺',quote:'WAVAX',list:[]}
];
const CHAIN_IDS=new Set(CHAINS.filter(c=>c.id!=='all').map(c=>c.id));
const TFS={m5:'5m',h1:'1h',h6:'6h',h24:'24h'};
const TREND={gain:'🌊 Top gainers',hype:'🆕 New hype',vol:'📊 Volume',liq:'💧 Liquidity',act:'💬 Most active',safe:'🛡 Low risk only'};
const DEXNAMES={pumpfun:'Pump.fun',pumpswap:'PumpSwap',raydium:'Raydium',meteora:'Meteora',orca:'Orca',uniswap:'Uniswap',pancakeswap:'PancakeSwap',aerodrome:'Aerodrome',moonshot:'Moonshot',launchlab:'LaunchLab',fluxbeam:'FluxBeam'};
const PAGE=24, REFRESH_MS=30000;

const S={chain:'all',tf:'h24',trend:'gain',dex:'all',q:'',limit:PAGE,list:[],found:[],shown:[],
 busy:false,at:0,on:false,err:'',curated:{},cache:new Map(),auth:new Map(),pairs:new Map(),timer:null,tick:null,qTimer:null};

/* ---------- helpers ---------- */
const num=v=>{const n=parseFloat(v);return Number.isFinite(n)?n:null};
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr=a=>Array.isArray(a)?a:[];
const liq=p=>num(p?.liquidity?.usd)||0;
const key=p=>p.chainId+':'+p.baseToken.address;
const safeUrl=u=>/^https:\/\//i.test(u||'')?String(u):'';
const cls=v=>{const n=num(v);return n===null||Math.abs(n)<0.05?'flat':n>0?'up':'dn'};
const fc=v=>{const n=num(v);return n===null?'–':(n>0?'+':'')+n.toFixed(Math.abs(n)>=100?0:1)+'%'};
const fm=v=>{const n=num(v);if(n===null)return '–';const a=Math.abs(n);return '$'+(a>=1e9?(n/1e9).toFixed(2)+'B':a>=1e6?(n/1e6).toFixed(2)+'M':a>=1e3?(n/1e3).toFixed(1)+'K':n.toFixed(0))};
function fp(v){
 const n=num(v);if(n===null)return '–';
 if(n>=1000)return '$'+n.toLocaleString(undefined,{maximumFractionDigits:2});
 if(n>=1)return '$'+n.toFixed(n>=10?2:3);
 if(n>=0.01)return '$'+n.toFixed(4);
 const m=n.toFixed(20).match(/^0\.(0+)(\d{1,4})/);
 if(m&&m[1].length>=3)return '$0.0<sub>'+m[1].length+'</sub>'+m[2];
 return '$'+n.toPrecision(3);
}
const ageH=p=>p.pairCreatedAt?(Date.now()-p.pairCreatedAt)/36e5:null;
function fage(p){const h=ageH(p);if(h===null)return '–';if(h<1)return Math.max(1,Math.round(h*60))+'m';if(h<24)return Math.floor(h)+'h';return Math.floor(h/24)+'d'}
const chainOf=id=>CHAINS.find(c=>c.id===id)||{name:id,em:'🔗'};
const dexName=id=>DEXNAMES[id]||(id?id.charAt(0).toUpperCase()+id.slice(1):'—');
const tx24=p=>(num(p.txns?.h24?.buys)||0)+(num(p.txns?.h24?.sells)||0);

/* ---------- network ---------- */
async function ds(path,ttl=20000){
 const c=S.cache.get(path);if(c&&Date.now()-c.t<ttl)return c.d;
 const ac=new AbortController(),to=setTimeout(()=>ac.abort(),10000);
 try{
  const r=await fetch(DS+path,{signal:ac.signal});
  if(!r.ok)throw new Error('DexScreener '+r.status);
  const d=await r.json();S.cache.set(path,{t:Date.now(),d});
  if(S.cache.size>150)S.cache.delete(S.cache.keys().next().value);
  return d;
 }finally{clearTimeout(to)}
}
function addPairs(map,list){
 arr(list).forEach(p=>{
  if(!p?.baseToken?.address||!CHAIN_IDS.has(p.chainId))return;
  const k=key(p),c=map.get(k);
  if(!c||liq(p)>liq(c))map.set(k,p);
 });
}
async function tokensFor(rows,wanted,map){
 const by={};
 rows.forEach(t=>{
  if(wanted.has(t?.chainId)&&t.tokenAddress)(by[t.chainId]=by[t.chainId]||new Set()).add(t.tokenAddress);
 });
 await Promise.all(Object.entries(by).map(async([c,set])=>{
  const addrs=[...set].slice(0,30);
  try{addPairs(map,await ds('/tokens/v1/'+c+'/'+addrs.map(encodeURIComponent).join(',')))}catch(e){}
 }));
}
/* Well-known coins: find their pair once, then refresh by pair address. */
async function resolveSym(sym,c){
 for(const q of [sym+'/'+c.quote,sym]){
  try{
   const d=await ds('/latest/dex/search?q='+encodeURIComponent(q),60000);
   const hit=arr(d.pairs).filter(p=>p.chainId===c.id&&String(p.baseToken?.symbol).toUpperCase()===sym.toUpperCase())
    .reduce((m,p)=>!m||liq(p)>liq(m)?p:m,null);
   if(hit&&liq(hit)>=10000)return hit;
  }catch(e){}
 }
 return null;
}
async function curatedFor(c){
 if(!c.list||!c.list.length)return [];
 if(!S.curated[c.id]){
  const found=(await Promise.all(c.list.map(s=>resolveSym(s,c)))).filter(Boolean);
  S.curated[c.id]=found.map(p=>p.pairAddress);
  return found;
 }
 if(!S.curated[c.id].length)return [];
 const d=await ds('/latest/dex/pairs/'+c.id+'/'+S.curated[c.id].slice(0,30).join(','));
 return arr(d.pairs);
}

async function load(manual){
 if(S.busy)return;
 S.busy=true;if(manual)S.cache.clear();
 const wanted=new Set(S.chain==='all'?[...CHAIN_IDS]:[S.chain]);
 const map=new Map();
 try{
  const [bt,bn,pr,...cur]=await Promise.all([
   ds('/token-boosts/top/v1').catch(()=>[]),
   ds('/token-boosts/latest/v1').catch(()=>[]),
   ds('/token-profiles/latest/v1').catch(()=>[]),
   ...CHAINS.filter(c=>wanted.has(c.id)).map(c=>curatedFor(c).catch(()=>[]))
  ]);
  cur.forEach(a=>addPairs(map,a));
  await tokensFor([...arr(bt),...arr(bn),...arr(pr)],wanted,map);
  S.list=[...map.values()].filter(p=>liq(p)>=1000);
  S.err='';
 }catch(e){console.error(e);S.err='Couldn’t reach DexScreener right now. Trying again in a moment 🔌'}
 S.at=Date.now();S.busy=false;
 render();checkAuthorities();
}

/* ---------- socials ---------- */
function social(p){
 const s=arr(p.info?.socials),w=arr(p.info?.websites);
 const get=t=>s.find(x=>String(x.type).toLowerCase()===t)?.url||'';
 const x=safeUrl(get('twitter'));
 let handle='',kind='';
 const m=x.match(/^https:\/\/(?:www\.)?(?:x|twitter)\.com\/([^/?#]+)(?:\/(status|communities)\b)?/i);
 if(m){handle=m[1];kind=(m[2]||'').toLowerCase()}
 const label=!x?'':kind==='communities'?'X community':'@'+handle+(kind==='status'?' · post':'');
 return {x,label,tg:safeUrl(get('telegram')),web:safeUrl(w[0]?.url)};
}

/* ---------- risk ----------
   Built only from data we really have: DexScreener market data plus, on
   Solana, the token's on-chain mint / freeze authority. It is a warning
   system, never a safety guarantee. */
function risk(p){
 const why=[],good=[];let s=0;
 const l=liq(p),h=ageH(p),tx=tx24(p),mc=num(p.marketCap||p.fdv),ch=num(p.priceChange?.h24);
 if(l<5000){s+=3;why.push('Very low liquidity')}else if(l<25000){s+=1;why.push('Low liquidity')}else good.push('Healthy liquidity');
 if(h!==null&&h<1){s+=2;why.push('Less than 1 hour old')}else if(h!==null&&h<24){s+=1;why.push('Less than 24 hours old')}
 if(mc&&l&&l/mc<0.02){s+=1;why.push('Thin liquidity compared to market cap')}
 if(tx<50){s+=1;why.push('Very little trading activity')}
 if(ch!==null&&ch<-70){s+=2;why.push('Dropped over 70% in 24h')}
 const b=num(p.txns?.h24?.buys)||0,se=num(p.txns?.h24?.sells)||0;
 if(tx>100&&se>b*2){s+=1;why.push('Many more sells than buys')}
 const so=social(p);
 if(!so.x&&!so.web){s+=1;why.push('No X or website linked')}else good.push('Socials linked');
 const a=p.chainId==='solana'?S.auth.get(p.baseToken.address):undefined;
 if(a){
  if(a.mint){s+=3;why.push('Mint authority still active (more supply can be created)')}else good.push('Mint authority revoked');
  if(a.freeze){s+=2;why.push('Freeze authority active (wallets can be frozen)')}else good.push('Freeze authority revoked');
 }
 const level=s>=5?'high':s>=2?'med':'low';
 return {level,why,good,label:level==='high'?'🔴 High risk':level==='med'?'🟡 Medium risk':'🟢 Lower risk',onchain:!!a};
}
async function checkAuthorities(){
 const conn=CORE.getConnection?CORE.getConnection():null;
 if(!conn||!window.solanaWeb3)return;
 const keys=[],mints=[];
 S.shown.forEach(p=>{
  const m=p.chainId==='solana'?p.baseToken.address:null;
  if(!m||S.auth.has(m)||mints.includes(m))return;
  try{keys.push(new solanaWeb3.PublicKey(m));mints.push(m)}catch(e){S.auth.set(m,null)}
 });
 if(!mints.length)return;
 try{
  const res=await conn.getMultipleParsedAccounts(keys.slice(0,100));
  res.value.forEach((a,i)=>{
   const info=a?.data?.parsed?.info;
   S.auth.set(mints[i],info?{mint:Boolean(info.mintAuthority),freeze:Boolean(info.freezeAuthority)}:null);
  });
  render(true);
 }catch(e){console.debug('Authority check failed',e)}
}

/* ---------- filtering + sorting ---------- */
const matches=(p,q)=>[p.baseToken.symbol,p.baseToken.name,p.baseToken.address].some(v=>String(v||'').toLowerCase().includes(q));
function baseRows(){
 let rows=S.list;
 if(S.q){
  const q=S.q.toLowerCase(),map=new Map();
  rows.filter(p=>matches(p,q)).forEach(p=>map.set(key(p),p));
  S.found.forEach(p=>{if(!map.has(key(p)))map.set(key(p),p)});
  rows=[...map.values()];
 }
 return S.chain==='all'?rows:rows.filter(p=>p.chainId===S.chain);
}
function view(rows){
 if(S.dex!=='all')rows=rows.filter(p=>p.dexId===S.dex);
 const tf=S.tf;
 if(S.trend==='safe')rows=rows.filter(p=>risk(p).level==='low');
 if(S.trend==='hype')rows=rows.filter(p=>{const h=ageH(p);return h!==null&&h<48});
 const v={
  gain:p=>num(p.priceChange?.[tf])??-1e9,
  hype:p=>num(p.volume?.h1)||0,
  vol:p=>num(p.volume?.h24)||0,
  liq:p=>liq(p),
  act:p=>tx24(p),
  safe:p=>num(p.volume?.h24)||0
 }[S.trend];
 return rows.slice().sort((a,b)=>v(b)-v(a));
}

/* ---------- UI ---------- */
const CSS=`
#allCoins{display:none!important}
#trade.ac-on .tlayout,#trade.ac-on .live-strip{display:none!important}
#trade.ac-on:not(.fg-locked) .tsearch{display:grid!important}
#trade:not(.ac-on) #acv2,#trade.fg-locked #acv2{display:none!important}
#acv2 .ac-filters{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}
@media(min-width:761px){#acv2 .ac-filters{grid-template-columns:repeat(4,1fr)}}
#acv2 .ac-f{display:block;min-width:0}
#acv2 .ac-f span{display:block;font:600 12px Fredoka,sans-serif;opacity:.7;margin:0 0 3px 8px}
#acv2 .ac-f select{margin:0;padding:10px 34px 10px 14px;border-radius:99px;box-shadow:0 3px 0 var(--ink);font:600 15px Fredoka,sans-serif;appearance:none;-webkit-appearance:none;cursor:pointer;
 background:#fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%2312305C' stroke-width='2.5' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 14px center}
#acv2 .ac-status{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-bottom:10px}
#acv2 .ac-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
#acv2 .ac-pills{display:flex;gap:5px;align-items:center;flex-wrap:wrap;min-width:0}
#acv2 .ac-x{text-decoration:none;color:var(--ink);background:var(--sun)}
#acv2 .rk{white-space:nowrap}
#acv2 .rk.low,.mk-sheet .rk.low{background:#B8F5D2;color:#0E8F52}
#acv2 .rk.med,.mk-sheet .rk.med{background:#FFF0B0}
#acv2 .rk.high,.mk-sheet .rk.high{background:#FFD0D8;color:#D6304F}
#acv2 .ac-more{margin:14px auto 0;display:block}
.ac-why{margin:8px 0;padding-left:20px;font-size:14px}
.ac-why li{margin:2px 0}
`;

function opts(obj,sel){return Object.entries(obj).map(([k,v])=>`<option value="${esc(k)}"${k===sel?' selected':''}>${esc(v)}</option>`).join('')}

function build(){
 if($('acv2'))return;
 const anchor=$('allCoins')||$('trade');
 if(!anchor)return;
 const st=document.createElement('style');st.textContent=CSS;document.head.appendChild(st);
 const root=document.createElement('div');root.id='acv2';
 root.innerHTML=`
  <div class="ac-filters">
   <label class="ac-f"><span>Chain</span><select id="acChain"></select></label>
   <label class="ac-f"><span>Time</span><select id="acTf"></select></label>
   <label class="ac-f"><span>Trending</span><select id="acTrend"></select></label>
   <label class="ac-f"><span>Platform</span><select id="acDex"></select></label>
  </div>
  <div class="ac-status small"><span class="live"><i></i><span id="acStat">loading…</span></span></div>
  <div class="ac-grid" id="acGrid"></div>
  <button class="btn sm alt ac-more" id="acMore" style="display:none">Show more</button>
  <p class="small" style="margin-top:14px">Market data from DexScreener, refreshed about every 30 seconds. Risk badges are automatic warnings based on liquidity, age, activity, linked socials and (on Solana) token authorities. They are not a guarantee. Trading works for Solana coins only; other chains are view-only. Not financial advice.</p>`;
 anchor.parentNode.insertBefore(root,anchor);
 $('acChain').innerHTML=CHAINS.map(c=>`<option value="${c.id}">${c.em} ${c.name}</option>`).join('');
 $('acTf').innerHTML=opts(TFS,S.tf);
 $('acTrend').innerHTML=opts(TREND,S.trend);
 $('acChain').onchange=e=>{S.chain=e.target.value;S.dex='all';S.limit=PAGE;S.list=[];S.found=[];render();load();if(S.q)remoteSearch()};
 $('acTf').onchange=e=>{S.tf=e.target.value;render()};
 $('acTrend').onchange=e=>{S.trend=e.target.value;S.limit=PAGE;render()};
 $('acDex').onchange=e=>{S.dex=e.target.value;S.limit=PAGE;render()};
 $('acMore').onclick=()=>{S.limit+=PAGE;render()};
 $('acGrid').onclick=e=>{
  if(e.target.closest('a'))return;
  const c=e.target.closest('[data-k]');if(c)openCoin(c.dataset.k);
 };
}

function card(p){
 const k=key(p),c=p.priceChange?.[S.tf],kd=cls(c),r=risk(p),so=social(p),img=safeUrl(p.info?.imageUrl);
 return `<article class="token-card" data-k="${esc(k)}">
  <div class="token-main">
   ${img?`<img class="token-icon" src="${esc(img)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;token-icon&quot;>🪙</span>'">`:'<span class="token-icon">🪙</span>'}
   <div class="token-name"><b>${esc(p.baseToken.symbol)}</b><span>${esc(p.baseToken.name)}</span></div>
   <span class="token-badge rk ${r.level}">${r.label}</span>
  </div>
  <div class="token-price">${fp(p.priceUsd)}</div>
  <div class="token-meta">
   <div class="meta-item"><b>${fm(p.marketCap||p.fdv)}</b><span>Market cap</span></div>
   <div class="meta-item"><b>${fm(liq(p))}</b><span>Liquidity</span></div>
   <div class="meta-item"><b>${fm(p.volume?.h24)}</b><span>24h volume</span></div>
   <div class="meta-item"><b>${fage(p)}</b><span>Age</span></div>
  </div>
  <div class="token-bottom">
   <div class="ac-pills">
    <span class="mini-pill change ${kd}">${TFS[S.tf]} ${fc(c)}</span>
    <span class="mini-pill">${chainOf(p.chainId).em} ${esc(chainOf(p.chainId).name)}</span>
    <span class="mini-pill">${esc(dexName(p.dexId))}</span>
    ${so.x?`<a class="mini-pill ac-x" href="${esc(so.x)}" target="_blank" rel="noopener">𝕏 ${esc(so.label)}</a>`:''}
   </div>
   ${p.chainId==='solana'?`<button class="quick-buy" type="button" data-trade="${esc(k)}">⚡ Trade</button>`:''}
  </div>
 </article>`;
}

function render(keepScroll){
 build();
 const grid=$('acGrid');if(!grid)return;
 const base=baseRows();
 /* Platform dropdown is built from what is actually on screen */
 const counts={};base.forEach(p=>{if(p.dexId)counts[p.dexId]=(counts[p.dexId]||0)+1});
 if(S.dex!=='all'&&!counts[S.dex])counts[S.dex]=0;
 const dexOpts={all:'All platforms'};
 Object.entries(counts).sort((a,b)=>b[1]-a[1]).forEach(([id,n])=>dexOpts[id]=dexName(id)+' ('+n+')');
 $('acDex').innerHTML=opts(dexOpts,S.dex);
 $('acChain').value=S.chain;
 const rows=view(base);
 S.shown=rows.slice(0,S.limit);
 S.shown.forEach(p=>S.pairs.set(key(p),p));
 if(S.err&&!rows.length)grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1">${S.err}</div>`;
 else if(!rows.length)grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">${S.at?'🌿':'🌊'}</div><p class="small">${S.at?'No coins match these filters right now.':'Splashing through the pond…'}</p></div>`;
 else grid.innerHTML=S.shown.map(card).join('');
 $('acMore').style.display=rows.length>S.limit?'block':'none';
 tickLive(rows.length);
}
function tickLive(n){
 const el=$('acStat');if(!el)return;
 if(n!=null)tickLive.n=n;
 el.textContent=S.at?'live · updated '+Math.round((Date.now()-S.at)/1000)+'s ago · '+(tickLive.n||0)+' coins':'loading…';
}

/* ---------- shared search bar ---------- */
function remoteSearch(){
 const q=S.q;
 if(q.length<2){S.found=[];render();return}
 ds('/latest/dex/search?q='+encodeURIComponent(q),15000).then(d=>{
  if(q!==S.q)return;
  const map=new Map();addPairs(map,d.pairs);
  S.found=[...map.values()].filter(p=>liq(p)>=500);
  render();checkAuthorities();
 }).catch(()=>{});
}
function bindSearch(){
 const box=$('tradeSearch');if(!box)return;
 box.addEventListener('input',()=>{
  if(!S.on)return;
  S.q=box.value.trim();S.limit=PAGE;render();
  clearTimeout(S.qTimer);S.qTimer=setTimeout(remoteSearch,400);
 });
}

/* ---------- detail sheet (fallback only) ---------- */
function closeSheet(){document.querySelectorAll('.ac-sheet').forEach(m=>m.remove())}
const SOL_MINT='So11111111111111111111111111111111111111112';

/* EVERY coin opens the same popup:
   - Solana coins (not SOL itself): the full Trade Pad popup (RugCheck stats,
     holders, fresh wallets, RUGGED! stamp, swap box).
   - Everything else (ETH, BNB, Base, SOL...): the same popup in view-only mode,
     through window.FIJI_OPEN_VIEW from popup-unify.js, with this file's risk flags.
   The old separate sheet below is used only if popup-unify.js is not loaded. */
function openCoin(k){
 const p=S.pairs.get(k);if(!p)return;
 const mint=p.baseToken.address,st=window.FIJI_TRADE?.getState?.();
 if(p.chainId==='solana'&&mint!==SOL_MINT&&st&&typeof window.tradeSelectByKey==='function'){
  st.base=[{...p},...st.base.filter(x=>x?.baseToken?.address!==mint)];   // lets the Trade Pad find this coin
  window.tradeSelectByKey(k);
  return;
 }
 if(typeof window.FIJI_OPEN_VIEW==='function'){
  window.FIJI_OPEN_VIEW(p,risk(p));
  return;
 }
 openDetail(k);
}
async function openDetail(k){
 const p=S.pairs.get(k);if(!p)return;
 closeSheet();
 const r=risk(p),so=social(p),pc=p.priceChange||{},t=p.txns?.h24||{},img=safeUrl(p.info?.imageUrl);
 const okC=/^[a-z0-9-]+$/i.test(p.chainId||''),okP=/^[A-Za-z0-9]+$/.test(p.pairAddress||'');
 const link=okC&&okP?'https://dexscreener.com/'+p.chainId+'/'+p.pairAddress:'';
 const d=document.createElement('div');d.className='mk-modal ac-sheet';
 d.innerHTML=`<div class="sticker card mk-sheet">
  <div class="mk-top">${img?`<img src="${esc(img)}" alt="">`:'<span class="mk-ph">🪙</span>'}
   <div class="mk-nm"><b>${esc(p.baseToken.symbol)}</b><span class="small">${esc(p.baseToken.name)} · ${esc(chainOf(p.chainId).name)}</span></div>
   <button class="btn sm alt ac-x-close">✕</button></div>
  <div class="mk-price big">${fp(p.priceUsd)}</div>
  <div class="mk-chips" style="margin:6px 0">${['m5','h1','h6','h24'].map(x=>`<span class="pill mk-chip ${cls(pc[x])}">${TFS[x]} ${fc(pc[x])}</span>`).join('')}</div>
  <p style="margin:10px 0 2px"><span class="pill rk ${r.level}">${r.label}</span></p>
  <ul class="ac-why">${r.why.map(w=>`<li>⚠️ ${esc(w)}</li>`).join('')}${r.good.map(w=>`<li>✅ ${esc(w)}</li>`).join('')}
</ul>
  <table>
   <tr><td>Market cap</td><td>${fm(p.marketCap||p.fdv)}</td></tr>
   <tr><td>Liquidity</td><td>${fm(liq(p))}</td></tr>
   <tr><td>Volume 24h</td><td>${fm(p.volume?.h24)}</td></tr>
   <tr><td>Buys / sells 24h</td><td>${t.buys==null?'–':t.buys} / ${t.sells==null?'–':t.sells}</td></tr>
   <tr><td>Platform</td><td>${esc(dexName(p.dexId))}</td></tr>
   <tr><td>Age</td><td>${fage(p)}</td></tr>
   <tr><td>X account</td><td>${so.x?`<a href="${esc(so.x)}" target="_blank" rel="noopener" style="color:var(--blue)">${esc(so.label)}</a>`:'Not linked'}</td></tr>
   <tr id="acChg" style="display:none"><td>X changes</td><td id="acChgV">–</td></tr>
   ${so.web?`<tr><td>Website</td><td><a href="${esc(so.web)}" target="_blank" rel="noopener" style="color:var(--blue)">Open</a></td></tr>`:''}
   ${so.tg?`<tr><td>Telegram</td><td><a href="${esc(so.tg)}" target="_blank" rel="noopener" style="color:var(--blue)">Open</a></td></tr>`:''}
  </table>
  ${link?`<iframe class="mk-frame" title="Price chart" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" src="${link}?embed=1&theme=light&trades=0&info=0"></iframe>`:''}
  <div class="mk-acts">
   <span class="small" style="flex:1 1 100%">Trading works for Solana coins only, so this coin is view-only here.</span>
   ${link?`<a class="btn sm alt" href="${link}" target="_blank" rel="noopener">DexScreener</a>`:''}
   <button class="btn sm alt" id="acCopy">Copy contract</button>
  </div></div>`;
 d.onclick=e=>{if(e.target===d)closeSheet()};
 d.querySelector('.ac-x-close').onclick=closeSheet;
 d.querySelector('#acCopy').onclick=async()=>{
  try{await navigator.clipboard.writeText(p.baseToken.address);toast('Contract copied 📝')}catch(e){toast('Copy failed')}
 };
 document.body.appendChild(d);
 loadChanges(p,d);
}
/* Optional: shows "X changes" once you add a tracker (see notes). Hidden otherwise. */
async function loadChanges(p,d){
 const db=CORE.getSupabase?CORE.getSupabase():null;if(!db)return;
 try{
  const {data,error}=await db.rpc('fiji_social_history',{p_chain:p.chainId,p_mint:p.baseToken.address});
  if(error||!data)return;
  const n=Number(data.changes);if(!Number.isFinite(n))return;
  d.querySelector('#acChg').style.display='';
  d.querySelector('#acChgV').textContent=n===0?'Never changed':n+' time'+(n===1?'':'s');
 }catch(e){}
}

/* ---------- start / stop + hooks ---------- */
function start(){
 build();
 if(S.on)return;
 S.on=true;
 S.q=($('tradeSearch')?.value||'').trim();
 render();load();
 if(S.q)remoteSearch();
 clearInterval(S.timer);clearInterval(S.tick);
 S.timer=setInterval(()=>{
  if(!document.hidden&&$('trade')?.classList.contains('on'))load();
 },REFRESH_MS);
 S.tick=setInterval(()=>tickLive(),1000);
}
function stop(){S.on=false;clearInterval(S.timer);clearInterval(S.tick);closeSheet()}

/* trade-all.js toggles the "ac-on" class on #trade when All coins is open
   (and the holder gate / tab changes clear it), so just follow that class. */
const sec=$('trade');
const syncMode=()=>{const on=Boolean(sec&&sec.classList.contains('ac-on'));if(on!==S.on)on?start():stop()};
if(sec)new MutationObserver(syncMode).observe(sec,{attributes:true,attributeFilter:['class']});

/* Keep the old All coins grid (market code in index.html) switched off */
try{if(typeof MK!=='undefined')Object.defineProperty(MK,'all',{get:()=>false,set:()=>{},configurable:true})}catch(e){}

const origTr=window.trRefresh;
window.trRefresh=function(){if(S.on)return load(true);return origTr?origTr.apply(this,arguments):undefined};
const origRf=window.tradeRefresh;
window.tradeRefresh=function(){if(S.on)return load(true);return origRf?origRf.apply(this,arguments):undefined};
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheet()});

build();bindSearch();syncMode();
window.FIJI_ALL={start,stop,refresh:()=>load(true)};
})();
