(function(){
'use strict';

/* Daily cooking quest card, placed at the TOP of the Inventory.
   Load AFTER reward-box.js and bun-coin.js. */

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const inv=$('rwInv');
if(!inv||!C.CFG||!C.getWallet){
  console.warn('quest: load it after reward-box.js and bun-coin.js');
  return;
}
const db=()=>C.getSupabase&&C.getSupabase();
const toast=C.toast||(m=>console.log('[FIJI]',m));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString();
const MIN_FIJI=2000000;
const TK='fiji_quest_tok';

const css=document.createElement('style');
css.textContent=`
.qs-card{background:#fff;border:3px solid var(--ink);border-radius:22px;box-shadow:0 5px 0 var(--ink);padding:14px;margin:0 0 16px}
.qs-top{display:flex;align-items:center;gap:14px}
.qs-dish{width:84px;height:84px;border-radius:50%;border:3px solid var(--ink);object-fit:cover;background:var(--sb);flex:none;box-shadow:0 4px 0 var(--ink);display:flex;align-items:center;justify-content:center;font-size:42px}
.qs-info{min-width:0;flex:1}
.qs-tag{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.qs-info h3{font-size:24px;line-height:1.1;margin:6px 0 2px}
.qs-timer{font:600 13px Fredoka,sans-serif;opacity:.75}
.qs-list{display:grid;gap:8px;margin:14px 0}
.qs-ing{display:flex;align-items:center;gap:10px;background:var(--soft);border:2px dashed var(--line);border-radius:14px;padding:7px 10px}
.qs-ing.ok{background:#EAFBF1;border-color:#7CF0A8}
.qs-ing img,.qs-ing .qs-ph{width:34px;height:34px;border-radius:50%;border:2.5px solid var(--ink);object-fit:cover;background:var(--sb);flex:none;display:flex;align-items:center;justify-content:center;font-size:17px}
.qs-ing b{font:600 16px Fredoka,sans-serif;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qs-ing span.n{font:700 16px Fredoka,sans-serif;white-space:nowrap}
.qs-rew{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.qs-note{font-size:12px;opacity:.7;margin-top:8px}
.qs-pop .qs-big{width:120px;height:120px;font-size:60px;margin:6px auto 10px}
.qs-pop{text-align:center;max-width:360px;width:100%;animation:qsIn .35s cubic-bezier(.2,.9,.3,1.3)}
@keyframes qsIn{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}
.qs-pop h3{font-size:28px;margin:4px 0}
.qs-pop .qs-rew{justify-content:center;margin:12px 0}
@media(max-width:760px){
 .qs-dish{width:68px;height:68px;font-size:34px}
 .qs-info h3{font-size:20px}
}
`;
document.head.appendChild(css);

const root=document.createElement('div');
root.className='qs-card';
root.id='qsRoot';
root.innerHTML='<div class="small">Loading today\'s quest…</div>';

function ensure(){
  const host=inv.querySelector('.card')||inv;
  if(!host.contains(root))host.prepend(root);
}
ensure();
new MutationObserver(ensure).observe(inv,{childList:true,subtree:true});

let st=null,offset=0,cooking=false,lastWallet=null,lastEndsLoad=0;

function img(src,fb,cls){
  return src
    ?'<img class="'+cls+'" src="'+esc(src)+'" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=&quot;'+cls+'&quot;>'+fb+'</span>\'">'
    :'<span class="'+cls+'">'+fb+'</span>';
}

function paint(){
  if(!st)return;
  const w=C.getWallet();
  const ing=Array.isArray(st.ingredients)?st.ingredients:[];
  const ready=ing.length>0&&ing.every(i=>Number(i.have)>=Number(i.qty));
  const rows=ing.map(i=>{
    const ok=Number(i.have)>=Number(i.qty);
    return '<div class="qs-ing'+(ok?' ok':'')+'">'+
      img(i.img,i.emoji||'🥬','qs-ph')+
      '<b>'+esc(i.name)+'</b>'+
      '<span class="n">'+nf(Math.min(i.have,999999))+' / '+nf(i.qty)+'</span>'+
      '<span>'+(ok?'✅':'❌')+'</span></div>';
  }).join('');

  let btn;
  if(!w)btn='<button class="btn full" data-act="connect">Connect wallet</button>';
  else if(st.done)btn='<button class="btn full" disabled>✅ Cooked! Next dish in <span class="qs-left">…</span></button>';
  else if(cooking)btn='<button class="btn full" disabled>Cooking… 🍳</button>';
  else if(!ready)btn='<button class="btn full" disabled>Missing ingredients</button>';
  else btn='<button class="btn full" data-act="cook">🍳 Cook it!</button>';

  root.innerHTML=
    '<div class="qs-top">'+
      img(st.dish_img,st.dish_emoji||'🍲','qs-dish')+
      '<div class="qs-info">'+
        '<div class="qs-tag"><span class="pill">📜 DAILY QUEST</span></div>'+
        '<h3>'+esc(st.dish_name)+'</h3>'+
        '<div class="qs-timer">New dish in <span class="qs-left">…</span></div>'+
      '</div>'+
    '</div>'+
    '<div class="qs-list">'+rows+'</div>'+
    '<div class="qs-rew"><span class="pill g">🪙 +'+nf(st.bun_reward)+' BUN</span><span class="pill">⭐ +'+nf(st.bunxp)+' BunXP</span></div>'+
    btn+
    '<p class="qs-note">One cook per dish. Same recipe for every player. Cooking needs at least '+nf(MIN_FIJI)+' FIJI in your wallet. BUN and BunXP are for gameplay only.</p>';
  tickTimer();
}

function fmtLeft(ms){
  const s=Math.max(0,Math.floor(ms/1000));
  const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(x).padStart(2,'0');
}
function tickTimer(){
  if(!st)return;
  const left=Date.parse(st.ends_at)-(Date.now()+offset);
  const t=fmtLeft(left);
  root.querySelectorAll('.qs-left').forEach(el=>{if(el.textContent!==t)el.textContent=t});
  if(left<=0&&Date.now()-lastEndsLoad>4000){lastEndsLoad=Date.now();load()}
}

async function load(){
  const c=db();
  if(!c){root.innerHTML='<div class="small">Quest is offline right now.</div>';return}
  const w=C.getWallet()||'';
  try{
    const {data,error}=await c.rpc('fiji_quest_status',{p_wallet:w});
    if(error)throw error;
    if(!data)return;
    st=data;
    offset=Date.parse(data.now)-Date.now();
    paint();
  }catch(e){
    console.warn('quest: status failed (is quest.sql installed?)',e);
    if(!st)root.innerHTML='<div class="small">The daily quest is not ready yet. Check back soon 🍳</div>';
  }
}

/* ---------- sign in + cook through the farm-market edge function ---------- */
async function edge(body){
  const {data,error}=await db().functions.invoke('clever-api',{body});
  if(error){
    let j=null;
    try{j=await error.context.json()}catch(e){}
    const err=new Error((j&&j.error)||error.message||'Request failed');
    err.relogin=!!(j&&j.relogin);
    throw err;
  }
  if(data&&data.error){
    const err=new Error(data.error);err.relogin=!!data.relogin;throw err;
  }
  return data;
}
function getTok(w){
  try{
    const o=JSON.parse(sessionStorage.getItem(TK)||'null');
    if(o&&o.w===w&&o.exp>Date.now())return o.t;
  }catch(e){}
  return '';
}
function setTok(w,t){
  try{sessionStorage.setItem(TK,JSON.stringify({w,t,exp:Date.now()+11*36e5}))}catch(e){}
}
async function signMsg(w,message){
  const p=C.getProvider();
  const bytes=new TextEncoder().encode(message);
  let sig;
  if(p&&typeof p.signMessage==='function'){
    const r=await p.signMessage(bytes,'utf8');
    sig=r&&r.signature?r.signature:r;
  }else if(p&&p.features&&p.features['solana:signMessage']){
    const accs=p.accounts||[];
    const acc=accs.find(a=>a.address===w)||accs[0];
    const r=await p.features['solana:signMessage'].signMessage({account:acc,message:bytes});
    sig=r[0].signature;
  }else throw new Error('Your wallet cannot sign messages');
  let s='';
  for(const b of sig)s+=String.fromCharCode(b);
  return btoa(s);
}
async function login(w){
  const n=await edge({action:'nonce'});
  const sig=await signMsg(w,n.message);
  const r=await edge({action:'login',wallet:w,nonce:n.nonce,signature:sig});
  setTok(w,r.token);
  return r.token;
}
async function callCook(w){
  let tok=getTok(w);
  if(!tok)tok=await login(w);
  try{
    return (await edge({action:'cook',token:tok})).data;
  }catch(e){
    if(!e.relogin)throw e;
    tok=await login(w);
    return (await edge({action:'cook',token:tok})).data;
  }
}

async function cook(){
  if(cooking)return;
  const w=C.getWallet();
  if(!w){if(typeof window.connect==='function')window.connect();return}
  cooking=true;paint();
  try{
    const d=await callCook(w);
    if(d&&typeof d.points==='number'){const s=$('spts');if(s)s.textContent=d.points}
    showDone(d&&d.cooked);
    try{window.FIJI_BUNXP&&window.FIJI_BUNXP.refresh()}catch(e){}
    try{window.FIJI_FARM&&typeof window.FIJI_FARM.refresh==='function'&&window.FIJI_FARM.refresh()}catch(e){}
    document.dispatchEvent(new CustomEvent('fiji:quest-cooked',{detail:d}));
  }catch(e){
    const m=e&&e.message?e.message:String(e);
    toast(e&&e.code===4001||/reject|denied|cancel/i.test(m)?'Signature cancelled':m);
  }
  cooking=false;
  await load();
}

function showDone(c){
  c=c||{};
  const d=document.createElement('div');
  d.className='modal';
  d.innerHTML='<div class="sticker card qs-pop">'+
    img(c.dish_img,c.dish_emoji||'🍲','qs-dish qs-big')+
    '<div class="tag" style="margin:0">quest complete</div>'+
    '<h3>'+esc(c.dish_name||'Yummy dish')+' is ready!</h3>'+
    '<p>You cooked today\'s dish 🐰</p>'+
    '<div class="qs-rew"><span class="pill g">🪙 +'+nf(c.bun)+' BUN</span><span class="pill">⭐ +'+nf(c.xp)+' BunXP</span></div>'+
    '<button class="btn" data-x>Yay!</button></div>';
  const close=()=>d.remove();
  d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-x]'))close()});
  document.body.appendChild(d);
}

root.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');
  if(!b)return;
  if(b.dataset.act==='cook')cook();
  else if(b.dataset.act==='connect'&&typeof window.connect==='function')window.connect();
});

/* keep it fresh: wallet changes, opening the Burrow, and every 15s while open */
let wasOn=false,lastLoad=0;
setInterval(()=>{
  tickTimer();
  const w=C.getWallet()||null;
  const sec=$('wallet');
  const on=Boolean(sec&&sec.classList.contains('on'));
  if(w!==lastWallet){lastWallet=w;lastLoad=Date.now();load();wasOn=on;return}
  if(on&&!wasOn){lastLoad=Date.now();load()}
  else if(on&&!document.hidden&&!cooking&&Date.now()-lastLoad>15000){lastLoad=Date.now();load()}
  wasOn=on;
},1000);

load();
window.FIJI_QUEST={refresh:load};
})();
