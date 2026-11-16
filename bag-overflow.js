(function(){
'use strict';

// Shows a "Bag is full" pop-up when the player owns more item types than their bag has slots.
// Needs the 1-line patch in reward-box.js that publishes window.FIJI_INV. Load after reward-box.js.
const C=window.FIJI_CORE||{};
if(!C.getWallet||!C.getSupabase){console.warn('bag-overflow: load it after the core script');return}
const toast=C.toast||(m=>console.log('[FIJI]',m));
const wallet=()=>C.getWallet();
const db=()=>C.getSupabase();
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString();

const css=document.createElement('style');
css.textContent=`
.bo-sheet{width:100%;max-width:420px;max-height:90vh;overflow-y:auto;background:var(--bg);text-align:center;padding:20px 16px}
.bo-sheet .em{font-size:54px;line-height:1}
.bo-sheet h3{font-size:24px;margin:6px 0 4px}
.bo-list{display:grid;gap:8px;margin:12px 0;text-align:left}
.bo-row{display:flex;align-items:center;gap:10px;background:#fff;border:2.5px solid var(--ink);border-radius:16px;padding:7px 10px}
.bo-row.hid{background:#FFF6CF}
.bo-pic{width:38px;height:38px;border-radius:50%;border:2.5px solid var(--ink);object-fit:contain;background:var(--sb);display:flex;align-items:center;justify-content:center;font-size:20px;flex:none}
.bo-t{flex:1;min-width:0;line-height:1.2}
.bo-t b{display:block;font:600 16px Fredoka,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bo-t span{font-size:12px;opacity:.7}
.bo-warn{background:#FFD0D8;border:2.5px dashed var(--ink);border-radius:14px;padding:8px 12px;font-size:13px;margin:10px 0}
.bo-acts{display:flex;gap:10px;margin-top:12px}
.bo-acts .btn{flex:1}
`;
document.head.appendChild(css);

const modal=document.createElement('div');
modal.className='modal';
modal.style.display='none';
modal.style.zIndex=470;
modal.innerHTML='<div class="sticker card bo-sheet" role="dialog" aria-modal="true" aria-label="Bag is full"></div>';
document.body.appendChild(modal);
const sheet=modal.firstChild;

let busy=false,confirmId=null,dismissedAt=0,lastKey='';

function inv(){
  const x=window.FIJI_INV||{};
  return {items:Array.isArray(x.items)?x.items:[],cap:Number(x.cap)||0};
}
function pic(i){
  const fb=esc(i.icon||'🎁');
  return i.img
    ?'<span class="bo-pic"><img src="'+esc(i.img)+'" alt="" style="width:100%;height:100%;object-fit:contain" onerror="this.outerHTML=\''+fb+'\'"></span>'
    :'<span class="bo-pic">'+fb+'</span>';
}
const burnable=i=>String(i.id).indexOf('dish:')!==0;

function paint(){
  const {items,cap}=inv();
  const over=items.length-cap;
  if(!wallet()||!cap||over<1){close();return}
  const sel=confirmId&&items.find(i=>i.id===confirmId);

  if(sel){
    sheet.innerHTML=
      '<div class="em">🔥</div><h3>Burn '+esc(sel.name)+'?</h3>'+
      '<p>Your whole stack of <b>'+nf(sel.count)+' × '+esc(sel.name)+'</b> will be destroyed.</p>'+
      '<div class="bo-warn">⚠️ This is permanent. Burned items are gone for good, cannot be recovered and give no refund.</div>'+
      '<div class="bo-acts"><button class="btn alt" type="button" data-a="no"'+(busy?' disabled':'')+'>Cancel</button>'+
      '<button class="btn" type="button" data-a="yes"'+(busy?' disabled':'')+'>'+(busy?'Burning…':'Burn it')+'</button></div>';
  }else{
    sheet.innerHTML=
      '<div class="em">🎒</div><h3>Your bag is full</h3>'+
      '<p>Your bag holds <b>'+cap+'</b> different items and you have <b>'+items.length+'</b>. '+
      'Burn '+over+' item'+(over===1?'':'s')+' to make room, or upgrade your bag in the Market.</p>'+
      '<div class="bo-list">'+items.map((i,n)=>
        '<div class="bo-row'+(n>=cap?' hid':'')+'">'+pic(i)+
        '<div class="bo-t"><b>'+esc(i.name)+'</b><span>× '+nf(i.count)+(n>=cap?' · not shown in your bag':'')+'</span></div>'+
        (burnable(i)?'<button class="btn sm alt" type="button" data-a="pick" data-id="'+esc(i.id)+'">🔥 Burn</button>':'<span class="small">Kept</span>')+
        '</div>').join('')+'</div>'+
      '<div class="bo-warn">⚠️ Burned items are permanently destroyed, with no refund.</div>'+
      '<div class="bo-acts"><button class="btn alt" type="button" data-a="later">Later</button></div>';
  }
  modal.style.display='flex';
}
function close(){modal.style.display='none';confirmId=null}

async function burn(){
  const w=wallet(),id=confirmId;
  if(busy||!w||!id)return;
  busy=true;paint();
  try{
    const {error}=await db().rpc('fiji_discard_item',{p_wallet:w,p_item:id});
    if(error)throw error;
    toast('🔥 Burned');
    confirmId=null;
    try{window.FIJI_FARM&&window.FIJI_FARM.refresh&&await window.FIJI_FARM.refresh()}catch(e){}
    try{window.FIJI_REWARDS&&window.FIJI_REWARDS.refresh&&window.FIJI_REWARDS.refresh()}catch(e){}
  }catch(e){
    console.warn('discard failed',e);
    toast('Could not burn this item. Nothing was removed.');
  }
  busy=false;paint();
}

sheet.addEventListener('click',e=>{
  const b=e.target.closest('[data-a]');
  if(!b)return;
  const a=b.dataset.a;
  if(a==='pick'){confirmId=b.dataset.id;paint()}
  else if(a==='no'){confirmId=null;paint()}
  else if(a==='yes')burn();
  else if(a==='later'){dismissedAt=inv().items.length;close()}
});

// show when inventory changes; "Later" hides it until the item count grows again
function check(){
  const {items,cap}=inv();
  const over=cap&&items.length>cap;
  if(!wallet()||!over){dismissedAt=0;close();return}
  if(items.length>dismissedAt||modal.style.display==='flex')paint();
}
document.addEventListener('fiji:inv',check);
setTimeout(check,1500);
})();
