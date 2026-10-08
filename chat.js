/* ============================================================
   FIJI GLOBAL CHAT  v1
   Load LAST in index.html (after splash-tap.js):
     <script src="chat.js"></script>
   Run chat.sql in Supabase first.

   - Replaces the "his voice" section on Home with a public chat.
   - Flow: connect wallet -> pick a username -> chat.
   - Messenger-style reactions (👍 ❤️ 😂 😮 😢 😡) and replies.
   - The same username replaces the short wallet on the Leaderboard.
   ============================================================ */
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

/* ---------------- styles ---------------- */
const css=document.createElement('style');
css.textContent=`
.ch-card{overflow:hidden}
.ch-head{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:3px solid var(--ink);background:var(--sun);font:600 17px Fredoka}
.ch-head button{background:none;border:0;font:600 14px Fredoka;text-decoration:underline;cursor:pointer;padding:0}
.ch-list{height:430px;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:14px;background:var(--soft)}
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
.ch-gate{text-align:center;padding:30px 20px}
.ch-gate .em{font-size:44px}
.ch-gate h3{font-size:26px;margin:6px 0}
.ch-gate input{max-width:320px;text-align:center;margin:12px auto 6px}
.ch-gate .btn{margin:6px 4px}
.lb-me{background:#FFF6CF}
@media(max-width:760px){.ch-list{height:380px}.ch-m{max-width:94%}}
`;
document.head.appendChild(css);

/* ---------------- replace "his voice" ---------------- */
const host=document.createElement('div');
const h2=quote.previousElementSibling,tag=h2&&h2.previousElementSibling;
quote.before(host);
[tag,h2,quote].forEach(el=>el&&el.remove());

/* ---------------- state ---------------- */
let wallet=null,me=null,editing=false;
let replyTo=null,pickerFor=null,lastHtml='',forceBottom=false;
let chan=null,poll=null,live=false,kickT=null,busy=false;
const msgs=new Map(),rx=new Map();
const q=s=>host.querySelector(s);

/* ---------------- screens ---------------- */
function mount(phase){
  if(phase==='connect'||phase==='offline'){
    host.innerHTML='<div class="tag">community chat</div><h2>Say hi to the bunnies 🐰</h2><div class="sticker ch-card ch-gate"><div class="em">💬</div><h3>Fiji Chat</h3>'+
      (phase==='offline'?'<p>Chat is offline right now. Try again later.</p>':'<p>Connect your wallet to join the conversation.</p><button class="btn" data-act="connect">Connect wallet</button>')+'</div>';
  }else if(phase==='name'){
    host.innerHTML='<div class="tag">community chat</div><h2>Say hi to the bunnies 🐰</h2><div class="sticker ch-card ch-gate"><div class="em">🐰</div><h3>Pick your username</h3>'+
      '<p class="small">3 to 16 characters: letters, numbers or _<br>It also shows on the leaderboard.</p>'+
      '<input id="chName" maxlength="16" autocomplete="off" placeholder="e.g. hoppy_bun" value="'+esc(me?me.username:'')+'">'+
      '<div><button class="btn" data-act="save">'+(me?'Save name':'Enter chat')+'</button>'+(me?'<button class="btn alt" data-act="cancel">Cancel</button>':'')+'</div></div>';
    const i=q('#chName');if(i)i.focus();
  }else{
    host.innerHTML='<div class="tag">community chat</div><h2>Say hi to the bunnies 🐰</h2><div class="sticker ch-card">'+
      '<div class="ch-head"><span>💬 Fiji Chat</span><span>@'+esc(me.username)+' · <button data-act="edit">change</button></span></div>'+
      '<div class="ch-list" id="chList"></div>'+
      '<div class="ch-replybar" id="chReply"></div>'+
      '<div class="ch-send"><input id="chIn" maxlength="300" autocomplete="off" placeholder="Write a message…"><button class="btn sm" data-act="send">Send</button></div></div>'+
      '<p class="small" style="margin-top:10px">Be kind. Never share your seed phrase. Admins will never DM you first.</p>';
    lastHtml='';forceBottom=true;paintReply();render();
  }
}

/* ---------------- rendering ---------------- */
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
  if(stick){box.scrollTop=box.scrollHeight;forceBottom=false}
}
function paintReply(){
  const b=q('#chReply');if(!b)return;
  if(!replyTo){b.style.display='none';return}
  b.style.display='flex';
  b.innerHTML='<span>↩ Replying to <b>'+esc(replyTo.username)+'</b>: '+esc(replyTo.body.slice(0,60))+'</span><button data-act="cancelreply" aria-label="Cancel reply">✕</button>';
}

/* ---------------- data ---------------- */
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

/* ---------------- actions ---------------- */
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
    forceBottom=true;render();
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
  const b=ev.target.closest('[data-act]');
  if(!b){if(pickerFor!==null){pickerFor=null;render()}return}
  const a=b.dataset.act,id=Number(b.dataset.id);
  if(a==='connect'&&typeof window.connect==='function')window.connect();
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

/* ---------------- wallet watcher ---------------- */
async function onWallet(){
  const w=wallet;
  stop();me=null;replyTo=null;pickerFor=null;editing=false;msgs.clear();rx.clear();lastHtml='';
  if(!w)return mount('connect');
  try{
    const {data}=await db.from('fiji_profiles').select('username').eq('wallet',w).maybeSingle();
    if(w!==wallet)return;
    if(data&&data.username){me={wallet:w,username:data.username};mount('chat');start()}
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

/* ---------------- leaderboard with usernames ---------------- */
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
