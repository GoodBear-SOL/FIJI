/* ============================================================
   FIJI TRADE PAD · HOLDER GATE
   Load AFTER tradepad.js and tradepad-popup.js:
     <script src="tradepad.js"></script>
     <script src="tradepad-popup.js"></script>
     <script src="tradepad-gate.js"></script>

   What it does:
   - Blocks the Trade tab with a popup until the connected wallet
     holds at least MIN_FIJI of the FIJI token.
   - Stops the live token feeds while locked, hides the feed UI.
   - Re-checks the balance every 20s, so selling below the
     minimum locks the tab again.
   Nothing in index.html or tradepad.js is changed.
   ============================================================ */
(function(){
'use strict';

const C=window.FIJI_CORE||{},T=window.FIJI_TRADE;
if(!T||!C.CFG){console.warn('tradepad-gate: load it after tradepad.js');return}

/* ---------------- settings ---------------- */
const MIN_FIJI=5000;           // required FIJI balance
const RECHECK_MS=20000;          // balance re-check while on the Trade tab
const MINT=C.CFG.FIJI_MINT;
const BUY_URL='https://jup.ag/swap/SOL-'+MINT;

const $=id=>document.getElementById(id);
const section=$('trade');
if(!section)return;

let checked=false;   // true once a balance has been loaded for the connected wallet
let balance=0;

/* ---------------- styles ---------------- */
const css=document.createElement('style');
css.textContent=`
#trade.fg-locked .disc,
#trade.fg-locked .tsearch,
#trade.fg-locked .live-strip,
#trade.fg-locked .tlayout{display:none}
.fg-modal{position:fixed;inset:0;background:rgba(18,48,92,.65);z-index:480;display:none;align-items:center;justify-content:center;padding:16px}
.fg-modal.on{display:flex}
.fg-sheet{width:100%;max-width:420px;text-align:center;padding:22px;background:var(--bg)}
.fg-sheet .em{font-size:44px}
.fg-sheet h3{font-size:26px;margin:6px 0 8px}
.fg-need{display:flex;justify-content:space-between;gap:10px;background:#fff;border:2.5px dashed var(--ink);border-radius:16px;padding:10px 14px;margin:14px 0;font:600 15px Fredoka}
.fg-acts{display:grid;gap:10px;margin-top:6px}
/* wallet picker must open ABOVE the gate popup (480) but below the toast (500) */
.modal{z-index:490}
`;
document.head.appendChild(css);

/* ---------------- popup ---------------- */
const modal=document.createElement('div');
modal.className='fg-modal';
modal.innerHTML='<div class="sticker fg-sheet" role="alertdialog" aria-modal="true" aria-label="FIJI holders only"></div>';
document.body.appendChild(modal);
const sheet=modal.firstChild;
const fmt=n=>Number(n||0).toLocaleString(undefined,{maximumFractionDigits:2});

function render(state){
  const need='<div class="fg-need"><span>Required</span><b>'+fmt(MIN_FIJI)+' FIJI</b></div>';
  const have='<div class="fg-need"><span>Your balance</span><b>'+fmt(balance)+' FIJI</b></div>';
  if(state==='checking'){
    sheet.innerHTML='<div class="em">⏳</div><h3>Checking your FIJI…</h3><p class="small">Reading your wallet balance.</p>'+
      '<div class="fg-acts"><button class="btn alt" data-a="recheck">Check again</button><button class="btn alt" data-a="home">Back to home</button></div>';
    return;
  }
  const msg='You need to hold at least <b>'+fmt(MIN_FIJI)+' FIJI</b> in your connected wallet before you can use the sniper feature and see early tokens.';
  if(state==='connect'){
    sheet.innerHTML='<div class="em">🔒</div><h3>Holders only</h3><p>'+msg+'</p>'+need+
      '<div class="fg-acts"><button class="btn" data-a="connect">Connect wallet</button>'+
      '<a class="btn alt" href="'+BUY_URL+'" target="_blank" rel="noopener">Buy FIJI</a>'+
      '<button class="btn alt" data-a="home">Back to home</button></div>';
    return;
  }
  sheet.innerHTML='<div class="em">🔒</div><h3>Not enough FIJI</h3><p>'+msg+'</p>'+need+have+
    '<div class="fg-acts"><a class="btn" href="'+BUY_URL+'" target="_blank" rel="noopener">Buy FIJI</a>'+
    '<button class="btn alt" data-a="recheck">I bought some, check again</button>'+
    '<button class="btn alt" data-a="home">Back to home</button></div>';
}

sheet.addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a;
  if(a==='connect'&&typeof window.connect==='function')window.connect();
  else if(a==='recheck'){checked=false;evaluate();C.loadAssets&&C.loadAssets()}
  else if(a==='home')C.go&&C.go('home');
});

/* ---------------- balance + decision ---------------- */
function holdings(){
  const toks=(T.getState().portfolio&&T.getState().portfolio.tokens)||[];
  return toks.filter(t=>t&&t.mint===MINT).reduce((s,t)=>s+(Number(t.tokenAmount&&t.tokenAmount.uiAmount)||0),0);
}

function evaluate(){
  const onTrade=section.classList.contains('on');
  const w=C.getWallet?C.getWallet():null;
  let state;
  if(!w)state='connect';
  else if(!checked)state='checking';
  else{balance=holdings();state=balance>=MIN_FIJI?'ok':'low'}

  const locked=state!=='ok';
  section.classList.toggle('fg-locked',locked);

  if(locked){
    if(onTrade){render(state);modal.classList.add('on');if(T.getState().started)T.stop()}
    else modal.classList.remove('on');
  }else{
    modal.classList.remove('on');
    if(onTrade&&!T.getState().started)T.start();
  }
}

/* ---------------- hooks ---------------- */
const origPortfolio=T.portfolioUpdated,origWallet=T.walletChanged;

T.portfolioUpdated=function(){
  const r=origPortfolio.apply(T,arguments);
  if(C.getWallet&&C.getWallet())checked=true;
  evaluate();
  return r;
};

T.walletChanged=function(address){
  checked=false;
  const r=origWallet.apply(T,arguments);
  evaluate();
  if(address&&C.loadAssets)C.loadAssets();   // guarantees a fresh balance after connect
  return r;
};

/* Runs when the user opens or leaves the Trade tab */
new MutationObserver(evaluate).observe(section,{attributes:true,attributeFilter:['class']});

/* Re-check while the tab is open */
setInterval(()=>{
  if(section.classList.contains('on')&&!document.hidden&&C.getWallet&&C.getWallet()&&C.loadAssets)C.loadAssets();
},RECHECK_MS);

evaluate();
})();
