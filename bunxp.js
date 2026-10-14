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

const origLoadBoard=typeof window.loadBoard==='function'?window.loadBoard:null;

const css=document.createElement('style');
css.textContent=`
.bx-head{margin:0 0 14px}
.bx-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.bx-note{font-size:14px;opacity:.8;margin:0 0 10px}
.bx-me{display:none;margin:0 0 12px}
.bx-me.on{display:flex;gap:8px;flex-wrap:wrap}
#lb tr.bx-mine td{background:#FFF6CF}
#lb td.bx-r,#lb th.bx-r{text-align:right}
`;
document.head.appendChild(css);

let mode='xp';
let seq=0;
const card=tbl.closest('.card');
const head=document.createElement('div');
head.className='bx-head';
head.innerHTML=
  '<div class="bx-tabs">'+
  '<button class="mk-p on" type="button" data-m="xp">⭐ BunXP</button>'+
  '<button class="mk-p" type="button" data-m="bun">BUN</button></div>'+
  '<p class="bx-note" id="bxNote"></p>'+
  '<div class="bx-me" id="bxMe"></div>';
if(card)card.before(head);else sec.appendChild(head);

const NOTE={
  xp:'Earn BunXP by watering and harvesting crops in the Bunny Field. BunXP and BUN are for community gameplay only and have no cash value. Future token or NFT rewards are not guaranteed.',
  bun:'BUN balance ranking. BunXP and BUN are for community gameplay only and have no cash value. Future token or NFT rewards are not guaranteed.'
};

head.addEventListener('click',e=>{
  const b=e.target.closest('[data-m]');
  if(!b||b.dataset.m===mode)return;
  mode=b.dataset.m;
  head.querySelectorAll('[data-m]').forEach(x=>x.classList.toggle('on',x.dataset.m===mode));
  loadBoard();
});

function paintMe(info){
  const el=$('bxMe');
  if(!el)return;
  if(mode!=='xp'||!wallet()||!info){el.classList.remove('on');el.innerHTML='';return}
  const xp=Number(info.bunxp)||0;
  el.innerHTML='<span class="pill">⭐ Your BunXP: '+fmtN(xp)+'</span>'+
    (info.rank?'<span class="pill g">Rank #'+fmtN(info.rank)+'</span>':'<span class="pill">Water or harvest to get ranked</span>');
  el.classList.add('on');
}

function paintTable(rows){
  const me=wallet();
  const first=mode==='xp'?['BunXP','bunxp','BUN','points']:['BUN','points','BunXP','bunxp'];
  const body=(rows||[]).map(p=>{
    const r=Number(p.rank)||0;
    const medal=['🥇','🥈','🥉'][r-1]||r;
    const who=p.username?esc(p.username):short(p.wallet);
    const mine=me&&p.wallet===me;
    return '<tr'+(mine?' class="bx-mine"':'')+'><td>'+medal+'</td><td>'+who+(mine?' <span class="small">(you)</span>':'')+'</td>'+
      '<td class="bx-r">'+fmtN(p[first[1]])+'</td><td class="bx-r">'+fmtN(p[first[3]])+'</td><td class="bx-r">🔥 '+fmtN(p.streak)+'</td></tr>';
  }).join('');
  tbl.innerHTML='<tr><th>#</th><th>Player</th><th class="bx-r">'+first[0]+'</th><th class="bx-r">'+first[2]+'</th><th class="bx-r">Streak</th></tr>'+
    (body||'<tr><td colspan="5" class="small">Nobody here yet. Be the first to water or harvest a crop 🌱</td></tr>');
}

async function loadBoard(){
  const note=$('bxNote');
  if(note)note.textContent=NOTE[mode];
  const client=db();
  if(!client){if(origLoadBoard)return origLoadBoard();return}
  const my=++seq;
  try{
    const {data,error}=await client.rpc('fiji_leaderboard',{p_sort:mode,p_limit:25});
    if(error)throw error;
    if(my!==seq)return;
    paintTable(Array.isArray(data)?data:[]);
    const w=wallet();
    if(mode==='xp'&&w){
      const r=await client.rpc('fiji_my_bunxp',{p_wallet:w});
      if(my===seq&&!r.error)paintMe(r.data);
    }else paintMe(null);
  }catch(e){
    console.warn('BunXP leaderboard unavailable (is bunxp.sql installed?)',e);
    if(my!==seq)return;
    paintMe(null);
    if(origLoadBoard){
      if(note)note.textContent='';
      head.style.display='none';
      origLoadBoard();
    }
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
    const {data,error}=await client.rpc('fiji_my_bunxp',{p_wallet:w});
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
