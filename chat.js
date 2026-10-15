(function(){
'use strict';

const C=window.FIJI_CORE||{};
const marker=document.getElementById('line');
const quote=marker&&marker.closest('.quote');
if(!C.CFG||!quote){console.warn('chat: load after the core script');return}
const db=C.getSupabase&&C.getSupabase();

const EMOJI=['👍','❤️','😂','😮','😢','😡'];
const LIMIT=80;
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hue=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return h};
const toast=m=>C.toast?C.toast(m):console.log(m);

const css=document.createElement('style');
css.textContent=`
.ch-card{overflow:hidden;position:relative}
.ch-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:3px solid var(--ink);background:var(--sun);font:600 17px Fredoka}
.ch-head button{background:none;border:0;font:600 14px Fredoka;text-decoration:underline;cursor:pointer;padding:0}
.ch-hr{display:flex;align-items:center;gap:8px;min-width:0}
.ch-head .ch-x,.ch-gate .ch-x{background:#fff;border:2.5px solid var(--ink);border-radius:50%;width:30px;height:30px;font:700 14px Fredoka;text-decoration:none;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;flex:none}
.ch-gate .ch-x{position:absolute;top:10px;right:10px}
.ch-list{height:430px;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:14px;background:var(--soft);overscroll-behavior:contain}
.ch-m{display:flex;gap:8px;max-width:88%}
.ch-m.me{align-self:flex-end;flex-direction:row-reverse}
.ch-m.flash .ch-bub{animation:chFlash 1.2s}
@keyframes chFlash{0%{box-shadow:0 0 0 4px var(--sun)}100%{box-shadow:none}}
.ch-av{width:34px;height:34px;border-radius:50%;border:2.5px solid var(--ink);flex:none;display:flex;align-items:center;justify-content:center;font:700 15px Fredoka;color:#fff}
.ch-body{min-width:0}
.ch-who{font:600 12px Fredoka;opacity:.7;margin:0 6px 2px}
.me .ch-who{text-align:right}
.ch-bub{background:#fff;border:2.5px solid var(--ink);border-radius:18px;padding:8px 13px;word-break:break-word;white-space:pre-wrap;font-size:16px;line-height:1.4;width:fit-content;max-width:100%}
.me .ch-bub{background:var(--blue);color:#fff;margin-left:auto}
.ch-rep{font-size:12px;background:rgba(18,48,92,.09);border-radius:12px;padding:4px 10px 10px;margin-bottom:-8px;cursor:pointer;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:fit-content}
.me .ch-rep{margin-left:auto}
.ch-chips,.ch-pick,.ch-acts{display:flex;gap:5px;margin-top:5px}
.me .ch-chips,.me .ch-pick,.me .ch-acts{justify-content:flex-end}
.ch-chip{border:2px solid var(--ink);background:#fff;border-radius:99px;padding:1px 8px;font:600 13px Fredoka;cursor:pointer}
.ch-chip.on,.ch-pick button.on{background:var(--sun)}
.ch-pick{background:#fff;border:2.5px solid var(--ink);border-radius:99px;padding:3px 6px;box-shadow:0 3px 0 var(--ink);width:max-content;max-width:100%}
.me .ch-pick{margin-left:auto}
.ch-pick button{border:0;background:none;border-radius:50%;font-size:22px;cursor:pointer;padding:0 3px;transition:transform .1s}
.ch-pick button:hover{transform:scale(1.25)}
.ch-acts{gap:12px;margin:3px 6px 0}
.ch-acts button{border:0;background:none;font:600 12px Fredoka;opacity:.6;cursor:pointer;padding:0}
.ch-acts button:hover{opacity:1}
.ch-replybar{display:none;align-items:center;justify-content:space-between;gap:10px;padding:8px 14px;background:var(--sb);border-top:2px dashed var(--line);font-size:14px}
.ch-replybar span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ch-replybar button{border:0;background:none;font-size:16px;cursor:pointer}
.ch-send{display:flex;gap:8px;padding:10px 12px;border-top:3px solid var(--ink)}
.ch-send input{margin:0;flex:1;min-width:0}
.ch-note{padding:0 14px 10px;font-size:12px;opacity:.75}
.ch-gate{text-align:center;padding:30px 20px}
.ch-gate .em{font-size:44px}
.ch-gate h3{font-size:26px;margin:6px 0}
.ch-gate input{max-width:320px;text-align:center;margin:12px auto 6px}
.ch-gate .btn{margin:6px 4px}
.lb-me{background:#FFF6CF}

/* floating chat icon + popup */
#chFab{position:fixed;right:20px;bottom:22px;z-index:350;width:62px;height:62px;border-radius:50%;border:3px solid var(--ink);background:var(--sun);box-shadow:0 5px 0 var(--ink);cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;font-size:28px;line-height:1;transition:transform .1s,box-shadow .1s;-webkit-tap-highlight-color:transparent}
#chFab:hover{transform:translateY(2px);box-shadow:0 3px 0 var(--ink)}
#chFab.ping{animation:chPing .9s ease-out}
@keyframes chPing{0%{transform:scale(1)}20%{transform:scale(1.2) rotate(-10deg)}40%{transform:scale(1.1) rotate(8deg)}60%{transform:scale(1.15) rotate(-6deg)}100%{transform:scale(1)}}
.ch-badge{position:absolute;top:-7px;right:-7px;min-width:24px;height:24px;padding:0 6px;border-radius:99px;background:var(--dn);color:#fff;border:2.5px solid var(--ink);font:700 13px Fredoka,sans-serif;display:none;align-items:center;justify-content:center;pointer-events:none}
.ch-pop{position:fixed;right:20px;bottom:98px;z-index:355;width:380px;height:min(560px,calc(100vh - 124px));display:none;flex-direction:column}
.ch-pop.on{display:flex}
.ch-pop>.ch-card{flex:1;min-height:0;display:flex;flex-direction:column}
.ch-pop .ch-list{height:auto;flex:1;min-height:0}
.ch-pop .ch-gate{justify-content:center;align-items:center;overflow-y:auto}
@media(max-width:760px){
 .ch-m{max-width:94%}
 #chFab{right:14px;bottom:calc(96px + env(safe-area-inset-bottom));width:56px;height:56px;font-size:26px}
 .ch-pop{inset:0;width:auto;height:auto;background:rgba(18,48,92,.45);padding:calc(10px + env(safe-area-inset-top)) 10px calc(10px + env(safe-area-inset-bottom))}
}
`;
document.head.appendChild(css);

const host=document.createElement('div');
host.className='ch-pop';
host.id='chPop';
host.setAttribute('role','dialog');
host.setAttribute('aria-label','Fiji Chat');
const h2=quote.previousElementSibling,tag=h2&&h2.previousElementSibling;
[tag,h2,quote].forEach(el=>el&&el.remove());
document.body.appendChild(host);

const fab=document.createElement('button');
fab.type='button';
fab.id='chFab';
fab.setAttribute('aria-label','Open chat');
fab.setAttribute('aria-expanded','false');
fab.innerHTML='<span class="ch-ico">💬</span><span class="ch-badge" id="chBadge"></span>';
document.body.appendChild(fab);

let wallet=null,me=null,editing=false;
let replyTo=null,pickerFor=null,lastHtml='',forceBottom=false;
let chan=null,poll=null,live=false,kickT=null,busy=false;
let isOpen=false,seen=null,unread=0;
const msgs=new Map(),rx=new Map();
const q=s=>host.querySelector(s);
const isMobile=()=>window.matchMedia&&window.matchMedia('(max-width:760px)').matches;

const seenKey=w=>'fiji_chat_seen_'+w;
function readSeen(w){
  try{const v=localStorage.getItem(seenKey(w));return v===null?null:Number(v)}catch(e){return null}
}
function saveSeen(){
  if(!wallet||seen===null)return;
  try{localStorage.setItem(seenKey(wallet),String(seen))}catch(e){}
}
function paintBadge(prev){
  const b=$badge();
  if(!b)return;
  if(unread>0&&!isOpen){
    b.textContent=unread>9?'9+':String(unread);
    b.style.display='flex';
    fab.setAttribute('aria-label','Open chat, '+unread+' new message'+(unread===1?'':'s'));
  }else{
    b.style.display='none';
    fab.setAttribute('aria-label',isOpen?'Close chat':'Open chat');
  }
  if(unread>prev&&!isOpen){
    fab.classList.remove('ping');void fab.offsetWidth;fab.classList.add('ping');
    setTimeout(()=>fab.classList.remove('ping'),1000);
  }
}
function $badge(){return document.getElementById('chBadge')}
function updateUnread(){
  if(!me)return;
  const prev=unread;
  const list=[...msgs.values()];
  const maxId=list.reduce((m,x)=>Math.max(m,Number(x.id)),0);
  if(seen===null){seen=maxId;saveSeen()}
  if(isOpen){
    if(maxId>seen){seen=maxId;saveSeen()}
    unread=0;
  }else{
    unread=list.filter(m=>Number(m.id)>seen&&m.wallet!==me.wallet).length;
  }
  paintBadge(prev);
}

function openChat(){
  if(isOpen)return;
  isOpen=true;
  host.classList.add('on');
  fab.setAttribute('aria-expanded','true');
  fab.querySelector('.ch-ico').textContent='✕';
  lastHtml='';forceBottom=true;
  render();
  updateUnread();
  paintBadge(unread);
  if(!isMobile()){const i=q('#chIn')||q('#chName');if(i)i.focus()}
}
function closeChat(){
  if(!isOpen)return;
  isOpen=false;
  pickerFor=null;
  host.classList.remove('on');
  fab.setAttribute('aria-expanded','false');
  fab.querySelector('.ch-ico').textContent='💬';
  paintBadge(unread);
}
fab.addEventListener('click',()=>isOpen?closeChat():openChat());
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen)closeChat()});

