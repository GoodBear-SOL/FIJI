(function(){
'use strict';

/* Load AFTER badges.js:
   <script src="referrals.js?v=1"></script>
   Adds a "Referrals" box to the Profile tab, right under Badges. */

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const sec=$('profile');
if(!sec||!C.getWallet){console.warn('referrals: load it after profile-tab.js');return}
if($('pfRef'))return;

const nf=n=>Number(n||0).toLocaleString();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const wallet=()=>C.getWallet();
const db=()=>C.getSupabase&&C.getSupabase();
const toast=C.toast||(m=>console.log('[FIJI]',m));

const badgesBox=[...sec.querySelectorAll('.pf-sec')].find(s=>{
  const h=s.querySelector('h2');return h&&/badges/i.test(h.textContent);
});
if(!badgesBox){console.warn('referrals: Badges section not found');return}

const css=document.createElement('style');
css.textContent=`
#pfRef .rf-code{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
#pfRef .rf-code b{font:700 26px Fredoka,sans-serif;letter-spacing:.06em}
#pfRef .rf-pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
#pfRef .rf-row{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--soft);border:2px dashed var(--line);border-radius:14px;padding:7px 12px;margin-bottom:8px}
#pfRef .rf-row b{font:600 16px Fredoka,sans-serif;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;
document.head.appendChild(css);

const box=document.createElement('div');
box.className='pf-sec';
box.id='pfRef';
box.innerHTML='<div class="tag" style="margin-top:0">invite friends</div><h2>Referrals</h2>'+
  '<div class="sticker card" id="pfRefBody"><div class="small">Connect your wallet to see your referrals.</div></div>';
badgesBox.after(box);
const body=$('pfRefBody');

let data=null,lastW=undefined,busy=false;

function paint(){
  const w=wallet();
  if(!w){body.innerHTML='<div class="small">Connect your wallet to see your referrals.</div>';return}
  if(!data){body.innerHTML='<div class="small">Loading…</div>';return}
  if(!data.code){
    body.innerHTML='<div class="small">Buy an Access Pass to get your own referral code and start inviting friends 🐰</div>';
    return;
  }
  const list=Array.isArray(data.list)?data.list:[];
  const rows=list.length
    ?list.map(r=>'<div class="rf-row"><b>'+esc(r.who)+'</b>'+
        '<span class="pill '+(r.has_pass?'g':'')+'">'+(r.has_pass?'🎟️ Has Access Pass':'⏳ No pass yet')+'</span></div>').join('')
    :'<div class="small">Nobody has used your code yet. Share it with your friends!</div>';
  body.innerHTML=
    '<div class="rf-code"><span class="small">Your code</span><b>'+esc(data.code)+'</b>'+
    '<button class="btn sm alt" type="button" id="pfRefCopy">Copy</button></div>'+
    '<div class="rf-pills"><span class="pill">👥 Joined: '+nf(data.total)+'</span>'+
    '<span class="pill g">🎟️ Bought a pass: '+nf(data.with_pass)+'</span></div>'+
    '<p class="small" style="margin-bottom:10px">Only friends who buy an Access Pass count toward referral badges.</p>'+rows;
  const b=$('pfRefCopy');
  if(b)b.onclick=()=>{
    try{navigator.clipboard.writeText(data.code).then(()=>toast('Code copied 📋'),()=>toast(data.code))}
    catch(e){toast(data.code)}
  };
}

async function refresh(){
  const w=wallet(),c=db();
  if(!w||!c){data=null;paint();return}
  if(busy)return;
  busy=true;
  try{
    const {data:d,error}=await c.rpc('fiji_my_referrals',{p_wallet:w});
    if(error)throw error;
    if(w===wallet())data=d;
  }catch(e){console.warn('referrals: lookup failed (did you run badges.sql?)',e)}
  finally{busy=false;paint()}
}

setInterval(()=>{
  const w=wallet()||null;
  if(w!==lastW){lastW=w;data=null;paint();if(w)refresh();return}
  if(!w||document.hidden||!sec.classList.contains('on'))return;
  refresh();
},8000);

const prevGo=window.go;
window.go=function(p){
  const r=typeof prevGo==='function'?prevGo.apply(this,arguments):undefined;
  if(p==='profile')refresh();
  return r;
};

paint();
window.FIJI_REFERRALS={refresh};
})();
