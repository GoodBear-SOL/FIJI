/* ============================================================
   FIJI REWARD BOX  v1   (admin gifts in the Burrow tab)

   Load AFTER market-tab.js (it uses the Burrow page layout):
     <script src="market-tab.js"></script>
     <script src="reward-box.js"></script>

   Needs rewards.sql to be run once in Supabase.

   What it does:
   - When a connected wallet has gifts you added, the Burrow tab
     shows a "gift waiting" button and opens a gift box popup.
   - The player taps Open gift. The server rolls / confirms the
     reward and adds it in one step.
   - The reward is shown ONLY after the server confirms it was
     added. If anything fails, the gift stays closed and nothing
     is added. They can try again.
   - Points update the Earn tab right away. Carrots show as a
     chip at the top of the Burrow tab.
   - Checks for new gifts when the Burrow tab opens, when the
     wallet changes, and every 60 seconds while Burrow is open.

   Does not touch gifts.js (referral gift boxes).
   ============================================================ */
(function(){
'use strict';

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const sec=$('wallet');
if(!sec||!C.getSupabase||!C.getWallet){
  console.warn('reward-box: load it after index.html core and market-tab.js');
  return;
}
const toast=C.toast||(m=>console.log('[FIJI]',m));
const POLL_MS=60000;

/* ---------------- state ---------------- */
let gifts=[];            // unopened gifts: [{id,created_at}]
let carrots=0;
let lastWallet=null;
let dismissed=false;     // player pressed Later for this wallet
let busy=false;
let state='closed';      // closed | opening | revealed | error
let result=null;
let errMsg='';
let loadSeq=0;

const wallet=()=>C.getWallet?C.getWallet():null;
const db=()=>C.getSupabase?C.getSupabase():null;
const onBurrow=()=>sec.classList.contains('on');

/* ---------------- styles ---------------- */
const css=document.createElement('style');
css.textContent=`
.rw-bar{display:none;align-items:center;gap:10px;flex-wrap:wrap;margin:14px 0 0}
.rw-bar.on{display:flex}
.rw-chip{display:inline-flex;align-items:center;gap:6px;border:2.5px solid var(--ink);border-radius:99px;padding:3px 14px;background:#fff;font:600 15px Fredoka,sans-serif}
.rw-giftbtn{background:var(--sun);color:var(--ink);animation:rwWiggle 2.4s ease-in-out infinite}
.rw-modal{position:fixed;inset:0;background:rgba(18,48,92,.6);z-index:455;display:none;align-items:center;justify-content:center;padding:16px}
.rw-modal.on{display:flex}
.rw-sheet{width:100%;max-width:380px;text-align:center;padding:24px 20px;background:var(--bg)}
.rw-sheet h3{font-size:26px;margin:4px 0 6px}
.rw-sheet p{margin:6px 0}
.rw-box{display:block;font-size:96px;line-height:1.1}
.rw-box.shake{animation:rwShake 1.2s ease-in-out infinite}
.rw-box.spin{animation:float 1.2s ease-in-out infinite}
.rw-box.pop{animation:rwPop .7s cubic-bezier(.2,.9,.3,1.3) both}
.rw-amt{font:700 42px/1.15 Fredoka,sans-serif;margin:8px 0;word-break:break-word}
.rw-note{background:#fff;border:2.5px dashed var(--ink);border-radius:16px;padding:8px 12px;margin:10px 0;font-size:15px}
.rw-count{font-size:13px;opacity:.7}
.rw-acts{display:grid;gap:10px;margin-top:16px}
@keyframes rwShake{0%,100%{transform:rotate(0)}15%{transform:rotate(-9deg)}30%{transform:rotate(8deg)}45%{transform:rotate(-6deg)}60%{transform:rotate(5deg)}75%{transform:rotate(0)}}
@keyframes rwPop{0%{transform:scale(.3) rotate(-20deg);opacity:0}70%{transform:scale(1.15) rotate(4deg)}100%{transform:scale(1) rotate(0);opacity:1}}
@keyframes rwWiggle{0%,86%,100%{transform:rotate(0)}90%{transform:rotate(-4deg)}94%{transform:rotate(4deg)}98%{transform:rotate(-2deg)}}
`;
document.head.appendChild(css);

/* ---------------- Burrow bar (gift button + carrots) ---------------- */
const bar=document.createElement('div');
bar.className='rw-bar';
bar.id='rwBar';
sec.prepend(bar);

function paintBar(){
  const n=gifts.length,w=wallet();
  let html='';
  if(w&&n>0){
    html+='<button class="btn sm rw-giftbtn" type="button" data-a="show">🎁 '+n+' gift'+(n===1?'':'s')+' waiting · Open</button>';
  }
  if(w&&carrots>0){
    html+='<span class="rw-chip" title="Your carrots">🥕 '+carrots.toLocaleString()+' carrots</span>';
  }
  if(bar.__h!==html){bar.innerHTML=html;bar.__h=html}
  bar.classList.toggle('on',Boolean(html));
}
bar.addEventListener('click',e=>{
  if(e.target.closest('[data-a="show"]')){
    dismissed=false;state='closed';result=null;openModal();
  }
});

/* ---------------- popup ---------------- */
const modal=document.createElement('div');
modal.className='rw-modal';
modal.innerHTML='<div class="sticker rw-sheet" role="dialog" aria-modal="true" aria-label="Gift box"></div>';
document.body.appendChild(modal);
const sheet=modal.firstChild;

const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function render(){
  const left=gifts.length;
  if(state==='closed'){
    sheet.innerHTML=
      '<span class="rw-box shake">🎁</span>'+
      '<h3>A gift is waiting!</h3>'+
      '<p>Tap the button to open it and see what is inside.</p>'+
      '<p class="rw-count">'+left+' gift'+(left===1?'':'s')+' waiting</p>'+
      '<div class="rw-acts"><button class="btn" type="button" data-a="open">Open gift</button>'+
      '<button class="btn alt" type="button" data-a="later">Later</button></div>';
  }else if(state==='opening'){
    sheet.innerHTML=
      '<span class="rw-box spin">🎁</span>'+
      '<h3>Opening…</h3>'+
      '<p>Adding your reward. Please wait.</p>';
  }else if(state==='revealed'&&result){
    const pts=result.type==='points';
    const amt=Number(result.amount).toLocaleString();
    sheet.innerHTML=
      '<span class="rw-box pop">🎉</span>'+
      '<h3>You got</h3>'+
      '<div class="rw-amt">'+(pts?'+'+amt+' points ⭐':'+'+amt+' 🥕 carrots')+'</div>'+
      (result.note?'<div class="rw-note">'+esc(result.note)+'</div>':'')+
      '<p class="small">Added to your account.</p>'+
      '<div class="rw-acts">'+
      (left>0
        ?'<button class="btn" type="button" data-a="next">Open next gift ('+left+' left)</button><button class="btn alt" type="button" data-a="done">Done</button>'
        :'<button class="btn" type="button" data-a="done">Done</button>')+
      '</div>';
  }else{
    sheet.innerHTML=
      '<span class="rw-box">😵</span>'+
      '<h3>Not opened</h3>'+
      '<p>'+esc(errMsg||'Something went wrong. Nothing was taken.')+'</p>'+
      '<div class="rw-acts">'+
      (left>0?'<button class="btn" type="button" data-a="retry">Try again</button>':'')+
      '<button class="btn alt" type="button" data-a="done">Close</button></div>';
  }
}

function openModal(){
  if(!gifts.length&&state!=='revealed')return;
  render();
  modal.classList.add('on');
}
function closeModal(){
  if(busy)return;
  modal.classList.remove('on');
  state='closed';result=null;errMsg='';
}

sheet.addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');if(!b)return;
  const a=b.dataset.a;
  if(a==='open'||a==='retry')claim();
  else if(a==='next'){state='closed';result=null;render()}
  else if(a==='later'){dismissed=true;closeModal()}
  else if(a==='done')closeModal();
});
modal.addEventListener('click',e=>{if(e.target===modal&&state!=='opening'){if(state==='closed')dismissed=true;closeModal()}});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&modal.classList.contains('on')&&state!=='opening'){if(state==='closed')dismissed=true;closeModal()}
});

