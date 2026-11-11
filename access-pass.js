(function(){
'use strict';

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const mkHost=$('mkInline'),mkPage=$('market');
if(!mkHost||!mkPage||!C.CFG||!C.getWallet||!C.getSupabase||!C.getConnection){
  console.warn('access-pass: load it after the core script, shop.js and seed-pay.js');
  return;
}
if($('apCard'))return;

const toast=C.toast||(m=>console.log('[FIJI]',m));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString();
const wallet=()=>C.getWallet();
const db=()=>C.getSupabase();

const PRICE=2000000;
const TREASURY='8SeUf8oskJU5FfvAWRhjjoo1BdUYx2tYFVwWiqx17zM6';
const IMG='./accesspass.png';
const ATA_PROGRAM='ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const MEMO_PROGRAM='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const MEMO_TEXT='FIJI pass';
const PAY_URL=C.CFG.SUPABASE_URL.replace(/\/+$/,'')+'/functions/v1/pass-pay';
const PK='fiji_pass_pending';
const TERMINAL=/already|too old|failed on-chain|not signed|too small|does not match|invalid/i;

let st=null,loading=false,buying=false,resuming=false,lastW=null,lastKey='',lastHas=false,lastSync=0,lastLoad=0;

const has=()=>Boolean(st&&st.has_pass===true);
const disc=n=>Math.floor((Number(n)*70+99)/100);

const css=document.createElement('style');
css.textContent=`
.ap{display:flex;gap:16px;align-items:center;padding:14px;margin:0 0 14px}
.ap-img{flex:none;width:170px;cursor:zoom-in;border:0;background:none;padding:0}
.ap-img img{display:block;width:100%;height:auto;border-radius:14px;border:3px solid var(--ink);box-shadow:0 4px 0 var(--ink)}
.ap-img .ap-ph{display:flex;align-items:center;justify-content:center;aspect-ratio:3/2;font-size:44px;border:3px solid var(--ink);border-radius:14px;background:var(--sb)}
.ap-body{flex:1;min-width:0}
.ap-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ap-top h3{margin:0;font-size:22px}
.ap-top .pill{font-size:12px;padding:0 10px}
.ap-price{font:700 22px Fredoka,sans-serif;margin:2px 0 4px}
.ap-price .small{font:600 12px Nunito,sans-serif}
.ap-list{list-style:none;padding:0;margin:4px 0 8px;display:grid;gap:3px;font-size:13.5px;line-height:1.3}
.ap-note{font-size:11.5px;opacity:.7;margin:0 0 8px}
.ap-act{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ap-code{font:700 17px Fredoka,monospace;letter-spacing:.08em;background:var(--sb);border:2.5px dashed var(--ink);border-radius:12px;padding:2px 10px}
.ap-off{color:var(--upi)}
.ap-lb{position:fixed;inset:0;z-index:700;background:rgba(18,48,92,.75);display:flex;align-items:center;justify-content:center;padding:16px}
.ap-lb img{max-width:min(520px,100%);max-height:88vh;border-radius:18px;border:3px solid var(--ink)}
#apProfile{margin-bottom:14px}
#apProfile .ap{margin:0;padding:10px}
#apProfile .ap-img{width:84px;cursor:zoom-in}
#apProfile .ap-top h3{font-size:18px}
@media(max-width:760px){
 .ap{gap:10px;padding:10px;align-items:flex-start}
 .ap-img{width:84px}
 .ap-img .ap-ph{font-size:30px}
 .ap-top h3{font-size:17px}
 .ap-price{font-size:17px;margin:0 0 2px}
 .ap-list{font-size:12px;gap:2px;margin:3px 0 6px}
 .ap-note{font-size:10.5px;margin-bottom:6px}
 .ap-code{font-size:15px}
 .ap .btn{min-height:38px;padding:5px 12px;font-size:14px}
 #apProfile .ap-img{width:64px}
}`;
document.head.appendChild(css);

/* ---------- helpers ---------- */
function picHtml(){
  return '<button type="button" class="ap-img" data-ap="zoom" aria-label="View Access Pass">'+
    '<img src="'+IMG+'" alt="FIJI Access Pass"></button>';
}
function zoom(){
  const d=document.createElement('div');
  d.className='ap-lb';
  d.innerHTML='<img src="'+IMG+'" alt="FIJI Access Pass">';
  d.onclick=()=>d.remove();
  document.body.appendChild(d);
}
async function copy(t){
  try{await navigator.clipboard.writeText(String(t))}
  catch(e){
    const a=document.createElement('textarea');a.value=String(t);a.style.cssText='position:fixed;opacity:0';
    document.body.appendChild(a);a.select();try{document.execCommand('copy')}catch(x){}a.remove();
  }
}

const card=document.createElement('div');
card.id='apCard';
mkHost.before(card);

const PERKS=
  '<li>🔑 Your own unique referral code. New users enter it in the Terms &amp; Conditions and it is saved to their profile</li>'+
  '<li>🔓 Quests are visible in your Burrow</li>'+
  '<li>🌾 All quests are free to access</li>'+
  '<li>🌱 30% off every seed in the Market</li>';

function paintCard(){
  const w=wallet(),key=['m',w||'',has()?st.code:(st?'n':'l'),buying?1:0].join('|');
  if(key===card.__k)return;
  card.__k=key;
  let pill,price,act;
  if(has()){
    pill='<span class="pill g">✅ Owned</span>';
    price='';
    act='<div class="ap-act"><span class="ap-code">'+esc(st.code)+'</span>'+
        '<button class="btn sm alt" type="button" data-ap="copy">Copy code</button></div>';
  }else{
    pill='<span class="pill">Lifetime</span>';
    price='<div class="ap-price">🪙 '+nf(PRICE)+' FIJI <span class="small">one-time</span></div>';
    act=!w
      ?'<button class="btn sm" type="button" data-ap="connect">Connect wallet</button>'
      :'<button class="btn sm" type="button" data-ap="buy"'+((buying||!st)?' disabled':'')+'>'+
        (buying?'Waiting for payment…':!st?'Checking…':'Buy Access Pass')+'</button>';
  }
  card.innerHTML='<div class="sticker card ap">'+picHtml()+
    '<div class="ap-body"><div class="ap-top"><h3>🎟️ Access Pass</h3>'+pill+'</div>'+price+
    '<ul class="ap-list">'+PERKS+'</ul>'+
    '<p class="ap-note">Tied to the wallet that buys it. It cannot be transferred or sold.</p>'+act+'</div></div>';
}

const profHead=$('pfHead');
let prof=null;
if(profHead){
  prof=document.createElement('div');
  prof.id='apProfile';
  profHead.after(prof);
}
function paintProfile(){
  if(!prof)return;
  const w=wallet(),key=['p',w||'',st?JSON.stringify(st):'-'].join('|');
  if(key===prof.__k)return;
  prof.__k=key;
  if(!w||!st){prof.innerHTML='';return}
  let since='';
  try{if(st.since)since=new Date(st.since).toLocaleDateString()}catch(e){}
  const ref=st.referred_by_code?'<div class="small">Joined with referral code '+esc(st.referred_by_code)+'</div>':'';
  if(has()){
    prof.innerHTML='<div class="sticker card ap">'+picHtml()+
      '<div class="ap-body"><div class="ap-top"><h3>🎟️ Access Pass</h3><span class="pill g">✅ Active</span></div>'+
      '<div class="small">Bound to this wallet'+(since?' · since '+esc(since):'')+'</div>'+
      '<div class="ap-act" style="margin-top:6px"><span class="ap-code">'+esc(st.code)+'</span>'+
      '<button class="btn sm alt" type="button" data-ap="copy">Copy</button></div>'+
      '<div class="small" style="margin-top:4px">👥 '+nf(st.referrals)+' player'+(Number(st.referrals)===1?'':'s')+' joined with your code</div>'+
      ref+'</div></div>';
  }else{
    prof.innerHTML='<div class="sticker card ap"><div class="ap-body"><div class="ap-top"><h3>🎟️ Access Pass</h3><span class="pill">Not owned</span></div>'+
      '<div class="small">Free quests, 30% off seeds and your own referral code.</div>'+
      '<div class="ap-act" style="margin-top:6px"><button class="btn sm" type="button" data-ap="market">See it in Market</button></div>'+ref+'</div></div>';
  }
}

function paint(){paintCard();paintProfile()}

async function loadStatus(force){
  const w=wallet();
  if(!w){st=null;paint();return}
  if(loading)return;
  if(!force&&Date.now()-lastLoad<15000)return;
  loading=true;
  try{
    const {data,error}=await db().rpc('fiji_pass_status',{p_wallet:w});
    if(error)throw error;
    if(w!==wallet())return;
    st=data||{has_pass:false};
    lastLoad=Date.now();
  }catch(e){
    console.warn('access-pass: status failed (is access-pass.sql installed?)',e);
    if(!st)st={has_pass:false};
  }finally{loading=false}
  const h=has();
  if(h!==lastHas){lastHas=h;lastKey='';changed()}
  paint();applyDisc();
  if(h)syncQuests();
}
function changed(){
  try{document.dispatchEvent(new CustomEvent('fiji:pass',{detail:{has:has()}}))}catch(e){}
  try{window.FIJI_FARM&&window.FIJI_FARM.render&&window.FIJI_FARM.render()}catch(e){}
}
async function syncQuests(force){
  const w=wallet();
  if(!w||!has())return;
  if(!force&&Date.now()-lastSync<3600e3)return;
  lastSync=Date.now();
  try{
    const r=await fetch(PAY_URL,{method:'POST',
      headers:{'apikey':C.CFG.SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({action:'sync',wallet:w})});
    const j=await r.json().catch(()=>({}));
    if(r.ok&&j.ok&&j.granted&&j.granted.length){
      try{window.FIJI_QUEST&&window.FIJI_QUEST.refresh&&window.FIJI_QUEST.refresh()}catch(e){}
    }
  }catch(e){console.debug('access-pass: quest sync failed',e);lastSync=0}
}

function wrapPay(){
  const P=window.FIJI_SEEDPAY;
  if(!P||P.__ap)return;
  const orig=P.buy;
  P.buy=async function(o){
    if(wallet()&&!st)await loadStatus(true);
    if(has()&&o&&String(o.item).indexOf('seed:')===0)o=Object.assign({},o,{unit:disc(o.unit)});
    return orig.call(this,o);
  };
  P.__ap=true;
}
let discBusy=false;
function applyDisc(){
  if(discBusy||!has())return;
  discBusy=true;
  try{
    mkHost.querySelectorAll('button[data-a="buy"][data-item^="seed:"]').forEach(b=>{
      if(b.dataset.ap)return;
      const orig=Number(b.dataset.price)||0;
      if(!orig)return;
      const row=b.closest('.fm-row'),q=row&&row.querySelector('.fm-q'),n=disc(orig);
      b.dataset.ap='1';b.dataset.price=n;
      if(q)q.dataset.price=n;
      const qty=Math.max(1,parseInt(q&&q.value,10)||1);
      b.textContent='Buy · '+nf(n*qty);
      const info=row&&row.querySelector('.fm-info');
      if(info){
        const s=document.createElement('span');
        s.className='ap-off';
        s.textContent='🎟️ 30% off with Access Pass · was '+nf(orig)+' each';
        info.appendChild(s);
      }
    });
  }finally{discBusy=false}
}
new MutationObserver(applyDisc).observe(mkHost,{childList:true,subtree:true});

const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes){
  const a=Array.from(bytes);
  let z=0;while(z<a.length&&a[z]===0)z++;
  const d=[];
  for(let i=z;i<a.length;i++){
    let c=a[i];
    for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0}
    while(c>0){d.push(c%58);c=(c/58)|0}
  }
  let s='';
  for(let i=0;i<z;i++)s+='1';
  for(let i=d.length-1;i>=0;i--)s+=B58[d[i]];
  return s;
}
function confirmBox(){
  return new Promise(resolve=>{
    const d=document.createElement('div');
    d.className='modal';
    d.style.zIndex=9999;
    d.innerHTML='<div class="sticker card" style="max-width:380px;width:100%;text-align:center">'+
      '<div style="font-size:48px;line-height:1">🎟️</div>'+
      '<h3>Buy the Access Pass?</h3>'+
      '<p class="small">You will send FIJI from your wallet to the project wallet. The pass is tied to this wallet and cannot be transferred. Payments are final.</p>'+
      '<div style="font:700 28px Fredoka,sans-serif;margin:10px 0">🪙 '+nf(PRICE)+' FIJI</div>'+
      '<div style="display:flex;gap:10px;margin-top:14px">'+
      '<button class="btn alt" type="button" style="flex:1" data-c="no">Cancel</button>'+
      '<button class="btn" type="button" style="flex:1" data-c="yes">Pay</button></div></div>';
    const done=v=>{d.remove();resolve(v)};
    d.addEventListener('click',e=>{
      if(e.target===d)return done(false);
      const b=e.target.closest('[data-c]');
      if(b)done(b.dataset.c==='yes');
    });
    document.body.appendChild(d);
  });
}
async function sendPayment(w){
  const web3=solanaWeb3,conn=C.getConnection();
  const mint=new web3.PublicKey(C.CFG.FIJI_MINT);
  const owner=new web3.PublicKey(w);
  const treasury=new web3.PublicKey(TREASURY);

  const mi=await conn.getParsedAccountInfo(mint);
  if(!mi.value||!mi.value.data||!mi.value.data.parsed)throw new Error('Could not read the FIJI token');
  const programId=mi.value.owner;
  const decimals=Number(mi.value.data.parsed.info.decimals);
  const raw=BigInt(PRICE)*(10n**BigInt(decimals));

  const accs=await conn.getParsedTokenAccountsByOwner(owner,{mint});
  let src=null,best=0n;
  accs.value.forEach(a=>{
    const v=BigInt(a.account.data.parsed.info.tokenAmount.amount);
    if(v>best){best=v;src=a.pubkey}
  });
  if(!src||best<raw)throw new Error('Not enough FIJI in your wallet (you need '+nf(PRICE)+')');

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
    data:new Uint8Array([1])
  });
  const data=new Uint8Array(10);
  data[0]=12;
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
  const memo=new web3.TransactionInstruction({
    programId:new web3.PublicKey(MEMO_PROGRAM),
    keys:[{pubkey:owner,isSigner:true,isWritable:false}],
    data:new TextEncoder().encode(MEMO_TEXT)
  });

  const tx=new web3.Transaction().add(createAta,transfer,memo);
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
  throw new Error('The payment is taking long. If FIJI left your wallet, reopen this page in a minute and your pass will arrive.');
}
async function verify(w,sig){
  let last='';
  for(let i=0;i<8;i++){
    const r=await fetch(PAY_URL,{method:'POST',
      headers:{'apikey':C.CFG.SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({wallet:w,signature:sig})});
    let j={};try{j=await r.json()}catch(e){}
    if(r.ok&&j.ok)return j.data;
    last=j.error||('Verification failed (HTTP '+r.status+')');
    if(j.retry||r.status===404){await new Promise(x=>setTimeout(x,2500));continue}
    break;
  }
  throw new Error(last);
}
const getPending=()=>{try{const o=JSON.parse(localStorage.getItem(PK)||'null');return o&&o.w&&o.sig?o:null}catch(e){return null}};
const setPending=o=>{try{if(o)localStorage.setItem(PK,JSON.stringify(o));else localStorage.removeItem(PK)}catch(e){}};

async function afterGrant(){
  toast('🎟️ Access Pass unlocked!');
  lastLoad=0;
  await loadStatus(true);
  syncQuests(true);
}
async function buy(){
  if(buying)return;
  const w=wallet();
  if(!w){if(typeof window.connect==='function')window.connect();return}
  await loadStatus(true);
  if(has())return toast('This wallet already owns the Access Pass 🎟️');
  const p=getPending();
  if(p&&p.w===w){toast('A payment is still being confirmed. Please wait a moment…');resume();return}
  buying=true;paint();
  try{
    if(!(await confirmBox()))return;
    toast('Approve the payment in your wallet…');
    const sig=await sendPayment(w);
    setPending({w,sig,t:Date.now()});
    toast('Payment sent. Confirming… ⏳');
    await waitConfirmed(sig);
    await verify(w,sig);
    setPending(null);
    await afterGrant();
  }catch(e){
    const m=e&&e.message?e.message:String(e);
    console.warn('pass payment failed',e);
    if(TERMINAL.test(m))setPending(null);
    toast(e&&e.code===4001||/reject|denied|cancel/i.test(m)?'Payment cancelled. Nothing was sent.':m);
  }finally{buying=false;card.__k='';paint()}
}
async function resume(){
  const p=getPending(),w=wallet();
  if(!p||!w||p.w!==w||buying||resuming)return;
  resuming=true;
  try{
    await verify(w,p.sig);
    setPending(null);
    await afterGrant();
  }catch(e){
    const m=String((e&&e.message)||e);
    if(TERMINAL.test(m)){setPending(null);if(/already/i.test(m)){lastLoad=0;loadStatus(true)}}
  }
  resuming=false;
}

function onClick(e){
  const b=e.target.closest('[data-ap]');
  if(!b)return;
  const a=b.dataset.ap;
  if(a==='zoom')zoom();
  else if(a==='copy'&&st&&st.code){copy(st.code);toast('Referral code copied 🔑')}
  else if(a==='connect'){if(typeof window.connect==='function')window.connect()}
  else if(a==='buy')buy();
  else if(a==='market'){if(typeof window.go==='function')window.go('market')}
}
card.addEventListener('click',onClick);
if(prof)prof.addEventListener('click',onClick);

setInterval(()=>{
  wrapPay();
  const w=wallet()||null;
  if(w!==lastW){
    lastW=w;st=null;lastHas=false;lastSync=0;lastLoad=0;card.__k='';
    if(prof)prof.__k='';
    changed();paint();
    if(w)loadStatus(true);
    return;
  }
  if(!w||document.hidden)return;
  const watching=mkPage.classList.contains('on')||(document.getElementById('profile')||{classList:{contains:()=>false}}).classList.contains('on')||(document.getElementById('wallet')||{classList:{contains:()=>false}}).classList.contains('on');
  if(watching&&Date.now()-lastLoad>30000)loadStatus(true);
},1000);
setInterval(resume,6000);

wrapPay();
paint();

window.FIJI_PASS={
  has,
  status:()=>st,
  disc,
  refresh:()=>{lastLoad=0;return loadStatus(true)}
};
})();
