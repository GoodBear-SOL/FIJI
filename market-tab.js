(function(){
'use strict';

const C=window.FIJI_CORE||{},T=window.FIJI_TRADE;
const $=id=>document.getElementById(id);
const sec=$('wallet'),hero=$('mkHero');
if(!sec||!hero||!C.CFG){console.warn('market-tab: page not ready');return}

const css=document.createElement('style');
css.textContent=`
.fj-act{margin-top:14px}
.fj-act .btn[data-a=buy]{background:#7CF0A8;color:var(--ink)}
.fj-act .btn[data-a=sell]{background:#FFD0D8;color:var(--ink)}
.cs-grid{margin-top:6px}
.cs{text-align:center;padding:26px 18px;margin:0}
.cs .em{font-size:40px;margin-top:10px}
.cs .pill{font-size:15px;letter-spacing:.08em;transform:rotate(-2deg)}
.cs h3{font-size:clamp(24px,4vw,32px);margin:12px 0 4px}
.cs .grid{margin-top:18px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
.cs-tile{border:2.5px dashed var(--ink);border-radius:18px;background:var(--soft);padding:16px 8px;font:600 15px Fredoka;opacity:.8}
.cs-tile span{display:block;font-size:30px;margin-bottom:2px}

/* ===== Bunny Bag (compact, no sideways scroll) ===== */
#wallet .card{overflow-x:hidden}
#assets{display:none}
.bag-total{background:linear-gradient(135deg,var(--sun),#FFE88A);border:3px solid var(--ink);border-radius:22px;
 padding:14px 16px;margin-bottom:12px;box-shadow:0 4px 0 var(--ink);
 display:flex;justify-content:space-between;align-items:center;gap:10px}
.bag-total .lbl{font:600 13px Fredoka;letter-spacing:.08em;text-transform:uppercase;opacity:.75}
.bag-total b{display:block;font:700 clamp(28px,8vw,38px)/1.05 Fredoka;word-break:break-all}
.bag-total .pill{font-size:14px;padding:2px 12px;white-space:nowrap}
.bag-total .pill.up{background:#B8F5D2;color:var(--upi)}
.bag-total .pill.dn{background:#FFD0D8;color:var(--dni)}
.bag-total .pill.flat{background:#fff}
.bag-list{display:grid;gap:8px}
.bg-row{background:#fff;border:2.5px solid var(--ink);border-radius:18px;overflow:hidden;box-shadow:0 3px 0 var(--ink)}
.bg-main{display:flex;align-items:center;gap:10px;padding:10px 12px;cursor:pointer;min-width:0}
.bg-main:active{background:#FFF6CF}
.bg-main img,.bg-ph{width:40px;height:40px;border-radius:50%;border:2.5px solid var(--ink);object-fit:cover;background:var(--sb);flex:none;display:flex;align-items:center;justify-content:center;font-size:19px}
.bg-l{flex:1;min-width:0;line-height:1.2}
.bg-l b{display:block;font:600 17px Fredoka;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bg-l span{display:block;font-size:13px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bg-r{text-align:right;flex:none;max-width:48%;line-height:1.2}
.bg-r b{display:block;font:700 17px Fredoka;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bg-chg{display:inline-block;border:2px solid var(--ink);border-radius:99px;padding:0 9px;margin-top:2px;font:600 12px Fredoka;white-space:nowrap}
.bg-chg.up{background:#B8F5D2;color:var(--upi)}
.bg-chg.dn{background:#FFD0D8;color:var(--dni)}
.bg-chg.flat{background:var(--sb)}
.bg-more{display:none;padding:10px 12px 12px;border-top:2px dashed var(--line);background:var(--soft)}
.bg-row.open .bg-more{display:block}
.bg-det{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px}
.bg-det div{background:#fff;border:2px dashed var(--line);border-radius:12px;padding:6px 8px;min-width:0}
.bg-det b{display:block;font:600 14px Fredoka;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bg-det span{font-size:11px;opacity:.65}
.bg-det .up{color:var(--upi)}
.bg-det .dn{color:var(--dni)}
.bg-acts{display:flex;gap:8px}
.bg-acts .btn{flex:1;padding:8px 10px;font-size:15px;min-height:0}
.bg-acts .btn[data-wa=buy]{background:#7CF0A8;color:var(--ink)}
.bg-acts .btn[data-wa=sell]{background:#FFD0D8;color:var(--ink)}
.bag-empty{padding:18px;text-align:center;border:2px dashed var(--line);border-radius:17px;background:var(--soft)}
@media(max-width:420px){
 .bag-total{padding:12px 14px}
 .bg-main{padding:9px 10px;gap:8px}
 .bg-main img,.bg-ph{width:36px;height:36px}
 .bg-l b,.bg-r b{font-size:16px}
}
`;
document.head.appendChild(css);

const SOL='So11111111111111111111111111111111111111112';
const USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const FIJI=C.CFG.FIJI_MINT;
const PINNED=[SOL,USDC,FIJI];
const FALLBACK={[SOL]:'◎',[USDC]:'💵'};
const REFRESH_MS=3000;

const num=x=>{const n=parseFloat(x);return isFinite(n)?n:null};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const liqOf=p=>num(p&&p.liquidity&&p.liquidity.usd)||0;
const safeImg=u=>/^https:\/\//.test(u||'')?u:'';
const shortMint=s=>String(s||'').slice(0,4)+'…'+String(s||'').slice(-4);
const dir=v=>v===null||Math.abs(v)<0.005?'flat':v>0?'up':'dn';

function money(n){
  if(n===null)return '—';
  const a=Math.abs(n);
  const s=a>=1000?a.toLocaleString(undefined,{maximumFractionDigits:0}):a>=1?a.toFixed(2):a>0?a.toFixed(4):'0.00';
  return (n<0?'-':'')+'$'+s;
}
function priceFmt(n){
  if(n===null)return '—';
  if(n>=1)return '$'+n.toLocaleString(undefined,{maximumFractionDigits:2});
  if(n>=0.01)return '$'+n.toFixed(4);
  if(n<=0)return '$0';
  return '$'+n.toFixed(Math.min(12,2-Math.floor(Math.log10(n))));
}
function amount(n){
  if(n>=1e9)return (n/1e9).toFixed(2)+'B';
  if(n>=1e6)return (n/1e6).toFixed(2)+'M';
  if(n>=1000)return n.toLocaleString(undefined,{maximumFractionDigits:2});
  return n.toLocaleString(undefined,{maximumFractionDigits:4});
}
function pnlText(v){
  if(v===null)return '—';
  if(Math.abs(v)<0.005)return '$0.00';
  return (v>0?'+':'-')+money(Math.abs(v));
}
function pctText(v){
  if(v===null)return '—';
  return (v>0?'+':'')+v.toFixed(Math.abs(v)>=100?0:1)+'%';
}

const cache=new Map();
async function getPairs(mints,ttl){
  const life=ttl||25000;
  const need=mints.filter(m=>{const c=cache.get(m);return !c||Date.now()-c.t>life});
  for(let i=0;i<need.length;i+=30){
    const chunk=need.slice(i,i+30).filter(m=>/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(m));
    if(!chunk.length)continue;
    try{
      const r=await fetch('https://api.dexscreener.com/tokens/v1/solana/'+chunk.join(','));
      if(!r.ok)throw new Error('HTTP '+r.status);
      const d=await r.json(),best={};
      (Array.isArray(d)?d:[]).forEach(p=>{
        const a=p&&p.baseToken&&p.baseToken.address;
        if(a&&(!best[a]||liqOf(p)>liqOf(best[a])))best[a]=p;
      });
      chunk.forEach(m=>cache.set(m,{t:Date.now(),pair:best[m]||null}));
    }catch(e){console.warn('wallet: price lookup failed',e)}
  }
  const out={};
  mints.forEach(m=>{const c=cache.get(m);out[m]=c?c.pair:null});
  return out;
}

/* ===== Bunny Bag rendering ===== */
const oldTbl=$('assets');
const bag=document.createElement('div');
bag.id='bag';
if(oldTbl){
  oldTbl.after(bag);
  bag.insertAdjacentHTML('afterend','<p class="small" id="bagNote" style="margin-top:10px;display:none">PNL and Status show the last 24 hours at current prices. Tap a coin for details. Prices from DexScreener.</p>');
}

let curKey='',openMint=null,lastVal={};

function setText(el,t){if(el&&el.textContent!==t)el.textContent=t}
function setCls(el,base,k){if(el){const c=base+' '+k;if(el.className!==c)el.className=c}}

function buildRows(list){
  const html=list.map(r=>{
    const fb=FALLBACK[r.mint]||'🪙';
    const pic=r.img?`<img src="${esc(r.img)}" alt="" loading="lazy" data-fb="${fb}">`:`<span class="bg-ph">${fb}</span>`;
    const canTrade=r.mint!==SOL;
    const acts=canTrade
      ?`<div class="bg-acts"><button class="btn sm" type="button" data-wa="buy">Buy</button>${r.amt>0?'<button class="btn sm alt" type="button" data-wa="sell">Sell</button>':''}</div>`
      :'<div class="small">SOL is what you pay with.</div>';
    return `<div class="bg-row${r.mint===openMint?' open':''}" data-mint="${esc(r.mint)}">
      <div class="bg-main">${pic}
        <div class="bg-l"><b>${esc(r.sym)}</b><span data-f="amt"></span></div>
        <div class="bg-r"><b data-f="val"></b><span class="bg-chg flat" data-f="chg"></span></div>
      </div>
      <div class="bg-more">
        <div class="bg-det"><div><b data-f="price"></b><span>Price</span></div><div><b data-f="pnl"></b><span>PNL (24h)</span></div></div>
        ${acts}
      </div></div>`;
  }).join('');
  bag.innerHTML=`<div class="bag-total"><div><div class="lbl">Total balance</div><b data-f="tot">$0.00</b></div><span class="pill flat" data-f="totchg">—</span></div><div class="bag-list">${html}</div>`;
  bag.querySelectorAll('img[data-fb]').forEach(i=>{
    i.addEventListener('error',()=>{
      const sp=document.createElement('span');
      sp.className='bg-ph';sp.textContent=i.dataset.fb;
      i.replaceWith(sp);
    },{once:true});
  });
}

function paint(rows,pairs){
  if(!oldTbl)return;
  const list=rows.map(r=>{
    const pr=pairs[r.mint]||null;
    let price=pr?num(pr.priceUsd):null;
    let chg=pr&&pr.priceChange?num(pr.priceChange.h24):null;
    if(r.mint===USDC){if(price===null)price=1;if(chg===null)chg=0}
    const val=price!==null?r.amt*price:null;
    const c=chg!==null?Math.max(chg,-99.9):null;
    const pnl=(val!==null&&c!==null)?val-val/(1+c/100):null;
    const bt=pr&&pr.baseToken||{};
    const sym=r.mint===SOL?'SOL':r.mint===USDC?'USDC':r.mint===FIJI?'FIJI':(bt.symbol||shortMint(r.mint));
    const img=r.mint===FIJI?'fiji.png':safeImg(pr&&pr.info&&pr.info.imageUrl);
    return {...r,sym,img,price,chg,val,pnl,pin:PINNED.indexOf(r.mint)}
  });

  list.sort((a,b)=>{
    if(a.pin>=0&&b.pin>=0)return a.pin-b.pin;
    if(a.pin>=0)return -1;
    if(b.pin>=0)return 1;
    return (b.val===null?-1:b.val)-(a.val===null?-1:a.val);
  });

  let totVal=0,totPnl=0;
  list.forEach(r=>{if(r.val!==null)totVal+=r.val;if(r.pnl!==null)totPnl+=r.pnl});
  const prev=totVal-totPnl,totPct=prev>0?totPnl/prev*100:null;

  // Rebuild only when the set of coins (or their icons) changes; otherwise update in place (no flicker)
  const key=list.map(r=>r.mint+'|'+(r.img?1:0)+'|'+(r.amt>0?1:0)).join(',');
  if(key!==curKey){curKey=key;buildRows(list)}

  setText(bag.querySelector('[data-f=tot]'),money(totVal));
  const tc=bag.querySelector('[data-f=totchg]');
  if(tc){
    setText(tc,pnlText(totPnl)+(totPct===null?'':' · '+pctText(totPct)));
    setCls(tc,'pill',dir(totPct===null?null:totPct));
  }

  list.forEach(r=>{
    const row=bag.querySelector('.bg-row[data-mint="'+r.mint+'"]');
    if(!row)return;
    const f=n=>row.querySelector('[data-f='+n+']');
    setText(f('amt'),amount(r.amt)+' '+r.sym);
    const vt=r.val===null?'—':money(r.val);
    setText(f('val'),vt);
    setText(f('chg'),pctText(r.chg));
    setCls(f('chg'),'bg-chg',dir(r.chg));
    setText(f('price'),priceFmt(r.price));
    const pe=f('pnl');setText(pe,pnlText(r.pnl));if(pe)pe.className=dir(r.pnl);

    // soft flash when value moves
    const old=lastVal[r.mint];
    if(old!==undefined&&r.val!==null&&Math.abs(r.val-old)>1e-9){
      const m=row.querySelector('.bg-main');
      m.classList.remove('fl-up','fl-dn');void m.offsetWidth;
      m.classList.add(r.val>old?'fl-up':'fl-dn');
    }
    if(r.val!==null)lastVal[r.mint]=r.val;
  });
  const n=$('bagNote');if(n)n.style.display='block';
}

let seq=0;
async function draw(p){
  if(!oldTbl)return;
  if(!(C.getWallet&&C.getWallet())){
    seq++;curKey='';lastVal={};openMint=null;bag.innerHTML='';
    const n=$('bagNote');if(n)n.style.display='none';
    return;
  }
  const my=++seq;
  let solAmt=num(p&&p.sol)||0;
  const hold=new Map();
  ((p&&p.tokens)||[]).forEach(t=>{
    if(!t||!t.mint)return;
    const a=num(t.tokenAmount&&t.tokenAmount.uiAmount)||0;
    if(t.mint===SOL){solAmt+=a;return}
    hold.set(t.mint,(hold.get(t.mint)||0)+a);
  });
  const extra=[...hold.keys()].filter(m=>PINNED.indexOf(m)<0).slice(0,60);
  const mints=PINNED.concat(extra);
  const rows=mints.map(m=>({mint:m,amt:m===SOL?solAmt:(hold.get(m)||0)}));

  if(!bag.firstChild)paint(rows,{});
  const pairs=await getPairs(mints,2500);
  if(my!==seq)return;
  paint(rows,pairs);
}

async function openAsset(mint,action){
  if(mint===SOL)return C.toast('SOL is what you pay with. Pick a token to trade.');
  if(!T||typeof window.tradeSelectByKey!=='function')return C.toast('Trade Pad is still loading');
  try{
    const pair=(await getPairs([mint]))[mint];
    if(!pair)return C.toast('No market found for this token yet 💧');
    const st=T.getState();
    st.base=[{...pair},...st.base.filter(x=>x?.baseToken?.address!==mint)];
    await window.tradeSelectByKey('solana:'+mint);
    window.tradeSetAction(action);
  }catch(e){
    console.warn('Open asset failed',e);
    C.toast('Could not open this token right now 💧');
  }
}

bag.addEventListener('click',e=>{
  const row=e.target.closest('.bg-row');if(!row)return;
  const b=e.target.closest('[data-wa]');
  if(b){openAsset(row.dataset.mint,b.dataset.wa);return}
  // tap a row to open / close its details (one open at a time)
  const was=row.classList.contains('open');
  bag.querySelectorAll('.bg-row.open').forEach(r=>r.classList.remove('open'));
  openMint=was?null:row.dataset.mint;
  if(!was)row.classList.add('open');
});

if(T){
  const prevPortfolio=T.portfolioUpdated;
  T.portfolioUpdated=function(p){
    const r=typeof prevPortfolio==='function'?prevPortfolio.apply(T,arguments):undefined;
    draw(p).catch(e=>console.warn('wallet bag failed',e));
    return r;
  };
}else{
  console.warn('market-tab: tradepad.js not loaded, wallet bag will not update');
}

/* Silent auto-refresh every 3s (only while the Burrow tab is open, the tab is visible, and a wallet is connected) */
let refreshing=false;
setInterval(async()=>{
  if(refreshing||document.hidden)return;
  if(!sec.classList.contains('on'))return;
  if(!(C.getWallet&&C.getWallet()))return;
  refreshing=true;
  try{await C.loadAssets()}catch(e){}
  finally{refreshing=false}
},REFRESH_MS);

/* ===== Buy / Sell FIJI on the home hero ===== */
function addActs(){
  if(hero.querySelector('.fj-act')||!hero.querySelector('.mk-hp'))return;
  const row=document.createElement('div');
  row.className='mk-acts fj-act';
  row.innerHTML='<button class="btn sm" type="button" data-a="buy">Buy FIJI</button><button class="btn sm" type="button" data-a="sell">Sell FIJI</button>';
  hero.appendChild(row);
}
new MutationObserver(addActs).observe(hero,{childList:true});
addActs();

async function tradeFiji(action){
  const mint=C.CFG.FIJI_MINT;
  C.go('trade');
  try{
    const r=await fetch('https://api.dexscreener.com/token-pairs/v1/solana/'+encodeURIComponent(mint));
    if(!r.ok)throw new Error('HTTP '+r.status);
    const pairs=await r.json();
    const pair=(Array.isArray(pairs)?pairs:[]).reduce((m,p)=>!m||(+(p.liquidity&&p.liquidity.usd)||0)>(+(m.liquidity&&m.liquidity.usd)||0)?p:m,null);
    if(!pair)return C.toast('FIJI is not listed on DexScreener yet');
    const st=window.FIJI_TRADE.getState();
    st.base=[pair,...st.base.filter(x=>x.baseToken?.address!==mint)];
    await window.tradeSelectByKey('solana:'+mint);
    window.tradeSetAction(action);
  }catch(e){
    console.warn('Buy/Sell FIJI failed',e);
    C.toast('Could not open FIJI right now. Try again in a moment 💧');
  }
}
hero.addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');
  if(b)tradeFiji(b.dataset.a);
});

