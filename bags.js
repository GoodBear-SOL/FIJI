(function(){
'use strict';
const C=window.FIJI_CORE||{};
const mkHost=document.getElementById('mkInline');
if(!mkHost||!C.getWallet||!C.getSupabase){console.warn('bags: load it after shop.js');return}
const toast=C.toast||(m=>console.log('[FIJI]',m));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString();

const BASE_CAP=15;
const BAGS=[
 {tier:1,name:'Bag 1',cap:20,price:2000000, img:'Bags/bag1.png'},
 {tier:2,name:'Bag 2',cap:25,price:5000000, img:'Bags/bag2.png'},
 {tier:3,name:'Bag 3',cap:30,price:15000000,img:'Bags/bag3.png'}
];
let tier=0,lastW=undefined,lastAt=0,busy=false;

const cap=()=>tier>0?BAGS[tier-1].cap:BASE_CAP;

function pic(b){
  const fb='<span class="fm-em">🎒</span>';
  return '<span class="fm-pic"><img src="'+esc(encodeURI(b.img))+'" alt="" loading="lazy" data-fb="'+esc(fb)+'" onerror="this.outerHTML=this.dataset.fb"></span>';
}
function html(){
  const tiles=BAGS.map(b=>{
    const owned=tier===b.tier,lower=tier>b.tier;
    const label=owned?'✅ Owned':lower?'Included':'Buy';
    return '<button type="button" class="fm-tile" data-bag="'+b.tier+'"'+((owned||lower)?' disabled style="opacity:.6;cursor:default"':'')+'>'+pic(b)+
      '<b>'+esc(b.name)+'</b>'+
      '<span class="fm-tp"><img src="./bun-coin.png" class="bun-icon" alt="">'+nf(b.price)+'</span>'+
      '<span class="small">Holds '+b.cap+' items</span>'+
      '<span class="small">'+label+'</span></button>';
  }).join('');
  return '<div class="fm-soon"><b>🎒 Bigger bag</b><p>Your burrow inventory holds '+BASE_CAP+' items. A bag raises that limit. Paid in BUN from your wallet to the project wallet. Payments are final, and the bag stays tied to your wallet. Current capacity: <b>'+cap()+'</b>.</p></div>'+
    '<div class="fm-tiles">'+tiles+'</div>';
}

function changed(){
  try{document.dispatchEvent(new CustomEvent('fiji:bag',{detail:{tier,cap:cap()}}))}catch(e){}
  try{window.FIJI_FARM&&window.FIJI_FARM.render&&window.FIJI_FARM.render()}catch(e){}
}
async function refresh(){
  const w=C.getWallet(),db=C.getSupabase();
  lastAt=Date.now();
  if(!w||!db){if(tier!==0){tier=0;changed()}return}
  if(busy)return;
  busy=true;
  try{
    const {data,error}=await db.rpc('fiji_bag_status',{p_wallet:w});
    if(error)throw error;
    if(w!==C.getWallet())return;
    const t=Math.max(0,Math.min(3,Number(data&&data.tier)||0));
    if(t!==tier){tier=t;changed()}
  }catch(e){console.warn('bags: status failed (is the bag SQL installed?)',e)}
  finally{busy=false}
}

mkHost.addEventListener('click',e=>{
  const b=e.target.closest('[data-bag]');
  if(!b||b.disabled)return;
  const def=BAGS.find(x=>x.tier===Number(b.dataset.bag));
  if(!def)return;
  if(!C.getWallet())return toast('Connect your wallet first');
  if(tier>=def.tier)return;
  const P=window.FIJI_SEEDPAY;
  if(!P||!P.buyBag)return toast('Payments are still loading. Try again in a moment 🎒');
  P.buyBag(def.tier,def.price,def.name);
});

setInterval(()=>{
  const w=C.getWallet()||null;
  if(w!==lastW){lastW=w;tier=0;changed();if(w)refresh();return}
  const mk=document.getElementById('market');
  if(w&&!document.hidden&&mk&&mk.classList.contains('on')&&Date.now()-lastAt>30000)refresh();
},1500);

window.FIJI_BAGS={cap,tier:()=>tier,html,refresh};
refresh();
})();
