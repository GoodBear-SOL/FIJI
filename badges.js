(function(){
'use strict';

const BASE='badges/';

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const sec=$('profile');
if(!sec||!C.getWallet){console.warn('badges: load it after profile-tab.js');return}

const nf=n=>Number(n||0).toLocaleString();
const wallet=()=>C.getWallet();
const db=()=>C.getSupabase&&C.getSupabase();
const toast=C.toast||(m=>console.log('[FIJI]',m));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const BADGES=[
 {file:'badge1.png', name:'Bunny Buddy',        desc:'7 active days',                    key:'days',      need:7},
 {file:'badge2.png', name:'Clover Hopper',      desc:'30 active days',                   key:'days',      need:30},
 {file:'badge3.png', name:'Carrot Cruncher',    desc:'60 active days',                   key:'days',      need:60},
 {file:'badge4.png', name:'Farm Hero',          desc:'100 active days',                  key:'days',      need:100},
 {file:'badge5.png', name:'BUNXP Sprout',       desc:'50,000 BunXP',                     key:'xp',        need:50000},
 {file:'badge6.png', name:'BUNXP Superstar',    desc:'100,000 BunXP',                    key:'xp',        need:100000},
 {file:'badge7.png', name:'BUNXP Overlord',     desc:'500,000 BunXP',                    key:'xp',        need:500000},
 {file:'badge8.png', name:'OG Burrow Bunny',    desc:'Harvested 5,000 or more crops',    key:'harvested', need:5000},
 {file:'badge9.png', name:'Market Bunny',       desc:'Purchased 3,000 items from the Market', key:'market', need:3000},
 {file:'badge10.png',name:'Golden Whale Bunny', desc:'Holds 10M FIJI LABS or more',      key:'hold',      need:10000000},
 {file:'badge11.png',name:'Bunny Connector',    desc:'5 Access Pass referrals',          key:'referrals', need:5},
 {file:'badge12.png',name:'Bunny Social Star',  desc:'10 Access Pass referrals',         key:'referrals', need:10},
 {file:'badge13.png',name:'Bunny NFT Keeper',   desc:'Holds 1 NFT',                      key:'nfts',      need:1},
 {file:'badge14.png',name:'Bunny NFT Hoarder',  desc:'Holds 5 NFTs',                     key:'nfts',      need:5},
 {file:'badge15.png',name:'Burrow VIP',         desc:'Purchased Access Pass',            key:'vip',       need:1},
 {file:'badge16.png',name:'Pass Hoarder Bunny', desc:'Purchased 3 or more passes',       key:'passes',    need:3}
];

const css=document.createElement('style');
css.textContent=`
#profile .pf-grid.bd-grid{grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:12px}
#profile .bd{background:none;border:0;padding:0;cursor:pointer;text-align:center;font:inherit;color:inherit;min-width:0}
#profile .bd img{width:100%;aspect-ratio:1/1;object-fit:contain;display:block;transition:filter .3s,opacity .3s}
#profile .bd.lock img{filter:grayscale(1);opacity:.45}
#profile .bd.on img{filter:none;opacity:1}
#profile .bd .bd-n{display:block;font:600 11px Fredoka,sans-serif;margin-top:2px;line-height:1.1}
@media(max-width:760px){#profile .pf-grid.bd-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}}
`;
document.head.appendChild(css);

const secBox=[...sec.querySelectorAll('.pf-sec')].find(s=>{
  const h=s.querySelector('h2');return h&&/badges/i.test(h.textContent);
});
const grid=secBox&&secBox.querySelector('.pf-grid');
if(!grid){console.warn('badges: Badges grid not found in profile');return}
grid.classList.add('bd-grid');

grid.innerHTML=BADGES.map((b,i)=>
  '<button type="button" class="bd lock" data-i="'+i+'">'+
  '<img src="'+esc(BASE+b.file)+'" alt="'+esc(b.name)+'" loading="lazy">'+
  '<span class="bd-n">'+esc(b.name)+'</span></button>'
).join('');

let stats={};
let holdAt=0,lastW=undefined,busy=false;

function paint(){
  grid.querySelectorAll('.bd').forEach(el=>{
    const b=BADGES[+el.dataset.i];
    const v=stats[b.key];
    const ok=v!=null&&Number(v)>=b.need;
    el.classList.toggle('on',ok);
    el.classList.toggle('lock',!ok);
  });
}

grid.addEventListener('click',e=>{
  const el=e.target.closest('.bd');
  if(!el)return;
  const b=BADGES[+el.dataset.i];
  const v=stats[b.key];
  const ok=v!=null&&Number(v)>=b.need;
  if(ok)toast('🏅 '+b.name+' unlocked: '+b.desc);
  else if(b.key==='vip')toast('🔒 '+b.name+': '+b.desc);
  else toast('🔒 '+b.name+': '+b.desc+(v!=null?' ('+nf(Math.floor(v))+' / '+nf(b.need)+')':''));
});

async function loadHold(w){
  if(Date.now()-holdAt<60000&&stats.hold!=null)return;
  try{
    const r=await C.getConnection().getParsedTokenAccountsByOwner(
      new solanaWeb3.PublicKey(w),{mint:new solanaWeb3.PublicKey(C.CFG.FIJI_MINT)});
    const amt=r.value.reduce((s,a)=>s+(Number(a.account.data.parsed.info.tokenAmount.uiAmount)||0),0);
    if(w!==wallet())return;
    stats.hold=amt;holdAt=Date.now();
  }catch(e){console.warn('badges: FIJI balance failed',e)}
}

async function refresh(){
  const w=wallet(),c=db();
  if(!w||!c){stats={};paint();return}
  if(busy)return;
  busy=true;
  try{
    const [prof,p2,extra]=await Promise.allSettled([
      c.from('fiji_profiles').select('bunxp,streak').eq('wallet',w).maybeSingle(),
      c.rpc('fiji_phase_status',{p_wallet:w}),
      c.rpc('fiji_badge_stats',{p_wallet:w})
    ]);
    if(w!==wallet())return;
    const val=r=>r.status==='fulfilled'&&r.value&&!r.value.error?r.value.data:null;
    const p=val(prof)||{},s=val(p2)||{},x=val(extra)||{};
    const next={};
    next.xp=Number(p.bunxp||0)+Number(s.p2_xp||0);
    next.days=x.active_days!=null?Number(x.active_days):null;
    next.harvested=x.harvested!=null?Number(x.harvested):null;
    next.market=x.market_items!=null?Number(x.market_items):null;
    next.nfts=x.nfts!=null?Number(x.nfts):null;
    next.passes=x.passes!=null?Number(x.passes):null;
    next.referrals=x.referrals!=null?Number(x.referrals):null;
    const pass=Boolean(window.FIJI_PASS&&window.FIJI_PASS.has&&window.FIJI_PASS.has());
    next.vip=pass?1:0;
    if(pass&&(next.passes==null||next.passes<1))next.passes=Math.max(next.passes||0,1);
    next.hold=stats.hold;
    stats=next;
    await loadHold(w);
    stats.hold=stats.hold;
  }catch(e){console.warn('badges: refresh failed',e)}
  finally{busy=false;paint()}
}

setInterval(()=>{
  const w=wallet()||null;
  if(w!==lastW){lastW=w;stats={};holdAt=0;paint();if(w)refresh();return}
  if(!w||document.hidden||!sec.classList.contains('on'))return;
  refresh();
},5000);

const prevGo=window.go;
window.go=function(p){
  const r=typeof prevGo==='function'?prevGo.apply(this,arguments):undefined;
  if(p==='profile')refresh();
  return r;
};

paint();
window.FIJI_BADGES={refresh};
})();