/* ---------------- claim ---------------- */
async function claim(){
  if(busy)return;
  const w=wallet(),client=db(),g=gifts[0];
  if(!w)return toast('Connect your wallet first');
  if(!client||!g){errMsg='Gifts are not available right now.';state='error';render();return}

  busy=true;state='opening';render();
  try{
    const {data,error}=await client.rpc('fiji_claim_reward',{p_wallet:w,p_reward_id:g.id});
    if(error)throw error;
    const amt=Number(data&&data.amount);
    if(!data||!Number.isFinite(amt)||amt<=0)throw new Error('The gift was not confirmed');

    /* Only now is it real: remove it, update the numbers, then reveal. */
    gifts=gifts.filter(x=>x.id!==g.id);
    if(data.profile){
      if(C.setProfile)C.setProfile(data.profile);
      const c=Number(data.profile.carrots);
      if(Number.isFinite(c))carrots=c;
    }
    result={type:data.reward_type,amount:amt,note:data.note||''};
    state='revealed';errMsg='';
  }catch(e){
    const m=String((e&&e.message)||e||'');
    console.warn('Gift claim failed',e);
    if(/already opened|not found/i.test(m)){
      gifts=gifts.filter(x=>x.id!==g.id);
      errMsg='This gift was already opened.';
    }else{
      errMsg='The gift could not be added, so nothing was taken. Please try again.';
    }
    state='error';
  }
  busy=false;
  paintBar();render();
}

