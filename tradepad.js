/* FIJI Trade Pad v2 — replaces the Memes tab. Load AFTER the main <script>:  <script src="tradepad.js"></script>
   Optional in your main CFG: JUP_KEY:'your-jupiter-api-key' (uses api.jup.ag instead of the free lite endpoint). */
(function(){
const JUP=CFG.JUP_KEY?'https://api.jup.ag/swap/v1':'https://lite-api.jup.ag/swap/v1',JH=CFG.JUP_KEY?{'x-api-key':CFG.JUP_KEY}:{},
 RC='https://api.rugcheck.xyz/v1',WSU='wss://pumpportal.fun/api/data',SOLM='So11111111111111111111111111111111111111112',
 HKEY=(()=>{try{return new URL(CFG.RPC).searchParams.get('api-key')}catch(e){return ''}})();
const TR={chain:'solana',mode:'new',pool:[],pairs:{},live:[],ws:null,on:false,timer:null,tick:null,at:0,busy:false,err:'',wl:new Set(),o:null};
const CH={solana:'◎ Solana',ethereum:'⟠ Ethereum',bsc:'🔶 BNB Chain',base:'🔵 Base'};
const MD={new:'🆕 New',trend:'📈 Trending',hot:'🔥 Hot',watch:'⭐ Watchlist'};
const age=ms=>{if(!ms)return '–';const s=(Date.now()-ms)/1000;return s<60?Math.floor(s)+'s':s<3600?Math.floor(s/60)+'m':s<86400?Math.floor(s/3600)+'h':Math.floor(s/86400)+'d'};
async function j(u,h){const ac=new AbortController(),t=setTimeout(()=>ac.abort(),10000);try{const r=await fetch(u,{signal:ac.signal,headers:h});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}

/* ---- styles + section ---- */
const st=document.createElement('style');
st.textContent=`.tr-box{border:2.5px dashed var(--ink);border-radius:18px;padding:12px 14px;margin:12px 0;background:#EAF6FF}
.tr-box select{padding:8px 12px;border:3px solid var(--ink);border-radius:14px;font:600 15px Nunito;background:#fff;margin:6px 0}
.tr-row{display:flex;gap:8px;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:2px dashed #cfd9ea;flex-wrap:wrap}.tr-row:last-child{border:0}
.tr-row b{font:600 17px Fredoka}.tr-live{margin-bottom:18px}.tr-live .tr-row{cursor:pointer}
.tr-risk{font:700 20px Fredoka;margin:4px 0 8px}.tr-ul{margin:8px 0 0 18px;font-size:14px}
.tr-find{display:flex;gap:8px;margin:0 0 12px}.tr-find input{margin:0}
@media(max-width:760px){.tr-box{padding:10px}}`;
document.head.appendChild(st);
const i0=pages.indexOf('memes');if(i0>-1)pages[i0]='trade';else if(!pages.includes('trade'))pages.push('trade');
ico.trade='📈';const oldM=$('memes');if(oldM)oldM.remove();
const sec=document.createElement('section');sec.className='pg';sec.id='trade';
sec.innerHTML=`<div class="tag">trade pad</div><h2>Find it. Check it. Trade it.</h2>
<div class="mk-live small"><span class="live"><i></i><span id="trAgo">loading…</span></span><button class="btn sm alt" id="trRef">Refresh</button></div>
<div class="mk-bar"><div class="mk-pills" id="trCh"></div></div><div class="mk-bar"><div class="mk-pills" id="trMd"></div></div>
<div class="tr-find"><input id="trCa" placeholder="Paste a token address to check it" autocomplete="off"><button class="btn sm" id="trGo">Check</button></div>
<div class="sticker card tr-live" id="trLive" style="display:none"></div>
<div class="grid" id="trGrid"></div>
<p class="small" style="margin-top:14px">Data from DexScreener, RugCheck, Helius and Pump.fun. Risk labels are automatic estimates, not advice. New tokens are extremely risky and you can lose everything. Trades are signed in your own wallet; Fiji never holds your funds.</p>`;
document.querySelector('main').appendChild(sec);
$('links').innerHTML=pages.map(p=>`<a data-p="${p}" onclick="go('${p}')"><span class="ic">${ico[p]}</span><span>${p[0].toUpperCase()+p.slice(1)}</span></a>`).join('');
const g0=go;go=function(p){g0(p);p=='trade'?start():stop()};
const a0=afterConnect;afterConnect=async function(o,r){TR.o=o;await a0(o,r);loadWatch()};
go(pages.find(p=>$(p).classList.contains('on'))||'home');
$('trRef').onclick=()=>refresh(true);
$('trGo').onclick=()=>{const v=$('trCa').value.trim();if(!/^[A-Za-z0-9]{20,64}$/.test(v))return toast('Paste a valid token address');openMint(v,TR.chain)};

/* ---- feed ---- */
async function pairsFor(chain,addrs){const g={};
 for(let i=0;i<addrs.length;i+=30){const d=await j(DS+'/tokens/v1/'+chain+'/'+addrs.slice(i,i+30).map(encodeURIComponent).join(','));
  (Array.isArray(d)?d:[]).forEach(p=>{const a=p.baseToken&&p.baseToken.address;if(a&&(!g[a]||liq(p)>liq(g[a])))g[a]=p})}
 return Object.values(g)}
async function fetchPool(){const ch=TR.chain,md=TR.mode,addrs=[];
 if(md=='watch'){TR.wl.forEach(x=>{const [c,a]=x.split(':');if(c==ch)addrs.push(a)})}
 else{const urls=md=='new'?['/token-profiles/latest/v1']:['/token-boosts/latest/v1','/token-boosts/top/v1'];
  const res=await Promise.all(urls.map(u=>j(DS+u).catch(()=>[])));
  res.forEach(l=>(Array.isArray(l)?l:[]).forEach(t=>{if(t.chainId==ch&&t.tokenAddress&&!addrs.includes(t.tokenAddress))addrs.push(t.tokenAddress)}))}
 let l=addrs.length?await pairsFor(ch,addrs.slice(0,60)):[];
 if(md!='watch')l=l.filter(p=>liq(p)>=1000);
 const m5=p=>{const t=p.txns&&p.txns.m5;return t?(t.buys||0)+(t.sells||0):0};
 if(md=='new')l.sort((a,b)=>(b.pairCreatedAt||0)-(a.pairCreatedAt||0));
 else if(md=='trend')l.sort((a,b)=>(num(b.volume&&b.volume.h1)||0)-(num(a.volume&&a.volume.h1)||0));
 else if(md=='hot')l.sort((a,b)=>m5(b)-m5(a));
 return l.slice(0,24)}
function tile(p){const c=p.priceChange?p.priceChange.h1:null,cl=cls(c),img=safeImg(p.info&&p.info.imageUrl),t=(p.txns&&p.txns.h1)||{};
 return `<div class="sticker card mk ${cl}" data-k="${esc(key(p))}" onclick="TRopen(this.dataset.k)">
 <div class="mk-top">${img?`<img src="${esc(img)}" alt="" loading="lazy" onerror="this.outerHTML='<span class=&quot;mk-ph&quot;>💧</span>'">`:'<span class="mk-ph">💧</span>'}
 <div class="mk-nm"><b>${esc(p.baseToken.symbol)}</b><span class="small">${esc(p.baseToken.name)} · ${age(p.pairCreatedAt)}</span></div><span class="pill mk-chip ${cl}">${fc(c)} 1h</span></div>
 <div class="mk-price">${fp(p.priceUsd)}</div>${wave(p)}
 <div class="mk-stats small"><span>MC ${fm(p.marketCap||p.fdv)}</span><span>Liq ${fm(liq(p))}</span></div>
 <div class="mk-stats small"><span>Vol ${fm(p.volume&&p.volume.h1)}</span><span>🟢${t.buys==null?'–':t.buys} 🔴${t.sells==null?'–':t.sells}</span></div></div>`}
function render(){const g=$('trGrid');
 if(TR.err&&!TR.pool.length){g.innerHTML='<div class="sticker card mk-empty" style="grid-column:1/-1">'+TR.err+'</div>';return}
 if(!TR.pool.length){g.innerHTML='<div class="sticker card mk-empty" style="grid-column:1/-1">'+(TR.mode=='watch'?'Nothing starred on this chain yet. Open a token and tap ☆.':'No tokens to show here right now 🌿')+'</div>';return}
 TR.pool.forEach(p=>TR.pairs[key(p)]=p);g.innerHTML=TR.pool.map(tile).join('')}
function ctrls(){$('trCh').innerHTML=Object.entries(CH).map(([k,v])=>`<button class="mk-p ${TR.chain==k?'on':''}" data-c="${k}">${v}</button>`).join('');
 $('trMd').innerHTML=Object.entries(MD).map(([k,v])=>`<button class="mk-p ${TR.mode==k?'on':''}" data-m="${k}">${v}</button>`).join('');
 $('trCh').querySelectorAll('button').forEach(b=>b.onclick=()=>{TR.chain=b.dataset.c;TR.pool=[];ctrls();renderLive();refresh(true)});
 $('trMd').querySelectorAll('button').forEach(b=>b.onclick=()=>{TR.mode=b.dataset.m;TR.pool=[];ctrls();renderLive();refresh(true)})}
async function refresh(loading){if(TR.busy&&!loading)return;const ch=TR.chain,md=TR.mode;TR.busy=true;if(loading)$('trGrid').innerHTML=LOADING;
 try{const l=await fetchPool();if(ch!=TR.chain||md!=TR.mode)return;TR.pool=l;TR.err=''}
 catch(e){if(ch!=TR.chain||md!=TR.mode)return;console.error(e);TR.err=OOPS}
 finally{TR.busy=false}
 render();TR.at=Date.now();ago()}
function ago(){$('trAgo').textContent=TR.at?'live · updated '+Math.round((Date.now()-TR.at)/1000)+'s ago':'loading…'}

/* ---- real-time Pump.fun launches (Solana · New) ---- */
function wsOpen(){if(TR.ws||!TR.on)return;const w=new WebSocket(WSU);TR.ws=w;
 w.onopen=()=>w.send(JSON.stringify({method:'subscribeNewToken'}));
 w.onmessage=e=>{try{const d=JSON.parse(e.data);if(d.txType=='create'&&d.mint){TR.live.unshift({m:d.mint,s:d.symbol,n:d.name,sol:d.solAmount,mc:d.marketCapSol,t:Date.now()});TR.live=TR.live.slice(0,10);renderLive()}}catch(x){}};
 w.onclose=()=>{TR.ws=null;if(TR.on)setTimeout(wsOpen,3000)};w.onerror=()=>{try{w.close()}catch(x){}}}
function renderLive(){const b=$('trLive');if(TR.chain!='solana'||TR.mode!='new'){b.style.display='none';return}
 b.style.display='block';
 b.innerHTML='<h3>⚡ Live launches <span class="small">Pump.fun, as they happen</span></h3>'+(TR.live.length?TR.live.map(x=>`<div class="tr-row" data-m="${esc(x.m)}"><span><b>${esc(x.s||'?')}</b> <span class="small">${esc(x.n||'')} · dev bought ${x.sol==null?'–':Number(x.sol).toFixed(2)} SOL · MC ${x.mc==null?'–':Number(x.mc).toFixed(1)} SOL · ${age(x.t)}</span></span><button class="btn sm alt">Check</button></div>`).join(''):'<p class="small">Waiting for the next launch…</p>');
 b.querySelectorAll('.tr-row').forEach(r=>r.onclick=()=>openMint(r.dataset.m,'solana'))}
function start(){TR.on=true;ctrls();renderLive();refresh(true);clearInterval(TR.timer);clearInterval(TR.tick);
 TR.timer=setInterval(()=>{if(!document.hidden)refresh()},15000);TR.tick=setInterval(()=>{ago();if(TR.mode=='new'&&TR.chain=='solana'&&TR.live.length&&!document.querySelector('.mk-modal'))renderLive()},1000);wsOpen()}
function stop(){TR.on=false;clearInterval(TR.timer);clearInterval(TR.tick);if(TR.ws){try{TR.ws.close()}catch(e){}TR.ws=null}}

/* ---- watchlist ---- */
async function loadWatch(){if(!db||!wallet)return;try{const {data}=await db.from('fiji_watchlist').select('chain,mint').eq('wallet',wallet);TR.wl=new Set((data||[]).map(x=>x.chain+':'+x.mint))}catch(e){}}
async function toggleWatch(p,btn){if(!wallet||!db)return toast('Connect your wallet first');
 const {data,error}=await db.rpc('fiji_watch_toggle',{p_wallet:wallet,p_chain:p.chainId,p_mint:p.baseToken.address});if(error)return toast(error.message);
 const id=p.chainId+':'+p.baseToken.address;data?TR.wl.add(id):TR.wl.delete(id);btn.textContent=data?'★':'☆'}

/* ---- token sheet ---- */
const isPump=p=>/pump/i.test(p.dexId||'')||String(p.baseToken.address).endsWith('pump');
async function openMint(m,ch){let p=null;
 try{const d=await j(DS+'/token-pairs/v1/'+ch+'/'+encodeURIComponent(m));p=best(Array.isArray(d)?d:[])}catch(e){}
 if(!p){const l=TR.live.find(x=>x.m==m)||{};p={chainId:ch,pairAddress:'',dexId:'pump.fun',baseToken:{address:m,symbol:l.s||short(m),name:l.n||'New token'}}}
 TR.pairs[key(p)]=p;openSheet(key(p))}
window.TRopen=openSheet;
const row=(l,v,c)=>`<div class="tr-row"><span>${l}</span><span class="pill mk-chip ${c||''}">${v}</span></div>`;
function openSheet(k){const p=TR.pairs[k];if(!p)return;closePair();
 const m=p.baseToken.address,sol=p.chainId=='solana',pc=p.priceChange||{},t=(p.txns&&p.txns.h24)||{},img=safeImg(p.info&&p.info.imageUrl),
 link=/^[a-z0-9-]+$/i.test(p.chainId||'')&&/^[A-Za-z0-9]+$/.test(p.pairAddress||'')?'https://dexscreener.com/'+p.chainId+'/'+p.pairAddress:'',
 star=TR.wl.has(p.chainId+':'+m)?'★':'☆',d=document.createElement('div');d.className='mk-modal';
 d.innerHTML=`<div class="sticker card mk-sheet">
 <div class="mk-top">${img?`<img src="${esc(img)}" alt="">`:'<span class="mk-ph">💧</span>'}<div class="mk-nm"><b>${esc(p.baseToken.symbol)}</b><span class="small">${esc(p.baseToken.name)} · ${esc(p.chainId)}</span></div>
  <button class="btn sm alt" id="trStar">${star}</button><button class="btn sm alt mk-x">✕</button></div>
 <div class="mk-price big" id="trPx">${fp(p.priceUsd)}</div><div class="mk-chips" style="margin:6px 0">${chips(pc)}</div>${wave(p)}
 <div class="tr-row"><span>Market cap</span><b>${fm(p.marketCap||p.fdv)}</b></div><div class="tr-row"><span>Liquidity</span><b>${fm(liq(p))}</b></div>
 <div class="tr-row"><span>Volume 24h</span><b>${fm(p.volume&&p.volume.h24)}</b></div><div class="tr-row"><span>Buys / sells 24h</span><b>${t.buys==null?'–':t.buys} / ${t.sells==null?'–':t.sells}</b></div>
 <div class="tr-row"><span>Age</span><b>${age(p.pairCreatedAt)}</b></div>
 <div class="tr-box"><div class="tr-risk">Risk check</div><div id="trRisk" data-m="${esc(m)}">Scanning… 🔎</div></div>
 ${sol?`<div class="tr-box"><div class="tr-risk">Early buyers</div><div id="trScan" data-m="${esc(m)}">Waiting for the risk check…</div></div>`:''}
 ${sol?`<div class="tr-box"><b>Buy with SOL</b><div class="mk-pills" style="margin:6px 0">${[0.1,0.5,1].map(v=>`<button class="mk-p" data-b="${v}">${v} SOL</button>`).join('')}</div>
  <input id="trAmt" type="number" min="0" step="0.01" placeholder="SOL amount"><select id="trSl"><option value="300">Slippage 3%</option><option value="1000" selected>Slippage 10%</option><option value="2500">Slippage 25%</option></select>
  <div class="small" id="trQ"></div><div class="mk-acts"><button class="btn" id="trBuy">Buy</button></div>
  <b style="display:block;margin-top:10px">Sell</b><div class="mk-pills" style="margin-top:6px">${[25,50,100].map(v=>`<button class="mk-p" data-s="${v}">${v}%</button>`).join('')}</div></div>`
  :'<div class="tr-box small">Trading is on Solana for now. You can still browse this chain and open the chart.</div>'}
 <div class="mk-acts">${link?`<a class="btn sm" href="${link}" target="_blank" rel="noopener">Open chart</a>`:''}<button class="btn sm alt" id="trCp">Copy contract</button></div></div>`;
 d.onclick=e=>{if(e.target===d)closePair()};d.querySelector('.mk-x').onclick=closePair;
 d.querySelector('#trCp').onclick=()=>{navigator.clipboard.writeText(m);toast('Contract copied 💧')};
 d.querySelector('#trStar').onclick=function(){toggleWatch(p,this)};
 document.body.appendChild(d);risk(m,p);if(sol)wireTrade(d,m,isPump(p));
 const iv=setInterval(async()=>{const el=$('trPx');if(!el||!document.body.contains(d)){clearInterval(iv);return}
  try{const x=await j(DS+'/token-pairs/v1/'+p.chainId+'/'+encodeURIComponent(m)),q=best(Array.isArray(x)?x:[]);if(q&&q.priceUsd)el.innerHTML=fp(q.priceUsd)}catch(e){}},8000)}

/* ---- risk (RugCheck) ---- */
async function risk(m,p){const put=h=>{const b=$('trRisk');if(b&&b.dataset.m==m)b.innerHTML=h};
 const a=p.pairCreatedAt?(Date.now()-p.pairCreatedAt)/3.6e6:null,t=(p.txns&&p.txns.h24)||{};
 if(p.chainId!='solana'){put(row('Liquidity',fm(liq(p)),liq(p)<10000?'dn':'up')+row('Age',age(p.pairCreatedAt),a!==null&&a<1?'':'up')+row('Buys vs sells 24h',(t.buys||0)+' / '+(t.sells||0),(t.sells||0)>(t.buys||0)*1.5?'dn':'up')+'<p class="small">Deep holder checks (top 10, dev, insiders) are Solana-only for now.</p>');return}
 try{const d=await j(RC+'/tokens/'+encodeURIComponent(m)+'/report'),mk=d.markets||[],pool=new Set();
  mk.forEach(x=>[x.pubkey,x.liquidityA,x.liquidityB,x.mintLP].forEach(a=>a&&pool.add(a)));
  const H=(d.topHolders||[]).filter(x=>!x.isPool&&!pool.has(x.address)&&!pool.has(x.owner)),pct=x=>Number(x.pct)||0,
  curve=/^pump(\.?fun)?$/i.test(p.dexId||'')||mk.some(x=>/pump_?fun$/i.test(x.marketType||'')),
  top10=H.slice(0,10).reduce((s,x)=>s+pct(x),0),dev=H.find(x=>d.creator&&(x.address==d.creator||x.owner==d.creator)),devP=dev?pct(dev):0,
  ins=H.filter(x=>x.insider).reduce((s,x)=>s+pct(x),0),nIns=Math.max(d.graphInsidersDetected||0,(d.insiderNetworks||[]).length),
  whales=H.filter(x=>pct(x)>=2).length,lp=Math.max(0,...mk.map(x=>x.lp&&Number(x.lp.lpLockedPct)||0));
  let s=0;if(d.rugged)s+=100;if(d.mintAuthority)s+=30;if(d.freezeAuthority)s+=25;s+=top10>50?25:top10>30?12:0;s+=devP>10?20:devP>3?8:0;
  s+=nIns?Math.min(30,10+nIns*4):0;s+=(!curve&&lp<50)?15:0;s+=liq(p)<10000?15:0;s+=(d.risks||[]).filter(x=>x.level=='danger').length*6;
  const lv=s>=55?['dn','🔴 High risk']:s>=25?['','🟡 Medium risk']:['up','🟢 Lower risk'];
  put(`<div class="pill mk-chip ${lv[0]}" style="font-size:16px">${lv[1]}</div>`
  +row('Rugged',d.rugged?'YES':'No',d.rugged?'dn':'up')+row('Mint authority',d.mintAuthority?'Active':'Renounced',d.mintAuthority?'dn':'up')
  +row('Freeze authority',d.freezeAuthority?'Active':'Renounced',d.freezeAuthority?'dn':'up')
  +row('Top 10 holders',top10.toFixed(1)+'%',top10>50?'dn':top10>30?'':'up')+row('Dev holding',dev?devP.toFixed(1)+'%':'not in top holders',devP>10?'dn':devP>3?'':'up')
  +row('Insiders',nIns?nIns+' found · '+ins.toFixed(1)+'% of supply':'None found',nIns?'dn':'up')+row('Whales (2%+ wallets)',String(whales),whales>3?'':'up')
  +(curve?row('Liquidity pool','Bonding curve','flat'):row('LP locked',lp.toFixed(0)+'%',lp<50?'dn':'up'))+row('Holders',d.totalHolders==null?'–':String(d.totalHolders))
  +((d.risks||[]).length?'<ul class="tr-ul">'+d.risks.slice(0,6).map(x=>`<li>${esc(x.name)}${x.description?' — '+esc(x.description):''}</li>`).join('')+'</ul>':'')
  +'<p class="small">Automatic estimate from RugCheck data (pool and bonding-curve accounts excluded from holder %). Not financial advice.</p>');
  scan(m,d.creator,H,pool)
 }catch(e){console.error(e);put('<p class="small">Couldn’t load the risk report right now. Treat this token as unchecked and be careful 💧</p>');const b=$('trScan');if(b&&b.dataset.m==m)b.innerHTML='<p class="small">Skipped.</p>'}}

/* ---- early-buyer scan: snipers, bundles, bots (Solana RPC + Helius parsed txs) ---- */
async function scan(m,creator,H,pool){const put=h=>{const b=$('trScan');if(b&&b.dataset.m==m)b.innerHTML=h};
 if(!$('trScan'))return;put('Reading the first trades… 🔎');
 try{const pk=new solanaWeb3.PublicKey(m);let sigs=[],before,full=true;
  for(let i=0;i<3;i++){const r=await conn.getSignaturesForAddress(pk,{limit:1000,before});sigs=sigs.concat(r);if(r.length<1000){full=false;break}before=r[r.length-1].signature}
  if(full)return put('<p class="small">This token is too old for the early-buyer scan (it only works on young tokens).</p>');
  const first=sigs.filter(s=>!s.err).slice(-80).reverse().map(s=>s.signature);
  if(!first.length||!HKEY)return put('<p class="small">No early trades found to scan.</p>');
  const r=await fetch('https://api.helius.xyz/v0/transactions?api-key='+HKEY,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transactions:first})});
  if(!r.ok)throw new Error('Helius '+r.status);
  const txs=(await r.json()).filter(x=>x&&x.slot).sort((a,b)=>a.slot-b.slot);if(!txs.length)return put('<p class="small">No early trades found to scan.</p>');
  const s0=txs[0].slot,W={},skip=x=>!x||pool.has(x)||x==creator;
  txs.forEach(t=>(t.tokenTransfers||[]).forEach(x=>{if(x.mint!=m)return;
   const w=(a,f)=>{if(skip(a))return;const o=W[a]=W[a]||{b:[],s:[],n:0};o[f].push(t.slot);o.n++};w(x.toUserAccount,'b');w(x.fromUserAccount,'s')}));
  const held={};H.forEach(x=>{const v=Number(x.pct)||0;if(x.owner)held[x.owner]=v;if(x.address)held[x.address]=v});
  const hp=arr=>arr.reduce((s,a)=>s+(held[a]||0),0),ws=Object.keys(W),
  snip=ws.filter(a=>W[a].b.some(sl=>sl-s0<=4)),
  bySlot={};ws.forEach(a=>W[a].b.forEach(sl=>{if(sl-s0<=10)(bySlot[sl]=bySlot[sl]||new Set()).add(a)}));
  const bl=Object.entries(bySlot).filter(([k,v])=>v.size>=3),bund=[...new Set(bl.flatMap(([k,v])=>[...v]))],
  bots=ws.filter(a=>W[a].n>=4||(W[a].b.length&&W[a].s.length&&Math.min(...W[a].s)-Math.min(...W[a].b)<=30&&Math.min(...W[a].s)>=Math.min(...W[a].b)));
  const sp=hp(snip),bp=hp(bund);
  put(row('Snipers (first ~2s)',snip.length?snip.length+' wallets · '+sp.toFixed(1)+'% held':'None found',sp>10||snip.length>=8?'dn':snip.length?'':'up')
  +row('Bundled buys',bund.length?bund.length+' wallets in '+bl.length+' slot'+(bl.length>1?'s':'')+' · '+bp.toFixed(1)+'% held':'None found',bp>10?'dn':bund.length?'':'up')
  +row('Likely bots',bots.length?String(bots.length)+' wallets':'None found',bots.length>=6?'dn':bots.length?'':'up')
  +`<p class="small">Based on the first ${txs.length} trades. Heuristics, so expect some false positives and misses.</p>`)
 }catch(e){console.error(e);put('<p class="small">Couldn’t run the early-buyer scan right now.</p>')}}

