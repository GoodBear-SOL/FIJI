(function(){
'use strict';

// Adds cooked dishes to the SAME inventory list as water, seeds and crops.
// Load AFTER shop.js (it wraps FIJI_FARM.inventoryItems).
const C=window.FIJI_CORE||{};
const F=window.FIJI_FARM;
if(!C.getWallet||!C.getSupabase||!F||typeof F.inventoryItems!=='function'){
  console.warn('cooked-dishes: load it after shop.js');
  return;
}
if(F.__cooked)return;
F.__cooked=true;

const wallet=()=>C.getWallet();
const db=()=>C.getSupabase();
const IMG_OK=/^(?:[\w\-]+\/)*[\w .\-]+\.(png|jpe?g|webp|gif|svg)$/i;
const imgUrl=f=>{f=String(f||'').trim();return /^https:\/\//i.test(f)?f:IMG_OK.test(f)?encodeURI(f):''};

let cooked=[],cookedFor=null,seq=0,lastAt=0;

// same shape shop.js returns: {id,icon,img,name,count}
const baseItems=F.inventoryItems;
F.inventoryItems=function(){
  const items=baseItems.apply(this,arguments)||[];
  if(cookedFor!==wallet())return items;
  return items.concat(cooked.map(d=>({
    id:'dish:'+d.dish_no,
    icon:d.emoji||'🍲',
    img:imgUrl(d.img),
    name:d.name||('Dish #'+d.dish_no),
    count:Number(d.times)||0
  })));
};

async function load(){
  const w=wallet(),c=db(),my=++seq;
  lastAt=Date.now();
  if(!w||!c){if(cooked.length||cookedFor){cooked=[];cookedFor=null;rerender()}return}
  try{
    const {data,error}=await c.rpc('fiji_my_cooked',{p_wallet:w});
    if(error)throw error;
    if(my!==seq||w!==wallet())return;
    const list=Array.isArray(data)?data:[];
    const changed=cookedFor!==w||JSON.stringify(list)!==JSON.stringify(cooked);
    cooked=list;cookedFor=w;
    if(changed)rerender();
  }catch(e){
    console.warn('cooked-dishes: lookup failed (is cooked-dishes.sql installed?)',e);
  }
}
// shop.js publishes the inventory to the reward box on every state refresh
function rerender(){
  try{
    if(window.FIJI_REWARDS&&window.FIJI_REWARDS.sync)window.FIJI_REWARDS.sync(); // repaint only, no refetch
    else F.refresh&&F.refresh();
  }catch(e){}
}

let lastW;
setInterval(()=>{
  const w=wallet()||null;
  if(w!==lastW){lastW=w;cooked=[];cookedFor=null;load();return}
  if(!document.hidden&&w&&Date.now()-lastAt>30000)load();
},1500);
document.addEventListener('fiji:quest-cooked',()=>setTimeout(load,800));

// for the next quest: how many times has the player cooked a dish?
window.FIJI_COOKED={
  refresh:load,
  list:()=>cooked.slice(),
  count:no=>{const d=cooked.find(x=>Number(x.dish_no)===Number(no));return d?Number(d.times)||0:0}
};
load();
})();