/* ---------------- loading ---------------- */
async function loadCarrots(w,seq){
  const client=db();if(!client)return;
  try{
    const {data,error}=await client.from('fiji_profiles').select('carrots').eq('wallet',w).maybeSingle();
    if(error||seq!==loadSeq)return;
    const c=Number(data&&data.carrots);
    carrots=Number.isFinite(c)?c:0;
    paintBar();
  }catch(e){}
}

async function loadGifts(auto){
  const w=wallet(),client=db(),seq=++loadSeq;
  if(!w||!client){gifts=[];carrots=0;paintBar();return}
  try{
    const {data,error}=await client.rpc('fiji_get_rewards',{p_wallet:w});
    if(error)throw error;
    if(seq!==loadSeq||w!==wallet())return;
    gifts=(Array.isArray(data)?data:[]).filter(g=>g&&g.id!=null);
  }catch(e){
    console.debug('Gift check unavailable (is rewards.sql installed?)',e);
    return;
  }
  loadCarrots(w,seq);
  paintBar();
  if(modal.classList.contains('on')&&!busy&&state==='closed')render();
  if(auto&&gifts.length&&!dismissed&&onBurrow()&&!modal.classList.contains('on')){
    state='closed';result=null;openModal();
  }
}

/* ---------------- triggers ---------------- */
new MutationObserver(()=>{if(onBurrow())loadGifts(true)}).observe(sec,{attributes:true,attributeFilter:['class']});

setInterval(()=>{
  const w=wallet()||null;
  if(w!==lastWallet){
    lastWallet=w;dismissed=false;gifts=[];carrots=0;
    if(modal.classList.contains('on')&&!busy){modal.classList.remove('on');state='closed';result=null}
    paintBar();
    if(w)loadGifts(onBurrow());
  }
},1500);

setInterval(()=>{
  if(onBurrow()&&!document.hidden&&wallet()&&!busy)loadGifts(true);
},POLL_MS);

if(onBurrow()&&wallet())loadGifts(true);
window.FIJI_REWARDS={refresh:()=>loadGifts(true)};
})();