const CLOSE_BTN='<button type="button" class="ch-x" data-act="close" aria-label="Close chat">✕</button>';
const NOTE='<p class="small ch-note">Be kind. Never share your seed phrase. Admins will never DM you first.</p>';

function mount(phase){
  if(phase==='connect'||phase==='offline'){
    host.innerHTML='<div class="sticker ch-card ch-gate">'+CLOSE_BTN+'<div class="em">💬</div><h3>Fiji Chat</h3>'+
      (phase==='offline'?'<p>Chat is offline right now. Try again later.</p>':'<p>Connect your wallet to join the conversation.</p><button class="btn" data-act="connect">Connect wallet</button>')+'</div>';
  }else if(phase==='name'){
    host.innerHTML='<div class="sticker ch-card ch-gate">'+CLOSE_BTN+'<div class="em">🐰</div><h3>Pick your username</h3>'+
      '<p class="small">3 to 16 characters: letters, numbers or _<br>It also shows on the leaderboard.</p>'+
      '<input id="chName" maxlength="16" autocomplete="off" placeholder="e.g. hoppy_bun" value="'+esc(me?me.username:'')+'">'+
      '<div><button class="btn" data-act="save">'+(me?'Save name':'Enter chat')+'</button>'+(me?'<button class="btn alt" data-act="cancel">Cancel</button>':'')+'</div></div>';
    const i=q('#chName');if(i&&isOpen)i.focus();
  }else{
    host.innerHTML='<div class="sticker ch-card">'+
      '<div class="ch-head"><span>💬 Fiji Chat</span><span class="ch-hr"><span>@'+esc(me.username)+' ·</span><button data-act="edit">change</button>'+CLOSE_BTN+'</span></div>'+
      '<div class="ch-list" id="chList"></div>'+
      '<div class="ch-replybar" id="chReply"></div>'+
      '<div class="ch-send"><input id="chIn" maxlength="300" autocomplete="off" placeholder="Write a message…"><button class="btn sm" data-act="send">Send</button></div>'+
      NOTE+'</div>';
    lastHtml='';forceBottom=true;paintReply();render();
  }
}

