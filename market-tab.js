/* ============================================================
   FIJI MARKET TAB LAYOUT  v2
   Load AFTER tradepad-gate.js:
     <script src="tradepad.js"></script>
     <script src="tradepad-popup.js"></script>
     <script src="tradepad-gate.js"></script>
     <script src="market-tab.js"></script>

   Market tab order:
     1. Your wallet: TICKER | HOLD | BALANCE | PNL (24h) | STATUS
     2. FIJI token status with Buy and Sell buttons
     3. COMING SOON teaser
     4. The existing meme coin market (unchanged)

   New in v2:
   - Wallet table with the real token image, USD balance, 24h PNL
     and a % status chip. SOL, USDC and FIJI are always listed.
   - Prices and images come from DexScreener (cached 25s).
   ============================================================ */
(function(){
'use strict';

const C=window.FIJI_CORE||{},T=window.FIJI_TRADE;
const $=id=>document.getElementById(id);
const sec=$('wallet'),hero=$('mkHero');
if(!sec||!hero||!C.CFG){console.warn('market-tab: page not ready');return}

/* ---------------- styles ---------------- */
const css=document.createElement('style');
css.textContent=`
.fj-act{margin-top:14px}
.fj-act .btn[data-a=buy]{background:#7CF0A8;color:var(--ink)}
.fj-act .btn[data-a=sell]{background:#FFD0D8;color:var(--ink)}
.cs{text-align:center;padding:30px 22px;margin:22px 0 0}
.cs .pill{font-size:15px;letter-spacing:.08em;transform:rotate(-2deg)}
.cs h3{font-size:clamp(24px,4vw,32px);margin:12px 0 4px}
.cs .grid{margin-top:18px;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px}
.cs-tile{border:2.5px dashed var(--ink);border-radius:18px;background:var(--soft);padding:16px 8px;font:600 15px Fredoka;opacity:.8}
.cs-tile span{display:block;font-size:30px;margin-bottom:2px}

/* wallet table */
table.wt{min-width:560px}
.wt th,.wt td{white-space:nowrap;word-break:normal;text-align:right;padding:10px 8px;vertical-align:middle}
.wt th:first-child,.wt td:first-child{text-align:left}
.wt th{font-size:13px;letter-spacing:.06em;text-transform:uppercase;opacity:.75}
.wt-tok{display:flex;align-items:center;gap:10px}
.wt-tok img,.wt-ph{width:36px;height:36px;border-radius:50%;border:2.5px solid var(--ink);object-fit:cover;background:var(--sb);flex:none;display:flex;align-items:center;justify-content:center;font-size:17px}
.wt-tok b{display:block;font:600 17px Fredoka;line-height:1.1}
.wt-tok span.n{display:block;font-size:12px;opacity:.65;max-width:130px;overflow:hidden;text-overflow:ellipsis}
.wt .up{color:var(--upi)}
.wt .dn{color:var(--dni)}
.wt .st{display:inline-block;border:2px solid var(--ink);border-radius:99px;padding:1px 10px;font:600 13px Fredoka}
.wt .st.up{background:#B8F5D2}
.wt .st.dn{background:#FFD0D8}
.wt .st.flat{background:var(--sb)}
.wt tr.tot td{border-top:3px solid var(--ink);border-bottom:0;font:600 16px Fredoka}
`;
document.head.appendChild(css);

/* ---------------- 1. wallet moves to the top ---------------- */
const tags=sec.querySelectorAll(':scope > .tag');
const walletTag=tags[1];
if(walletTag){
  const wH2=walletTag.nextElementSibling,wCard=wH2&&wH2.nextElementSibling;
  if(wH2&&wCard)sec.prepend(walletTag,wH2,wCard);
}

/* ---------------- 1b. wallet table ---------------- */
const SOL='So11111111111111111111111111111111111111112';
const USDC='EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const FIJI=C.CFG.FIJI_MINT;
const PINNED=[SOL,USDC,FIJI];
const FALLBACK={[SOL]:'◎',[USDC]:'💵'};

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
function amount(n){
  return n>=1000?n.toLocaleString(undefined,{maximumFractionDigits:2}):n.toLocaleString(undefined,{maximumFractionDigits:4});
}
function pnlText(v){
  if(v===null)return '—';
  if(Math.abs(v)<0.005)return '$0.00';
  return (v>0?'↑ +':'↓ -')+money(Math.abs(v));
}
function pctText(v){
  if(v===null)return '—';
  return (v>0?'+':'')+v.toFixed(Math.abs(v)>=100?0:1)+'%';
}

/* DexScreener lookup, cached per mint */
const cache=new Map();
async function getPairs(mints){
  const need=mints.filter(m=>{const c=cache.get(m);return !c||Date.now()-c.t>25000});
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
    }catch(e){console.warn('wallet table: price lookup failed',e)}
  }
  const out={};
  mints.forEach(m=>{const c=cache.get(m);out[m]=c?c.pair:null});
  return out;
}