const soon=document.createElement('div');
soon.innerHTML=`<div class="tag">coming soon to the burrow</div>
 <h2>More to dig up.</h2>
 <div class="grid cs-grid">
  <div class="sticker card cs"><span class="pill">COMING SOON</span><div class="em">🛍️</div><h3>Shop</h3>
   <p>New things to buy with FIJI are on the way. Details will be announced here.</p>
   <div class="grid"><div class="cs-tile"><span>🎁</span>Mystery item</div><div class="cs-tile"><span>✨</span>Mystery item</div></div></div>
  <div class="sticker card cs"><span class="pill">COMING SOON</span><div class="em">⛏️</div><h3>Mining</h3>
   <p>Dig for BUN together with the community. BUN is for fun and has no cash value.</p>
   <div class="grid"><div class="cs-tile"><span>🔒</span>Locked</div><div class="cs-tile"><span>🔒</span>Locked</div></div></div>
  <div class="sticker card cs"><span class="pill">COMING SOON</span><div class="em">🖼️</div><h3>NFTs</h3>
   <p>Bunny collectibles and your own NFTs will show up here. Nothing to claim yet.</p>
   <div class="grid"><div class="cs-tile"><span>🐰</span>Mystery bunny</div><div class="cs-tile"><span>💧</span>Mystery drop</div></div></div>
 </div>
 <p class="small" style="margin-top:14px">Nothing here is live yet and no rewards are promised.</p>`;
sec.appendChild(soon);

})();