function msgHtml(m){
  const id=Number(m.id),mine=me&&m.wallet===me.wallet;
  const counts={};let mineE=null;
  const rm=rx.get(id);
  if(rm)rm.forEach((e,w)=>{counts[e]=(counts[e]||0)+1;if(me&&w===me.wallet)mineE=e});
  const chips=Object.entries(counts).map(([e,n])=>'<button class="ch-chip'+(e===mineE?' on':'')+'" data-act="pick" data-id="'+id+'" data-e="'+e+'">'+e+' '+n+'</button>').join('');
  const picker=pickerFor===id?'<div class="ch-pick">'+EMOJI.map(e=>'<button type="button" class="'+(e===mineE?'on':'')+'" data-act="pick" data-id="'+id+'" data-e="'+e+'">'+e+'</button>').join('')+'</div>':'';
  const rep=m.reply_to?'<div class="ch-rep" data-act="jump" data-id="'+Number(m.reply_to)+'">↩ <b>'+esc(m.reply_username)+'</b> '+esc(m.reply_body)+'</div>':'';
  const t=new Date(m.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  return '<div class="ch-m'+(mine?' me':'')+'" id="chm-'+id+'"><div class="ch-av" style="background:hsl('+hue(m.username)+',65%,48%)">'+esc(String(m.username).charAt(0).toUpperCase())+'</div>'+
    '<div class="ch-body"><div class="ch-who">'+esc(m.username)+' · '+t+'</div>'+rep+'<div class="ch-bub">'+esc(m.body)+'</div>'+
    (chips?'<div class="ch-chips">'+chips+'</div>':'')+picker+
    '<div class="ch-acts"><button data-act="open" data-id="'+id+'">😊 React</button><button data-act="reply" data-id="'+id+'">↩ Reply</button></div></div></div>';
}
function render(){
  const box=q('#chList');if(!box)return;
  const list=[...msgs.values()].sort((a,b)=>a.id-b.id);
  const html=list.length?list.map(msgHtml).join(''):'<div class="small" style="margin:auto">No messages yet. Say hi 🐰</div>';
  if(html===lastHtml)return;
  lastHtml=html;
  const stick=forceBottom||box.scrollHeight-box.scrollTop-box.clientHeight<90;
  box.innerHTML=html;
  if(stick){box.scrollTop=box.scrollHeight;if(isOpen)forceBottom=false}
}
function paintReply(){
  const b=q('#chReply');if(!b)return;
  if(!replyTo){b.style.display='none';return}
  b.style.display='flex';
  b.innerHTML='<span>↩ Replying to <b>'+esc(replyTo.username)+'</b>: '+esc(replyTo.body.slice(0,60))+'</span><button data-act="cancelreply" aria-label="Cancel reply">✕</button>';
}

async function load(){
  if(!db||!me)return;
  const {data,error}=await db.from('fiji_chat_messages').select('*').order('id',{ascending:false}).limit(LIMIT);
  if(error)throw error;
  msgs.clear();
  (data||[]).forEach(m=>msgs.set(Number(m.id),m));
  const ids=[...msgs.keys()];
  rx.clear();
  if(ids.length){
    const r=await db.from('fiji_chat_reactions').select('message_id,wallet,emoji').in('message_id',ids);
    (r.data||[]).forEach(x=>{const k=Number(x.message_id);if(!rx.has(k))rx.set(k,new Map());rx.get(k).set(x.wallet,x.emoji)});
  }
  render();
  updateUnread();
}
const kick=()=>{clearTimeout(kickT);kickT=setTimeout(()=>load().catch(()=>{}),250)};
function start(){
  stop();
  load().catch(e=>console.warn('chat load failed',e));
  try{
    chan=db.channel('fiji-chat')
      .on('postgres_changes',{event:'*',schema:'public',table:'fiji_chat_messages'},kick)
      .on('postgres_changes',{event:'*',schema:'public',table:'fiji_chat_reactions'},kick)
      .subscribe(s=>{live=s==='SUBSCRIBED'});
  }catch(e){live=false}
  poll=setInterval(()=>{if(!document.hidden&&!live)load().catch(()=>{})},8000);   // fallback if realtime is off
}
function stop(){
  clearInterval(poll);poll=null;live=false;
  if(chan){try{db.removeChannel(chan)}catch(e){}chan=null}
}

async function saveName(){
  const v=(q('#chName')||{}).value||'';
  try{
    const {data,error}=await db.rpc('fiji_set_username',{p_wallet:wallet,p_username:v.trim()});
    if(error)throw error;
    const first=!me;
    me={wallet,username:data};editing=false;
    toast('Welcome, '+data+' 🐰');
    mount('chat');
    if(first)start();else load().catch(()=>{});
  }catch(e){toast(e.message||String(e))}
}
async function send(){
  const inp=q('#chIn');if(!inp||busy)return;
  const body=inp.value.trim();if(!body)return;
  busy=true;
  try{
    const {data,error}=await db.rpc('fiji_chat_send',{p_wallet:wallet,p_body:body,p_reply_to:replyTo?replyTo.id:null});
    if(error)throw error;
    inp.value='';replyTo=null;paintReply();
    if(data&&data.id)msgs.set(Number(data.id),data);
    forceBottom=true;render();updateUnread();
  }catch(e){toast(e.message||String(e))}
  busy=false;inp.focus();
}
async function react(id,e){
  pickerFor=null;
  try{
    const {error}=await db.rpc('fiji_chat_react',{p_wallet:wallet,p_message:id,p_emoji:e});
    if(error)throw error;
    await load();
  }catch(err){toast(err.message||String(err));render()}
}

host.addEventListener('click',ev=>{
  if(ev.target===host){closeChat();return}
  const b=ev.target.closest('[data-act]');
  if(!b){if(pickerFor!==null){pickerFor=null;render()}return}
  const a=b.dataset.act,id=Number(b.dataset.id);
  if(a==='close')closeChat();
  else if(a==='connect'&&typeof window.connect==='function')window.connect();
  else if(a==='save')saveName();
  else if(a==='cancel'){editing=false;mount('chat')}
  else if(a==='edit'){editing=true;mount('name')}
  else if(a==='send')send();
  else if(a==='open'){pickerFor=pickerFor===id?null:id;render()}
  else if(a==='pick')react(id,b.dataset.e);
  else if(a==='reply'){
    const m=msgs.get(id);if(!m)return;
    replyTo={id,username:m.username,body:m.body};pickerFor=null;paintReply();render();
    const i=q('#chIn');if(i)i.focus();
  }
  else if(a==='cancelreply'){replyTo=null;paintReply()}
  else if(a==='jump'){
    const el=q('#chm-'+id);
    if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1300)}
  }
});
host.addEventListener('keydown',ev=>{
  if(ev.key!=='Enter'||ev.shiftKey)return;
  if(ev.target.id==='chIn'){ev.preventDefault();send()}
  else if(ev.target.id==='chName'){ev.preventDefault();saveName()}
});

