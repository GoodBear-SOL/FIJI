(function(){
'use strict';

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const sec=$('wallet');
if(!sec||!C.getSupabase||!C.getWallet){
  console.warn('shop: load it after the core script, market-tab.js and reward-box.js');
  return;
}
const toast=C.toast||(m=>console.log('[FIJI]',m));
const db=()=>C.getSupabase();
const wallet=()=>C.getWallet();
const onBurrow=()=>sec.classList.contains('on');

const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtN=n=>Number(n||0).toLocaleString();
const errMsg=e=>{
  const m=String((e&&e.message)||e||'Something went wrong');
  if(/could not find the function|does not exist/i.test(m))return 'The farm is not set up yet (run farm.sql)';
  return m.charAt(0).toUpperCase()+m.slice(1);
};
function fmtLeft(ms){
  const s=Math.max(0,Math.ceil(ms/1000));
  const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(x).padStart(2,'0');
}

let cat=null;
let st=null;
let skew=0;
let busy=false;
let failed=false;
let lastWallet=null;
let view={open:false,mode:'market',tab:'seeds',plot:null};
const nowMs=()=>Date.now()+skew;

const IMG_OK=/^[\w .\-]+\.(png|jpe?g|webp|gif|svg)$/i;
function imgUrl(f){
  f=String(f||'').trim();
  if(/^https:\/\//i.test(f))return f;
  return IMG_OK.test(f)?encodeURI(f):'';
}
function pic(img,emoji,cls){
  const u=imgUrl(img);
  const fb='<span class="fm-em">'+esc(emoji||'🌱')+'</span>';
  return '<span class="fm-pic '+(cls||'')+'">'+(u
    ?'<img src="'+esc(u)+'" alt="" loading="lazy" data-fb="'+esc(fb)+'" onerror="this.outerHTML=this.dataset.fb">'
    :fb)+'</span>';
}

const crop=id=>(cat&&cat.crops.find(c=>c.id===id))||null;
const waterItem=()=>(cat&&cat.items.find(i=>i.id==='water'))||{id:'water',name:'Water',emoji:'💧',img:'',price:20};
const own=id=>{
  if(!st)return 0;
  const r=st.inventory.find(x=>x.item_id===id);
  return r?Number(r.qty)||0:0;
};


function inventoryItems(){
  if(!st||!cat)return [];
  const out=[],w=waterItem();
  if(own('water')>0)out.push({id:'water',icon:w.emoji,img:imgUrl(w.img),name:w.name,count:own('water')});
  cat.crops.forEach(c=>{
    const n=own('seed:'+c.id);
    if(n>0)out.push({id:'seed:'+c.id,icon:c.seed_emoji,img:imgUrl(c.seed_img),name:c.name+' seed',count:n});
  });
  cat.crops.forEach(c=>{
    const n=own('crop:'+c.id);
    if(n>0)out.push({id:'crop:'+c.id,icon:c.crop_emoji,img:imgUrl(c.crop_img),name:c.name,count:n});
  });
  return out;
}
function publish(){
  try{window.FIJI_REWARDS&&window.FIJI_REWARDS.sync&&window.FIJI_REWARDS.sync(st?st.carrots:null)}catch(e){}
}

async function loadCatalog(){
  const {data,error}=await db().rpc('fiji_farm_catalog');
  if(error)throw error;
  cat=data;failed=false;
}
function setState(d){
  st=d;
  skew=Date.parse(d.now)-Date.now();
  const p=$('spts'),pts=Number(d.points);
  if(p&&Number.isFinite(pts))p.textContent=pts;
  publish();
  render();
}
async function loadState(){
  const w=wallet();
  if(!w){st=null;publish();render();return}
  try{
    if(!cat)await loadCatalog();
    const {data,error}=await db().rpc('fiji_farm_state',{p_wallet:w});
    if(error)throw error;
    if(w!==wallet())return;
    failed=false;
    setState(data);
  }catch(e){
    console.warn('farm load failed',e);
    failed=true;render();
  }
}

async function act(fn,args,okMsg){
  const w=wallet();
  if(!w){toast('Connect your wallet first');return null}
  if(busy)return null;
  busy=true;
  try{
    const {data,error}=await db().rpc(fn,Object.assign({p_wallet:w},args));
    if(error)throw error;
    setState(data);
    if(okMsg)toast(typeof okMsg==='function'?okMsg(data):okMsg);
    return data;
  }catch(e){
    toast(errMsg(e));
    return null;
  }finally{busy=false}
}

const css=document.createElement('style');
css.textContent=`
.fm-top{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.fm-bigem{font-size:44px;line-height:1}
.fm-topt{flex:1;min-width:180px}
.fm-topt h3{margin:0}
.fm-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.fm-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:2px 2px 6px}
.fm-plot{display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center;padding:12px 8px;background:var(--soft);border:3px solid var(--ink);border-radius:20px;box-shadow:0 4px 0 var(--ink);min-width:0}
.fm-plot.empty{background:#F6E7C8}
.fm-plot.ready{background:#B8F5D2}
.fm-plot.buy{background:#fff;border-style:dashed}
.fm-plot b{font:600 17px Fredoka,sans-serif}
.fm-plot .btn{margin-top:2px}
.fm-pic{display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;flex:none}
.fm-pic.big{width:72px;height:72px}
.fm-pic img{width:100%;height:100%;object-fit:contain;display:block}
.fm-em{font-size:34px;line-height:1}
.fm-pic.big .fm-em{font-size:44px}
.fm-plot.ready .fm-pic{animation:fmHop 1s ease-in-out infinite}
@keyframes fmHop{50%{transform:translateY(-8px) scale(1.06)}}
.fm-bar{width:100%;height:12px;border:2.5px solid var(--ink);border-radius:99px;background:#fff;overflow:hidden}
.fm-bar i{display:block;height:100%;width:0;background:var(--teal);transition:width .4s}
.fm-cd{font:700 20px Fredoka,sans-serif}
.fm-note{margin-top:12px}

.fm-modal{position:fixed;inset:0;background:rgba(18,48,92,.5);z-index:460;display:none;align-items:center;justify-content:center;padding:16px}
.fm-modal.on{display:flex}
.fm-sheet{width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden;padding:0;background:var(--bg)}
.fm-head{display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:3px solid var(--ink);background:var(--sun)}
.fm-head h3{margin:0;flex:1;font-size:22px}
.fm-tabs{display:flex;gap:8px;padding:10px 12px;border-bottom:2.5px dashed var(--line);overflow-x:auto;background:var(--soft)}
.fm-tabs .mk-p{white-space:nowrap}
.fm-body{padding:12px;overflow-y:auto;display:grid;gap:10px;align-content:start}
.fm-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;background:#fff;border:2.5px solid var(--ink);border-radius:16px;padding:8px 10px}
.fm-info{flex:1;min-width:140px;line-height:1.25}
.fm-info b{display:block;font:600 17px Fredoka,sans-serif}
.fm-info span{display:block;font-size:12px;opacity:.75}
.fm-buy{display:flex;align-items:center;gap:6px;flex:none}
.fm-q{width:58px;margin:0;padding:7px 6px;text-align:center;border-radius:12px}
.fm-soon{background:#FFF6CF;border:2.5px dashed var(--ink);border-radius:16px;padding:12px 14px}
.fm-soon b{font:700 18px Fredoka,sans-serif}
.fm-soon p{margin:4px 0 0;font-size:14px}
.fm-empty{text-align:center;padding:18px 10px}
@media(max-width:760px){
 .fm-modal{align-items:flex-end;padding:10px 10px calc(10px + env(safe-area-inset-bottom))}
 .fm-sheet{max-height:92vh}
 .fm-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
 .fm-bigem{font-size:36px}
}
@media(prefers-reduced-motion:reduce){.fm-plot.ready .fm-pic{animation:none}}
`;
document.head.appendChild(css);

sec.querySelectorAll('.cs').forEach(c=>{
  const h=c.querySelector('h3');
  if(h&&h.textContent.trim()==='Shop')c.remove();
});

const farm=document.createElement('div');
farm.id='fmFarm';
farm.innerHTML=
  '<div class="tag">your farm</div><h2>Bunny Field</h2>'+
  '<div class="sticker card fm-top"><span class="fm-bigem">🛍️</span>'+
  '<div class="fm-topt"><h3>Market</h3><p class="small">Buy seeds and water, then grow vegetables in your field.</p></div>'+
  '<button class="btn" type="button" data-a="market">Open Market</button></div>'+
  '<div class="sticker card" style="margin-top:14px"><div class="fm-stats" id="fmStats"></div>'+
  '<div class="fm-grid" id="fmField"></div>'+
  '<p class="small fm-note">Water a plant until its bar is full, wait for the timer, then harvest it. Seeds and water are bought in the Market. BUN is for fun and has no cash value.</p></div>';
const anchor=$('rwInv')||($('assets')&&$('assets').closest('.card'));
if(anchor)anchor.after(farm);else sec.appendChild(farm);

function plotHtml(p,now,waterQty){
  const n=p.plot_no;
  if(!p.crop_id){
    return '<div class="fm-plot empty"><span class="fm-pic big"><span class="fm-em">🟫</span></span><b>Plot '+n+'</b>'+
      '<span class="small">Empty</span>'+
      '<button class="btn sm" type="button" data-a="pick" data-plot="'+n+'">🌱 Plant</button></div>';
  }
  const c=crop(p.crop_id)||{name:p.crop_id,waterings:Number(p.waterings_done)||1,grow_hours:24,
    seed_emoji:'🌱',crop_emoji:'🥬',seed_img:'',crop_img:''};
  const need=Number(c.waterings)||1,done=Number(p.waterings_done)||0;
  if(!p.ready_at){
    const pct=Math.min(100,done/need*100);
    return '<div class="fm-plot">'+pic(c.seed_img,c.seed_emoji,'big')+
      '<b>'+esc(c.name)+'</b><span class="small">Watered '+done+' / '+need+'</span>'+
      '<div class="fm-bar"><i style="width:'+pct+'%"></i></div>'+
      (waterQty>0
        ?'<button class="btn sm" type="button" data-a="water" data-plot="'+n+'">💧 Water</button>'
        :'<button class="btn sm alt" type="button" data-a="market-water">Need water</button>')+'</div>';
  }
  const end=Date.parse(p.ready_at),left=end-now;
  if(left>0){
    const total=Math.max(1,(Number(c.grow_hours)||0)*3600000);
    const pct=Math.min(100,(1-left/total)*100);
    return '<div class="fm-plot">'+pic(c.seed_img,c.seed_emoji,'big')+
      '<b>'+esc(c.name)+'</b><span class="small">Growing…</span>'+
      '<span class="fm-cd" data-end="'+end+'" data-total="'+total+'">'+fmtLeft(left)+'</span>'+
      '<div class="fm-bar"><i data-bar style="width:'+pct+'%"></i></div></div>';
  }
  return '<div class="fm-plot ready">'+pic(c.crop_img,c.crop_emoji,'big')+
    '<b>'+esc(c.name)+'</b><span class="small">Ready!</span>'+
    '<button class="btn sm" type="button" data-a="harvest" data-plot="'+n+'">🧺 Harvest</button></div>';
}

function renderField(){
  const box=$('fmField'),stats=$('fmStats');
  if(!box)return;
  const msg=t=>'<div class="empty-state" style="grid-column:1/-1">'+t+'</div>';
  if(stats)stats.innerHTML='';
  if(!wallet()){box.innerHTML=msg('Connect your wallet to start farming 🐰');return}
  if(failed){box.innerHTML=msg('The farm is not available right now. Try again in a moment 💧');return}
  if(!st||!cat){box.innerHTML=msg('Loading your field…');return}
  const now=nowMs(),w=waterItem();
  if(stats)stats.innerHTML=
    '<span class="pill">'+esc(w.emoji)+' '+esc(w.name)+' × '+fmtN(own('water'))+'</span>'+
    '<span class="pill">🟫 '+st.plots_owned+' / '+st.max_plots+' plots</span>';
  let html=st.plots.map(p=>plotHtml(p,now,own('water'))).join('');
  if(st.plots_owned<st.max_plots&&st.next_plot_price!=null){
    html+='<div class="fm-plot buy"><span class="fm-pic big"><span class="fm-em">➕</span></span><b>New plot</b>'+
      '<span class="small">⭐ '+fmtN(st.next_plot_price)+' BUN</span>'+
      '<button class="btn sm alt" type="button" data-a="buyplot">Buy plot</button></div>';
  }
  box.innerHTML=html;
}

const modal=document.createElement('div');
modal.className='fm-modal';
modal.innerHTML='<div class="sticker fm-sheet" role="dialog" aria-modal="true" aria-label="Market"></div>';
document.body.appendChild(modal);
const sheet=modal.firstChild;

function headHtml(title){
  const bal=st?'<span class="pill">⭐ '+fmtN(st.points)+' BUN</span>':'<span class="pill">Connect wallet</span>';
  return '<div class="fm-head"><h3>'+title+'</h3>'+bal+'<button class="btn sm alt" type="button" data-a="close" aria-label="Close">✕</button></div>';
}
function buyRow(o){
  return '<div class="fm-row">'+pic(o.img,o.emoji)+
    '<div class="fm-info"><b>'+esc(o.name)+'</b><span>'+o.l1+'</span><span>'+o.l2+'</span></div>'+
    '<div class="fm-buy"><input class="fm-q" type="number" min="1" max="99" value="1" inputmode="numeric" data-q="'+esc(o.id)+'" data-price="'+o.price+'">'+
    '<button class="btn sm" type="button" data-a="buy" data-item="'+esc(o.id)+'" data-price="'+o.price+'">Buy · '+fmtN(o.price)+'</button></div></div>';
}
function marketBody(){
  if(!cat)return '<div class="fm-empty">'+(failed?'The market is not available right now 💧':'Loading the market…')+'</div>';
  if(view.tab==='water'){
    const w=waterItem();
    return buyRow({id:'water',img:w.img,emoji:w.emoji,name:w.name,price:w.price,
      l1:'Used to water your plants',l2:'You have: '+fmtN(own('water'))});
  }
  if(view.tab==='veg'){
    return '<div class="fm-soon"><b>Player market opens soon</b><p>You will be able to sell vegetables you grew to other players here. Buyers pay '+
      esc(cat.config.market_markup_pct)+'% more than the base value. Here is what each one is worth:</p></div>'+
      cat.crops.map(c=>{
        const have=c.to_carrots?(st?Number(st.carrots)||0:0):own('crop:'+c.id);
        return '<div class="fm-row">'+pic(c.crop_img,c.crop_emoji)+
          '<div class="fm-info"><b>'+esc(c.name)+'</b><span>Base value '+fmtN(c.base_value)+' BUN</span><span>Market price '+fmtN(c.market_price)+' BUN</span></div>'+
          '<span class="pill">You have '+fmtN(have)+'</span></div>';
      }).join('');
  }
  return cat.crops.map(c=>buyRow({
    id:'seed:'+c.id,img:c.seed_img,emoji:c.seed_emoji,name:c.name+' seed',price:c.seed_price,
    l1:esc(c.waterings)+' watering'+(c.waterings===1?'':'s')+' · ready '+esc(c.grow_hours)+'h after the last one',
    l2:'You have: '+fmtN(own('seed:'+c.id))+' · worth '+fmtN(c.base_value)+' BUN grown'
  })).join('');
}
function pickBody(){
  const seeds=inventoryItems().filter(i=>i.id.indexOf('seed:')===0);
  if(!seeds.length){
    return '<div class="fm-empty"><p>You have no seeds yet.</p><br>'+
      '<button class="btn" type="button" data-a="market">Open Market</button></div>';
  }
  return seeds.map(s=>'<div class="fm-row">'+pic(s.img,s.icon)+
    '<div class="fm-info"><b>'+esc(s.name)+'</b><span>You have: '+fmtN(s.count)+'</span></div>'+
    '<button class="btn sm" type="button" data-a="plant" data-crop="'+esc(s.id.slice(5))+'">Plant</button></div>').join('');
}
function renderModal(){
  if(!view.open)return;
  if(view.mode==='pick'){
    sheet.innerHTML=headHtml('🌱 Plant in plot '+esc(view.plot))+'<div class="fm-body">'+pickBody()+'</div>';
    return;
  }
  const tab=(k,l)=>'<button class="mk-p'+(view.tab===k?' on':'')+'" type="button" data-a="tab" data-tab="'+k+'">'+l+'</button>';
  sheet.innerHTML=headHtml('🛍️ Market')+
    '<div class="fm-tabs">'+tab('seeds','🌱 Seeds')+tab('veg','🥕 Vegetables')+tab('water','💧 Water')+'</div>'+
    '<div class="fm-body">'+marketBody()+'</div>';
}
function openModal(mode,tab,plot){
  view={open:true,mode:mode||'market',tab:tab||view.tab||'seeds',plot:plot==null?null:plot};
  modal.classList.add('on');
  renderModal();
  if(!cat||(wallet()&&!st))loadState();
}
function closeModal(){
  view.open=false;
  modal.classList.remove('on');
}
modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&view.open)closeModal()});

