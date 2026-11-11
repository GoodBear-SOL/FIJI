(function(){
'use strict';

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const sec=$('board'),tbl=$('lb');
if(!sec||!tbl||!C.getSupabase||!C.getWallet){
  console.warn('bunxp: load it after the core script and shop.js');
  return;
}
const toast=C.toast||(m=>console.log('[FIJI]',m));
const db=()=>C.getSupabase();
const wallet=()=>C.getWallet();

const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=a=>{const s=String(a||'');return s.length<=10?s:s.slice(0,4)+'…'+s.slice(-4)};
const fmtN=n=>Number(n||0).toLocaleString();

const css=document.createElement('style');
css.textContent=`
.bx-head{margin:0 0 14px}
.bx-note{font-size:14px;opacity:.8;margin:0 0 10px}
.bx-me{display:none;margin:0 0 12px}
.bx-me.on{display:flex;gap:8px;flex-wrap:wrap}
#lb tr.bx-mine td{background:#FFF6CF}
#lb td.bx-r,#lb th.bx-r{text-align:right}
`;
document.head.appendChild(css);

const card=tbl.closest('.card');
const head=document.createElement('div');
head.className='bx-head';
head.innerHTML=
  '<p class="bx-note">Phase 2 ranking. Earn BunXP by playing. BunXP is for community gameplay only and has no cash value.</p>'+
  '<div class="bx-me" id="bxMe"></div>';
if(card)card.before(head);else sec.appendChild(head);

function paintMe(info){
  const el=$('bxMe');
  if(!el)return;
  if(!wallet()||!info){el.classList.remove('on');el.innerHTML='';return}
  el.innerHTML='<span class="pill">⭐ Your BunXP: '+fmtN(info.bunxp)+'</span>'+
    (info.rank?'<span class="pill g">Rank #'+fmtN(info.rank)+'</span>':'<span class="pill">Play to get ranked</span>');
  el.classList.add('on');
}

function paintTable(rows){
  const me=wallet();
  const body=(rows||[]).map(p=>{
    const r=Number(p.rank)||0;
    const medal=['🥇','🥈','🥉'][r-1]||r;
    const who=p.username?esc(p.username):short(p.wallet);
    const mine=me&&p.wallet===me;
    return '<tr'+(mine?' class="bx-mine"':'')+'><td>'+medal+'</td><td>'+who+(mine?' <span class="small">(you)</span>':'')+'</td>'+
      '<td class="bx-r">'+fmtN(p.bunxp)+'</td><td class="bx-r">🔥 '+fmtN(p.streak)+'</td></tr>';
  }).join('');
  tbl.innerHTML='<tr><th>#</th><th>Player</th><th class="bx-r">BunXP</th><th class="bx-r">Streak</th></tr>'+
    (body||'<tr><td colspan="4" class="small">Nobody here yet. Be the first to earn BunXP 🌱</td></tr>');
}

let seq=0;
async function loadBoard(){
  const client=db();
  if(!client)return;
  const my=++seq;
  try{
    const {data,error}=await client.rpc('fiji_leaderboard_p2',{p_limit:25});
    if(error)throw error;
    if(my!==seq)return;
    paintTable(Array.isArray(data)?data:[]);
    const w=wallet();
    if(w){
      const r=await client.rpc('fiji_my_phase2',{p_wallet:w});
      if(my===seq&&!r.error)paintMe(r.data);
    }else paintMe(null);
  }catch(e){
    console.warn('Phase 2 leaderboard unavailable (are the fiji_leaderboard_p2 functions installed?)',e);
    if(my!==seq)return;
    paintMe(null);
    tbl.innerHTML='<tr><td class="small">The leaderboard is not available right now 💧</td></tr>';
  }
}
window.loadBoard=loadBoard;

let xp=null,lastW=null,rseq=0;

function paintPill(){
  const s=$('fmStats');
  if(!s||!s.children.length||!wallet()||xp===null)return;
  let p=s.querySelector('.bx-pill');
  if(!p){p=document.createElement('span');p.className='pill bx-pill';s.appendChild(p)}
  const t='⭐ '+fmtN(xp)+' BunXP';
  if(p.textContent!==t)p.textContent=t;
}

async function refreshXp(){
  const w=wallet(),client=db(),my=++rseq;
  if(!w||!client){xp=null;lastW=null;return}
  if(lastW!==w){xp=null;lastW=w}
  try{
    const {data,error}=await client.rpc('fiji_my_phase2',{p_wallet:w});
    if(error||!data||my!==rseq||w!==wallet())return;
    const n=Number(data.bunxp);
    if(!Number.isFinite(n))return;
    const gain=xp===null?0:n-xp;
    xp=n;
    paintPill();
    if(gain>0)setTimeout(()=>toast('⭐ +'+fmtN(gain)+' BunXP'),1300);
  }catch(e){console.debug('BunXP lookup unavailable',e)}
}

function watchStats(){
  const s=$('fmStats');
  if(!s)return false;
  new MutationObserver(()=>{
    if(!s.children.length||s.querySelector('.bx-pill'))return;
    paintPill();
    refreshXp();
  }).observe(s,{childList:true});
  return true;
}
if(!watchStats())window.addEventListener('load',watchStats);

window.FIJI_BUNXP={refresh:refreshXp,reloadBoard:loadBoard};
})();
