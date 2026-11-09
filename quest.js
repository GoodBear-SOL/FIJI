(function(){
'use strict';

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const inv=$('rwInv');
const sec=$('wallet');
if(!inv||!sec||!C.CFG||!C.getWallet){
  console.warn('quest: load it after reward-box.js and bun-coin.js');
  return;
}
const db=()=>C.getSupabase&&C.getSupabase();
const toast=C.toast||(m=>console.log('[FIJI]',m));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString();
const wallet=()=>C.getWallet();
const TK='fiji_quest_tok';
const PAY_URL=C.CFG.SUPABASE_URL.replace(/\/+$/,'')+'/functions/v1/quest-pay';
const ATA_PROGRAM='ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

const S={
  min_hold:1000000,
  treasury:'EZebVdUUxPYjUaBvrAewkAeDWXsw6pJ9tdhXQG6Z33mE',
  products:[
    {id:'farming',name:'Farming Crops',emoji:'🌾',blurb:'Plant, water and harvest crops in the Bunny Field.',price_fiji:50000,days:7},
    {id:'cooking',name:'Cooking',emoji:'🍳',blurb:'Cook the daily dish from your harvest and earn BunXP.',price_fiji:100000,days:7}
  ],
  subs:[],
  offset:0,
  loaded:false,
  failed:false
};
let hold=null;          // FIJI balance of the connected wallet (null = unknown)
let holdErr=false;      // true when the balance lookup failed
let holdAt=0;
let view='board';       // board | farming | cooking
let buying=false;
let lastKey='';
let lastWallet=null;
let lastStatusAt=0;
let statusBusy=false;

/* ---------------- styles ---------------- */
const css=document.createElement('style');
css.textContent=`
#fmFarm:not(.qs-live){display:none!important}
#fmFarm.qs-live{margin-top:14px}
#fmFarm.qs-live .tag{margin-top:0}
.qh-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}
.qh-top .grow{flex:1}
.qh-lock{text-align:center;padding:10px 6px}
.qh-lock .em{font-size:54px;line-height:1}
.qh-lock h3{font-size:24px;margin:8px 0 4px}
.qh-bar{height:14px;border:2.5px solid var(--ink);border-radius:99px;background:#fff;overflow:hidden;margin:12px auto;max-width:360px}
.qh-bar i{display:block;height:100%;background:var(--teal);width:0}
.qh-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
.qh-q{background:var(--soft);border:3px solid var(--ink);border-radius:20px;box-shadow:0 4px 0 var(--ink);padding:14px;display:flex;flex-direction:column;gap:6px;min-width:0}
.qh-q.on{background:#EAFBF1}
.qh-q .em{font-size:44px;line-height:1}
.qh-q h3{font-size:22px;margin:2px 0 0}
.qh-q p{font-size:14px;margin:0}
.qh-q .row{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0}
.qh-q .btn{margin-top:auto}
.qh-pay{max-width:440px;margin:0 auto;text-align:center}
.qh-pay .em{font-size:60px;line-height:1}
.qh-pay h3{font-size:26px;margin:6px 0 2px}
.qh-price{font:700 34px Fredoka,sans-serif;margin:10px 0 2px}
.qh-list{list-style:none;padding:0;margin:12px 0;text-align:left;display:grid;gap:6px;font-size:15px}
.qh-list li{background:var(--soft);border:2px dashed var(--line);border-radius:12px;padding:6px 10px}
.qh-sub{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#EAFBF1;border:2.5px solid #7CF0A8;border-radius:16px;padding:8px 12px;margin-bottom:14px}
.qh-sub b{font:600 16px Fredoka,sans-serif}
.qh-note{font-size:12px;opacity:.7;margin-top:10px}
.qh-pop{max-width:380px;width:100%;text-align:center}
.qh-pop .em{font-size:54px;line-height:1}
.qh-pop h3{font-size:24px;margin:8px 0 4px}
.qh-pop .acts{display:flex;gap:10px;margin-top:16px}
.qh-pop .acts .btn{flex:1}

.qs-card{background:#fff;border:3px solid var(--ink);border-radius:22px;box-shadow:0 5px 0 var(--ink);padding:14px;margin:0 0 6px}
.qs-top{display:flex;align-items:center;gap:14px}
.qs-dish{width:84px;height:84px;border-radius:50%;border:3px solid var(--ink);object-fit:cover;background:var(--sb);flex:none;box-shadow:0 4px 0 var(--ink);display:flex;align-items:center;justify-content:center;font-size:42px}
.qs-info{min-width:0;flex:1}
.qs-tag{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.qs-info h3{font-size:24px;line-height:1.1;margin:6px 0 2px}
.qs-timer{font:600 13px Fredoka,sans-serif;opacity:.75}
.qs-list{display:grid;gap:8px;margin:14px 0}
.qs-ing{display:flex;align-items:center;gap:10px;background:var(--soft);border:2px dashed var(--line);border-radius:14px;padding:7px 10px}
.qs-ing.ok{background:#EAFBF1;border-color:#7CF0A8}
.qs-ing img,.qs-ing .qs-ph{width:34px;height:34px;border-radius:50%;border:2.5px solid var(--ink);object-fit:cover;background:var(--sb);flex:none;display:flex;align-items:center;justify-content:center;font-size:17px}
.qs-ing b{font:600 16px Fredoka,sans-serif;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qs-ing span.n{font:700 16px Fredoka,sans-serif;white-space:nowrap}
.qs-rew{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.qs-note{font-size:12px;opacity:.7;margin-top:8px}
.qs-pop .qs-big{width:120px;height:120px;font-size:60px;margin:6px auto 10px}
.qs-pop{text-align:center;max-width:360px;width:100%;animation:qsIn .35s cubic-bezier(.2,.9,.3,1.3)}
@keyframes qsIn{0%{transform:scale(.7);opacity:0}100%{transform:scale(1);opacity:1}}
.qs-pop h3{font-size:28px;margin:4px 0}
.qs-pop .qs-rew{justify-content:center;margin:12px 0}
@media(max-width:760px){
 .qs-dish{width:68px;height:68px;font-size:34px}
 .qs-info h3{font-size:20px}
}
`;
document.head.appendChild(css);

const hub=document.createElement('div');
hub.id='qsHub';
hub.innerHTML='<div class="tag">quests</div><h2>Quest Board</h2><div class="sticker card" id="qhBody"></div>';
inv.before(hub);
const body=$('qhBody');

const root=document.createElement('div');
root.className='qs-card';
root.id='qsRoot';
root.innerHTML='<div class="small">Loading today\'s dish…</div>';

const prod=id=>S.products.find(p=>p.id===id)||null;
const nowMs=()=>Date.now()+S.offset;
function subOf(id){
  const s=S.subs.find(x=>x.quest_id===id);
  if(!s)return null;
  return Date.parse(s.expires_at)>nowMs()?s:null;
}
function fmtLong(ms){
  const s=Math.max(0,Math.floor(ms/1000));
  const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
  return d>0?d+'d '+h+'h':h>0?h+'h '+m+'m':m+'m '+(s%60)+'s';
}
function fmtLeft(ms){
  const s=Math.max(0,Math.floor(ms/1000));
  const h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(x).padStart(2,'0');
}
function img(src,fb,cls){
  return src
    ?'<img class="'+cls+'" src="'+esc(src)+'" alt="" loading="lazy" onerror="this.outerHTML=\'<span class=&quot;'+cls+'&quot;>'+fb+'</span>\'">'
    :'<span class="'+cls+'">'+fb+'</span>';
}
const farmEl=()=>$('fmFarm');
function stashFarm(){
  const f=farmEl();
  if(!f)return;
  f.classList.remove('qs-live');
  if(f.parentElement!==sec)sec.appendChild(f);
}

async function loadHold(force){
  const w=wallet();
  if(!w){hold=null;return}
  if(!force&&hold!==null&&Date.now()-holdAt<30000)return;
  try{
    const r=await C.getConnection().getParsedTokenAccountsByOwner(
      new solanaWeb3.PublicKey(w),{mint:new solanaWeb3.PublicKey(C.CFG.FIJI_MINT)});
    const amt=r.value.reduce((s,a)=>s+(Number(a.account.data.parsed.info.tokenAmount.uiAmount)||0),0);
    if(w!==wallet())return;
    hold=amt;holdAt=Date.now();holdErr=false;
  }catch(e){
    console.warn('quest: FIJI balance lookup failed',e);
    if(hold===null)holdErr=true;
  }
  render();
}

/* ---------------- subscription status ---------------- */
async function loadStatus(force){
  const c=db();
  if(!c)return;
  if(statusBusy){
    if(!force)return;
    for(let i=0;i<40&&statusBusy;i++)await new Promise(r=>setTimeout(r,150));
  }
  statusBusy=true;
  try{
    const {data,error}=await c.rpc('fiji_quest_sub_status',{p_wallet:wallet()||''});
    if(error)throw error;
    if(data){
      S.offset=Date.parse(data.now)-Date.now();
      if(data.treasury)S.treasury=data.treasury;
      if(Number(data.min_hold)>0)S.min_hold=Number(data.min_hold);
      if(Array.isArray(data.products)&&data.products.length)S.products=data.products;
      S.subs=Array.isArray(data.subs)?data.subs:[];
      S.loaded=true;S.failed=false;
    }
  }catch(e){
    console.warn('quest: status failed (is quest-sub.sql installed?)',e);
    S.failed=!S.loaded;
  }
  statusBusy=false;lastStatusAt=Date.now();
  render();
  resumePending();
}

function renderKey(){
  const w=wallet()||'';
  const subs=S.subs.map(s=>s.quest_id+s.expires_at).join(',');
  const state=!w?'nw':hold===null?(holdErr?'err':'chk'):hold<S.min_hold?'low':'ok';
  const act=state==='ok'?subs:'';
  return [state,view,act,buying?1:0,S.failed?1:0,state==='low'?Math.floor(hold):''].join('|');
}
function render(){
  const k=renderKey();
  if(k===lastKey)return;
  lastKey=k;
  stashFarm();

  const w=wallet();
  if(!w){
    body.innerHTML='<div class="qh-lock"><div class="em">🔒</div><h3>Connect your wallet</h3>'+
      '<p class="small">Hold '+nf(S.min_hold)+' FIJI to unlock the quests.</p><br>'+
      '<button class="btn" type="button" data-act="connect">Connect wallet</button></div>';
    return;
  }
  if(hold===null&&holdErr){
    body.innerHTML='<div class="qh-lock"><div class="em">💧</div><h3>Could not check your FIJI</h3><p class="small">The network is busy. Try again.</p><br>'+
      '<button class="btn" type="button" data-act="retry">Try again</button></div>';
    return;
  }
  if(hold===null){
    body.innerHTML='<div class="qh-lock"><div class="em">🔎</div><h3>Checking your FIJI…</h3></div>';
    return;
  }
  if(hold<S.min_hold){
    const pct=Math.min(100,hold/S.min_hold*100);
    body.innerHTML='<div class="qh-lock"><div class="em">🔒</div><h3>Quests are for FIJI holders</h3>'+
      '<p>Hold at least <b>'+nf(S.min_hold)+' FIJI</b> to see the available quests.</p>'+
      '<div class="qh-bar"><i style="width:'+pct.toFixed(1)+'%"></i></div>'+
      '<p class="small">You hold '+nf(Math.floor(hold))+' FIJI</p><br>'+
      '<button class="btn" type="button" data-act="trade">Get FIJI</button></div>';
    return;
  }
  if(S.failed){
    body.innerHTML='<div class="qh-lock"><div class="em">💧</div><h3>Quests are not ready yet</h3><p class="small">Check back soon.</p></div>';
    return;
  }
  if(view==='board')return renderBoard();
  renderDetail(view);
}

function renderBoard(){
  const cards=S.products.map(p=>{
    const s=subOf(p.id);
    const status=s
      ?'<span class="pill g">✅ Active</span><span class="pill qh-left" data-end="'+Date.parse(s.expires_at)+'">…</span>'
      :'<span class="pill">🔒 Not purchased</span>';
    return '<div class="qh-q'+(s?' on':'')+'">'+
      '<div class="em">'+esc(p.emoji||'📜')+'</div>'+
      '<h3>'+esc(p.name)+'</h3>'+
      '<p>'+esc(p.blurb||'')+'</p>'+
      '<div class="row"><span class="pill">🪙 '+nf(p.price_fiji)+' FIJI</span><span class="pill">⏳ '+nf(p.days)+' days</span></div>'+
      '<div class="row">'+status+'</div>'+
      '<button class="btn" type="button" data-act="open" data-q="'+esc(p.id)+'">'+(s?'Open quest':'View quest')+'</button></div>';
  }).join('');
  body.innerHTML=
    '<div class="qh-top"><span class="pill g">✅ Holder unlocked</span><span class="pill">'+nf(Math.floor(hold))+' FIJI</span></div>'+
    '<p class="small" style="margin-bottom:12px">Pick a quest. Each quest is a '+nf((S.products[0]||{}).days||7)+'-day pass paid in FIJI. Quest rewards are BunXP and count toward your Phase 2 BunXP.</p>'+
    '<div class="qh-grid">'+cards+'</div>'+
    '<p class="qh-note">FIJI payments are final and go to the project treasury. BunXP is for gameplay only and has no cash value. Future token or NFT rewards are not guaranteed.</p>';
  tick();
}

function renderDetail(id){
  const p=prod(id);
  if(!p){view='board';lastKey='';render();return}
  const s=subOf(id);
  const back='<div class="qh-top"><button class="btn sm alt" type="button" data-act="back">← Quests</button>'+
    '<span class="grow"></span><span class="pill">'+esc(p.emoji||'')+' '+esc(p.name)+'</span></div>';

  if(!s){
    const can=hold>=Number(p.price_fiji);
    body.innerHTML=back+
      '<div class="qh-pay"><div class="em">'+esc(p.emoji||'📜')+'</div><h3>'+esc(p.name)+'</h3>'+
      '<p class="small">'+esc(p.blurb||'')+'</p>'+
      '<div class="qh-price">🪙 '+nf(p.price_fiji)+' FIJI</div>'+
      '<div class="small">for '+nf(p.days)+' days of access</div>'+
      '<ul class="qh-list">'+detailPerks(id,p)+'</ul>'+
      '<p class="small">Your balance: '+nf(Math.floor(hold))+' FIJI</p><br>'+
      '<button class="btn full" type="button" data-act="buy" data-q="'+esc(id)+'"'+((buying||!can)?' disabled':'')+'>'+
        (buying?'Waiting for payment…':can?'Subscribe · '+nf(p.price_fiji)+' FIJI':'Not enough FIJI')+'</button>'+
      '<p class="qh-note">Your wallet will ask you to approve a FIJI transfer to the project treasury. FIJI never needs your private key.</p></div>';
    return;
  }

  body.innerHTML=back+
    '<div class="qh-sub"><span class="pill g">✅ Active</span><b>Access ends in <span class="qh-left" data-end="'+Date.parse(s.expires_at)+'">…</span></b>'+
    '</div>'+
    '<div id="qhHost"></div>';
  const host=$('qhHost');
  if(id==='cooking'){
    host.appendChild(root);
    paintCook();
  }else if(id==='farming'){
    const f=farmEl();
    if(f){f.classList.add('qs-live');host.appendChild(f)}
    else host.innerHTML='<div class="empty-state">The Bunny Field could not load. Refresh the page.</div>';
    try{window.FIJI_FARM&&window.FIJI_FARM.refresh&&window.FIJI_FARM.refresh()}catch(e){}
    try{window.FIJI_FARM&&window.FIJI_FARM.render&&window.FIJI_FARM.render()}catch(e){}
  }
  tick();
}
function detailPerks(id,p){
  if(id==='farming')return '<li>🌱 Buy seeds and water in the Market</li><li>🧺 Plant, water and harvest your plots</li><li>⭐ Earn BunXP for every watering and harvest</li><li>⏳ Access lasts '+nf(p.days)+' days from purchase</li>';
  if(id==='cooking')return '<li>🍳 A new dish every 12 hours</li><li>🥕 Cook it with vegetables you harvested</li><li>⭐ Rewards BunXP</li><li>⏳ Access lasts '+nf(p.days)+' days from purchase</li>';
  return '<li>⏳ Access lasts '+nf(p.days)+' days from purchase</li>';
}

function tick(){
  const now=nowMs();
  body.querySelectorAll('.qh-left').forEach(el=>{
    const t=fmtLong(Number(el.dataset.end)-now);
    if(el.textContent!==t)el.textContent=t;
  });
}

const PK='fiji_quest_pending';
const TERMINAL=/already used|too old|failed on-chain|does not match|not signed|invalid/i;
function getPending(){
  try{const o=JSON.parse(localStorage.getItem(PK)||'null');return o&&o.w&&o.q&&o.sig?o:null}catch(e){return null}
}
function setPending(o){
  try{if(o)localStorage.setItem(PK,JSON.stringify(o));else localStorage.removeItem(PK)}catch(e){}
}
function applyGrant(g){
  if(!g||!g.quest_id||!g.expires_at)return;
  S.subs=S.subs.filter(x=>x.quest_id!==g.quest_id).concat([{quest_id:g.quest_id,expires_at:g.expires_at}]);
  lastKey='';
}
let resuming=false;
async function resumePending(){
  const p=getPending(),w=wallet();
  if(!p||!w||p.w!==w||buying||resuming)return;
  resuming=true;
  try{
    const g=await verifyPayment(w,p.q,p.sig);
    setPending(null);
    applyGrant(g);
    toast('✅ Your payment was confirmed. Quest unlocked!');
    await loadStatus(true);
  }catch(e){
    const m=String((e&&e.message)||e);
    if(TERMINAL.test(m))setPending(null);
    if(/already used/i.test(m))await loadStatus(true);
  }
  resuming=false;
}
const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes){
  const a=Array.from(bytes);
  let zeros=0;while(zeros<a.length&&a[zeros]===0)zeros++;
  const d=[];
  for(let i=zeros;i<a.length;i++){
    let c=a[i];
    for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0}
    while(c>0){d.push(c%58);c=(c/58)|0}
  }
  let s='';
  for(let i=0;i<zeros;i++)s+='1';
  for(let i=d.length-1;i>=0;i--)s+=B58[d[i]];
  return s;
}
function confirmBox(p){
  return new Promise(resolve=>{
    const d=document.createElement('div');
    d.className='modal';
    d.innerHTML='<div class="sticker card qh-pop"><div class="em">'+esc(p.emoji||'📜')+'</div>'+
      '<h3>Subscribe to '+esc(p.name)+'?</h3>'+
      '<p class="small">You will send FIJI to the project treasury for '+nf(p.days)+' days of access.</p>'+
      '<div class="qh-price" style="font-size:28px">🪙 '+nf(p.price_fiji)+' FIJI</div>'+
      '<div class="acts"><button class="btn alt" type="button" data-c="no">Cancel</button>'+
      '<button class="btn" type="button" data-c="yes">Pay</button></div></div>';
    const done=v=>{d.remove();resolve(v)};
    d.addEventListener('click',e=>{
      if(e.target===d)return done(false);
      const b=e.target.closest('[data-c]');
      if(b)done(b.dataset.c==='yes');
    });
    document.body.appendChild(d);
  });
}
async function sendPayment(w,p){
  const web3=solanaWeb3,conn=C.getConnection();
  const mint=new web3.PublicKey(C.CFG.FIJI_MINT);
  const owner=new web3.PublicKey(w);
  const treasury=new web3.PublicKey(S.treasury);

  const mi=await conn.getParsedAccountInfo(mint);
  if(!mi.value||!mi.value.data||!mi.value.data.parsed)throw new Error('Could not read the FIJI token');
  const programId=mi.value.owner;
  const decimals=Number(mi.value.data.parsed.info.decimals);
  const raw=BigInt(Math.round(Number(p.price_fiji)))*(10n**BigInt(decimals));

  const accs=await conn.getParsedTokenAccountsByOwner(owner,{mint});
  let src=null,best=0n;
  accs.value.forEach(a=>{
    const t=a.account.data.parsed.info.tokenAmount;
    const v=BigInt(t.amount);
    if(v>best){best=v;src=a.pubkey}
  });
  if(!src||best<raw)throw new Error('Not enough FIJI in your wallet');

  const ataProg=new web3.PublicKey(ATA_PROGRAM);
  const [dest]=web3.PublicKey.findProgramAddressSync(
    [treasury.toBytes(),programId.toBytes(),mint.toBytes()],ataProg);

  const createAta=new web3.TransactionInstruction({
    programId:ataProg,
    keys:[
      {pubkey:owner,isSigner:true,isWritable:true},
      {pubkey:dest,isSigner:false,isWritable:true},
      {pubkey:treasury,isSigner:false,isWritable:false},
      {pubkey:mint,isSigner:false,isWritable:false},
      {pubkey:web3.SystemProgram.programId,isSigner:false,isWritable:false},
      {pubkey:programId,isSigner:false,isWritable:false}
    ],
    data:new Uint8Array([1])   // CreateIdempotent
  });
  const data=new Uint8Array(10);
  data[0]=12;                  // TransferChecked
  new DataView(data.buffer).setBigUint64(1,raw,true);
  data[9]=decimals;
  const transfer=new web3.TransactionInstruction({
    programId,
    keys:[
      {pubkey:src,isSigner:false,isWritable:true},
      {pubkey:mint,isSigner:false,isWritable:false},
      {pubkey:dest,isSigner:false,isWritable:true},
      {pubkey:owner,isSigner:true,isWritable:false}
    ],
    data
  });

  const tx=new web3.Transaction().add(createAta,transfer);
  tx.feePayer=owner;
  tx.recentBlockhash=(await conn.getLatestBlockhash('confirmed')).blockhash;

  const pr=C.getProvider();
  if(!pr)throw new Error('Connect your wallet first');
  if(typeof pr.signAndSendTransaction==='function'){
    const r=await pr.signAndSendTransaction(tx);
    const sg=r&&r.signature?r.signature:r;
    return typeof sg==='string'?sg:b58(sg);
  }
  const f=pr.features&&pr.features['solana:signAndSendTransaction'];
  if(f){
    const acc=(pr.accounts||[]).find(a=>a.address===w)||(pr.accounts||[])[0];
    const r=await f.signAndSendTransaction({
      account:acc,chain:'solana:mainnet',
      transaction:tx.serialize({requireAllSignatures:false,verifySignatures:false})
    });
    return b58(r[0].signature);
  }
  if(typeof pr.signTransaction==='function'){
    const signed=await pr.signTransaction(tx);
    return await conn.sendRawTransaction(signed.serialize());
  }
  throw new Error('This wallet cannot send transactions');
}
async function waitConfirmed(sig){
  const conn=C.getConnection();
  for(let i=0;i<40;i++){
    const r=await conn.getSignatureStatuses([sig],{searchTransactionHistory:true});
    const s=r&&r.value&&r.value[0];
    if(s&&s.err)throw new Error('The payment failed on-chain');
    if(s&&(s.confirmationStatus==='confirmed'||s.confirmationStatus==='finalized'))return;
    await new Promise(r=>setTimeout(r,1500));
  }
  throw new Error('The payment is taking long. If FIJI left your wallet, reopen this page in a minute.');
}
async function verifyPayment(w,id,sig){
  let last='';
  for(let i=0;i<8;i++){
    const r=await fetch(PAY_URL,{
      method:'POST',
      headers:{'apikey':C.CFG.SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({wallet:w,quest:id,signature:sig})
    });
    let j={};try{j=await r.json()}catch(e){}
    if(r.ok&&j.ok)return j.data;
    last=j.error||('Verification failed (HTTP '+r.status+')');
    if(j.retry||r.status===404){await new Promise(x=>setTimeout(x,2500));continue}
    break;
  }
  throw new Error(last);
}
async function buy(id){
  if(buying)return;
  const w=wallet();
  if(!w){if(typeof window.connect==='function')window.connect();return}
  const p=prod(id);
  if(!p)return;
  const pend=getPending();
  if(pend&&pend.w===w){
    toast('A payment is still being confirmed. Please wait a moment…');
    resumePending();
    return;
  }
  buying=true;render();
  try{
    await loadStatus(true);
    if(subOf(id)){toast('You already have this quest. You can renew it after it ends.');return}
    await loadHold(true);
    if(hold===null||hold<S.min_hold){toast('You need '+nf(S.min_hold)+' FIJI to buy quests 🔒');return}
    if(hold<Number(p.price_fiji)){toast('Not enough FIJI for this quest');return}
    if(!(await confirmBox(p)))return;

    toast('Approve the payment in your wallet…');
    const sig=await sendPayment(w,p);
    setPending({w,q:id,sig,t:Date.now()});
    toast('Payment sent. Confirming… ⏳');
    await waitConfirmed(sig);
    const g=await verifyPayment(w,id,sig);
    setPending(null);
    applyGrant(g);
    toast('✅ '+p.name+' unlocked for '+nf(p.days)+' days!');
    holdAt=0;
    await loadStatus(true);
    loadHold(true);
    try{window.FIJI_FARM&&window.FIJI_FARM.refresh&&window.FIJI_FARM.refresh()}catch(e){}
    if(id==='cooking')loadCook();
  }catch(e){
    const m=e&&e.message?e.message:String(e);
    console.warn('quest payment failed',e);
    if(TERMINAL.test(m))setPending(null);
    toast(e&&e.code===4001||/reject|denied|cancel/i.test(m)?'Payment cancelled. Nothing was sent.':m);
  }finally{
    buying=false;lastKey='';render();
  }
}

/* ---------------- Cooking quest (daily dish, BunXP only) ---------------- */
let st=null,offsetC=0,cooking=false,lastEndsLoad=0;

function paintCook(){
  if(!st){return}
  const w=wallet();
  const ing=Array.isArray(st.ingredients)?st.ingredients:[];
  const ready=ing.length>0&&ing.every(i=>Number(i.have)>=Number(i.qty));
  const rows=ing.map(i=>{
    const ok=Number(i.have)>=Number(i.qty);
    return '<div class="qs-ing'+(ok?' ok':'')+'">'+
      img(i.img,i.emoji||'🥬','qs-ph')+
      '<b>'+esc(i.name)+'</b>'+
      '<span class="n">'+nf(Math.min(i.have,999999))+' / '+nf(i.qty)+'</span>'+
      '<span>'+(ok?'✅':'❌')+'</span></div>';
  }).join('');

  let btn;
  if(!w)btn='<button class="btn full" data-act="connect">Connect wallet</button>';
  else if(st.done)btn='<button class="btn full" disabled>✅ Cooked! Next dish in <span class="qs-left">…</span></button>';
  else if(cooking)btn='<button class="btn full" disabled>Cooking… 🍳</button>';
  else if(!ready)btn='<button class="btn full" disabled>Missing ingredients</button>';
  else btn='<button class="btn full" data-act="cook">🍳 Cook it!</button>';

  root.innerHTML=
    '<div class="qs-top">'+
      img(st.dish_img,st.dish_emoji||'🍲','qs-dish')+
      '<div class="qs-info">'+
        '<div class="qs-tag"><span class="pill">📜 DAILY DISH</span></div>'+
        '<h3>'+esc(st.dish_name)+'</h3>'+
        '<div class="qs-timer">New dish in <span class="qs-left">…</span></div>'+
      '</div>'+
    '</div>'+
    '<div class="qs-list">'+rows+'</div>'+
    '<div class="qs-rew">'+(Number(st.bun_reward)>0?'<span class="pill">🪙 +'+nf(st.bun_reward)+' BUN</span>':'')+'<span class="pill">⭐ +'+nf(st.bunxp)+' BunXP</span></div>'+
    btn+
    '<p class="qs-note">One cook per dish. Same recipe for every player. Cooking rewards BunXP, and BunXP counts toward your Phase 2 total. BunXP is for gameplay only.</p>';
  tickCook();
}
function tickCook(){
  if(!st)return;
  const left=Date.parse(st.ends_at)-(Date.now()+offsetC);
  const t=fmtLeft(left);
  root.querySelectorAll('.qs-left').forEach(el=>{if(el.textContent!==t)el.textContent=t});
  if(left<=0&&Date.now()-lastEndsLoad>4000){lastEndsLoad=Date.now();loadCook()}
}
async function loadCook(){
  const c=db();
  if(!c){root.innerHTML='<div class="small">The dish is offline right now.</div>';return}
  const w=wallet()||'';
  try{
    const {data,error}=await c.rpc('fiji_quest_status',{p_wallet:w});
    if(error)throw error;
    if(!data)return;
    st=data;
    offsetC=Date.parse(data.now)-Date.now();
    paintCook();
  }catch(e){
    console.warn('quest: dish status failed (is quest.sql installed?)',e);
    if(!st)root.innerHTML='<div class="small">The daily dish is not ready yet. Check back soon 🍳</div>';
  }
}

async function edge(b){
  const {data,error}=await db().functions.invoke('clever-api',{body:b});
  if(error){
    let j=null;
    try{j=await error.context.json()}catch(e){}
    const err=new Error((j&&j.error)||error.message||'Request failed');
    err.relogin=!!(j&&j.relogin);
    throw err;
  }
  if(data&&data.error){
    const err=new Error(data.error);err.relogin=!!data.relogin;throw err;
  }
  return data;
}
function getTok(w){
  try{
    const o=JSON.parse(sessionStorage.getItem(TK)||'null');
    if(o&&o.w===w&&o.exp>Date.now())return o.t;
  }catch(e){}
  return '';
}
function setTok(w,t){
  try{sessionStorage.setItem(TK,JSON.stringify({w,t,exp:Date.now()+11*36e5}))}catch(e){}
}
async function signMsg(w,message){
  const p=C.getProvider();
  const bytes=new TextEncoder().encode(message);
  let sig;
  if(p&&typeof p.signMessage==='function'){
    const r=await p.signMessage(bytes,'utf8');
    sig=r&&r.signature?r.signature:r;
  }else if(p&&p.features&&p.features['solana:signMessage']){
    const accs=p.accounts||[];
    const acc=accs.find(a=>a.address===w)||accs[0];
    const r=await p.features['solana:signMessage'].signMessage({account:acc,message:bytes});
    sig=r[0].signature;
  }else throw new Error('Your wallet cannot sign messages');
  let s='';
  for(const b of sig)s+=String.fromCharCode(b);
  return btoa(s);
}
async function login(w){
  const n=await edge({action:'nonce'});
  const sig=await signMsg(w,n.message);
  const r=await edge({action:'login',wallet:w,nonce:n.nonce,signature:sig});
  setTok(w,r.token);
  return r.token;
}
async function callCook(w){
  let tok=getTok(w);
  if(!tok)tok=await login(w);
  try{
    return (await edge({action:'cook',token:tok})).data;
  }catch(e){
    if(!e.relogin)throw e;
    tok=await login(w);
    return (await edge({action:'cook',token:tok})).data;
  }
}
async function cook(){
  if(cooking)return;
  const w=wallet();
  if(!w){if(typeof window.connect==='function')window.connect();return}
  if(!subOf('cooking'))return toast('Your Cooking quest has ended. Renew it to keep cooking 🍳');
  cooking=true;paintCook();
  try{
    const d=await callCook(w);
    showDone(d&&d.cooked);
    try{window.FIJI_BUNXP&&window.FIJI_BUNXP.refresh()}catch(e){}
    try{window.FIJI_FARM&&typeof window.FIJI_FARM.refresh==='function'&&window.FIJI_FARM.refresh()}catch(e){}
    try{window.FIJI_PHASE&&window.FIJI_PHASE.refresh&&window.FIJI_PHASE.refresh()}catch(e){}
    document.dispatchEvent(new CustomEvent('fiji:quest-cooked',{detail:d}));
  }catch(e){
    const m=e&&e.message?e.message:String(e);
    toast(e&&e.code===4001||/reject|denied|cancel/i.test(m)?'Signature cancelled':m);
  }
  cooking=false;
  await loadCook();
}
function showDone(c){
  c=c||{};
  const d=document.createElement('div');
  d.className='modal';
  d.innerHTML='<div class="sticker card qs-pop">'+
    img(c.dish_img,c.dish_emoji||'🍲','qs-dish qs-big')+
    '<div class="tag" style="margin:0">quest complete</div>'+
    '<h3>'+esc(c.dish_name||'Yummy dish')+' is ready!</h3>'+
    '<p>You cooked today\'s dish 🐰</p>'+
    '<div class="qs-rew">'+(Number(c.bun)>0?'<span class="pill">🪙 +'+nf(c.bun)+' BUN</span>':'')+'<span class="pill">⭐ +'+nf(c.xp)+' BunXP</span></div>'+
    '<button class="btn" data-x>Yay!</button></div>';
  const close=()=>d.remove();
  d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-x]'))close()});
  document.body.appendChild(d);
}

