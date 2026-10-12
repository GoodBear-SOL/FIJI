(function(){
'use strict';

const C=window.FIJI_CORE||{},T=window.FIJI_TRADE;
const sec=document.getElementById('trade'),panel=document.getElementById('allCoins');
if(!T||!sec||!panel||typeof MK==='undefined'||typeof window.openPair!=='function'||typeof window.tradeSetMode!=='function'){
  console.warn('trade-all: load it after tradepad.js, tradepad-popup.js and market-tab.js');return;
}

const SOL_MINT='So11111111111111111111111111111111111111112';
let mode='';
let wasActive=false;

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

const origStart=T.start;
T.start=function(){const r=origStart.apply(this,arguments);sync();return r};

new MutationObserver(sync).observe(sec,{attributes:true,attributeFilter:['class']});

const origOpen=window.openPair;
window.openPair=function(k){
  const p=MK.pairs[k];
  if(!p)return;
  const mint=p.baseToken&&p.baseToken.address;

  if(p.chainId==='solana'&&mint&&mint!==SOL_MINT&&typeof window.tradeSelectByKey==='function'){
    const st=T.getState&&T.getState();
    if(st){
      st.base=[{...p},...st.base.filter(x=>!x.baseToken||x.baseToken.address!==mint)];
      window.tradeSelectByKey('solana:'+mint);
      return;
    }
  }

  const r=origOpen.apply(this,arguments);
  try{
    const sheet=document.querySelector('.mk-modal .mk-sheet');
    const table=sheet&&sheet.querySelector('table');
    if(table&&!sheet.querySelector('.ac-note')){
      const n=document.createElement('div');
      n.className='ac-note';
      n.innerHTML=mint===SOL_MINT
        ?'SOL is the coin you pay with on the Trade Pad. Pick any Solana token to trade and earn <b>+50 BUN</b> per trade.'
        :'The Fiji Trade Pad supports <b>Solana</b> tokens only, so this coin is view-only here. You can still follow it on DexScreener.';
      table.after(n);
    }
  }catch(e){console.warn('trade-all note failed',e)}
  return r;
};

sync();
})();