modal.addEventListener('input',e=>{
  const q=e.target.closest&&e.target.closest('.fm-q');
  if(!q)return;
  const qty=Math.min(99,Math.max(1,parseInt(q.value,10)||1));
  const btn=q.parentNode.querySelector('[data-a="buy"]');
  if(btn)btn.textContent='Buy · '+fmtN(Number(q.dataset.price)*qty);
});

async function onClick(e){
  const b=e.target.closest('[data-a]');
  if(!b)return;
  const a=b.dataset.a,plot=Number(b.dataset.plot);
  if(a==='market')return openModal('market','seeds');
  if(a==='market-water')return openModal('market','water');
  if(a==='close')return closeModal();
  if(a==='tab'){view.tab=b.dataset.tab;return renderModal()}
  if(a==='pick'){
    if(!wallet())return toast('Connect your wallet first');
    return openModal('pick',null,plot);
  }
  if(a==='buy'){
    const row=b.closest('.fm-buy'),q=row&&row.querySelector('.fm-q');
    const qty=Math.min(99,Math.max(1,parseInt(q&&q.value,10)||1));
    const item=b.dataset.item;
    const label=item==='water'?waterItem().name:((crop(item.slice(5))||{}).name||'')+' seed';
    return void act('fiji_farm_buy',{p_item:item,p_qty:qty},'Bought '+qty+' × '+label+' ✔');
  }
  if(a==='plant'){
    const id=b.dataset.crop,p=view.plot;
    const r=await act('fiji_farm_plant',{p_plot:p,p_crop:id},'Planted '+((crop(id)||{}).name||'seed')+' 🌱');
    if(r)closeModal();
    return;
  }
  if(a==='water')return void act('fiji_farm_water',{p_plot:plot},'Watered 💧');
  if(a==='harvest'){
    return void act('fiji_farm_harvest',{p_plot:plot},d=>{
      const h=d&&d.harvested,c=h&&crop(h.crop_id);
      if(!h)return 'Harvested 🧺';
      return 'Harvested '+(c?c.name:h.crop_id)+' × '+h.qty+(h.to_carrots?' (added to your Carrots)':'')+' 🧺';
    });
  }
  if(a==='buyplot'){
    if(!st)return;
    if(!window.confirm('Buy plot '+(st.plots_owned+1)+' for '+fmtN(st.next_plot_price)+' BUN?'))return;
    return void act('fiji_farm_buy_plot',{},'New plot unlocked 🟫');
  }
}
farm.addEventListener('click',onClick);
modal.addEventListener('click',onClick);

function render(){renderField();renderModal()}

setInterval(()=>{
  if(!onBurrow()||document.hidden)return;
  const now=nowMs();
  let flip=false;
  document.querySelectorAll('#fmField [data-end]').forEach(el=>{
    const left=Number(el.dataset.end)-now;
    if(left<=0){flip=true;return}
    el.textContent=fmtLeft(left);
    const bar=el.closest('.fm-plot').querySelector('[data-bar]');
    if(bar)bar.style.width=Math.min(100,(1-left/Number(el.dataset.total))*100)+'%';
  });
  if(flip)renderField();
},1000);

setInterval(()=>{
  const w=wallet()||null;
  if(w===lastWallet)return;
  lastWallet=w;
  st=null;publish();render();
  if(w&&onBurrow())loadState();
},1500);
new MutationObserver(()=>{if(onBurrow()&&wallet())loadState()}).observe(sec,{attributes:true,attributeFilter:['class']});

loadCatalog().then(render).catch(e=>{console.warn('farm catalog unavailable (is farm.sql installed?)',e);failed=true;render()});
render();
if(onBurrow()&&wallet())loadState();

window.FIJI_FARM={inventoryItems,refresh:loadState,open:openModal};
})();
