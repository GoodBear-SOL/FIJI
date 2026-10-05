/* ============================================================
   FIJI TRADE PAD · "ALL COINS" MODE
   Load AFTER tradepad.js, tradepad-popup.js, tradepad-gate.js
   and market-tab.js (replaces market-trade.js):
     <script src="tradepad.js"></script>
     <script src="tradepad-popup.js"></script>
     <script src="tradepad-gate.js"></script>
     <script src="market-tab.js"></script>
     <script src="trade-all.js"></script>

   What it does:
   - Adds a "🌍 All coins" tab to the Trade Pad. It shows the coin
     market (SOL / ETH / BNB, Solana, Ethereum, BNB Chain, Base, Hot)
     that used to live on the Market tab. The markup and market
     code stay in index.html, this file only wires it into Trade.
   - Solana coins open in the normal Trade Pad popup (stats, swap).
   - Coins on other chains open the view-only chart sheet with a
     "Solana trading only" note, because the trade router only
     builds Solana swaps.
   - The coin feed only refreshes while All coins is visible.
   Nothing else in the other files is changed.
   ============================================================ */
(function(){
'use strict';

const C=window.FIJI_CORE||{},T=window.FIJI_TRADE;
const sec=document.getElementById('trade'),panel=document.getElementById('allCoins');
if(!T||!sec||!panel||typeof MK==='undefined'||typeof window.openPair!=='function'||typeof window.tradeSetMode!=='function'){
  console.warn('trade-all: load it after tradepad.js, tradepad-popup.js and market-tab.js');return;
}

const SOL_MINT='So11111111111111111111111111111111111111112';
let mode='';          // '' = a normal Trade Pad feed, 'all' = All coins
let wasActive=false;

/* ---------------- styles ---------------- */
const css=document.createElement('style');
css.textContent=`
#allCoins{display:none}
#trade.ac-on #allCoins{display:block}
#trade.ac-on .tsearch,
#trade.ac-on .live-strip,
#trade.ac-on .tlayout{display:none}
.ac-note{background:var(--soft);border:2px dashed var(--line);border-radius:14px;padding:10px 12px;font-size:14px;margin:12px 0}
`;
document.head.appendChild(css);

/* ---------------- show / hide the panel ---------------- */
function highlight(){
  if(mode!=='all')return;
  document.querySelectorAll('#trade .discovery-tab').forEach(b=>b.classList.toggle('on',b.dataset.mode==='all'));
}

function sync(){
  const active=sec.classList.contains('on')&&mode==='all';
  if(sec.classList.contains('ac-on')!==active)sec.classList.toggle('ac-on',active);
  MK.all=active;
  if(active){
    highlight();
    if(!wasActive)startMarket();
  }else if(wasActive&&!document.getElementById('wallet').classList.contains('on')){
    stopMarket();
  }
  wasActive=active;
}

const origMode=window.tradeSetMode;
window.tradeSetMode=function(m){
  if(m==='all'){mode='all';sync();return Promise.resolve()}
  mode='';
  const r=origMode.apply(this,arguments);
  sync();
  return r;
};

/* tradepad.js repaints the mode tabs when it starts, so re-apply ours afterwards */
const origStart=T.start;
T.start=function(){const r=origStart.apply(this,arguments);sync();return r};

/* Runs when the user opens or leaves the Trade tab */
new MutationObserver(sync).observe(sec,{attributes:true,attributeFilter:['class']});

/* ---------------- coin click ---------------- */
const origOpen=window.openPair;
window.openPair=function(k){
  const p=MK.pairs[k];
  if(!p)return;
  const mint=p.baseToken&&p.baseToken.address;

  /* Solana coins (not SOL itself): straight into the Trade Pad popup */
  if(p.chainId==='solana'&&mint&&mint!==SOL_MINT&&typeof window.tradeSelectByKey==='function'){
    const st=T.getState&&T.getState();
    if(st){
      st.base=[{...p},...st.base.filter(x=>!x.baseToken||x.baseToken.address!==mint)];   // lets the Trade Pad find this coin
      window.tradeSelectByKey('solana:'+mint);
      return;
    }
  }

  /* Everything else: the view-only chart sheet plus a short note */
  const r=origOpen.apply(this,arguments);
  try{
    const sheet=document.querySelector('.mk-modal .mk-sheet');
    const table=sheet&&sheet.querySelector('table');
    if(table&&!sheet.querySelector('.ac-note')){
      const n=document.createElement('div');
      n.className='ac-note';
      n.innerHTML=mint===SOL_MINT
        ?'SOL is the coin you pay with on the Trade Pad. Pick any Solana token to trade and earn <b>+50 points</b> per trade.'
        :'The Fiji Trade Pad supports <b>Solana</b> tokens only, so this coin is view-only here. You can still follow it on DexScreener.';
      table.after(n);
    }
  }catch(e){console.warn('trade-all note failed',e)}
  return r;
};

sync();
})();