const tbl=$('assets');
if(tbl){
  tbl.classList.add('wt');
  tbl.insertAdjacentHTML('afterend','<p class="small" style="margin-top:10px">PNL and Status show the last 24 hours at current prices. Prices from DexScreener.</p>');
}

function paint(rows,pairs){
  if(!tbl)return;
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
    const name=r.mint===SOL?'Solana':r.mint===USDC?'USD Coin':r.mint===FIJI?'Fiji':(bt.name||'Unknown token');
    const img=r.mint===FIJI?'fiji.png':safeImg(pr&&pr.info&&pr.info.imageUrl);
    return {...r,sym,name,img,price,chg,val,pnl,pin:PINNED.indexOf(r.mint)}
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

  const body=list.map(r=>{
    const k=dir(r.pnl),s=dir(r.chg);
    const fb=FALLBACK[r.mint]||'🪙';
    const pic=r.img?`<img src="${esc(r.img)}" alt="" loading="lazy" data-fb="${fb}">`:`<span class="wt-ph">${fb}</span>`;
    return `<tr>
      <td><div class="wt-tok">${pic}<div><b>${esc(r.sym)}</b><span class="n">${esc(r.name)}</span></div></div></td>
      <td>${r.amt>0?amount(r.amt):'0'}</td>
      <td>${r.val===null?'—':money(r.val)}</td>
      <td class="${k}">${pnlText(r.pnl)}</td>
      <td><span class="st ${s}">${pctText(r.chg)}</span></td>
    </tr>`;
  }).join('');

  const tk=dir(totPnl);
  tbl.innerHTML=`<thead><tr><th>Ticker</th><th>Hold</th><th>Balance</th><th>PNL (24h)</th><th>Status</th></tr></thead>
    <tbody>${body}
    <tr class="tot"><td>Total</td><td></td><td>${money(totVal)}</td><td class="${tk}">${pnlText(totPnl)}</td><td><span class="st ${dir(totPct)}">${pctText(totPct)}</span></td></tr></tbody>`;

  tbl.querySelectorAll('img[data-fb]').forEach(i=>{
    i.addEventListener('error',()=>{
      const sp=document.createElement('span');
      sp.className='wt-ph';sp.textContent=i.dataset.fb;
      i.replaceWith(sp);
    },{once:true});
  });
}

let seq=0;
async function draw(p){
  if(!tbl)return;
  if(!(C.getWallet&&C.getWallet())){tbl.innerHTML='';return}
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

  paint(rows,{});                       // show balances right away
  const pairs=await getPairs(mints);    // then fill in price, PNL and images
  if(my!==seq)return;
  paint(rows,pairs);
}

/* Runs every time index.html reports fresh balances (connect, refresh, disconnect) */
if(T){
  const prevPortfolio=T.portfolioUpdated;
  T.portfolioUpdated=function(p){
    const r=typeof prevPortfolio==='function'?prevPortfolio.apply(T,arguments):undefined;
    draw(p).catch(e=>console.warn('wallet table failed',e));
    return r;
  };
}else{
  console.warn('market-tab: tradepad.js not loaded, wallet table will not update');
}

/* ---------------- 2. Buy / Sell on the FIJI status card ---------------- */
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
    st.base=[pair,...st.base.filter(x=>x.baseToken?.address!==mint)];   // lets the Trade Pad find FIJI
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

/* ---------------- 3. COMING SOON teaser ---------------- */
const teaser=document.createElement('div');
teaser.className='sticker card cs';
teaser.innerHTML=`<span class="pill">COMING SOON</span>
 <h3>Spend your FIJI</h3>
 <p>New things to buy with FIJI are on the way. Details will be announced here.</p>
 <div class="grid">
  <div class="cs-tile"><span>🎁</span>Mystery item</div>
  <div class="cs-tile"><span>✨</span>Mystery item</div>
  <div class="cs-tile"><span>🔒</span>Mystery item</div>
 </div>`;
hero.after(teaser);

/* ---------------- 4. label for the existing coin market ---------------- */
const majors=$('mkMajors');
if(majors){
  const t=document.createElement('div');
  t.className='tag';
  t.textContent='meme coin market';
  majors.before(t);
}

})();
