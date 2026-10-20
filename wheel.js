(function(){
'use strict';

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const sec=$('earn');
if(!sec||!C.getSupabase||!C.getWallet){
  console.warn('wheel: load it after the core script');
  return;
}
const toast=C.toast||(m=>console.log('[FIJI]',m));
const db=()=>C.getSupabase();
const wallet=()=>C.getWallet();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const SIZE=320;
const COLORS=['#FFF3C4','#BFE3FF','#B8F5D2','#FFD0D8'];
const DEFAULT_STATUS={used:0,limit:5,cost:50};

let prizes=[];
let totalW=0;
let status=Object.assign({},DEFAULT_STATUS);
let spinning=false;
let rot=0;
let open=false;
let lastWallet=null;

const css=document.createElement('style');
css.textContent=`
.wh-modal{position:fixed;inset:0;background:rgba(18,48,92,.55);z-index:465;display:none;align-items:center;justify-content:center;padding:16px}
.wh-modal.on{display:flex}
.wh-sheet{width:100%;max-width:420px;max-height:94vh;overflow-y:auto;padding:16px;background:var(--bg);text-align:center}
.wh-head{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.wh-head h3{flex:1;margin:0;font-size:24px;text-align:left}
.wh-stage{position:relative;width:min(100%,${SIZE}px);aspect-ratio:1;margin:14px auto 10px}
.wh-pointer{position:absolute;top:-14px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:14px solid transparent;border-right:14px solid transparent;border-top:26px solid var(--ink);z-index:3;filter:drop-shadow(0 2px 0 rgba(0,0,0,.2))}
.wh-rim{position:absolute;inset:0;border:4px solid var(--ink);border-radius:50%;box-shadow:0 6px 0 var(--ink);overflow:hidden;background:#fff}
#whCanvas{width:100%;height:100%;display:block;transition:transform 4.6s cubic-bezier(.12,.72,.08,1)}
.wh-hub{position:absolute;left:50%;top:50%;width:54px;height:54px;transform:translate(-50%,-50%);border-radius:50%;border:4px solid var(--ink);background:var(--sun);z-index:2;display:flex;align-items:center;justify-content:center;overflow:hidden}
.wh-hub img{width:100%;height:100%;object-fit:contain;display:block}
.wh-info{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin:6px 0 10px}
.wh-res{min-height:56px;margin:8px 0;padding:8px 12px;border:2.5px dashed var(--ink);border-radius:16px;background:#fff;font:600 18px Fredoka,sans-serif;display:flex;align-items:center;justify-content:center}
.wh-res.win{background:#B8F5D2}
.wh-res.jack{background:var(--sun);animation:whPop .7s cubic-bezier(.2,.9,.3,1.3)}
@keyframes whPop{0%{transform:scale(.6)}100%{transform:scale(1)}}
.wh-odds{margin-top:12px;text-align:left}
.wh-odds summary{cursor:pointer;font:600 15px Fredoka,sans-serif}
.wh-odds table{margin-top:6px;font-size:14px}
.wh-odds td{padding:5px 4px}
.wh-odds td:last-child{text-align:right;white-space:nowrap}
@media(prefers-reduced-motion:reduce){#whCanvas{transition-duration:.01s!important}}
`;
document.head.appendChild(css);

const card=document.createElement('div');
card.className='sticker card';
card.id='whCard';
card.innerHTML='<div class="em">🎡</div><h3>Lucky Wheel</h3>'+
  '<p>Spin for veggies, seeds, water or the BUN jackpot. Costs BUN, limited spins per day.</p><br>'+
  '<button class="btn sm" type="button" data-a="open">Spin the wheel</button>';
function mountCard(){
  const grid=sec.querySelector('.grid');
  const pad=$('pad');
  const tapCard=pad&&pad.closest('.card');
  if(tapCard&&grid&&tapCard.parentElement===grid){
    if(tapCard.nextElementSibling!==card)tapCard.after(card);
    return;
  }
  if(!document.body.contains(card))(grid||sec).appendChild(card);
}
mountCard();
setInterval(mountCard,1500); 
card.addEventListener('click',e=>{if(e.target.closest('[data-a="open"]'))openWheel()});

const modal=document.createElement('div');
modal.className='wh-modal';
modal.innerHTML=
 '<div class="sticker wh-sheet" role="dialog" aria-modal="true" aria-label="Lucky Wheel">'+
  '<div class="wh-head"><h3>🎡 Lucky Wheel</h3><button class="btn sm alt" type="button" data-a="close" aria-label="Close">✕</button></div>'+
  '<div class="wh-info" id="whInfo"></div>'+
  '<div class="wh-stage"><div class="wh-pointer"></div><div class="wh-rim"><canvas id="whCanvas"></canvas></div><div class="wh-hub"><img src="BUN%20COIN.png" alt="BUN Coin"></div></div>'+
  '<div class="wh-res" id="whRes">Press spin and good luck!</div>'+
  '<button class="btn full" type="button" id="whSpin" data-a="spin">Spin</button>'+
  '<details class="wh-odds"><summary>See prizes and odds</summary><table id="whOdds"></table></details>'+
  '<p class="small" style="margin-top:10px">BUN is for fun and has no cash value. Prizes are picked by the server, not your device.</p>'+
 '</div>';
document.body.appendChild(modal);
const canvas=modal.querySelector('#whCanvas');

modal.addEventListener('click',e=>{
  if(e.target===modal&&!spinning)closeWheel();
  const b=e.target.closest('[data-a]');if(!b)return;
  if(b.dataset.a==='close'&&!spinning)closeWheel();
  if(b.dataset.a==='spin')spin();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open&&!spinning)closeWheel()});

function fmtPct(w){
  if(!totalW)return '';
  const p=w/totalW*100;
  if(p>=1)return p.toFixed(1)+'%';
  if(p>=0.01)return p.toFixed(2)+'%';
  return p.toFixed(4).replace(/0+$/,'')+'%';
}

function drawWheel(){
  const n=prizes.length;if(!n)return;
  const dpr=Math.min(window.devicePixelRatio||1,2);
  canvas.width=SIZE*dpr;canvas.height=SIZE*dpr;
  const g=canvas.getContext('2d');
  g.setTransform(dpr,0,0,dpr,0,0);
  const R=SIZE/2,seg=Math.PI*2/n;
  g.clearRect(0,0,SIZE,SIZE);
  g.translate(R,R);
  for(let i=0;i<n;i++){
    const a0=i*seg-Math.PI/2,a1=(i+1)*seg-Math.PI/2,p=prizes[i];
    g.beginPath();g.moveTo(0,0);g.arc(0,0,R,a0,a1);g.closePath();
    g.fillStyle=p.jackpot?'#FFD21F':COLORS[i%COLORS.length];
    g.fill();
    g.lineWidth=2.5;g.strokeStyle='#12305C';g.stroke();
    g.save();
    g.rotate((a0+a1)/2);
    g.textAlign='center';g.textBaseline='middle';
    g.font='30px serif';
    g.fillText(p.emoji||'🎁',R*0.7,0);
    g.restore();
  }
}

function paintInfo(){
  const left=Math.max(0,status.limit-status.used);
  $('whInfo').innerHTML=
    '<span class="pill">🎟️ '+left+' / '+status.limit+' spins left</span>'+
    '<span class="pill">⭐ '+Number(status.cost).toLocaleString()+' BUN per spin</span>';
  const b=$('whSpin');
  if(b){
    b.disabled=spinning||!wallet()||left<=0;
    b.textContent=spinning?'Spinning…':!wallet()?'Connect wallet to spin':left<=0?'No spins left today':'Spin · '+Number(status.cost).toLocaleString()+' BUN';
  }
}

function paintOdds(){
  $('whOdds').innerHTML=prizes.map(p=>
    '<tr><td>'+esc(p.emoji)+' '+esc(p.label)+'</td><td>'+fmtPct(p.weight)+'</td></tr>').join('');
}

async function loadPrizes(){
  if(prizes.length)return;
  const {data,error}=await db().from('fiji_wheel_prizes').select('*').eq('active',true).order('sort',{ascending:true});
  if(error)throw error;
  prizes=(data||[]).filter(p=>p.weight>0);
  totalW=prizes.reduce((s,p)=>s+Number(p.weight||0),0);
  drawWheel();paintOdds();
}
async function loadStatus(){
  const w=wallet();
  if(!w){status=Object.assign({},DEFAULT_STATUS);paintInfo();return}
  try{
    const {data,error}=await db().rpc('fiji_wheel_status',{p_wallet:w});
    if(error)throw error;
    if(w!==wallet())return;
    status={used:Number(data.used)||0,limit:Number(data.limit)||5,cost:Number(data.cost)||50};
  }catch(e){console.warn('wheel status failed',e)}
  paintInfo();
}

async function openWheel(){
  open=true;
  modal.classList.add('on');
  document.body.style.overflow='hidden';
  paintInfo();
  try{await loadPrizes()}
  catch(e){
    console.warn('wheel prizes failed (is wheel.sql installed?)',e);
    $('whRes').textContent='The wheel is not available right now 💧';
    return;
  }
  loadStatus();
}
function closeWheel(){
  open=false;
  modal.classList.remove('on');
  document.body.style.overflow='';
}

async function spin(){
  if(spinning)return;
  const w=wallet();
  if(!w)return toast('Connect your wallet first');
  if(!prizes.length)return toast('The wheel is not ready yet');
  if(status.used>=status.limit)return toast('No spins left today');

  spinning=true;paintInfo();
  const res=$('whRes');
  res.className='wh-res';res.textContent='Spinning… 🎡';

  let data;
  try{
    const r=await db().rpc('fiji_wheel_spin',{p_wallet:w});
    if(r.error)throw r.error;
    data=r.data;
  }catch(e){
    spinning=false;
    const m=String((e&&e.message)||e||'Something went wrong');
    res.textContent=m.charAt(0).toUpperCase()+m.slice(1);
    loadStatus();
    return;
  }

  const idx=Math.max(0,prizes.findIndex(p=>p.id===data.prize_id));
  const n=prizes.length,segDeg=360/n;
  const center=(idx+0.5)*segDeg;
  const jitter=(Math.random()-0.5)*segDeg*0.7;
  const target=360-center+jitter;
  const delta=(((target-(rot%360))%360)+360)%360;
  rot+=360*5+delta;
  canvas.style.transform='rotate('+rot+'deg)';

  setTimeout(()=>{
    spinning=false;
    status.used=Number(data.used)||status.used+1;
    status.limit=Number(data.limit)||status.limit;
    res.className='wh-res '+(data.jackpot?'jack':'win');
    res.textContent=(data.jackpot?'👑 JACKPOT! ':'🎉 You got ')+data.emoji+' '+data.label+(data.xp_gained?' · +'+data.xp_gained+' XP':'');
    paintInfo();
    // refresh BUN, streak, inventory and carrots everywhere
    try{if(data.profile&&C.setProfile)C.setProfile(data.profile)}catch(e){}
    try{
      const c=Number(data.profile&&data.profile.carrots);
      if(window.FIJI_REWARDS&&window.FIJI_REWARDS.sync&&Number.isFinite(c))window.FIJI_REWARDS.sync(c);
    }catch(e){}
    try{window.FIJI_FARM&&window.FIJI_FARM.refresh&&window.FIJI_FARM.refresh()}catch(e){}
    try{window.FIJI_BUNXP&&window.FIJI_BUNXP.refresh&&window.FIJI_BUNXP.refresh()}catch(e){}
    toast(data.jackpot?'JACKPOT! 👑':'You won '+data.label+' '+data.emoji);
  },4800);
}

setInterval(()=>{
  const w=wallet()||null;
  if(w===lastWallet)return;
  lastWallet=w;
  status=Object.assign({},DEFAULT_STATUS);
  paintInfo();
  if(w&&open)loadStatus();
},1500);

window.FIJI_WHEEL={open:openWheel,refresh:loadStatus};
})();
