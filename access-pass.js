(function(){
'use strict';

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const mkHost=$('mkInline'),mkPage=$('market');
if(!mkHost||!mkPage||!C.CFG||!C.getWallet||!C.getSupabase||!C.getConnection){
  console.warn('access-pass: load it after the core script, shop.js and seed-pay.js');
  return;
}
if($('apCard'))return;

const toast=C.toast||(m=>console.log('[FIJI]',m));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString();
const wallet=()=>C.getWallet();
const db=()=>C.getSupabase();

const PRICE=2000000;
const TREASURY='8SeUf8oskJU5FfvAWRhjjoo1BdUYx2tYFVwWiqx17zM6';
const ATA_PROGRAM='ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const MEMO_PROGRAM='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const MEMO_TEXT='FIJI pass';
const PAY_URL=C.CFG.SUPABASE_URL.replace(/\/+$/,'')+'/functions/v1/pass-pay';
const PK='fiji_pass_pending';
const TERMINAL=/already|too old|failed on-chain|not signed|too small|does not match|invalid/i;

const IMG_VER='?v=4';
const IMG_CANDIDATES=[
  './accesspass.png'
];
let IMG=IMG_CANDIDATES[0]+IMG_VER;  
let imgState='try';               

let st=null,loading=false,buying=false,resuming=false,lastW=null,lastKey='',lastHas=false,lastSync=0,lastLoad=0;

const has=()=>Boolean(st&&st.has_pass===true);
const disc=n=>Math.floor((Number(n)*70+99)/100);

const css=document.createElement('style');
css.textContent=`
.ap{display:flex;gap:16px;align-items:center;padding:14px;margin:0 0 14px}
.ap-img{flex:none;width:260px;cursor:zoom-in;border:0;background:none;padding:0;position:relative;line-height:0}
.ap-img img{display:block;width:100%;height:auto;aspect-ratio:2/1;object-fit:cover;border-radius:14px;border:3px solid var(--ink);box-shadow:0 4px 0 var(--ink);background:var(--sb)}
.ap-ph{display:flex;align-items:center;justify-content:center;aspect-ratio:2/1;width:100%;font-size:44px;border:3px solid var(--ink);border-radius:14px;background:var(--sb);line-height:1}
.ap-zoomtip{position:absolute;right:8px;bottom:8px;background:rgba(18,48,92,.82);color:#fff;font:600 12px Fredoka,sans-serif;border-radius:99px;padding:2px 10px;line-height:1.5;pointer-events:none}
.ap-body{flex:1;min-width:0}
.ap-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ap-top h3{margin:0;font-size:22px}
.ap-top .pill{font-size:12px;padding:0 10px}
.ap-price{font:700 22px Fredoka,sans-serif;margin:2px 0 4px}
.ap-price .small{font:600 12px Nunito,sans-serif}
.ap-list{list-style:none;padding:0;margin:4px 0 8px;display:grid;gap:3px;font-size:13.5px;line-height:1.3}
.ap-note{font-size:11.5px;opacity:.7;margin:0 0 8px}
.ap-act{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ap-code{font:700 17px Fredoka,monospace;letter-spacing:.08em;background:var(--sb);border:2.5px dashed var(--ink);border-radius:12px;padding:2px 10px}
.ap-off{color:var(--upi)}

/* lightbox */
.ap-lb{position:fixed;inset:0;z-index:9000;background:rgba(10,24,48,.88);display:flex;align-items:center;justify-content:center;padding:14px;cursor:zoom-out}
.ap-lb img{width:min(900px,100%);max-height:90vh;height:auto;object-fit:contain;border-radius:18px;border:3px solid #fff;box-shadow:0 10px 40px rgba(0,0,0,.5)}
.ap-lb-x{position:absolute;top:calc(12px + env(safe-area-inset-top));right:14px;width:44px;height:44px;border-radius:50%;border:3px solid var(--ink);background:var(--sun);color:var(--ink);font:700 20px Fredoka,sans-serif;cursor:pointer;box-shadow:0 3px 0 var(--ink)}
.ap-lb-cap{position:absolute;bottom:calc(14px + env(safe-area-inset-bottom));left:0;right:0;text-align:center;color:#fff;font:600 13px Fredoka,sans-serif;opacity:.8;pointer-events:none}

/* Profile panel */
#apProfile{margin-bottom:14px}
#apProfile .ap{margin:0;padding:12px}
#apProfile .ap-top h3{font-size:19px}
#apProfile .ap-img{width:240px}

/* Profile > Mint Passes tile: the full card, full width of its box */
.ap-mint{grid-column:1/-1;display:block;padding:0;margin:0;border:3px solid var(--ink);border-radius:14px;overflow:hidden;background:var(--sb);cursor:zoom-in;line-height:0;box-shadow:0 3px 0 var(--ink);position:relative;width:100%;max-width:460px}
.ap-mint img{display:block;width:100%;height:auto;aspect-ratio:2/1;object-fit:cover}
#profile .pf-grid:has(.ap-mint){display:block}
#profile .pf-grid:has(.ap-mint) .pf-ph{display:inline-flex;width:56px;margin:10px 10px 0 0}

/* Burrow panel */
#apBurrow{margin:0 0 14px}
#apBurrow .ap-full{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;padding:14px}
#apBurrow .ap-pic{width:100%;max-width:460px;padding:0;border:0;background:none;cursor:zoom-in;line-height:0;position:relative}
#apBurrow .ap-pic img{display:block;width:100%;height:auto;aspect-ratio:2/1;object-fit:cover;border-radius:16px;border:3px solid var(--ink);box-shadow:0 4px 0 var(--ink);background:var(--sb)}

@media(max-width:760px){
 .ap{gap:10px;padding:12px;flex-direction:column;align-items:stretch}
 .ap-img,#apProfile .ap-img{width:100%;max-width:none;margin:0 auto}
 .ap-ph{font-size:34px}
 .ap-top h3{font-size:18px}
 .ap-price{font-size:18px;margin:0 0 2px}
 .ap-list{font-size:12.5px;gap:3px;margin:3px 0 6px}
 .ap-note{font-size:11px;margin-bottom:6px}
 .ap-code{font-size:15px}
 .ap .btn{min-height:40px;padding:6px 14px;font-size:15px}
 #apBurrow .ap-full{padding:10px}
 #apBurrow .ap-pic{max-width:none}
 .ap-mint{max-width:none}
 .ap-lb{padding:8px}
 .ap-lb img{width:100%;max-height:82vh}
}

/* Compact Market card (small picture, perks are in the details popup) */
.ap.ap-compact{padding:10px 12px;gap:14px}
.ap.ap-compact .ap-img{width:170px}
.ap.ap-compact .ap-top h3{font-size:19px}
.ap.ap-compact .ap-price{font-size:19px;margin:0 0 2px}
.ap-tag{font-size:13px;opacity:.75;margin:0 0 8px;line-height:1.3}
@media(max-width:760px){
 .ap.ap-compact{flex-direction:row;align-items:center;gap:10px;padding:10px}
 .ap.ap-compact .ap-img{width:118px;flex:none;margin:0}
 .ap.ap-compact .ap-top h3{font-size:16px}
 .ap.ap-compact .ap-price{font-size:16px}
 .ap.ap-compact .ap-tag{display:none}
 .ap.ap-compact .ap-zoomtip{font-size:10px;padding:0 7px}
}

/* Details popup */
.ap-md{position:fixed;inset:0;z-index:350;background:rgba(18,48,92,.6);display:none;align-items:center;justify-content:center;padding:16px}
.ap-md.on{display:flex}
.ap-mbox{width:100%;max-width:440px;max-height:92vh;overflow-y:auto;background:var(--bg);padding:16px}
.ap-mbox .ap-top{margin-bottom:10px}
.ap-mbox .ap-top .btn{margin-left:auto}
.ap-mpic{display:block;width:100%;padding:0;border:0;background:none;cursor:zoom-in;line-height:0;position:relative;margin-bottom:12px}
.ap-mpic img{display:block;width:100%;height:auto;aspect-ratio:2/1;object-fit:cover;border-radius:14px;border:3px solid var(--ink);box-shadow:0 4px 0 var(--ink);background:var(--sb)}
.ap-mbox .ap-list{font-size:14.5px;gap:6px;margin:6px 0 10px}
@media(max-width:760px){
 .ap-md{align-items:flex-end;padding:10px 10px calc(10px + env(safe-area-inset-bottom))}
 .ap-mbox{max-height:90vh}
}`;
document.head.appendChild(css);

function imgTag(alt,tip){
  if(imgState==='fail')return '<span class="ap-ph" role="img" aria-label="'+esc(alt)+'">🎟️</span>';
  return '<img src="'+esc(IMG)+'" alt="'+esc(alt)+'" decoding="async">'+(tip?'<span class="ap-zoomtip">🔍</span>':'');
}
function picHtml(){
  return '<button type="button" class="ap-img" data-ap="zoom" aria-label="View Access Pass">'+imgTag('FIJI Access Pass',true)+'</button>';
}
function infoPicHtml(){
  return '<button type="button" class="ap-img" data-ap="info" aria-label="View Access Pass details">'+imgTag('FIJI Access Pass',true)+'</button>';
}
function zoom(){
  if(document.querySelector('.ap-lb'))return;
  const d=document.createElement('div');
  d.className='ap-lb';
  d.innerHTML=(imgState==='fail'
    ?'<div class="ap-ph" style="max-width:520px;background:#fff">🎟️</div>'
    :'<img src="'+esc(IMG)+'" alt="FIJI Access Pass">')+
    '<button type="button" class="ap-lb-x" aria-label="Close">✕</button>'+
    '<div class="ap-lb-cap">Tap anywhere to close</div>';
  const close=()=>{d.remove();document.removeEventListener('keydown',onKey)};
  const onKey=e=>{if(e.key==='Escape')close()};
  d.addEventListener('click',close);
  document.addEventListener('keydown',onKey);
  document.body.appendChild(d);
}
async function copy(t){
  try{await navigator.clipboard.writeText(String(t))}
  catch(e){
    const a=document.createElement('textarea');a.value=String(t);a.style.cssText='position:fixed;opacity:0';
    document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch(x){}a.remove();
  }
}

function probe(i){
  if(i>=IMG_CANDIDATES.length){
    imgState='fail';
    console.warn('Could not load the access pass image.',IMG_CANDIDATES.join(', '));
    repaintAll();
    return;
  }
  const url=IMG_CANDIDATES[i]+IMG_VER,im=new Image();
  im.onload=()=>{IMG=url;imgState='ok';repaintAll()};
  im.onerror=()=>probe(i+1);
  im.src=url;
}
function repaintAll(){
  if(card)card.__k='';
  if(prof)prof.__k='';
  if(bur)bur.__k='';
  if(info)info.__k='';
  if(mintGrid){const t=mintGrid.querySelector('.ap-mint');if(t)t.remove()}
  paint();
}

const card=document.createElement('div');
card.id='apCard';
function placeCard(){
  if(card.parentElement!==mkHost||mkHost.firstChild!==card)mkHost.insertBefore(card,mkHost.firstChild);
}
placeCard();
new MutationObserver(()=>{if(card.parentElement!==mkHost||mkHost.firstChild!==card)placeCard()})
  .observe(mkHost,{childList:true});

/* Pass description. When you add more passes later, each one can have its own
   title, tagline, perks and note like this. */
const PERKS=
  '<li>🔑 Received unique referral code. New users enter it in the Terms &amp; Conditions and it is saved to their profile</li>'+
  '<li>🔓 Quests are visible in your Burrow</li>'+
  '<li>🌾 All quests are FREE to access</li>'+
  '<li>🌱 30% off every seed in the Market</li>';
const TAGLINE='Lifetime pass · Free quests, 30% off seeds and your own referral code.';
const NOTE='Tied to the wallet that buys it. It cannot be transferred or sold.';

/* shared pieces used by the Market card and the details popup */
function pillHtml(){
  return has()?'<span class="pill g">✅ Owned</span>':'<span class="pill">Lifetime</span>';
}
function priceHtml(){
  return has()?'':'<div class="ap-price">🪙 '+nf(PRICE)+' FIJI <span class="small">one-time</span></div>';
}
function ctlHtml(){
  const w=wallet();
  if(has()){
    return '<span class="ap-code">'+esc(st.code)+'</span>'+
      '<button class="btn sm alt" type="button" data-ap="copy">Copy code</button>';
  }
  return !w
    ?'<button class="btn sm" type="button" data-ap="connect">Connect wallet</button>'
    :'<button class="btn sm" type="button" data-ap="buy"'+((buying||!st)?' disabled':'')+'>'+
      (buying?'Waiting for payment…':!st?'Checking…':'Buy Access Pass')+'</button>';
}

function paintCard(){
  const w=wallet(),key=['m',w||'',has()?st.code:(st?'n':'l'),buying?1:0,imgState,IMG].join('|');
  if(key===card.__k)return;
  card.__k=key;
  card.innerHTML='<div class="sticker card ap ap-compact">'+infoPicHtml()+
    '<div class="ap-body"><div class="ap-top"><h3>🎟️ Access Pass</h3>'+pillHtml()+'</div>'+
    priceHtml()+
    '<p class="ap-tag">'+esc(TAGLINE)+'</p>'+
    '<div class="ap-act">'+ctlHtml()+
    '<button class="btn sm alt" type="button" data-ap="info">View perks</button></div></div></div>';
}

/* Details popup */
const info=document.createElement('div');
info.className='ap-md';
info.id='apInfo';
info.setAttribute('role','dialog');
info.setAttribute('aria-modal','true');
info.setAttribute('aria-label','Access Pass details');
document.body.appendChild(info);

function paintInfo(){
  if(!info.classList.contains('on'))return;
  const w=wallet(),key=['i',w||'',has()?st.code:(st?'n':'l'),buying?1:0,imgState,IMG].join('|');
  if(key===info.__k)return;
  info.__k=key;
  info.innerHTML='<div class="sticker card ap-mbox">'+
    '<div class="ap-top"><h3>🎟️ Access Pass</h3>'+pillHtml()+
    '<button class="btn sm alt" type="button" data-ap="info-close" aria-label="Close">✕</button></div>'+
    '<button type="button" class="ap-mpic" data-ap="zoom" aria-label="View Access Pass">'+imgTag('FIJI Access Pass',true)+'</button>'+
    priceHtml()+
    '<ul class="ap-list">'+PERKS+'</ul>'+
    '<p class="ap-note">'+esc(NOTE)+'</p>'+
    '<div class="ap-act">'+ctlHtml()+'</div></div>';
}
function openInfo(){
  info.classList.add('on');
  info.__k='';
  paintInfo();
}
function closeInfo(){
  info.classList.remove('on');
}
info.addEventListener('click',e=>{
  if(e.target===info)return closeInfo();
  onClick(e);
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&info.classList.contains('on')&&!document.querySelector('.ap-lb'))closeInfo();
});

const profHead=$('pfHead');
let prof=null;
if(profHead){
  prof=document.createElement('div');
  prof.id='apProfile';
  profHead.after(prof);
}
function paintProfile(){
  if(!prof)return;
  const w=wallet(),key=['p',w||'',st?JSON.stringify(st):'-',imgState,IMG].join('|');
  if(key===prof.__k)return;
  prof.__k=key;
  if(!w||!st){prof.innerHTML='';return}
  let since='';
  try{if(st.since)since=new Date(st.since).toLocaleDateString()}catch(e){}
  const ref=st.referred_by_code?'<div class="small">Joined with referral code '+esc(st.referred_by_code)+'</div>':'';
  if(has()){
    prof.innerHTML='<div class="sticker card ap">'+picHtml()+
      '<div class="ap-body"><div class="ap-top"><h3>🎟️ Access Pass</h3><span class="pill g">✅ Active</span></div>'+
      '<div class="small">Bound to this wallet'+(since?' · since '+esc(since):'')+'</div>'+
      '<div class="ap-act" style="margin-top:6px"><span class="ap-code">'+esc(st.code)+'</span>'+
      '<button class="btn sm alt" type="button" data-ap="copy">Copy</button></div>'+
      '<div class="small" style="margin-top:4px">👥 '+nf(st.referrals)+' player'+(Number(st.referrals)===1?'':'s')+' joined with your code</div>'+
      ref+'</div></div>';
  }else{
    prof.innerHTML='<div class="sticker card ap"><div class="ap-body"><div class="ap-top"><h3>🎟️ Access Pass</h3><span class="pill">Not owned</span></div>'+
      '<div class="small">Free quests, 30% off seeds and your own referral code.</div>'+
      '<div class="ap-act" style="margin-top:6px"><button class="btn sm" type="button" data-ap="market">Get it in Market</button></div>'+ref+'</div></div>';
  }
}

const burrow=$('wallet');
let bur=null;
if(burrow){
  bur=document.createElement('div');
  bur.id='apBurrow';
  const h2=burrow.querySelector(':scope > h2');
  if(h2)h2.after(bur);else burrow.prepend(bur);
  bur.addEventListener('click',e=>onClick(e));
}
function paintBurrow(){
  if(!bur)return;
  const w=wallet(),key=['b',w||'',has()?st.code:'-',imgState,IMG].join('|');
  if(key===bur.__k)return;
  bur.__k=key;
  if(!w||!has()){bur.innerHTML='';return}
  bur.innerHTML='<div class="sticker card ap-full">'+
    '<button type="button" class="ap-pic" data-ap="zoom" aria-label="View Access Pass">'+imgTag('FIJI Access Pass',true)+'</button>'+
    '<div><span class="pill g">🎟️ Access Pass</span></div>'+
    '<div class="ap-act"><span class="ap-code">'+esc(st.code)+'</span>'+
    '<button class="btn sm alt" type="button" data-ap="copy">Copy code</button></div></div>';
}

let mintGrid=null,mintBound=false;
function findMintGrid(){
  if(mintGrid&&mintGrid.isConnected)return mintGrid;
  const secs=document.querySelectorAll('#profile .pf-sec');
  for(const s of secs){
    const h=s.querySelector('h2');
    if(h&&/mint passes/i.test(h.textContent)){mintGrid=s.querySelector('.pf-grid');break}
  }
  if(mintGrid&&!mintBound){mintBound=true;mintGrid.addEventListener('click',e=>onClick(e))}
  return mintGrid;
}
function paintMint(){
  const g=findMintGrid();
  if(!g)return;
  let t=g.querySelector('.ap-mint');
  const on=Boolean(wallet())&&has();
  if(t&&t.dataset.src!==IMG+'|'+imgState){t.remove();t=null}
  if(on&&!t){
    const d=document.createElement('button');
    d.type='button';d.className='ap-mint';d.dataset.ap='zoom';d.dataset.src=IMG+'|'+imgState;
    d.setAttribute('aria-label','View Access Pass');
    d.innerHTML=imgTag('FIJI Access Pass',true);
    g.insertBefore(d,g.firstChild);
    const ph=g.querySelector('.pf-ph');
    if(ph)ph.remove();
  }else if(!on&&t){
    t.remove();
    const ph=document.createElement('div');
    ph.className='pf-ph';ph.setAttribute('aria-hidden','true');ph.textContent='?';
    g.insertBefore(ph,g.firstChild);
  }
}

function paint(){paintCard();paintInfo();paintProfile();paintBurrow();paintMint()}

async function loadStatus(force){
  const w=wallet();
  if(!w){st=null;paint();return}
  if(loading)return;
  if(!force&&Date.now()-lastLoad<15000)return;
  loading=true;
  try{
    const {data,error}=await db().rpc('fiji_pass_status',{p_wallet:w});
    if(error)throw error;
    if(w!==wallet())return;
    st=data||{has_pass:false};
    lastLoad=Date.now();
  }catch(e){
    console.warn('Status failed',e);
    if(!st)st={has_pass:false};
  }finally{loading=false}
  const h=has();
  if(h!==lastHas){lastHas=h;lastKey='';changed()}
  paint();applyDisc();
  if(h)syncQuests();
}
function changed(){
  try{document.dispatchEvent(new CustomEvent('fiji:pass',{detail:{has:has()}}))}catch(e){}
  try{window.FIJI_FARM&&window.FIJI_FARM.render&&window.FIJI_FARM.render()}catch(e){}
}
async function syncQuests(force){
  const w=wallet();
  if(!w||!has())return;
  if(!force&&Date.now()-lastSync<3600e3)return;
  lastSync=Date.now();
  try{
    const r=await fetch(PAY_URL,{method:'POST',
      headers:{'apikey':C.CFG.SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({action:'sync',wallet:w})});
    const j=await r.json().catch(()=>({}));
    if(r.ok&&j.ok&&j.granted&&j.granted.length){
      try{window.FIJI_QUEST&&window.FIJI_QUEST.refresh&&window.FIJI_QUEST.refresh()}catch(e){}
    }
  }catch(e){console.debug('access-pass: quest sync failed',e);lastSync=0}
}

function wrapPay(){
  const P=window.FIJI_SEEDPAY;
  if(!P||P.__ap)return;
  const orig=P.buy;
  P.buy=async function(o){
    if(wallet()&&!st)await loadStatus(true);
    if(has()&&o&&String(o.item).indexOf('seed:')===0)o=Object.assign({},o,{unit:disc(o.unit)});
    return orig.call(this,o);
  };
  P.__ap=true;
}
let discBusy=false;
function applyDisc(){
  if(discBusy||!has())return;
  discBusy=true;
  try{
    mkHost.querySelectorAll('button[data-a="buy"][data-item^="seed:"]').forEach(b=>{
      if(b.dataset.ap)return;
      const orig=Number(b.dataset.price)||0;
      if(!orig)return;
      const row=b.closest('.fm-row'),q=row&&row.querySelector('.fm-q'),n=disc(orig);
      b.dataset.ap='1';b.dataset.price=n;
      if(q)q.dataset.price=n;
      const qty=Math.max(1,parseInt(q&&q.value,10)||1);
      b.textContent='Buy · '+nf(n*qty);
      const infoEl=row&&row.querySelector('.fm-info');
      if(infoEl){
        const s=document.createElement('span');
        s.className='ap-off';
        s.textContent='🎟️ 30% off with Access Pass · was '+nf(orig)+' each';
        infoEl.appendChild(s);
      }
    });
  }finally{discBusy=false}
}
new MutationObserver(applyDisc).observe(mkHost,{childList:true,subtree:true});

const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes){
  const a=Array.from(bytes);
  let z=0;while(z<a.length&&a[z]===0)z++;
  const d=[];
  for(let i=z;i<a.length;i++){
    let c=a[i];
    for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0}
    while(c>0){d.push(c%58);c=(c/58)|0}
  }
  let s='';
  for(let i=0;i<z;i++)s+='1';
  for(let i=d.length-1;i>=0;i--)s+=B58[d[i]];
  return s;
}
function confirmBox(){
  return new Promise(resolve=>{
    const d=document.createElement('div');
    d.className='modal';
    d.style.zIndex=9999;
    d.innerHTML='<div class="sticker card" style="max-width:380px;width:100%;text-align:center">'+
      '<div style="font-size:48px;line-height:1">🎟️</div>'+
      '<h3>Buy the Access Pass?</h3>'+
      '<p class="small">You will send FIJI from your wallet to the project wallet. The pass is tied to this wallet and cannot be transferred. Payments are final.</p>'+
      '<div style="font:700 28px Fredoka,sans-serif;margin:10px 0">🪙 '+nf(PRICE)+' FIJI</div>'+
      '<div style="display:flex;gap:10px;margin-top:14px">'+
      '<button class="btn alt" type="button" style="flex:1" data-c="no">Cancel</button>'+
      '<button class="btn" type="button" style="flex:1" data-c="yes">Pay</button></div></div>';
    const done=v=>{d.remove();resolve(v)};
    d.addEventListener('click',e=>{
      if(e.target===d)return done(false);
      const b=e.target.closest('[data-c]');
      if(b)done(b.dataset.c==='yes');
    });
    document.body.appendChild(d);
  });
}
async function sendPayment(w){
  const web3=solanaWeb3,conn=C.getConnection();
  const mint=new web3.PublicKey(C.CFG.FIJI_MINT);
  const owner=new web3.PublicKey(w);
  const treasury=new web3.PublicKey(TREASURY);

  const mi=await conn.getParsedAccountInfo(mint);
  if(!mi.value||!mi.value.data||!mi.value.data.parsed)throw new Error('Could not read the FIJI token');
  const programId=mi.value.owner;
  const decimals=Number(mi.value.data.parsed.info.decimals);
  const raw=BigInt(PRICE)*(10n**BigInt(decimals));

  const accs=await conn.getParsedTokenAccountsByOwner(owner,{mint});
  let src=null,best=0n;
  accs.value.forEach(a=>{
    const v=BigInt(a.account.data.parsed.info.tokenAmount.amount);
    if(v>best){best=v;src=a.pubkey}
  });
  if(!src||best<raw)throw new Error('Not enough FIJI in your wallet (you need '+nf(PRICE)+')');

  const ataProg=new web3.PublicKey(ATA_PROGRAM);
  const [dest]=web3.PublicKey.findProgramAddressSync(
    [treasury.toBytes(),programId.toBytes(),mint.toBytes()],ataProg);

  const createAta=new web3.TransactionInstruction({
    programId:ataProg,
    keys:[
      {pubkey:owner,isSigner:true,isWritable:true},
      {pubkey:dest,isSigner:false,isWritable:true},
      {pubkey:treasury,isSigner:false,isWritable:false},
      {pubkey:mint,isSigner:false,isWritable:false},
      {pubkey:web3.SystemProgram.programId,isSigner:false,isWritable:false},
      {pubkey:programId,isSigner:false,isWritable:false}
    ],
    data:new Uint8Array([1])
  });
  const data=new Uint8Array(10);
  data[0]=12;
  new DataView(data.buffer).setBigUint64(1,raw,true);
  data[9]=decimals;
  const transfer=new web3.TransactionInstruction({
    programId,
    keys:[
      {pubkey:src,isSigner:false,isWritable:true},
      {pubkey:mint,isSigner:false,isWritable:false},
      {pubkey:dest,isSigner:false,isWritable:true},
      {pubkey:owner,isSigner:true,isWritable:false}
    ],
    data
  });
  const memo=new web3.TransactionInstruction({
    programId:new web3.PublicKey(MEMO_PROGRAM),
    keys:[{pubkey:owner,isSigner:true,isWritable:false}],
    data:new TextEncoder().encode(MEMO_TEXT)
  });

  const tx=new web3.Transaction().add(createAta,transfer,memo);
  tx.feePayer=owner;
  tx.recentBlockhash=(await conn.getLatestBlockhash('confirmed')).blockhash;

  const pr=C.getProvider();
  if(!pr)throw new Error('Connect your wallet first');
  if(typeof pr.signAndSendTransaction==='function'){
    const r=await pr.signAndSendTransaction(tx);
    const sg=r&&r.signature?r.signature:r;
    return typeof sg==='string'?sg:b58(sg);
  }
  const f=pr.features&&pr.features['solana:signAndSendTransaction'];
  if(f){
    const acc=(pr.accounts||[]).find(a=>a.address===w)||(pr.accounts||[])[0];
    const r=await f.signAndSendTransaction({
      account:acc,chain:'solana:mainnet',
      transaction:tx.serialize({requireAllSignatures:false,verifySignatures:false})
    });
    return b58(r[0].signature);
  }
  if(typeof pr.signTransaction==='function'){
    const signed=await pr.signTransaction(tx);
    return await conn.sendRawTransaction(signed.serialize());
  }
  throw new Error('This wallet cannot send transactions');
}
async function waitConfirmed(sig){
  const conn=C.getConnection();
  for(let i=0;i<40;i++){
    const r=await conn.getSignatureStatuses([sig],{searchTransactionHistory:true});
    const s=r&&r.value&&r.value[0];
    if(s&&s.err)throw new Error('The payment failed on-chain');
    if(s&&(s.confirmationStatus==='confirmed'||s.confirmationStatus==='finalized'))return;
    await new Promise(r=>setTimeout(r,1500));
  }
  throw new Error('The payment is taking long. If FIJI left your wallet, reopen this page in a minute and your pass will arrive.');
}
async function verify(w,sig){
  let last='';
  for(let i=0;i<8;i++){
    const r=await fetch(PAY_URL,{method:'POST',
      headers:{'apikey':C.CFG.SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({wallet:w,signature:sig})});
    let j={};try{j=await r.json()}catch(e){}
    if(r.ok&&j.ok)return j.data;
    last=j.error||('Verification failed (HTTP '+r.status+')');
    if(j.retry||r.status===404){await new Promise(x=>setTimeout(x,2500));continue}
    break;
  }
  throw new Error(last);
}
const getPending=()=>{try{const o=JSON.parse(localStorage.getItem(PK)||'null');return o&&o.w&&o.sig?o:null}catch(e){return null}};
const setPending=o=>{try{if(o)localStorage.setItem(PK,JSON.stringify(o));else localStorage.removeItem(PK)}catch(e){}};

async function afterGrant(){
  toast('🎟️ Access Pass unlocked!');
  lastLoad=0;
  await loadStatus(true);
  syncQuests(true);
}
async function buy(){
  if(buying)return;
  const w=wallet();
  if(!w){if(typeof window.connect==='function')window.connect();return}
  await loadStatus(true);
  if(has())return toast('This wallet already owns the Access Pass 🎟️');
  const p=getPending();
  if(p&&p.w===w){toast('A payment is still being confirmed. Please wait a moment…');resume();return}
  buying=true;paint();
  try{
    if(!(await confirmBox()))return;
    toast('Approve the payment in your wallet…');
    const sig=await sendPayment(w);
    setPending({w,sig,t:Date.now()});
    toast('Payment sent. Confirming… ⏳');
    await waitConfirmed(sig);
    await verify(w,sig);
    setPending(null);
    await afterGrant();
  }catch(e){
    const m=e&&e.message?e.message:String(e);
    console.warn('pass payment failed',e);
    if(TERMINAL.test(m))setPending(null);
    toast(e&&e.code===4001||/reject|denied|cancel/i.test(m)?'Payment cancelled. Nothing was sent.':m);
  }finally{buying=false;card.__k='';info.__k='';paint()}
}
async function resume(){
  const p=getPending(),w=wallet();
  if(!p||!w||p.w!==w||buying||resuming)return;
  resuming=true;
  try{
    await verify(w,p.sig);
    setPending(null);
    await afterGrant();
  }catch(e){
    const m=String((e&&e.message)||e);
    if(TERMINAL.test(m)){setPending(null);if(/already/i.test(m)){lastLoad=0;loadStatus(true)}}
  }
  resuming=false;
}

function onClick(e){
  const b=e.target.closest('[data-ap]');
  if(!b)return;
  const a=b.dataset.ap;
  if(a==='zoom')zoom();
  else if(a==='info')openInfo();
  else if(a==='info-close')closeInfo();
  else if(a==='copy'&&st&&st.code){copy(st.code);toast('Referral code copied 🔑')}
  else if(a==='connect'){if(typeof window.connect==='function')window.connect()}
  else if(a==='buy')buy();
  else if(a==='market'){if(typeof window.go==='function')window.go('market')}
}
card.addEventListener('click',onClick);
if(prof)prof.addEventListener('click',onClick);

setInterval(()=>{
  wrapPay();paintMint();placeCard();
  const w=wallet()||null;
  if(w!==lastW){
    lastW=w;st=null;lastHas=false;lastSync=0;lastLoad=0;card.__k='';info.__k='';
    if(prof)prof.__k='';
    if(bur)bur.__k='';
    changed();paint();
    if(w)loadStatus(true);
    return;
  }
  if(!w||document.hidden)return;
  const on=id=>{const e=document.getElementById(id);return Boolean(e&&e.classList.contains('on'))};
  const watching=mkPage.classList.contains('on')||on('profile')||on('wallet');
  if(watching&&Date.now()-lastLoad>30000)loadStatus(true);
},1000);
setInterval(resume,6000);

wrapPay();
paint();
probe(0);

window.FIJI_PASS={
  has,
  status:()=>st,
  disc,
  refresh:()=>{lastLoad=0;return loadStatus(true)}
};
})();
