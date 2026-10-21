(function(){
'use strict';

/* ============================================================
   FIJI TERMS & CONDITIONS GATE
   Shows a popup to EVERY wallet right after it connects.
   The site stays blocked until the user ticks the box and accepts.
   "Decline" disconnects the wallet.

   Load it after the core script (same place as your other add-on files).
   To make everybody accept again after you change the rules,
   raise TERMS_VERSION by 1.
   ============================================================ */

const C=window.FIJI_CORE||{};
if(!C.CFG||!C.getWallet){console.warn('tc-gate: load it after the core script');return}

const TERMS_VERSION=1;

/* ---------- EDIT THE RULES HERE ---------- */
const RULES=[
  {t:'BUN and BunXP are for fun',
   d:'BUN and BunXP are in-site community points for gameplay only. They have no cash value, and any future token or NFT rewards are not guaranteed. The FIJI team may adjust, pause or reset them to keep the game fair.'},
  {t:'The FIJI token has real value',
   d:'Unlike BUN and BunXP, the FIJI token is a real token with a market value that can go up or down, and you can lose some or all of it. Buying, holding or selling FIJI is your own decision and risk. Holding it only unlocks access to site features and does not guarantee any reward.'},
  {t:'Holding requirements',
   d:'Using the Trade Pad sniper feature requires holding at least 1,000,000 FIJI in your connected wallet. Buying or selling crops in the Market requires at least 2,000,000 FIJI. These amounts are access requirements only and your FIJI always stays in your own wallet.'},
  {t:'Fair play',
   d:'One person, one wallet. Bots, multiple wallets, self-trading and any other way of farming BUN or BunXP are not allowed. Progress earned this way can be removed.'},
  {t:'Rewards and limits',
   d:'Trade rewards need a minimum trade of 0.01 SOL and have daily limits. Referral rewards are only paid when your referred friend completes a qualifying trade.'},
  {t:'Trading risk',
   d:'Crypto tokens, especially new meme coins, can lose value very fast. Nothing on this site is financial advice. A platform fee may apply to Jupiter routes and is shown before you sign. FIJI never asks for your seed phrase or private key.'}

  /* Turn these on ONLY after the backend really enforces them:
  ,{t:'Holder progress',
   d:'Wallets holding at least 2,000,000 FIJI earn daily BunXP. Wallets below that lose BunXP each day.'}
  ,{t:'Selling or moving your FIJI',
   d:'If you sell all your FIJI or transfer it to a different wallet, your BUN and BunXP progress is reset to 0.'}
  */
];

const $=id=>document.getElementById(id);
const db=()=>C.getSupabase&&C.getSupabase();
const toast=C.toast||(m=>console.log('[FIJI]',m));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const lsKey=w=>'fiji_terms_v'+TERMS_VERSION+'_'+w;
const localOk=w=>{try{return localStorage.getItem(lsKey(w))==='1'}catch(e){return false}};
const setLocal=w=>{try{localStorage.setItem(lsKey(w),'1')}catch(e){}};

const css=document.createElement('style');
css.textContent=`
.tc-modal{position:fixed;inset:0;background:rgba(18,48,92,.7);z-index:560;display:none;align-items:center;justify-content:center;padding:16px}
.tc-modal.on{display:flex}
.tc-sheet{width:100%;max-width:520px;max-height:92vh;display:flex;flex-direction:column;overflow:hidden;padding:0;background:var(--bg)}
.tc-head{padding:14px 18px;border-bottom:3px solid var(--ink);background:var(--sun);text-align:center}
.tc-head .em{font-size:34px;line-height:1}
.tc-head h3{margin:4px 0 0;font-size:24px}
.tc-body{padding:14px 18px;overflow-y:auto;display:grid;gap:10px;align-content:start}
.tc-intro{font-size:15px}
.tc-rule{background:#fff;border:2.5px solid var(--ink);border-radius:16px;padding:10px 14px}
.tc-rule b{display:block;font:600 17px Fredoka,sans-serif;margin-bottom:2px}
.tc-rule span{display:block;font-size:14px;line-height:1.45}
.tc-foot{padding:12px 18px 16px;border-top:3px solid var(--ink);display:grid;gap:10px}
.tc-agree{display:flex;align-items:flex-start;gap:10px;font-size:14px;cursor:pointer;line-height:1.4}
.tc-agree input{width:22px;height:22px;margin:0;flex:none;accent-color:var(--blue);cursor:pointer;padding:0}
.tc-acts{display:grid;gap:8px}
@media(max-width:760px){
 .tc-modal{align-items:flex-end;padding:10px 10px calc(10px + env(safe-area-inset-bottom))}
 .tc-sheet{max-height:94vh}
}
`;
document.head.appendChild(css);

const modal=document.createElement('div');
modal.className='tc-modal';
modal.innerHTML=
 '<div class="sticker tc-sheet" role="alertdialog" aria-modal="true" aria-label="Terms and Conditions">'+
  '<div class="tc-head"><div class="em">📜</div><h3>Terms &amp; Conditions</h3></div>'+
  '<div class="tc-body">'+
   '<p class="tc-intro">Welcome to FIJI Labs 🐰 Please read the rules below. You need to accept them before you can continue.</p>'+
   RULES.map((r,i)=>'<div class="tc-rule"><b>'+(i+1)+'. '+esc(r.t)+'</b><span>'+esc(r.d)+'</span></div>').join('')+
  '</div>'+
  '<div class="tc-foot">'+
   '<label class="tc-agree"><input type="checkbox" id="tcCheck"><span>I have read and agree to the Terms &amp; Conditions above.</span></label>'+
   '<div class="tc-acts">'+
    '<button class="btn full" type="button" id="tcOk" disabled>Accept and continue</button>'+
    '<button class="btn alt full" type="button" id="tcNo">Decline and disconnect</button>'+
   '</div>'+
  '</div>'+
 '</div>';
document.body.appendChild(modal);

const chk=$('tcCheck'),ok=$('tcOk'),no=$('tcNo');
let current=null,seq=0,busy=false,shown=false;

function show(){
  if(shown)return;
  shown=true;
  chk.checked=false;ok.disabled=true;ok.textContent='Accept and continue';
  modal.classList.add('on');
  document.body.style.overflow='hidden';
  modal.querySelector('.tc-body').scrollTop=0;
}
function hide(){
  shown=false;
  modal.classList.remove('on');
  document.body.style.overflow='';
}

chk.addEventListener('change',()=>{ok.disabled=!chk.checked||busy});

async function check(w){
  const my=++seq;
  if(localOk(w)){hide();return}
  let accepted=false;
  try{
    const client=db();
    if(client){
      const {data,error}=await client.rpc('fiji_terms_status',{p_wallet:w,p_version:TERMS_VERSION});
      if(!error&&data===true)accepted=true;
    }
  }catch(e){console.warn('tc-gate: status lookup failed',e)}
  if(my!==seq||w!==(C.getWallet()||null))return;
  if(accepted){setLocal(w);hide();return}
  show();
}

ok.addEventListener('click',async()=>{
  const w=C.getWallet&&C.getWallet();
  if(!w||!chk.checked||busy)return;
  busy=true;ok.disabled=true;ok.textContent='Saving…';
  try{
    const client=db();
    if(client){
      const {error}=await client.rpc('fiji_accept_terms',{p_wallet:w,p_version:TERMS_VERSION});
      if(error)console.warn('tc-gate: could not save acceptance on the server (is tc.sql installed?)',error);
    }
  }catch(e){console.warn('tc-gate: accept failed',e)}
  setLocal(w);
  busy=false;
  hide();
  toast('Welcome to FIJI Labs 🐰');
});

no.addEventListener('click',()=>{
  hide();
  if(typeof window.connect==='function'&&C.getWallet&&C.getWallet())window.connect();
});

/* No closing by Escape or by clicking outside: the rules must be accepted or declined. */
modal.addEventListener('click',e=>{if(e.target===modal)e.stopPropagation()});

/* Watch the wallet: every connect (including automatic reconnect) runs the check. */
setInterval(()=>{
  const w=C.getWallet()||null;
  if(w===current)return;
  current=w;
  if(!w){seq++;hide();return}
  check(w);
},500);

window.FIJI_TERMS={version:TERMS_VERSION,show:()=>{if(C.getWallet&&C.getWallet())show()}};
})();