/* ---- trading: Jupiter first, Pump.fun route for bonding-curve tokens (non-custodial, wallet signs) ---- */
async function decOf(m){const a=await conn.getParsedAccountInfo(new solanaWeb3.PublicKey(m));return a.value&&a.value.data.parsed?a.value.data.parsed.info.decimals:6}
const quote=(i,o,amt,sl)=>j(JUP+'/quote?inputMint='+i+'&outputMint='+o+'&amount='+amt+'&slippageBps='+sl+'&restrictIntermediateTokens=true',JH);
async function sendTx(tx){const o=TR.o;if(!o)throw new Error('Reconnect your wallet');
 if(o.legacy){const p=o.legacy;if(p.signTransaction){const s=await p.signTransaction(tx);return conn.sendRawTransaction(s.serialize())}
  const r=await p.signAndSendTransaction(tx);return r.signature||r}
 const acc=(o.std.accounts||[]).find(a=>a.address==wallet)||(o.std.accounts||[])[0],f=o.std.features['solana:signTransaction'];
 if(!f)throw new Error('This wallet cannot sign swaps');
 const [r]=await f.signTransaction({account:acc,transaction:tx.serialize(),chain:'solana:mainnet'});return conn.sendRawTransaction(r.signedTransaction)}
async function jupTx(i,o,amt,sl){const q=await quote(i,o,amt,sl);if(q.error||!q.outAmount)throw new Error(q.error||'No route found');
 const r=await fetch(JUP+'/swap',{method:'POST',headers:Object.assign({'Content-Type':'application/json'},JH),body:JSON.stringify({quoteResponse:q,userPublicKey:wallet,wrapAndUnwrapSol:true,dynamicComputeUnitLimit:true,prioritizationFeeLamports:{priorityLevelWithMaxLamports:{maxLamports:1000000,priorityLevel:'high'}}})}),s=await r.json();
 if(!s.swapTransaction)throw new Error(s.error||'Could not build the swap');
 return solanaWeb3.VersionedTransaction.deserialize(Uint8Array.from(atob(s.swapTransaction),c=>c.charCodeAt(0)))}