async function onWallet(){
  const w=wallet;
  stop();me=null;replyTo=null;pickerFor=null;editing=false;msgs.clear();rx.clear();lastHtml='';
  seen=null;unread=0;paintBadge(0);
  if(!w)return mount('connect');
  try{
    const {data}=await db.from('fiji_profiles').select('username').eq('wallet',w).maybeSingle();
    if(w!==wallet)return;
    if(data&&data.username){me={wallet:w,username:data.username};seen=readSeen(w);mount('chat');start()}
    else mount('name');
  }catch(e){console.warn('chat: username lookup failed',e);if(w===wallet)mount('name')}
}
if(!db){mount('offline')}
else{
  mount('connect');
  setInterval(()=>{
    const w=C.getWallet?C.getWallet():null;
    if(w===wallet)return;
    wallet=w;onWallet();
  },1000);
}

window.loadBoard=async function(){
  if(!db)return;
  const lb=document.getElementById('lb');if(!lb)return;
  const {data}=await db.from('fiji_profiles').select('wallet,points,streak,username').order('points',{ascending:false}).limit(25);
  const sh=a=>{const s=String(a||'');return s.length<=10?s:s.slice(0,4)+'…'+s.slice(-4)};
  lb.innerHTML='<tr><th>#</th><th>Player</th><th>BUN</th><th>Streak</th></tr>'+
    (data||[]).map((p,i)=>{
      const mine=wallet&&p.wallet===wallet;
      return '<tr'+(mine?' class="lb-me"':'')+'><td>'+(['🥇','🥈','🥉'][i]||i+1)+'</td><td>'+
        (p.username?'<b>'+esc(p.username)+'</b><div class="small">'+esc(sh(p.wallet))+'</div>':esc(sh(p.wallet)))+
        '</td><td>'+Number(p.points||0)+'</td><td>🔥 '+Number(p.streak||0)+'</td></tr>';
    }).join('');
};

})();