function onClick(e){
  const b=e.target.closest('[data-act]');
  if(!b)return;
  const a=b.dataset.act;
  if(a==='connect'){if(typeof window.connect==='function')window.connect()}
  else if(a==='trade'){if(typeof window.go==='function')window.go('trade')}
  else if(a==='open'){view=b.dataset.q;lastKey='';render();if(view==='cooking')loadCook()}
  else if(a==='back'){view='board';lastKey='';render()}
  else if(a==='retry'){holdErr=false;lastKey='';render();loadHold(true)}
  else if(a==='buy')buy(b.dataset.q);
  else if(a==='cook')cook();
}
body.addEventListener('click',onClick);
root.addEventListener('click',onClick);

let wasOn=false;
setInterval(()=>{
  tick();tickCook();

  const now=nowMs();
  if(S.subs.some(s=>Date.parse(s.expires_at)<=now)){
    S.subs=S.subs.filter(s=>Date.parse(s.expires_at)>now);
    lastKey='';
    if(view!=='board'&&!subOf(view))view='board';
    render();
  }

  const w=wallet()||null;
  const on=Boolean(sec.classList.contains('on'));
  if(w!==lastWallet){
    lastWallet=w;hold=null;holdErr=false;S.subs=[];view='board';lastKey='';st=null;
    root.innerHTML='<div class="small">Loading today\'s dish…</div>';
    render();
    loadStatus();
    if(w)loadHold(true);
    wasOn=on;return;
  }
  if(on&&!wasOn){loadStatus();loadHold(true)}
  else if(on&&!document.hidden&&!buying){
    if(Date.now()-lastStatusAt>20000)loadStatus();
    if(w&&Date.now()-holdAt>30000)loadHold(true);
  }
  wasOn=on;
},1000);

render();
loadStatus();
window.FIJI_QUEST={refresh:()=>{loadStatus();loadHold(true);loadCook()}};
})();
