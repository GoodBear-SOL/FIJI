(function(){
'use strict';

/* FIJI Labs: Profile tab
   Load AFTER seed-pay.js (last script in index.html).
   - Adds a Profile tab (desktop nav + mobile bottom bar)
   - Moves the Bunny Bag from Burrow into Profile
   - Shows leaderboard rank, Phase 1 BunXP, Phase 2 BunXP
   - Locked placeholders: 15 badges, 3 NFTs, 4 Mint Passes (all "?")
   - Makes the farm plot boxes smaller on phones
*/

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const main=document.querySelector('main.wrap'),links=$('links'),burrow=$('wallet');
if(!main||!links||!burrow||!C.CFG||!C.getWallet){console.warn('profile-tab: load it after the other scripts');return}
if($('profile'))return;

const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString();
const short=a=>{const s=String(a||'');return s.length<=10?s:s.slice(0,4)+'…'+s.slice(-4)};
const wallet=()=>C.getWallet();
const db=()=>C.getSupabase&&C.getSupabase();

/* ---------- placeholder counts ---------- */
const BADGES=15, NFTS=3, PASSES=4;

/* ---------- styles ---------- */
const css=document.createElement('style');
css.textContent=`
#profile .pf-head{display:flex;align-items:center;gap:14px;margin-bottom:14px}
#profile .pf-av{width:64px;height:64px;border-radius:50%;border:3px solid var(--ink);object-fit:cover;box-shadow:0 4px 0 var(--ink);flex:none}
#profile .pf-who{min-width:0;flex:1}
#profile .pf-who h3{font-size:24px;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#profile .pf-stats{margin-bottom:14px}
#profile .pf-stats .small{display:block}
#profile .pf-sec{margin-top:22px}
#profile .pf-sec h3{font-size:20px;margin:0 0 10px}
#pfBag .card{overflow-x:hidden}
#profile .pf-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,60px));gap:10px}
#profile .pf-ph{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;border:2px solid var(--line);border-radius:12px;background:var(--soft);font:600 22px Fredoka,sans-serif;color:var(--ink);opacity:.5;user-select:none}
#profile .pf-lock{text-align:center;padding:10px 6px}
#profile .pf-lock .em{font-size:48px;line-height:1}

@media(max-width:760px){
 /* 6 tabs in the bottom bar */
 .nav a{padding:6px 6px}
 #profile .pf-av{width:52px;height:52px}
 #profile .pf-who h3{font-size:20px}
 #profile .pf-grid{grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}

 /* smaller farm plot boxes on phones */
 .fm-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
 .fm-plot{padding:8px 4px;gap:3px;border-width:2.5px;border-radius:14px;box-shadow:0 3px 0 var(--ink)}
 .fm-plot b{font-size:13px;line-height:1.1}
 .fm-plot .small{font-size:11px;line-height:1.2}
 .fm-plot .fm-pic.big{width:40px;height:40px}
 .fm-plot .fm-pic.big .fm-em{font-size:26px}
 .fm-plot .fm-bar{height:9px;border-width:2px}
 .fm-plot .fm-cd{font-size:14px}
 .fm-plot .btn.sm{padding:4px 8px;font-size:12px;min-height:0;border-width:2.5px;box-shadow:0 2px 0 var(--ink)}
 .fm-plot .bun-icon{width:14px;height:14px}
 .fm-stats .pill{font-size:13px;padding:1px 10px}
}
@media(max-width:380px){
 .fm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
`;
document.head.appendChild(css);

/* ---------- page ---------- */
const ph=(n)=>Array.from({length:n},()=>'<div class="pf-ph" aria-hidden="true">?</div>').join('');

const sec=document.createElement('section');
sec.className='pg';
sec.id='profile';
sec.innerHTML=
 '<div class="tag">my profile</div><h2>Bunny Profile</h2>'+
 '<div class="sticker card pf-head" id="pfHead"></div>'+
 '<div class="stats sticker card pf-stats">'+
  '<div><b id="pfRank">–</b>rank</div>'+
  '<div><b id="pfP1">–</b>Phase 1 BunXP</div>'+
  '<div><b id="pfP2">–</b>Phase 2 BunXP</div>'+
  '<div><b id="pfStreak">–</b>day streak</div>'+
 '</div>'+
 '<div id="pfBag"></div>'+
 '<div class="pf-sec"><div class="tag" style="margin-top:0">collection</div><h2>Badges</h2>'+
  '<div class="sticker card"><div class="pf-grid">'+ph(BADGES)+'</div></div></div>'+
 '<div class="pf-sec"><h2>NFTs</h2>'+
  '<div class="sticker card"><div class="pf-grid">'+ph(NFTS)+'</div></div></div>'+
 '<div class="pf-sec"><h2>Mint Passes</h2>'+
  '<div class="sticker card"><div class="pf-grid">'+ph(PASSES)+'</div></div></div>';
main.appendChild(sec);

/* ---------- move the Bunny Bag out of Burrow ---------- */
(function moveBag(){
  const assets=$('assets'),card=assets&&assets.closest('.card');
  if(!card||card.parentElement!==burrow){console.warn('profile-tab: Bunny Bag card not found in Burrow');return}
  const slot=$('pfBag');
  const tag=burrow.querySelector(':scope > .tag'),h2=burrow.querySelector(':scope > h2');
  if(tag&&/my wallet/i.test(tag.textContent))slot.appendChild(tag);
  if(h2&&/bunny bag/i.test(h2.textContent))slot.appendChild(h2);
  slot.appendChild(card);
  burrow.insertAdjacentHTML('afterbegin','<div class="tag">burrow</div><h2>Your Burrow</h2>');
})();

/* ---------- nav link ---------- */
try{if(typeof pages!=='undefined'&&!pages.includes('profile'))pages.push('profile')}catch(e){}
const link=document.createElement('a');
link.dataset.p='profile';
link.innerHTML='<span class="ic">👤</span><span>Profile</span>';
link.onclick=()=>window.go('profile');
const adminLink=links.querySelector('[data-p="admin"]');
if(adminLink)links.insertBefore(link,adminLink);else links.appendChild(link);

const prevGo=window.go;
window.go=function(p){
  const r=typeof prevGo==='function'?prevGo.apply(this,arguments):undefined;
  if(p==='profile'){
    try{C.loadAssets&&C.loadAssets()}catch(e){}
    refresh();
  }
  return r;
};

/* account menu: "My Bunny Bag" now opens the Profile tab */
const prevAct=window.acctAction;
window.acctAction=function(a){
  if(a==='wallet'){
    try{closeAcct()}catch(e){}
    window.go('profile');
    return;
  }
  return typeof prevAct==='function'?prevAct.apply(this,arguments):undefined;
};
const menuLabel=document.querySelector('#acctMenu [onclick="acctAction(\'wallet\')"] .am-t b');
if(menuLabel)menuLabel.textContent='My Profile';

/* ---------- data ---------- */
let seq=0,lastLoad=0,lastW=undefined,assetsBusy=false;
const on=()=>sec.classList.contains('on');

function paintHead(name){
  const w=wallet();
  const el=$('pfHead');
  if(!w){
    el.innerHTML='<div class="pf-lock" style="width:100%"><div class="em">🔒</div><h3>Connect your wallet</h3>'+
      '<p class="small">Connect to see your Bunny Bag, rank and BunXP.</p><br>'+
      '<button class="btn" type="button" id="pfConnect">Connect wallet</button></div>';
    const b=$('pfConnect');
    if(b)b.onclick=()=>{if(typeof window.connect==='function')window.connect()};
    return;
  }
  el.innerHTML='<img class="pf-av" src="fiji.png" alt="">'+
    '<div class="pf-who"><h3>'+esc(name||'Bunny')+'</h3><div class="small">'+esc(short(w))+'</div></div>';
}
function setStats(rank,p1,p2,streak){
  const f=v=>v==null||!isFinite(Number(v))?'–':nf(v);
  $('pfRank').textContent=rank?'#'+nf(rank):'–';
  $('pfP1').textContent=f(p1);
  $('pfP2').textContent=f(p2);
  $('pfStreak').textContent=f(streak);
}

async function refresh(){
  const w=wallet(),client=db(),my=++seq;
  lastLoad=Date.now();
  if(!w||!client){paintHead();setStats(null,null,null,null);return}
  const [prof,rk,phs]=await Promise.allSettled([
    client.from('fiji_profiles').select('username,bunxp,streak').eq('wallet',w).maybeSingle(),
    client.rpc('fiji_my_phase2',{p_wallet:w}),
    client.rpc('fiji_phase_status',{p_wallet:w})
  ]);
  if(my!==seq||w!==wallet())return;
  const val=r=>r.status==='fulfilled'&&r.value&&!r.value.error?r.value.data:null;
  const p=val(prof)||{},r=val(rk)||{},s=val(phs)||{};

  /* Phase 1 BunXP = frozen BunXP stored on the profile.
     Phase 2 BunXP = p2_xp from the phase status (falls back to fiji_my_phase2.bunxp).
     If profile.bunxp turns out to include Phase 2 as well, change p1 to: p.bunxp - p2 */
  const p2=s.p2_xp!=null?s.p2_xp:r.bunxp;
  const p1=p.bunxp;
  paintHead(p.username);
  setStats(r.rank,p1,p2,p.streak);
}

/* wallet connect/disconnect + periodic refresh while the tab is open */
setInterval(()=>{
  const w=wallet()||null;
  if(w!==lastW){lastW=w;paintHead();setStats(null,null,null,null);if(on())refresh();return}
  if(!on()||document.hidden||!w)return;
  if(Date.now()-lastLoad>20000)refresh();
},1000);

/* the Bunny Bag normally refreshes only while Burrow is open: keep it live here */
setInterval(async()=>{
  if(assetsBusy||document.hidden||!on()||!wallet())return;
  assetsBusy=true;
  try{await C.loadAssets()}catch(e){}
  finally{assetsBusy=false}
},3000);

paintHead();
setStats(null,null,null,null);
window.FIJI_PROFILE={refresh};
})();
