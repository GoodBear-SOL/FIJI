/* ============================================================
   FIJI MARKET TAB LAYOUT
   Load AFTER tradepad-popup.js:
     <script src="tradepad.js"></script>
     <script src="tradepad-popup.js"></script>
     <script src="market-tab.js"></script>

   New Market tab order:
     1. Your wallet (assets balance)
     2. FIJI token status with Buy and Sell buttons
     3. COMING SOON teaser
     4. The existing meme coin market (unchanged)
   Buy and Sell open the Trade Pad popup with FIJI selected.
   ============================================================ */
(function(){
'use strict';

const C=window.FIJI_CORE||{};
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
`;
document.head.appendChild(css);

/* ---------------- 1. wallet moves to the top ---------------- */
const tags=sec.querySelectorAll(':scope > .tag');
const walletTag=tags[1];
if(walletTag){
  const wH2=walletTag.nextElementSibling,wCard=wH2&&wH2.nextElementSibling;
  if(wH2&&wCard)sec.prepend(walletTag,wH2,wCard);
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