async function pumpTx(pp,m,sl){const r=await fetch('https://pumpportal.fun/api/trade-local',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({publicKey:wallet,action:pp.a,mint:m,amount:pp.amount,denominatedInSol:pp.a=='buy'?'true':'false',slippage:Math.max(1,Math.round(sl/100)),priorityFee:0.0005,pool:'auto'})});
 if(!r.ok)throw new Error('Pump.fun route '+r.status);
 return solanaWeb3.VersionedTransaction.deserialize(new Uint8Array(await r.arrayBuffer()))}
async function swap(i,o,amt,sl,pp,m,pump){let tx;
 try{tx=await jupTx(i,o,amt,sl)}catch(e){if(!pump)throw e;tx=await pumpTx(pp,m,sl)}
 const sig=await sendTx(tx);toast('Sent ✔ '+short(sig));
 let c;try{c=await conn.confirmTransaction(sig,'confirmed')}catch(e){toast('Sent, still confirming…');loadAssets();return sig}
 if(c.value&&c.value.err)throw new Error('Transaction failed on-chain (try higher slippage)');
 toast('Confirmed ✔');loadAssets();return sig}
function wireTrade(d,m,pump){const amt=d.querySelector('#trAmt'),qb=d.querySelector('#trQ'),sl=()=>d.querySelector('#trSl').value;let tm=null;
 const prev=()=>{clearTimeout(tm);tm=setTimeout(async()=>{const v=parseFloat(amt.value);if(!(v>0)){qb.textContent='';return}
  try{const q=await quote(SOLM,m,Math.round(v*1e9),sl()),dc=await decOf(m);qb.textContent='≈ '+(q.outAmount/10**dc).toLocaleString(undefined,{maximumFractionDigits:2})+' tokens · price impact '+(Number(q.priceImpactPct||0)*100).toFixed(2)+'%'}
  catch(e){qb.textContent=pump?'Still on the Pump.fun curve. The buy will go through Pump.fun (about 1% fee).':'No quote available for this token yet.'}},400)};
 amt.oninput=prev;d.querySelector('#trSl').onchange=prev;
 d.querySelectorAll('[data-b]').forEach(b=>b.onclick=()=>{amt.value=b.dataset.b;prev()});
 d.querySelector('#trBuy').onclick=async function(){if(!wallet)return toast('Connect your wallet first');const v=parseFloat(amt.value);if(!(v>0))return toast('Enter a SOL amount');
  if(!confirm('Buy with '+v+' SOL? New tokens are very risky and can go to zero.'))return;
  this.disabled=true;try{await swap(SOLM,m,Math.round(v*1e9),sl(),{a:'buy',amount:v},m,pump)}catch(e){toast('Swap failed: '+(e.message||e))}this.disabled=false};
 d.querySelectorAll('[data-s]').forEach(b=>b.onclick=async()=>{if(!wallet)return toast('Connect your wallet first');
  try{const r=await conn.getParsedTokenAccountsByOwner(new solanaWeb3.PublicKey(wallet),{mint:new solanaWeb3.PublicKey(m)});let raw=0n;
   r.value.forEach(x=>raw+=BigInt(x.account.data.parsed.info.tokenAmount.amount));if(raw==0n)return toast('You don’t hold this token');
   const part=(raw*BigInt(b.dataset.s)/100n).toString();if(!confirm('Sell '+b.dataset.s+'% of your balance?'))return;await swap(m,SOLM,part,sl(),{a:'sell',amount:b.dataset.s+'%'},m,pump)}
  catch(e){toast('Swap failed: '+(e.message||e))}})}
})();
