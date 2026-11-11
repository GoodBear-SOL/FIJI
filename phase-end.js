(function(){
'use strict';

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const board=$('board'),burrow=$('wallet'),earn=$('earn');
if(!board||!burrow||!C.getSupabase||!C.getWallet){
  console.warn('phase-end: load it after the core script and shop.js');
  return;
}
const toast=C.toast||(m=>console.log('[FIJI]',m));
const db=()=>C.getSupabase();
const wallet=()=>C.getWallet();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString();

const ph={cutoff:null,skew:0,srvEnded:false,burnPct:50,data:null};
const listeners=[];
let lastEnded=false,lastWallet=null,loading=false,lastLoad=0,busy=false,cardMode='',airBuilt=false,deb=0;
const nowMs=()=>Date.now()+ph.skew;
const ended=()=>ph.srvEnded||(ph.cutoff!==null&&nowMs()>=ph.cutoff);

const css=document.createElement('style');
css.textContent=`
.ph-card{text-align:center;margin:0 0 16px;overflow-x:hidden}
.ph-card h3{font-size:clamp(22px,4vw,30px);margin:8px 0 4px}
.ph-clock{font:700 clamp(34px,10vw,62px)/1.05 Fredoka,sans-serif;letter-spacing:-1px;margin:6px 0;font-variant-numeric:tabular-nums}
.ph-note{font-size:14px;opacity:.8;margin:6px auto 0;max-width:560px}
.ph-pills{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin:8px 0}
.ph-banner{display:none;padding:12px 16px;margin:0 0 14px;background:#FFF6CF;border-style:dashed;font:600 15px Fredoka,sans-serif}
.ph-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.ph-row{display:flex;gap:8px;align-items:center;margin:8px 0}
.ph-row input{margin:0}
.ph-sub{font:600 14px Fredoka,sans-serif;letter-spacing:.08em;text-transform:uppercase;opacity:.7;margin:14px 2px 6px}
.ph-req{display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--soft);border:2px dashed var(--line);border-radius:14px;padding:8px 12px;margin-bottom:8px}
.ph-req b{font:600 17px Fredoka,sans-serif}
.ph-req .small{display:block}
.ph-bad{background:#FFD0D8}
`;
document.head.appendChild(css);

function fmtLeft(ms){
  const s=Math.max(0,Math.floor(ms/1000));
  const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;
  const p=n=>String(n).padStart(2,'0');
  return (d>0?d+'d ':'')+p(h)+':'+p(m)+':'+p(x);
}
function whenText(){
  if(ph.cutoff===null)return '';
  const d=new Date(ph.cutoff);
  let est='',mine='';
  try{est=d.toLocaleString('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}catch(e){est=d.toString()}
  try{mine=d.toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})}catch(e){}
  return est+(mine?' · your time: '+mine:'');
}

const card=document.createElement('div');
card.id='phCard';
card.className='sticker card ph-card';
const bh2=board.querySelector('h2');
if(bh2)bh2.after(card);else board.prepend(card);

function paintCard(){
  const mode=(ph.cutoff===null&&!ph.srvEnded)?'wait':(ended()?'end':'live');
  if(mode!==cardMode){
    cardMode=mode;
    if(mode==='wait'){
      card.innerHTML='<div class="small">Loading the Phase 1 countdown…</div>';
    }else if(mode==='live'){
      card.innerHTML=
        '<div class="tag" style="margin:0">phase one</div>'+
        '<h3>⏳ Phase 1 ends in</h3>'+
        '<div class="ph-clock" id="phClock">--:--:--</div>'+
        '<p class="small" id="phWhen"></p>'+
        '<p class="ph-note">BunXP earned from Phase 1 leaderboard are saved.</p>';
    }else{
      card.innerHTML=
        '<div class="tag" style="margin:0">phase one</div>'+
        '<h3>✅ Phase 1 has ended</h3>'+
        '<p class="ph-note">Phase 2 is live!</p>'+
        '<div class="ph-pills" id="phMe"></div>'+
        '<p class="small" id="phWhen"></p>';
    }
  }
  const w=$('phWhen');if(w){const t=whenText();if(w.textContent!==t)w.textContent=t}
  const me=$('phMe');
  if(me){
    const d=ph.data;
    const html=(wallet()&&d&&d.p2_xp!=null)?'<span class="pill">⭐ Your Phase 2 BunXP: '+nf(d.p2_xp)+'</span>':'';
    if(me.innerHTML!==html)me.innerHTML=html;
  }
}

const banner=document.createElement('div');
banner.className='sticker card ph-banner';
banner.textContent='🏁 Phase 2 started!';
const eh2=earn&&earn.querySelector('h2');
if(eh2)eh2.after(banner);
function paintBanner(){banner.style.display=ended()?'block':'none'}

const air=document.createElement('div');
air.id='phAir';
air.style.display='none';
air.innerHTML='<div class="tag">airdrop</div><h2>BUN airdrop</h2><div class="sticker card" id="phAirBody"></div>';
const farm=$('fmFarm');
if(farm)farm.before(air);else burrow.appendChild(air);

function buildAir(){
  if(airBuilt)return;
  airBuilt=true;
  $('phAirBody').innerHTML=
    '<div class="ph-stats" id="phAirPills"></div>'+
    '<p class="small">Choose your BUN airdrop amount. Submitted BUN will be reserved immediately and marked as Pending until withdrawn.</p>'+
    '<div class="ph-row"><input id="phAmt" type="number" min="1" step="1" inputmode="numeric" placeholder="Amount of BUN">'+
    '<button class="btn sm alt" type="button" data-a="max">Max</button></div>'+
    '<button class="btn full" type="button" id="phAirBtn" data-a="submit">Submit request</button>'+
    '<div class="ph-sub">Your requests</div><div id="phAirList"></div>';
}
const STAT={
  pending:{t:'⏳ Pending withdrawal',c:''},
  paid:{t:'✅ Sent',c:'g'},
  rejected:{t:'↩️ Returned to your BUN',c:'ph-bad'}
};
function paintAir(){
  air.style.display='none';
  return;
  air.style.display='block';
  buildAir();
  const w=wallet(),d=ph.data||{},reqs=Array.isArray(d.requests)?d.requests:[];
  const bal=Number(d.balance)||0;
  const pend=reqs.filter(r=>r.status==='pending').reduce((s,r)=>s+(Number(r.amount)||0),0);
  $('phAirPills').innerHTML=w
    ?'<span class="pill g">🪙 Available: '+nf(bal)+' BUN</span><span class="pill">⏳ Pending withdrawal: '+nf(pend)+' BUN</span>'
    :'<span class="pill">Connect your wallet to see your BUN</span>';
  $('phAirList').innerHTML=!w?'<div class="small">Connect your wallet to see your requests.</div>'
    :!reqs.length?'<div class="small">No requests yet.</div>'
    :reqs.map(r=>{
      const s=STAT[r.status]||STAT.pending;
      let when='';try{when=new Date(r.created_at).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch(e){}
      return '<div class="ph-req"><div><b>'+nf(r.amount)+' BUN</b><span class="small">Request #'+esc(r.id)+' · '+esc(when)+'</span></div>'+
        '<span class="pill '+s.c+'">'+s.t+'</span></div>';
    }).join('');
  const b=$('phAirBtn');
  if(b){
    b.disabled=busy;
    b.textContent=busy?'Submitting…':(w?'Submit request':'Connect wallet');
  }
}

function confirmBox(amt){
  return new Promise(resolve=>{
    const d=document.createElement('div');
    d.className='modal';
    d.innerHTML='<div class="sticker card" style="max-width:360px;width:100%;text-align:center">'+
      '<div style="font-size:48px;line-height:1">🪂</div>'+
      '<h3>Submit airdrop request?</h3>'+
      '<p class="small">'+nf(amt)+' BUN will be set aside and shown as pending withdrawal.</p>'+
      '<div style="display:flex;gap:10px;margin-top:14px">'+
      '<button class="btn alt" type="button" style="flex:1" data-c="no">Cancel</button>'+
      '<button class="btn" type="button" style="flex:1" data-c="yes">Submit</button></div></div>';
    const done=v=>{d.remove();resolve(v)};
    d.addEventListener('click',e=>{
      if(e.target===d)return done(false);
      const b=e.target.closest('[data-c]');
      if(b)done(b.dataset.c==='yes');
    });
    document.body.appendChild(d);
  });
}

async function submit(){
  if(busy)return;
  const w=wallet();
  if(!w){if(typeof window.connect==='function')window.connect();return}
  const inp=$('phAmt');
  const amt=Math.floor(Number(inp&&inp.value));
  const bal=Number(ph.data&&ph.data.balance)||0;
  if(!Number.isFinite(amt)||amt<1)return toast('Enter how much BUN you want to receive');
  if(amt>bal)return toast('You only have '+nf(bal)+' BUN');
  if(!(await confirmBox(amt)))return;
  busy=true;paintAir();
  try{
    const {data,error}=await db().rpc('fiji_airdrop_request',{p_wallet:w,p_amount:amt});
    if(error)throw error;
    if(w===wallet())apply(data);
    if(inp)inp.value='';
    toast('Request submitted ⏳ Pending withdrawal');
    try{window.FIJI_FARM&&window.FIJI_FARM.refresh&&window.FIJI_FARM.refresh()}catch(e){}
  }catch(e){
    const m=String((e&&e.message)||e||'Something went wrong');
    toast(m.charAt(0).toUpperCase()+m.slice(1));
  }finally{
    busy=false;paintAir();
  }
}

air.addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');
  if(!b)return;
  if(b.dataset.a==='max'){
    const bal=Number(ph.data&&ph.data.balance)||0;
    const inp=$('phAmt');
    if(inp&&bal>0)inp.value=Math.floor(bal);
  }else if(b.dataset.a==='submit')submit();
});

function fire(){
  paintBanner();paintAir();
  listeners.forEach(f=>{try{f(ended())}catch(e){}});
  try{window.FIJI_FARM&&window.FIJI_FARM.render&&window.FIJI_FARM.render()}catch(e){}
}
function apply(d){
  if(!d)return;
  ph.cutoff=Date.parse(d.cutoff);
  ph.skew=Date.parse(d.now)-Date.now();
  ph.srvEnded=Boolean(d.ended);
  ph.burnPct=Number(d.burn_pct)||50;
  ph.data=d;
  const e=ended();
  if(e!==lastEnded){lastEnded=e;fire()}
  paintCard();paintBanner();paintAir();
}
async function load(){
  if(loading)return;
  const c=db();
  if(!c)return;
  loading=true;
  const w=wallet()||null;
  let again=false;
  try{
    const {data,error}=await c.rpc('fiji_phase_status',{p_wallet:w});
    if(error)throw error;
    if(w!==(wallet()||null))again=true;
    else apply(data);
  }catch(e){
    console.warn('phase: status failed (is phase-end.sql installed?)',e);
    if(!ph.data&&cardMode==='wait')card.innerHTML='<div class="small">The Phase 1 countdown is not available right now.</div>';
  }finally{
    loading=false;lastLoad=Date.now();
  }
  if(again)load();
}

setInterval(()=>{
  const e=ended();
  if(e!==lastEnded){lastEnded=e;fire();if(e)load()}
  paintCard();
  const clk=$('phClock');
  if(clk&&ph.cutoff!==null)clk.textContent=fmtLeft(ph.cutoff-nowMs());
  const w=wallet()||null;
  if(w!==lastWallet){lastWallet=w;load()}
  else if(!document.hidden&&Date.now()-lastLoad>60000)load();
},1000);

const sp=$('spts');
if(sp)new MutationObserver(()=>{clearTimeout(deb);deb=setTimeout(load,1200)})
  .observe(sp,{childList:true,characterData:true,subtree:true});

window.FIJI_PHASE={
  ended,
  burnPct:()=>ph.burnPct,
  cutoff:()=>ph.cutoff,
  refresh:load,
  onChange:f=>{if(typeof f==='function')listeners.push(f)}
};

paintCard();
load();
})();
