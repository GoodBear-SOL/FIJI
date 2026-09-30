/* ============================================================
   FIJI TRADE PAD v4
   Solana-only discovery + watchlist + trade router client.

   Load AFTER the core script in index.html:
     <script src="tradepad.js"></script>

   Needs from index.html (window.FIJI_CORE):
     CFG, $, toast, loadAssets,
     getWallet, getProvider, getConnection, getSupabase

   Talks to the Supabase Edge Function:
     POST {TRADE_ROUTER_URL}/quote   (Jupiter routes only)
     POST {TRADE_ROUTER_URL}/build   (Jupiter and Pump routes)

   Never put private keys or seed phrases in this file.
   ============================================================ */
(function(){
'use strict';

/* ============================================================
   1. CONFIG
============================================================ */
const TPCFG={
  TRADE_ROUTER_URL:'https://tmceqqciccnnlxjiobgc.supabase.co/functions/v1/trade-router',
  PUMPPORTAL_KEY:'',      // optional; live feeds work without it
  FEE_BPS:25,             // display only. The router enforces the real fee.
  SOL_RESERVE:0.005,      // SOL kept back for network fees when using MAX
  QUICK_BUY_SOL:0.10,
  REFRESH_MS:15000,
  MAX_FEED:30,
  MAX_LIVE:80,
  DS_BATCH:30,
  TIMEOUT_MS:10000,
  ENRICH_EVERY_MS:4000
};

const CORE=window.FIJI_CORE||{};
const CFG=CORE.CFG||{};
const $=CORE.$||(id=>document.getElementById(id));
const toast=CORE.toast||(m=>console.log('[FIJI]',m));

const DS='https://api.dexscreener.com';
const PUMP_WS='wss://pumpportal.fun/api/data';
const SOL_MINT='So11111111111111111111111111111111111111112';
const PUMP_START_TOKENS=1073000000;  // virtual token reserve at launch
const PUMP_GRAD_TOKENS=793100000;    // virtual token reserve at graduation

/* ============================================================
   2. STATE
============================================================ */
const TP={
  started:false,
  mode:'new',
  action:'buy',
  selected:null,
  feed:[],          // what is on screen
  base:[],          // last unfiltered feed (search filters this)
  liveNew:[],
  liveMigrated:[],
  cache:new Map(),
  watch:new Set(),
  portfolio:{sol:0,tokens:[]},
  loading:false,
  watchLoading:false,
  refreshTimer:null,
  ageTimer:null,
  enrichTimer:null,
  enrichQ:[],
  ws:null,
  wsTimer:null,
  wsOnline:false,
  search:'',
  updatedAt:0,
  error:''
};

/* ============================================================
   3. SMALL HELPERS
============================================================ */
const num=v=>{const n=Number(v);return Number.isFinite(n)?n:null};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=v=>{const s=String(v||'');return s.length<=12?s:s.slice(0,5)+'…'+s.slice(-5)};
const safeImage=v=>/^https?:\/\//i.test(String(v||''))?String(v):'';
const feePercent=()=>TPCFG.FEE_BPS/100;

function setText(id,text){const el=$(id);if(el)el.textContent=text}
function setHtml(id,html){const el=$(id);if(el)el.innerHTML=html}

function formatPercent(v){const n=num(v);if(n===null)return '—';return (n>0?'+':'')+n.toFixed(Math.abs(n)>=100?0:1)+'%'}
function formatUsd(v){
  const n=num(v);if(n===null)return '—';
  const a=Math.abs(n);
  if(a>=1e9)return '$'+(n/1e9).toFixed(2)+'B';
  if(a>=1e6)return '$'+(n/1e6).toFixed(2)+'M';
  if(a>=1e3)return '$'+(n/1e3).toFixed(1)+'K';
  if(a>=1)return '$'+n.toFixed(n>=10?2:3);
  if(a>=0.01)return '$'+n.toFixed(4);
  return '$'+n.toPrecision(3);
}
function formatSol(v){const n=num(v);return n===null?'—':n.toLocaleString(undefined,{minimumFractionDigits:4,maximumFractionDigits:4})}
function formatNumber(v){const n=num(v);return n===null?'—':n.toLocaleString(undefined,{maximumFractionDigits:4})}
function formatAge(ts){
  const n=num(ts);if(n===null)return '—';
  const diff=Date.now()-(n<1e12?n*1000:n);
  if(diff<60000)return Math.max(1,Math.floor(diff/1000))+'s';
  if(diff<3600000)return Math.floor(diff/60000)+'m';
  if(diff<86400000)return Math.floor(diff/3600000)+'h';
  return Math.floor(diff/86400000)+'d';
}
function changeClass(v){const n=num(v);if(n===null||Math.abs(n)<0.05)return 'flat';return n>0?'up':'dn'}

const liquidity=p=>num(p?.liquidity?.usd)||0;
const volume24=p=>num(p?.volume?.h24)||0;
const volume1h=p=>num(p?.volume?.h1)||0;
const tx24=p=>(num(p?.txns?.h24?.buys)||0)+(num(p?.txns?.h24?.sells)||0);
const tokenKey=p=>(!p?.chainId||!p?.baseToken?.address)?'':p.chainId+':'+p.baseToken.address;
function tokenKeyParts(key){const s=String(key||''),i=s.indexOf(':');return i<0?null:{chain:s.slice(0,i),mint:s.slice(i+1)}}
const walletAddress=()=>CORE.getWallet?CORE.getWallet():(window.wallet||null);

/* A Pump.fun token that has not graduated trades on the bonding curve. */
const isPumpCurve=p=>Boolean(p&&((p.bonding&&!p.migrated)||p.dexId==='pumpfun'));

/* ============================================================
   4. NETWORK
============================================================ */
async function fetchJson(url,opt={}){
  const {timeout,...init}=opt;
  const ac=new AbortController();
  const timer=setTimeout(()=>ac.abort(),timeout||TPCFG.TIMEOUT_MS);
  try{
    const r=await fetch(url,{...init,signal:ac.signal});
    if(!r.ok){
      let m='HTTP '+r.status;
      try{const j=await r.json();m=j.error||j.message||m}catch(e){}
      throw new Error(m);
    }
    return await r.json();
  }catch(e){
    if(e&&e.name==='AbortError')throw new Error('Request timed out');
    throw e;
  }finally{clearTimeout(timer)}
}

async function ds(path,cacheMs=10000){
  const c=TP.cache.get(path);
  if(c&&Date.now()-c.time<cacheMs)return c.data;
  const data=await fetchJson(DS+path);
  TP.cache.set(path,{time:Date.now(),data});
  return data;
}

function routerUrl(path){
  return TPCFG.TRADE_ROUTER_URL?TPCFG.TRADE_ROUTER_URL.replace(/\/$/,'')+path:'';
}

/* Sends the Supabase anon key so the function accepts the request
   even when "Verify JWT" is turned on. */
function routerPost(path,body){
  const url=routerUrl(path);
  if(!url)return Promise.reject(new Error('Trade router is not configured'));
  const headers={'Content-Type':'application/json'};
  if(CFG.SUPABASE_KEY){
    headers.apikey=CFG.SUPABASE_KEY;
    headers.Authorization='Bearer '+CFG.SUPABASE_KEY;
  }
  return fetchJson(url,{method:'POST',headers,body:JSON.stringify(body),timeout:15000});
}

/* ============================================================
   5. DEXSCREENER DATA
============================================================ */
async function fetchTokenPairs(mints){
  const unique=[...new Set((mints||[]).filter(Boolean))];
  if(!unique.length)return [];
  const all=[];
  for(let i=0;i<unique.length;i+=TPCFG.DS_BATCH){
    const chunk=unique.slice(i,i+TPCFG.DS_BATCH);
    try{
      const data=await ds('/tokens/v1/solana/'+chunk.map(encodeURIComponent).join(','),7000);
      if(Array.isArray(data))data.forEach(p=>{if(p?.chainId==='solana')all.push(p)});
    }catch(e){console.warn('Token enrichment failed',e)}
  }
  const best=new Map();
  all.forEach(p=>{
    const mint=p?.baseToken?.address;
    if(!mint)return;
    const cur=best.get(mint);
    if(!cur||liquidity(p)>liquidity(cur))best.set(mint,p);
  });
  return [...best.values()];
}

async function buildProfileFeed(){
  const data=await ds('/token-profiles/latest/v1',8000);
  const profiles=Array.isArray(data)?data:(data&&typeof data==='object'?[data]:[]);
  const sol=profiles.filter(p=>p?.chainId==='solana'&&p?.tokenAddress).slice(0,40);
  const pairs=await fetchTokenPairs(sol.map(p=>p.tokenAddress));
  const map=new Map(pairs.map(p=>[p.baseToken.address,p]));
  return sol.map(profile=>{
    const pair=map.get(profile.tokenAddress);
    if(pair)return {...pair,discoveryType:'new',profile};
    return {
      chainId:'solana',pairAddress:'',dexId:'launch',
      baseToken:{address:profile.tokenAddress,symbol:'NEW',name:profile.tokenAddress},
      info:{imageUrl:profile.icon||''},
      pairCreatedAt:Date.now(),priceChange:{},volume:{},liquidity:{},
      profile,discoveryType:'new'
    };
  });
}

async function fetchTrending(){
  const data=await ds('/token-boosts/top/v1',7000);
  const rows=Array.isArray(data)?data:[];
  const sol=rows.filter(x=>x?.chainId==='solana'&&x?.tokenAddress).slice(0,45);
  const pairs=await fetchTokenPairs(sol.map(x=>x.tokenAddress));
  const boostMap=new Map(sol.map(x=>[x.tokenAddress,x]));
  const score=p=>volume1h(p)+tx24(p)*25+Math.abs(num(p.priceChange?.h1)||0)*1000;
  return pairs
    .map(p=>({...p,discoveryType:'trending',boost:boostMap.get(p.baseToken.address)||null}))
    .sort((a,b)=>score(b)-score(a))
    .slice(0,TPCFG.MAX_FEED);
}

function mergeByMint(rows){
  const map=new Map();
  rows.forEach(p=>{
    const k=p?.baseToken?.address;
    if(!k)return;
    const cur=map.get(k);
    if(!cur||liquidity(p)>liquidity(cur))map.set(k,p);
  });
  return [...map.values()];
}

/* ============================================================
   6. LIVE PUMPPORTAL DATA
============================================================ */
function normalizeNewEvent(e){
  if(!e||!e.mint)return null;
  return {
    chainId:'solana',pairAddress:'',dexId:'pump',
    baseToken:{address:e.mint,symbol:e.symbol||'NEW',name:e.name||e.mint},
    info:{imageUrl:''},
    metadataUri:/^https?:\/\//i.test(e.uri||'')?e.uri:'',
    priceUsd:null,marketCap:null,fdv:null,
    liquidity:{usd:0},volume:{h24:0,h1:0},priceChange:{h24:0,h1:0,m5:0},
    txns:{h24:{buys:e.txType==='create'?1:0,sells:0}},
    pairCreatedAt:Date.now(),discoveryType:'new',bonding:true,
    bondingCurveKey:e.bondingCurveKey||'',
    vSolInBondingCurve:num(e.vSolInBondingCurve),
    vTokensInBondingCurve:num(e.vTokensInBondingCurve),
    marketCapSol:num(e.marketCapSol),initialBuy:num(e.initialBuy),
    signature:e.signature||'',creator:e.traderPublicKey||''
  };
}

function normalizeMigration(e){
  if(!e||!e.mint)return null;
  return {
    chainId:'solana',pairAddress:e.pool||'',dexId:e.pool||'migration',
    baseToken:{address:e.mint,symbol:e.symbol||'MIGRATED',name:e.name||e.mint},
    info:{imageUrl:''},
    pairCreatedAt:e.timestamp?Number(e.timestamp)*1000:Date.now(),
    priceUsd:null,marketCap:null,fdv:null,
    liquidity:{usd:0},volume:{h24:0,h1:0},priceChange:{h24:0,h1:0,m5:0},
    txns:{h24:{buys:0,sells:0}},
    discoveryType:'migrated',migrated:true,
    migrationSignature:e.signature||'',migrationPool:e.pool||''
  };
}

/* Merge fresh DexScreener market data into a live item, keeping live fields. */
function applyPair(item,pair){
  if(!pair)return;
  const keep={
    discoveryType:item.discoveryType,bonding:item.bonding,migrated:item.migrated,
    bondingCurveKey:item.bondingCurveKey,vSolInBondingCurve:item.vSolInBondingCurve,
    vTokensInBondingCurve:item.vTokensInBondingCurve,marketCapSol:item.marketCapSol,
    initialBuy:item.initialBuy,migrationSignature:item.migrationSignature,
    migrationPool:item.migrationPool,metadataUri:item.metadataUri,creator:item.creator
  };
  const oldImage=item.info?.imageUrl||'';
  Object.assign(item,pair,keep);
  if(!item.info?.imageUrl&&oldImage)item.info={...(item.info||{}),imageUrl:oldImage};
}

async function enrichLiveEvents(events){
  const mints=events.map(e=>e?.baseToken?.address).filter(Boolean);
  if(!mints.length)return events;
  const pairs=await fetchTokenPairs(mints);
  const map=new Map(pairs.map(p=>[p.baseToken.address,p]));
  events.forEach(e=>applyPair(e,map.get(e?.baseToken?.address)));
  return events;
}

/* Token metadata links point to JSON, not an image. Read the real image from it. */
async function loadPumpImage(item){
  if(item.info?.imageUrl||!item.metadataUri)return;
  try{
    const meta=await fetchJson(item.metadataUri,{timeout:6000});
    const img=safeImage(meta?.image);
    if(img){item.info={...(item.info||{}),imageUrl:img};scheduleRender()}
  }catch(e){}
}

/* New tokens arrive fast. Enrich them in batches to stay under API limits. */
function queueEnrich(item){
  TP.enrichQ.push(item);
  if(TP.enrichTimer)return;
  TP.enrichTimer=setTimeout(async()=>{
    TP.enrichTimer=null;
    const batch=TP.enrichQ.splice(0,TPCFG.DS_BATCH);
    if(!batch.length)return;
    try{await enrichLiveEvents(batch)}catch(e){}
    batch.slice(0,10).forEach(loadPumpImage);
    scheduleRender();
    if(TP.enrichQ.length)queueEnrich(TP.enrichQ.shift());
  },TPCFG.ENRICH_EVERY_MS);
}

let renderQueued=false;
function scheduleRender(){
  if(renderQueued)return;
  renderQueued=true;
  requestAnimationFrame(()=>{renderQueued=false;renderFeed()});
}

/* Add a live token to the on-screen feed right away. */
function pushLive(item){
  if(TP.search)return;
  if(TP.mode==='new'||(TP.mode==='bonding'&&item.bonding)){
    TP.feed=mergeByMint([item,...TP.feed])
      .sort((a,b)=>Number(b.pairCreatedAt||0)-Number(a.pairCreatedAt||0))
      .slice(0,TPCFG.MAX_FEED);
    TP.base=TP.feed;
    scheduleRender();
  }else if(TP.mode==='migrated'&&item.migrated){
    TP.feed=mergeByMint([item,...TP.feed]).slice(0,TPCFG.MAX_FEED);
    TP.base=TP.feed;
    scheduleRender();
  }
}

function pumpWsUrl(){
  return TPCFG.PUMPPORTAL_KEY?PUMP_WS+'?api-key='+encodeURIComponent(TPCFG.PUMPPORTAL_KEY):PUMP_WS;
}
function closePumpSocket(){
  clearTimeout(TP.wsTimer);TP.wsTimer=null;
  if(TP.ws){try{TP.ws.close()}catch(e){}}
  TP.ws=null;TP.wsOnline=false;
}
function schedulePumpReconnect(){
  clearTimeout(TP.wsTimer);
  if(!TP.started)return;
  TP.wsTimer=setTimeout(openPumpSocket,3500);
}
function openPumpSocket(){
  if(!TP.started||TP.ws)return;
  let socket;
  try{socket=new WebSocket(pumpWsUrl())}
  catch(e){console.warn('Pump websocket unavailable',e);schedulePumpReconnect();return}
  TP.ws=socket;

  socket.onopen=()=>{
    TP.wsOnline=true;
    try{
      socket.send(JSON.stringify({method:'subscribeNewToken'}));
      socket.send(JSON.stringify({method:'subscribeMigration'}));
    }catch(e){console.warn('Pump subscription failed',e)}
    updateLiveStatus();
  };

  socket.onmessage=ev=>{
    let d;
    try{d=JSON.parse(ev.data)}catch(e){return}
    if(!d||!d.mint)return;
    const type=String(d.txType||d.type||'').toLowerCase();

    if(type==='create'){
      const item=normalizeNewEvent(d);
      if(!item)return;
      TP.liveNew.unshift(item);
      TP.liveNew=TP.liveNew.slice(0,TPCFG.MAX_LIVE);
      pushLive(item);
      queueEnrich(item);
    }else if(type.includes('migrat')){
      const item=normalizeMigration(d);
      if(!item)return;
      TP.liveMigrated.unshift(item);
      TP.liveMigrated=TP.liveMigrated.slice(0,TPCFG.MAX_LIVE);
      pushLive(item);
      queueEnrich(item);
    }
  };

  socket.onerror=()=>{TP.wsOnline=false;updateLiveStatus();try{socket.close()}catch(e){}};
  socket.onclose=()=>{
    if(TP.ws===socket)TP.ws=null;
    TP.wsOnline=false;updateLiveStatus();schedulePumpReconnect();
  };
}

/* ============================================================
   7. WATCHLIST (Supabase)
============================================================ */
async function loadWatchlist(){
  const wallet=walletAddress();
  const db=CORE.getSupabase?CORE.getSupabase():null;
  if(!wallet||!db){TP.watch.clear();return}
  if(TP.watchLoading)return;
  TP.watchLoading=true;
  try{
    const {data,error}=await db.rpc('fiji_get_watchlist',{p_wallet:wallet});
    if(error)throw error;
    TP.watch.clear();
    (Array.isArray(data)?data:[]).forEach(r=>{if(r?.chain&&r?.mint)TP.watch.add(r.chain+':'+r.mint)});
  }catch(e){console.warn('Supabase watchlist load failed',e)}
  finally{TP.watchLoading=false}
}

async function toggleWatch(p){
  const wallet=walletAddress();
  if(!wallet)return toast('Connect your wallet first');
  if(!p)return toast('Select a token first');
  const db=CORE.getSupabase?CORE.getSupabase():null;
  if(!db)return toast('Supabase is unavailable');
  const chain=p.chainId||'solana',mint=p.baseToken?.address;
  if(!mint)return toast('Token address unavailable');
  try{
    const {data,error}=await db.rpc('fiji_watch_toggle',{p_wallet:wallet,p_chain:chain,p_mint:mint});
    if(error)throw error;
    const key=chain+':'+mint;
    if(data===true){TP.watch.add(key);toast('Added to watchlist ⭐')}
    else{TP.watch.delete(key);toast('Removed from watchlist')}
    updateTradeStar();
    renderFeed();
    if(TP.mode==='watchlist')await refresh(false);
  }catch(e){console.error('Watchlist toggle error',e);toast('Watchlist error: '+(e.message||e))}
}

/* ============================================================
   8. PORTFOLIO + DECIMALS
============================================================ */
const decCache=new Map([[SOL_MINT,9]]);

function portfolioToken(mint){return (TP.portfolio.tokens||[]).find(t=>t?.mint===mint)}
function portfolioTokenAmount(mint){
  const t=portfolioToken(mint);
  return num(t?.tokenAmount?.uiAmount||0)||0;
}

function updatePortfolioFromCore(payload){
  if(!payload)return;
  if(num(payload.sol)!==null)TP.portfolio.sol=num(payload.sol)||0;
  if(Array.isArray(payload.tokens)){
    TP.portfolio.tokens=payload.tokens;
    payload.tokens.forEach(t=>{
      const d=num(t?.tokenAmount?.decimals);
      if(t?.mint&&d!==null)decCache.set(t.mint,d);
    });
  }
  updateTradeBalances();
}

async function getDecimals(mint){
  if(decCache.has(mint))return decCache.get(mint);
  try{
    const conn=CORE.getConnection?CORE.getConnection():null;
    if(conn&&window.solanaWeb3){
      const info=await conn.getParsedAccountInfo(new solanaWeb3.PublicKey(mint));
      const d=info?.value?.data?.parsed?.info?.decimals;
      if(Number.isInteger(d)){decCache.set(mint,d);return d}
    }
  }catch(e){}
  return 6; // common default for Solana meme tokens; not cached
}

function updateTradeBalances(){
  const sol=TP.portfolio.sol||0;
  setText('tradeSolBalance',formatSol(sol));
  setText('portfolioSolTotal',formatSol(sol)+' SOL');
  setText('swapWalletBalance','◎ '+formatSol(sol)+' SOL');
  setText('headerSolBalance',formatSol(sol));
  if(TP.action==='buy'){
    setText('tradePayBalance','Balance: '+formatSol(sol)+' SOL');
  }else{
    setText('tradePayBalance','Balance: '+formatNumber(portfolioTokenAmount(TP.selected?.baseToken?.address)));
  }
}

/* ============================================================
   9. FEEDS
============================================================ */
async function getFeed(){
  if(TP.mode==='new'){
    let fallback=[];
    try{fallback=await buildProfileFeed()}catch(e){console.warn('New fallback failed',e)}
    return mergeByMint([...TP.liveNew,...fallback])
      .sort((a,b)=>Number(b.pairCreatedAt||0)-Number(a.pairCreatedAt||0))
      .slice(0,TPCFG.MAX_FEED);
  }
  if(TP.mode==='bonding'){
    const bonding=TP.liveNew.filter(i=>i.bonding!==false&&!i.migrated);
    await enrichLiveEvents(bonding.slice(0,TPCFG.DS_BATCH));
    return mergeByMint(bonding)
      .sort((a,b)=>{
        const am=num(a.marketCapSol),bm=num(b.marketCapSol);
        if(am!==null&&bm!==null)return bm-am; // closest to graduating first
        return Number(b.pairCreatedAt||0)-Number(a.pairCreatedAt||0);
      })
      .slice(0,TPCFG.MAX_FEED);
  }
  if(TP.mode==='migrated'){
    await enrichLiveEvents(TP.liveMigrated.slice(0,TPCFG.DS_BATCH));
    return mergeByMint(TP.liveMigrated)
      .sort((a,b)=>Number(b.pairCreatedAt||0)-Number(a.pairCreatedAt||0))
      .slice(0,TPCFG.MAX_FEED);
  }
  if(TP.mode==='watchlist'){
    if(!walletAddress())return [];
    await loadWatchlist();
    const wanted=[...TP.watch].map(tokenKeyParts).filter(Boolean).filter(x=>x.chain==='solana').map(x=>x.mint);
    const pairs=await fetchTokenPairs(wanted);
    return mergeByMint(pairs.map(p=>({...p,discoveryType:'watchlist'}))).slice(0,TPCFG.MAX_FEED);
  }
  return fetchTrending();
}

/* ============================================================
   10. FEED RENDERING
============================================================ */
function bondingProgress(p){
  const v=num(p?.vTokensInBondingCurve);
  if(v===null||v<=0)return null;
  return clamp((PUMP_START_TOKENS-v)/(PUMP_START_TOKENS-PUMP_GRAD_TOKENS)*100,0,100);
}

function discoveryBadge(p){
  if(p.discoveryType==='migrated')return '<span class="token-badge">🎓 Migrated</span>';
  if(p.discoveryType==='bonding'||p.bonding)return '<span class="token-badge">📈 Bonding</span>';
  if(p.discoveryType==='trending')return '<span class="token-badge">🔥 Trending</span>';
  if(p.discoveryType==='watchlist')return '<span class="token-badge">⭐ Saved</span>';
  return '<span class="token-badge">🆕 New</span>';
}

function modeLabel(m){
  return {new:'New',trending:'Trending',bonding:'Bonding',migrated:'Migrated',watchlist:'Watchlist'}[m]||'tokens';
}

function tradeTokenCard(p){
  const mint=p?.baseToken?.address,key=tokenKey(p),image=safeImage(p?.info?.imageUrl);
  const price=num(p?.priceUsd),change=num(p?.priceChange?.h1);
  const watched=TP.watch.has(key),progress=bondingProgress(p);
  const showBond=(p.bonding||p.discoveryType==='bonding')&&progress!==null;
  return `
  <article class="token-card" data-token-key="${esc(key)}" onclick="tradeSelectByKey(this.dataset.tokenKey)">
    <div class="token-main">
      ${image
        ?`<img class="token-icon" src="${esc(image)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;token-icon&quot;>🪙</span>'">`
        :'<span class="token-icon">🪙</span>'}
      <div class="token-name"><b>${esc(p?.baseToken?.symbol||'TOKEN')}</b><span>${esc(p?.baseToken?.name||short(mint))}</span></div>
      ${discoveryBadge(p)}
      ${watched?'<span class="token-badge">⭐</span>':''}
    </div>
    <div class="token-price">${price!==null?formatUsd(price):'Live price loading…'}</div>
    <div class="token-meta">
      <div class="meta-item"><b>${formatUsd(p?.marketCap||p?.fdv)}</b><span>Market cap</span></div>
      <div class="meta-item"><b>${formatUsd(liquidity(p))}</b><span>Liquidity</span></div>
      <div class="meta-item"><b>${formatUsd(volume24(p))}</b><span>24h volume</span></div>
      <div class="meta-item"><b>${formatAge(p?.pairCreatedAt)}</b><span>Age</span></div>
    </div>
    ${showBond?`
    <div style="margin-top:8px;background:#F7FAFF;border:2px dashed #CFD9EA;border-radius:12px;padding:7px 8px">
      <div style="display:flex;justify-content:space-between;gap:8px;font:600 12px Fredoka"><span>Bonding progress</span><b>${progress.toFixed(0)}%</b></div>
      <div style="height:8px;border:2px solid #12305C;border-radius:999px;background:#fff;overflow:hidden;margin-top:4px">
        <div style="width:${progress}%;height:100%;background:#3FB6C9"></div>
      </div>
    </div>`:''}
    <div class="token-bottom">
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">
        <span class="mini-pill change ${changeClass(change)}">1h ${change===null?'—':formatPercent(change)}</span>
        <span class="mini-pill">${esc(p?.dexId||'Solana')}</span>
      </div>
      <button class="quick-buy" type="button" data-buy-key="${esc(key)}"
        onclick="event.stopPropagation();tradeQuickBuy(this.dataset.buyKey)">
        ⚡ ${TP.action==='buy'?'Buy '+TPCFG.QUICK_BUY_SOL.toFixed(2)+' SOL':'Sell'}
      </button>
    </div>
  </article>`;
}

function emptyBox(icon,title,text,retry){
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><h3>${title}</h3><p class="small">${text}</p>${retry?'<br><button class="btn sm" onclick="tradeRefresh(true)">Try again</button>':''}</div>`;
}

function renderFeed(){
  const box=$('tradeList');
  if(!box)return;
  if(TP.loading&&!TP.feed.length)
    return void(box.innerHTML=emptyBox('🌊','Finding live Solana tokens…','Looking for current '+esc(modeLabel(TP.mode))+' activity.'));
  if(TP.error&&!TP.feed.length)
    return void(box.innerHTML=emptyBox('💧','Trade Pad needs another splash',esc(TP.error),true));
  if(!TP.feed.length){
    let msg='No tokens found in this feed right now.';
    if(TP.search)msg='No tokens match your search.';
    else if(TP.mode==='watchlist')msg=walletAddress()?'Your watchlist has no currently visible Solana pairs.':'Connect your wallet to view your watchlist.';
    else if(TP.mode==='bonding')msg='Bonding tokens will appear here from the live launch feed.';
    else if(TP.mode==='migrated')msg='Fresh migrations will appear here from the live migration feed.';
    return void(box.innerHTML=emptyBox(TP.mode==='watchlist'?'⭐':'🌿',TP.mode==='watchlist'?'Watchlist':'Nothing here yet',msg));
  }
  box.innerHTML=TP.feed.map(tradeTokenCard).join('');
}

function updateLiveStatus(){
  if(TP.wsOnline)setText('tradeLiveText','Live Solana feed connected');
  else if(TPCFG.PUMPPORTAL_KEY)setText('tradeLiveText','Reconnecting to live feed…');
  else setText('tradeLiveText','Live discovery · connecting to Pump feed…');
  if(TP.updatedAt)setText('tradeUpdated','Updated '+formatAge(TP.updatedAt)+' ago');
}

/* ============================================================
   11. SELECTED TOKEN
============================================================ */
function findByKey(key){
  return TP.feed.find(p=>tokenKey(p)===key)||TP.base.find(p=>tokenKey(p)===key)||
    TP.liveNew.find(p=>tokenKey(p)===key)||TP.liveMigrated.find(p=>tokenKey(p)===key)||null;
}

function updateChart(p){
  const h24=num(p.priceChange?.h24);
  if(h24===null){const e=$('tradeChartEmpty');if(e)e.style.display='flex';return}
  const e=$('tradeChartEmpty');if(e)e.style.display='none';
  const up='0,40 8,37 16,39 25,31 33,34 42,25 50,28 58,19 66,22 75,14 83,17 92,9 100,12';
  const dn='0,12 8,17 16,14 25,23 33,20 42,29 50,25 58,34 66,30 75,38 83,34 92,43 100,40';
  const line=$('tradeChartPath');
  if(line)line.setAttribute('points',h24>=0?up:dn);
}

function updateSelectedUI(){
  const p=TP.selected;
  if(!p){
    ['tradePrice','tradeMc','tradeLiq','tradeVol','summaryToken','summaryLiq','summaryImpact','summaryRoute','summaryNetworkFee','securityAddress','securityAge','securityLiq','securityDex'].forEach(id=>setText(id,'—'));
    setText('tradeDetailSymbol','Select a token');
    setText('tradeDetailName','Choose a token from the live feed.');
    setText('tradeReceiveAsset','TOKEN');
    const r=$('tradeReceiveAmount');if(r)r.value='';
    setText('tradeContract','Contract address will appear here');
    setText('securityStatus','Not checked');
    setText('tradeChartLabel','24h');
    const e=$('tradeChartEmpty');if(e)e.style.display='flex';
    updateTradeActionUI();updateTradeBalances();
    return;
  }
  const mint=p.baseToken?.address||'',symbol=p.baseToken?.symbol||'TOKEN';
  const icon=$('tradeDetailIcon');if(icon)icon.src=safeImage(p.info?.imageUrl)||'fiji.png';
  setText('tradeDetailSymbol',symbol);
  setText('tradeDetailName',(p.baseToken?.name||'Token')+' · Solana · '+(p.dexId||'market'));
  setText('tradePrice',p.priceUsd!=null?formatUsd(p.priceUsd):'—');
  setText('tradeMc',formatUsd(p.marketCap||p.fdv));
  setText('tradeLiq',formatUsd(liquidity(p)));
  setText('tradeVol',formatUsd(volume24(p)));
  setText('summaryToken',symbol);
  setText('summaryLiq',formatUsd(liquidity(p)));
  setText('summaryRoute',isPumpCurve(p)?'Pump bonding curve':(p.dexId||'Solana'));
  setText('tradeContract',mint||'—');
  setText('securityAddress',short(mint));
  setText('securityAge',formatAge(p.pairCreatedAt));
  setText('securityLiq',formatUsd(liquidity(p)));
  setText('securityDex',p.dexId||'—');
  setText('tradeChartLabel',symbol+' · 24h');
  updateChart(p);
  updateTradeStar();
  updateTradeActionUI();
  updateTradeBalances();
  runLightSecurity();
  schedulePreview();
}

function updateTradeStar(){
  const star=$('tradeStar');
  if(!star)return;
  const watched=Boolean(TP.selected&&TP.watch.has(tokenKey(TP.selected)));
  star.classList.toggle('on',watched);
  star.textContent=watched?'★':'☆';
}

function runLightSecurity(){
  const p=TP.selected;
  if(!p)return;
  const l=liquidity(p);
  if(isPumpCurve(p))setText('securityStatus','Pump curve · not graduated');
  else if(l<=0)setText('securityStatus','Liquidity not available');
  else if(l<5000)setText('securityStatus','Low liquidity');
  else setText('securityStatus','Basic market data loaded');
}

async function selectByKey(key){
  const p=findByKey(key);
  if(!p)return;
  if(!p.priceUsd){
    try{const rows=await fetchTokenPairs([p.baseToken.address]);applyPair(p,rows[0])}catch(e){}
  }
  TP.selected=p;
  updateSelectedUI();
  refreshSelectedToken();
  const card=$('selectedTokenCard');
  if(card&&window.matchMedia&&window.matchMedia('(max-width:760px)').matches)card.scrollIntoView({behavior:'smooth',block:'start'});
}

async function refreshSelectedToken(){
  const p=TP.selected;
  if(!p?.baseToken?.address)return;
  try{
    const rows=await fetchTokenPairs([p.baseToken.address]);
    if(!rows[0])return;
    applyPair(p,rows[0]);
    updateSelectedUI();
  }catch(e){console.debug('Selected token refresh unavailable',e)}
}

/* ============================================================
   12. BUY / SELL CONTROLS
============================================================ */
function updateTradeActionUI(){
  const buy=$('buyTab'),sell=$('sellTab');
  if(buy){buy.classList.toggle('on',TP.action==='buy');buy.classList.toggle('buy',TP.action==='buy')}
  if(sell){sell.classList.toggle('on',TP.action==='sell');sell.classList.toggle('sell',TP.action==='sell')}
  const symbol=TP.selected?.baseToken?.symbol||'TOKEN';
  setText('tradePayAsset',TP.action==='buy'?'SOL':symbol);
  setText('tradeAmountUnit',TP.action==='buy'?'SOL':'% of holdings');
  setText('tradeReceiveAsset',TP.action==='buy'?symbol:'SOL');
  setText('tradeExecuteButton',TP.selected?(TP.action==='buy'?'BUY NOW':'SELL NOW'):'Select a token');
  setText('tradeFeeNote','FIJI platform fee · '+feePercent().toFixed(2)+'% on Jupiter routes · shown before signing.');
  updateTradeBalances();
}

function setAction(action){
  TP.action=action==='sell'?'sell':'buy';
  const amt=$('tradeAmount');if(amt)amt.value='';
  updateTradeActionUI();
  renderFeed();
  schedulePreview();
}

function getAvailableSol(){return Math.max(0,(TP.portfolio.sol||0)-TPCFG.SOL_RESERVE)}

function setPreset(percent){
  if(!TP.selected)return toast('Select a token first');
  const pct=clamp(Number(percent)||0,0,100),amt=$('tradeAmount');
  if(!amt)return;
  if(TP.action==='buy'){
    const avail=getAvailableSol();
    if(avail<=0)return toast('Not enough SOL after network reserve');
    amt.value=(avail*pct/100).toFixed(4);
  }else{
    amt.value=String(pct);
  }
  schedulePreview();
}

function getSlippageBps(){
  const v=$('tradeSlippage')?.value||'auto';
  if(v==='auto')return 100;
  return Math.round((Number(v)||1)*100);
}

function currentAmount(){return num($('tradeAmount')?.value)}

function amountValid(){
  const a=currentAmount();
  if(a===null||a<=0)return false;
  return TP.action==='buy'?a<=getAvailableSol():a<=100;
}

/* ============================================================
   13. REQUEST BUILDER (matches the trade-router function)
============================================================ */
function buildTradeBody(){
  const p=TP.selected;
  if(!p?.baseToken?.address)throw new Error('Select a token first');
  const wallet=walletAddress();
  if(!wallet)throw new Error('Connect your wallet first');
  const mint=p.baseToken.address,v=currentAmount(),buy=TP.action==='buy';
  const pump=isPumpCurve(p);
  const base={wallet,action:TP.action,pool:pump?'pump':'auto',slippageBps:getSlippageBps()};

  if(pump){
    return buy
      ?{...base,inputMint:SOL_MINT,outputMint:mint,amount:v,denominatedInSol:true}
      :{...base,inputMint:mint,outputMint:SOL_MINT,amount:Math.round(v)+'%',denominatedInSol:false};
  }
  if(buy){
    return {...base,inputMint:SOL_MINT,outputMint:mint,amount:String(Math.floor(v*1e9))};
  }
  const t=portfolioToken(mint);
  const raw=BigInt(t?.tokenAmount?.amount||'0');
  if(raw<=0n)throw new Error('You do not hold this token');
  const part=raw*BigInt(Math.round(v))/100n;
  if(part<=0n)throw new Error('Amount is too small');
  return {...base,inputMint:mint,outputMint:SOL_MINT,amount:part.toString()};
}

/* ============================================================
   14. QUOTE PREVIEW
============================================================ */
let previewSeq=0,previewTimer=null;

function schedulePreview(){
  clearTimeout(previewTimer);
  previewTimer=setTimeout(updateTradePreview,350);
}

function clearPreview(route){
  const r=$('tradeReceiveAmount');if(r)r.value='';
  setText('summaryImpact','—');
  setText('summaryNetworkFee','—');
  setText('summaryRoute',route||'—');
}

async function updateTradePreview(){
  const seq=++previewSeq,p=TP.selected;
  if(!p)return;
  if(!amountValid()){clearPreview(isPumpCurve(p)?'Pump bonding curve':(p.dexId||'—'));return}

  /* Pump curve: the router builds the exact transaction at signing time. */
  if(isPumpCurve(p)){
    clearPreview('Pump bonding curve');
    const recv=$('tradeReceiveAmount');
    if(TP.action==='buy'&&recv){
      const est=pumpBuyEstimate(p,currentAmount());
      if(est!==null)recv.value='≈ '+est.toLocaleString(undefined,{maximumFractionDigits:2});
    }
    setText('tradeFeeNote','Pump route · provider fee about 0.5% · FIJI fee 0% on Pump routes.');
    return;
  }

  setText('summaryRoute','Finding route…');
  try{
    const body=buildTradeBody();
    const res=await routerPost('/quote',body);
    if(seq!==previewSeq)return;
    const q=res.quote;
    if(!q)throw new Error('No route found');
    const outMint=body.outputMint;
    const dec=await getDecimals(outMint);
    if(seq!==previewSeq)return;
    const out=Number(q.outAmount)/Math.pow(10,dec);
    const recv=$('tradeReceiveAmount');
    if(recv)recv.value=out.toLocaleString(undefined,{maximumFractionDigits:6});
    const impact=num(q.priceImpactPct);
    setText('summaryImpact',impact!==null?(impact*100).toFixed(2)+'%':'—');
    const labels=[...new Set((q.routePlan||[]).map(r=>r?.swapInfo?.label).filter(Boolean))];
    setText('summaryRoute',labels.length?labels.join(' → '):(p.dexId||'Jupiter'));
    setText('summaryNetworkFee','—');
    if(res.feeBps!=null)
      setText('tradeFeeNote','FIJI platform fee · '+(Number(res.feeBps)/100).toFixed(2)+'% · shown before signing.');
  }catch(e){
    if(seq!==previewSeq)return;
    clearPreview('Quote unavailable');
    setText('tradeFeeNote','⚠ '+(e.message||'Quote failed'));
    console.debug('Trade preview unavailable',e);
  }
}

function pumpBuyEstimate(p,sol){
  const vs=num(p.vSolInBondingCurve),vt=num(p.vTokensInBondingCurve);
  if(!vs||!vt)return null;
  const dx=sol*0.99; // approx. 1% curve fee
  return vt-(vs*vt)/(vs+dx);
}

/* ============================================================
   15. SIGNING + EXECUTION
============================================================ */
function decodeBase64(value){
  const bin=atob(value),bytes=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  return bytes;
}

async function signAndSend(encoded){
  const provider=CORE.getProvider?CORE.getProvider():null;
  const connection=CORE.getConnection?CORE.getConnection():null;
  const address=walletAddress();
  if(!provider||!connection||!address)throw new Error('Wallet is not connected');
  if(!window.solanaWeb3)throw new Error('Solana Web3 library is unavailable');

  const bytes=decodeBase64(encoded);
  let tx=null;
  try{tx=solanaWeb3.VersionedTransaction.deserialize(bytes)}catch(e){tx=null}
  const opts={maxRetries:2,skipPreflight:false};

  /* Injected wallets (Phantom, Solflare, Backpack) */
  if(typeof provider.signTransaction==='function'){
    const toSign=tx||solanaWeb3.Transaction.from(bytes);
    const signed=await provider.signTransaction(toSign);
    return connection.sendRawTransaction(signed.serialize(),opts);
  }

  /* Wallet Standard wallets */
  const feature=provider?.features?.['solana:signTransaction'];
  const accounts=provider?.accounts||[];
  const account=accounts.find(a=>a.address===address)||accounts[0];
  if(feature&&account){
    const res=await feature.signTransaction({account,transaction:bytes,chain:'solana:mainnet'});
    const signed=res?.signedTransaction||res?.[0]?.signedTransaction;
    if(!signed)throw new Error('Wallet did not return a signed transaction');
    return connection.sendRawTransaction(signed,opts);
  }
  throw new Error('This wallet cannot sign transactions through FIJI yet');
}
async function claimTradePoints(sig,mint){
  const wallet=walletAddress();
  if(!wallet||!sig)return;
  for(let i=0;i<4;i++){
    try{
      const res=await routerPost('/claim',{wallet,signature:sig,mint});
      if(res?.awarded){
        if(res.profile&&CORE.setProfile)CORE.setProfile(res.profile);
        toast('+'+res.points+' points for your trade ⭐');
      }else if(res?.reason&&!/already/i.test(res.reason)){
        toast(res.reason);
      }
      return;
    }catch(e){
      const m=String(e.message||e);
      if(/not found yet/i.test(m)&&i<3){await new Promise(r=>setTimeout(r,2500));continue}
      console.warn('Trade points claim failed',e);
      toast(m);
      return;
    }
  }
}
async function executeTrade(){
  if(!walletAddress())return toast('Connect your wallet first');
  if(!TP.selected)return toast('Select a token first');
  if(!amountValid())
    return toast(TP.action==='buy'?'Enter a valid SOL amount':'Enter a sell percentage from 1 to 100');
  if(!routerUrl('/build'))return toast('Trade router is not configured yet');

  const btn=$('tradeExecuteButton');
  if(btn){if(btn.disabled)return;btn.disabled=true;btn.textContent='Building transaction…'}
  try{
    const body=buildTradeBody();
    const res=await routerPost('/build',body);
    if(!res?.transaction)throw new Error(res?.error||'Trade router did not return a transaction');

    const p=TP.selected,symbol=p.baseToken?.symbol||'TOKEN',amount=currentAmount();
    const fijiFee=Number(res.feeBps||0)/100,provFee=res.providerFeeBps?Number(res.providerFeeBps)/100:0;
    const amountText=TP.action==='buy'?amount.toFixed(4)+' SOL':amount+'% of your '+symbol;
    const ok=window.confirm(
      (TP.action==='buy'?'Buy ':'Sell ')+symbol+' · '+amountText+'\n\n'+
      'FIJI platform fee: '+fijiFee.toFixed(2)+'%\n'+
      (provFee?'Route provider fee: about '+provFee.toFixed(2)+'%\n':'')+
      '\nYour wallet will ask you to sign the transaction.'
    );
    if(!ok)return;

    if(btn)btn.textContent='Waiting for wallet…';
    const sig=await signAndSend(res.transaction);
    toast('Transaction sent ✔ '+short(sig));

    let failed=false;
    try{
      const conn=CORE.getConnection();
      const r=await conn.confirmTransaction(sig,'confirmed');
      if(r?.value?.err)failed=true;
    }catch(e){console.warn('Confirmation lookup failed',e)}
    toast(failed?'Transaction failed on-chain':'Trade confirmed ✔');
      if(!failed)await claimTradePoints(sig,TP.selected?.baseToken?.address);

    if(CORE.loadAssets)await CORE.loadAssets();
    await refreshSelectedToken();
  }catch(e){
    console.error('Trade execution failed',e);
    toast('Trade failed: '+(e.message||e));
  }finally{
    if(btn)btn.disabled=false;
    updateTradeActionUI();
  }
}

async function quickBuyByKey(key){
  const p=findByKey(key);
  if(!p)return toast('Token data is no longer available');
  TP.selected=p;
  TP.action='buy';
  updateSelectedUI();
  if(getAvailableSol()<TPCFG.QUICK_BUY_SOL)
    return toast('You need at least '+TPCFG.QUICK_BUY_SOL.toFixed(2)+' SOL available');
  const amt=$('tradeAmount');if(amt)amt.value=TPCFG.QUICK_BUY_SOL.toFixed(2);
  await executeTrade();
}

/* ============================================================
   16. SEARCH
============================================================ */
let searchTimer=null;

function matchesSearch(p,q){
  return String(p?.baseToken?.symbol||'').toLowerCase().includes(q)||
    String(p?.baseToken?.name||'').toLowerCase().includes(q)||
    String(p?.baseToken?.address||'').toLowerCase().includes(q);
}

async function applySearch(){
  const q=TP.search;
  if(!q){TP.feed=TP.base.slice();renderFeed();return}
  const loaded=TP.base.filter(p=>matchesSearch(p,q));
  if(loaded.length){TP.feed=loaded.slice(0,TPCFG.MAX_FEED);renderFeed();return}
  try{
    const data=await ds('/latest/dex/search?q='+encodeURIComponent(q),4000);
    if(q!==TP.search)return; // a newer search started
    const pairs=(data?.pairs||[]).filter(p=>p?.chainId==='solana');
    TP.feed=mergeByMint(pairs).slice(0,TPCFG.MAX_FEED);
  }catch(e){console.warn('Search failed',e);TP.feed=[]}
  renderFeed();
}

/* ============================================================
   17. REFRESH + TIMERS
============================================================ */
async function refresh(forced=false){
  if(TP.loading&&!forced)return;
  TP.loading=true;TP.error='';
  if(!TP.feed.length)renderFeed();
  try{
    const rows=await getFeed();
    TP.base=mergeByMint(rows).slice(0,TPCFG.MAX_FEED);
    TP.feed=TP.search?TP.feed:TP.base.slice();
    TP.updatedAt=Date.now();
    if(TP.search)await applySearch();else renderFeed();

    if(TP.selected){
      const upd=TP.base.find(p=>tokenKey(p)===tokenKey(TP.selected));
      if(upd){
        const sel=TP.selected;
        if(upd!==sel){applyPair(sel,upd);}
        updateSelectedUI();
      }
    }
  }catch(e){
    console.error('Trade refresh error',e);
    TP.error='Could not load live Solana discovery right now.';
    renderFeed();
  }finally{
    TP.loading=false;
    updateLiveStatus();
  }
}

function startTimers(){
  stopTimers();
  TP.refreshTimer=setInterval(()=>{if(TP.started&&!document.hidden)refresh(false)},TPCFG.REFRESH_MS);
  TP.ageTimer=setInterval(()=>{updateLiveStatus();if(TP.feed.length)renderFeed()},30000);
}
function stopTimers(){
  clearInterval(TP.refreshTimer);clearInterval(TP.ageTimer);
  TP.refreshTimer=null;TP.ageTimer=null;
}

/* ============================================================
   18. PUBLIC METHODS
============================================================ */
function renderModeTabs(){
  document.querySelectorAll('.discovery-tab').forEach(b=>b.classList.toggle('on',b.dataset.mode===TP.mode));
}

function start(){
  if(TP.started){
    updatePortfolioFromCore({sol:TP.portfolio.sol,tokens:TP.portfolio.tokens});
    return;
  }
  TP.started=true;TP.error='';
  renderModeTabs();renderFeed();startTimers();openPumpSocket();
  loadWatchlist().catch(()=>{});
  refresh(true);
  updateTradeActionUI();updateTradeBalances();
}

function stop(){
  TP.started=false;
  stopTimers();closePumpSocket();
  clearTimeout(TP.enrichTimer);TP.enrichTimer=null;
}

async function setMode(mode){
  const allowed=['new','trending','bonding','migrated','watchlist'];
  TP.mode=allowed.includes(mode)?mode:'new';
  TP.feed=[];TP.base=[];
  renderModeTabs();renderFeed();
  await refresh(true);
}

async function walletChanged(address){
  if(address)await loadWatchlist();else TP.watch.clear();
  updateTradeBalances();updateTradeStar();
  if(TP.mode==='watchlist'){TP.feed=[];TP.base=[];await refresh(true)}
}

function portfolioUpdated(payload){
  updatePortfolioFromCore(payload);
  schedulePreview();
}

function publicSearch(value){
  TP.search=String(value||'').trim().toLowerCase();
  clearTimeout(searchTimer);
  searchTimer=setTimeout(applySearch,200);
}

async function copyContract(){
  const mint=TP.selected?.baseToken?.address;
  if(!mint)return toast('Select a token first');
  try{await navigator.clipboard.writeText(mint);toast('Contract copied 💧')}
  catch(e){toast('Copy failed')}
}

function flipSide(){setAction(TP.action==='buy'?'sell':'buy')}

/* ============================================================
   19. EXPOSE API + DOM HOOKS
============================================================ */
window.FIJI_TRADE={
  start,stop,setMode,
  refresh:f=>refresh(Boolean(f)),
  search:publicSearch,
  setAction,setPreset,flipSide,
  toggleWatch:()=>TP.selected?toggleWatch(TP.selected):toast('Select a token first'),
  copyContract,
  execute:executeTrade,
  quickBuy:quickBuyByKey,
  walletChanged,portfolioUpdated,
  getState:()=>TP
};

/* Names used by the onclick handlers in index.html */
window.tradeSetMode=setMode;
window.tradeRefresh=f=>refresh(Boolean(f));
window.tradeToggleWatch=window.FIJI_TRADE.toggleWatch;
window.tradeSetAction=setAction;
window.tradeSetPreset=setPreset;
window.tradeFlipSide=flipSide;
window.tradeExecute=executeTrade;
window.tradeQuickBuy=quickBuyByKey;
window.tradeSelectByKey=selectByKey;
window.tradeCopyContract=copyContract;

const searchBox=$('tradeSearch');
if(searchBox)searchBox.addEventListener('input',()=>publicSearch(searchBox.value));
const slip=$('tradeSlippage');
if(slip)slip.addEventListener('change',schedulePreview);
const amtBox=$('tradeAmount');
if(amtBox)amtBox.addEventListener('input',schedulePreview);

updateTradeActionUI();
updateTradeBalances();
renderModeTabs();

if(document.getElementById('trade')?.classList.contains('on'))start();

})();
