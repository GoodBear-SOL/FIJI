(function(){
'use strict';

const C=window.FIJI_CORE||{};
if(!C.CFG||!C.getWallet){console.warn('admin-panel: load it after the core script');return}

const ADMIN='9CFHiteoDPmjdNpqo5J2P9LUkt3dRcTpEGaJTxbLNjn4';
const API=C.CFG.SUPABASE_URL.replace(/\/+$/,'')+'/functions/v1/admin-api';
const FIJI=C.CFG.FIJI_MINT, MIN=2000000, TK='fiji_admin_tok';
const BUN_MINT='6jPrsxYj29kEYMSPDi9uwFBH3iMd9UTCyZby85x2pump';
const main=document.querySelector('main.wrap'), links=document.getElementById('links');
if(!main||!links)return;

const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString();
const short=a=>{a=String(a||'');return a.length<=12?a:a.slice(0,5)+'…'+a.slice(-5)};
const when=t=>{try{return new Date(t).toLocaleString(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch(e){return ''}};
const toast=m=>C.toast?C.toast(m):console.log(m);
const isAdmin=()=>C.getWallet()===ADMIN;

/* Same list as badges.js (keep both in sync if you ever change a badge) */
const BD_BASE='badges/';
const BADGES=[
 {file:'badge1.png', name:'Bunny Buddy',        desc:'7 active days',                    key:'days',      need:7},
 {file:'badge2.png', name:'Clover Hopper',      desc:'30 active days',                   key:'days',      need:30},
 {file:'badge3.png', name:'Carrot Cruncher',    desc:'60 active days',                   key:'days',      need:60},
 {file:'badge4.png', name:'Farm Hero',          desc:'100 active days',                  key:'days',      need:100},
 {file:'badge5.png', name:'BUNXP Sprout',       desc:'50,000 BunXP',                     key:'xp',        need:50000},
 {file:'badge6.png', name:'BUNXP Superstar',    desc:'100,000 BunXP',                    key:'xp',        need:100000},
 {file:'badge7.png', name:'BUNXP Overlord',     desc:'500,000 BunXP',                    key:'xp',        need:500000},
 {file:'badge8.png', name:'OG Burrow Bunny',    desc:'Harvested 5,000 or more crops',    key:'harvested', need:5000},
 {file:'badge9.png', name:'Market Bunny',       desc:'Purchased 3,000 items from the Market', key:'market', need:3000},
 {file:'badge10.png',name:'Golden Whale Bunny', desc:'Holds 10M FIJI LABS or more',      key:'hold',      need:10000000},
 {file:'badge11.png',name:'Bunny Connector',    desc:'5 Access Pass referrals',          key:'referrals', need:5},
 {file:'badge12.png',name:'Bunny Social Star',  desc:'10 Access Pass referrals',         key:'referrals', need:10},
 {file:'badge13.png',name:'Bunny NFT Keeper',   desc:'Holds 1 NFT',                      key:'nfts',      need:1},
 {file:'badge14.png',name:'Bunny NFT Hoarder',  desc:'Holds 5 NFTs',                     key:'nfts',      need:5},
 {file:'badge15.png',name:'Burrow VIP',         desc:'Purchased Access Pass',            key:'vip',       need:1},
 {file:'badge16.png',name:'Pass Hoarder Bunny', desc:'Purchased 3 or more passes',       key:'passes',    need:3}
];

const css=document.createElement('style');
css.textContent=`
#admin .adm-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 14px}
#admin .adm-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;text-align:left}
#admin .adm-stat{background:var(--sb);border:2.5px solid var(--ink);border-radius:18px;padding:12px}
#admin .adm-stat b{display:block;font:700 24px Fredoka;word-break:break-all}
#admin .adm-req{border:2.5px solid var(--ink);border-radius:18px;padding:12px;margin-bottom:10px;background:var(--soft)}
#admin .adm-head{display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between;align-items:flex-start}
#admin .adm-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
#admin .adm-box{background:#fff;border:2px dashed var(--line);border-radius:12px;padding:8px 10px;margin-top:8px}
#admin .adm-row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
#admin .adm-row>input,#admin .adm-row>select{flex:1;min-width:140px;width:auto}
#admin .adm-mono{font-family:monospace;font-size:13px;word-break:break-all}
#admin .btn.ok{background:#7CF0A8;color:var(--ink)}
#admin .btn.bad{background:#FFD0D8;color:var(--ink)}
#admin .adm-up{color:var(--upi)}#admin .adm-dn{color:var(--dni)}
#admin label{display:block;font:600 13px Fredoka;margin:10px 0 3px;opacity:.8}
#admin .adm-pills{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}
#admin .adm-sec{margin-top:18px}
#admin .adm-bd{display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:10px;margin-top:8px}
#admin .adm-bdi{text-align:center;min-width:0}
#admin .adm-bdi img{width:100%;aspect-ratio:1/1;object-fit:contain;display:block;filter:grayscale(1);opacity:.4}
#admin .adm-bdi.on img{filter:none;opacity:1}
#admin .adm-bdi span{display:block;font:600 11px Fredoka;line-height:1.1;margin-top:2px}
#admin .adm-bdi small{display:block;font-size:10px;opacity:.65;line-height:1.1;margin-top:1px}
`;
document.head.appendChild(css);

const sec=document.createElement('section');
sec.className='pg';sec.id='admin';
sec.innerHTML='<div class="tag">admin</div><h2>🛡️ Admin Dashboard</h2><div id="admBody"></div>';
main.appendChild(sec);
const body=sec.querySelector('#admBody');

const link=document.createElement('a');
link.dataset.p='admin';
link.style.display='none';
link.innerHTML='<span class="ic">🛡️</span><span>Admin</span>';
link.onclick=()=>openAdmin();
links.appendChild(link);

const origGo=window.go;
window.go=function(p){
  const r=typeof origGo==='function'?origGo.apply(this,arguments):undefined;
  sec.classList.remove('on');link.classList.remove('on');
  return r;
};

function openAdmin(){
  if(!isAdmin())return;
  document.querySelectorAll('section.pg').forEach(s=>s.classList.toggle('on',s===sec));
  document.querySelectorAll('.nav a').forEach(a=>a.classList.toggle('on',a===link));
  try{if(typeof stopMarket==='function')stopMarket()}catch(e){}
  try{window.FIJI_TRADE&&window.FIJI_TRADE.stop&&window.FIJI_TRADE.stop()}catch(e){}
  scrollTo({top:0});
  paint();
}

let token='',view='over',wdData=[],lastW=null,autoOpened=false;
function loadTok(){
  try{const o=JSON.parse(sessionStorage.getItem(TK)||'null');if(o&&o.w===ADMIN&&o.exp>Date.now())return o.t}catch(e){}
  return '';
}
function saveTok(t){try{sessionStorage.setItem(TK,JSON.stringify({w:ADMIN,t,exp:Date.now()+3.5*3600e3}))}catch(e){}}
function clearTok(){token='';try{sessionStorage.removeItem(TK)}catch(e){}}

async function rawApi(b){
  const r=await fetch(API,{method:'POST',headers:{'apikey':C.CFG.SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify(b)});
  const j=await r.json().catch(()=>({}));
  if(j.relogin){clearTok();paint();throw new Error('Session expired, sign in again')}
  if(!r.ok||j.error)throw new Error(j.error||('Request failed (HTTP '+r.status+')'));
  return j;
}
async function api(b){const j=await rawApi(Object.assign({token},b));return j.data!==undefined?j.data:j}
async function act(fn,ok){try{const d=await fn();if(ok)toast(ok);return d}catch(e){toast(e.message||String(e));return null}}

async function signMsg(bytes){
  const p=C.getProvider(),w=C.getWallet();
  if(p&&typeof p.signMessage==='function'){
    const r=await p.signMessage(bytes,'utf8');
    return r&&r.signature?r.signature:r;
  }
  const f=p&&p.features&&p.features['solana:signMessage'];
  if(f){
    const acc=(p.accounts||[]).find(a=>a.address===w)||(p.accounts||[])[0];
    const r=await f.signMessage({account:acc,message:bytes});
    return (Array.isArray(r)?r[0]:r).signature;
  }
  throw new Error('Your wallet cannot sign messages');
}
async function signIn(){
  if(!isAdmin())return toast('Connect the admin wallet first');
  try{
    toast('Approve the sign-in message in your wallet…');
    const n=await rawApi({action:'nonce'});
    const sig=await signMsg(new TextEncoder().encode(n.message));
    let s='';for(const b of sig)s+=String.fromCharCode(b);
    const l=await rawApi({action:'login',wallet:ADMIN,nonce:n.nonce,message:n.message,signature:btoa(s)});
    token=l.token;saveTok(token);paint();
  }catch(e){
    const m=e&&e.message?e.message:String(e);
    toast(e&&e.code===4001||/reject|denied|cancel/i.test(m)?'Sign-in cancelled':m);
  }
}

function paint(){
  if(!isAdmin()){body.innerHTML='';return}
  if(!token)token=loadTok();
  if(!token){
    body.innerHTML='<div class="sticker card"><h3>Admin sign-in</h3><p class="small">Sign one message with this wallet to open the dashboard. Nothing is transferred.</p><br><button class="btn" data-act="login">Sign in as admin</button></div>';
    return;
  }
  body.innerHTML=
   '<div class="adm-tabs">'+
   [['over','📊 Overview'],['bun','🪂 Pending BUN'],['wd','💸 Withdrawals'],['usr','👥 Users'],['log','📜 Audit log']].map(t=>
     '<button class="mk-p'+(view===t[0]?' on':'')+'" data-act="tab" data-t="'+t[0]+'">'+t[1]+'</button>').join('')+
   '<button class="mk-p" data-act="logout">Sign out</button></div><div id="admView"></div>';
  if(view==='over')loadOver();
  else if(view==='bun')loadBun();
  else if(view==='wd')loadWd();
  else if(view==='usr')viewUsers();
  else loadLog();
}
  
const v=()=>document.getElementById('admView');

/* Eligibility = holds 2,000,000+ FIJI OR owns an Access Pass (decided by the admin-api "balance" action) */
function eligText(d){
  const fj=d.qualifies===true;
  if(d.has_pass&&fj)return '<b class="adm-up">✅ Eligible: Access Pass + '+nf(d.balance)+' FIJI</b>';
  if(d.has_pass)return '<b class="adm-up">✅ Eligible: owns an Access Pass</b> ('+nf(d.balance)+' FIJI)';
  if(fj)return '<b class="adm-up">✅ Eligible: holds '+nf(d.balance)+' FIJI</b> (needs '+nf(MIN)+')';
  return '<b class="adm-dn">❌ Not eligible: only '+nf(d.balance)+' FIJI and no Access Pass</b> (needs '+nf(MIN)+')';
}
const isOk=d=>d.eligible!=null?d.eligible:d.qualifies;
const eligHtml=okv=>okv==='1'
  ?'<p class="adm-up" style="margin-top:8px">✅ Eligible: holds '+nf(MIN)+'+ FIJI or owns an Access Pass</p>'
  :'<p class="adm-dn" style="margin-top:8px">⚠️ '+(okv==='0'?'Not eligible: this wallet does NOT hold '+nf(MIN)+' FIJI and has no Access Pass.':'Eligibility not checked yet.')+'</p>';

async function loadOver(){
  const d=await act(()=>api({action:'overview'}));if(!d||!v())return;
  v().innerHTML='<div class="sticker card"><div class="adm-stats">'+[
    ['Players',nf(d.users)],['Total BUN (no value)',nf(d.total_bun)],['Total BunXP',nf(d.total_bunxp)],
    ['Pending requests',nf(d.pending_requests)],['Pending BUN',nf(d.pending_bun)]
  ].map(x=>'<div class="adm-stat"><span class="small">'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+'</div>'+
  (d.airdrop_table?'':'<p class="small" style="margin-top:10px">Withdrawal table not found. Run phase-end.sql, then admin-setup.sql again.</p>')+
  '<br><button class="btn sm alt" data-act="tab" data-t="over">Refresh</button></div>';
}

const ST={pending:['⏳ Pending',''],paid:['✅ Released','g'],rejected:['↩️ Rejected','']};
let wdFilter='pending';
async function loadWd(){
  const d=await act(()=>api({action:'airdrops',status:wdFilter}));if(!d||!v())return;
  wdData=d;
  v().innerHTML='<div class="sticker card"><div class="adm-row"><h3 style="margin-right:auto">Withdrawal requests</h3>'+
   '<select id="admWdF" style="max-width:170px;flex:none">'+
   [['pending','Pending'],['paid','Released'],['rejected','Rejected'],['','All']].map(o=>'<option value="'+o[0]+'"'+(o[0]===wdFilter?' selected':'')+'>'+o[1]+'</option>').join('')+
   '</select><button class="btn sm alt" data-act="wd-refresh">Refresh</button></div>'+
   '<p class="small" style="margin:8px 0">BUN is already reserved when the player submits. <b>Release</b> keeps that deduction and records the payout. <b>Reject</b> returns the BUN.</p>'+
   (d.length?d.map(r=>{
     const s=ST[r.status]||['?',''];
     return '<div class="adm-req"><div class="adm-head"><div><b style="font-size:18px">'+nf(r.amount)+' BUN</b> <span class="pill '+(s[1]==='g'?'g':'')+'">'+s[0]+'</span>'+
      '<div class="small">#'+r.id+' · '+when(r.created_at)+' · '+esc(r.username||'')+'</div><div class="adm-mono">'+esc(r.wallet)+'</div></div>'+
      '<div class="small" style="text-align:right">Player now: '+nf(r.current_bun)+' BUN<br>'+nf(r.current_xp)+' BunXP</div></div>'+
      '<div class="adm-box small" id="admChk'+r.id+'">Eligibility not checked yet.</div>'+
      (r.paid_signature?'<div class="adm-box adm-mono">Tx: '+esc(r.paid_signature)+'</div>':'')+
      (r.admin_note?'<div class="adm-box small">Note: '+esc(r.admin_note)+'</div>':'')+
      '<div class="adm-acts"><button class="btn sm alt" data-act="chk" data-id="'+r.id+'">🔎 Check eligibility</button>'+
      '<button class="btn sm alt" data-act="user" data-w="'+esc(r.wallet)+'">👤 User</button>'+
      (r.status==='pending'?
        '<button class="btn sm ok" data-act="release" data-id="'+r.id+'">🚀 Release tokens</button>'+
        '<button class="btn sm alt" data-act="paid" data-id="'+r.id+'">Mark paid (sent manually)</button>'+
        '<button class="btn sm bad" data-act="reject" data-id="'+r.id+'">Reject &amp; refund</button>':'')+
      '</div></div>';
   }).join(''):'<div class="small" style="padding:14px">Nothing here 🌿</div>')+'</div>';
}
const reqOf=id=>wdData.find(r=>Number(r.id)===Number(id));

async function chk(id){
  const r=reqOf(id);if(!r)return;
  const el=document.getElementById('admChk'+id);if(!el)return;
  el.textContent='Checking…';
  const d=await act(()=>api({action:'balance',wallet:r.wallet}));
  if(!d){el.textContent='Could not check. Try again.';return}
  el.innerHTML=eligText(d);
  el.dataset.ok=isOk(d)?'1':'0';
}
async function reject(id){
  const note=prompt('Reason (optional). The BUN will be returned to the player.','');
  if(note===null)return;
  if(await act(()=>api({action:'resolve',id:Number(id),kind:'reject',note}),'Rejected, BUN returned'))loadWd();
}
async function markPaid(id){
  const sig=prompt('Paste the transaction signature (optional, verified on-chain):','');
  if(sig===null)return;
  if(await act(()=>api({action:'resolve',id:Number(id),kind:'paid',signature:sig.trim(),note:'sent manually'}),'Marked as released'))loadWd();
}

function release(id){
  const r=reqOf(id);if(!r)return;
  const okv=(document.getElementById('admChk'+id)||{dataset:{}}).dataset.ok;
  const d=document.createElement('div');d.className='modal';
  d.innerHTML='<div class="sticker card" style="max-width:440px;width:100%;max-height:90vh;overflow:auto" id="admRel"><h3>🚀 Release tokens</h3>'+
   '<p class="small">Sends real tokens from <b>your admin wallet</b> to the player. Your wallet will ask you to approve.</p>'+
   '<div class="adm-box adm-mono">'+esc(r.wallet)+'</div>'+
   eligHtml(okv)+
   '<label>Token mint address</label><input id="rMint" value="'+BUN_MINT+'">'+
   '<label>BUN requested</label><input value="'+nf(r.amount)+'" disabled>'+
   '<label>Tokens per 1 BUN</label><input id="rRate" type="number" step="any" value="1">'+
   '<label>Tokens to send</label><input id="rAmt" type="number" step="any" value="'+Number(r.amount)+'">'+
   '<div class="adm-row" style="margin-top:14px"><button class="btn alt" id="rNo">Cancel</button><button class="btn ok" id="rGo">Send &amp; mark released</button></div></div>';
  document.body.appendChild(d);
  const q=i=>d.querySelector('#'+i);
  q('rRate').oninput=()=>{q('rAmt').value=+(Number(r.amount)*Number(q('rRate').value||0)).toFixed(9)};
  q('rNo').onclick=()=>d.remove();
  q('rGo').onclick=async()=>{
    const mint=q('rMint').value.trim(),a=Number(q('rAmt').value);
    if(!(a>0))return toast('Enter an amount to send');
    if(!confirm('Send '+nf(a)+' tokens to '+short(r.wallet)+' ?'))return;
    q('rGo').disabled=true;q('rGo').textContent='Waiting for wallet…';
    try{
      const sig=await sendTokens(r.wallet,mint,a);
      toast('Sent. Confirming…');
      await waitConfirmed(sig);
      let done=false;
      for(let i=0;i<6&&!done;i++){
        try{await api({action:'resolve',id:Number(id),kind:'paid',signature:sig,note:'released '+a+' of '+mint});done=true}
        catch(e){if(i===5)throw new Error('Tokens were SENT ('+short(sig)+') but recording failed: '+e.message+'. Use "Mark paid" with this signature: '+sig);await new Promise(x=>setTimeout(x,2500))}
      }
      toast('✅ Released and recorded');d.remove();loadWd();
    }catch(e){
      const m=e&&e.message?e.message:String(e);
      toast(e&&e.code===4001||/reject|denied|cancel/i.test(m)?'Cancelled, nothing sent':m);
      q('rGo').disabled=false;q('rGo').textContent='Send & mark released';
    }
  };
}

const B58='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(bytes){
  const a=Array.from(bytes);let z=0;while(z<a.length&&a[z]===0)z++;
  const d=[];
  for(let i=z;i<a.length;i++){let c=a[i];for(let j=0;j<d.length;j++){c+=d[j]<<8;d[j]=c%58;c=(c/58)|0}while(c>0){d.push(c%58);c=(c/58)|0}}
  let s='';for(let i=0;i<z;i++)s+='1';for(let i=d.length-1;i>=0;i--)s+=B58[d[i]];return s;
}
async function sendTokens(toWallet,mintStr,amount){
  const web3=solanaWeb3,conn=C.getConnection(),pr=C.getProvider();
  if(!isAdmin()||!pr)throw new Error('Connect the admin wallet first');
  const owner=new web3.PublicKey(ADMIN),to=new web3.PublicKey(toWallet),mint=new web3.PublicKey(mintStr);
  const mi=await conn.getParsedAccountInfo(mint);
  if(!mi.value||!mi.value.data||!mi.value.data.parsed)throw new Error('Could not read the token');
  const programId=mi.value.owner,dec=Number(mi.value.data.parsed.info.decimals);
  const raw=BigInt(Math.round(amount*Math.pow(10,dec)));
  const accs=await conn.getParsedTokenAccountsByOwner(owner,{mint});
  let src=null,best=0n;
  accs.value.forEach(a=>{const x=BigInt(a.account.data.parsed.info.tokenAmount.amount);if(x>best){best=x;src=a.pubkey}});
  if(!src||best<raw)throw new Error('Admin wallet does not hold enough of this token');
  const ATA=new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
  const [dest]=web3.PublicKey.findProgramAddressSync([to.toBytes(),programId.toBytes(),mint.toBytes()],ATA);
  const create=new web3.TransactionInstruction({programId:ATA,keys:[
    {pubkey:owner,isSigner:true,isWritable:true},{pubkey:dest,isSigner:false,isWritable:true},
    {pubkey:to,isSigner:false,isWritable:false},{pubkey:mint,isSigner:false,isWritable:false},
    {pubkey:web3.SystemProgram.programId,isSigner:false,isWritable:false},{pubkey:programId,isSigner:false,isWritable:false}],
    data:new Uint8Array([1])});
  const data=new Uint8Array(10);data[0]=12;new DataView(data.buffer).setBigUint64(1,raw,true);data[9]=dec;
  const xfer=new web3.TransactionInstruction({programId,keys:[
    {pubkey:src,isSigner:false,isWritable:true},{pubkey:mint,isSigner:false,isWritable:false},
    {pubkey:dest,isSigner:false,isWritable:true},{pubkey:owner,isSigner:true,isWritable:false}],data});
  const tx=new web3.Transaction().add(create,xfer);
  tx.feePayer=owner;tx.recentBlockhash=(await conn.getLatestBlockhash('confirmed')).blockhash;
  if(typeof pr.signAndSendTransaction==='function'){
    const r=await pr.signAndSendTransaction(tx);const sg=r&&r.signature?r.signature:r;
    return typeof sg==='string'?sg:b58(sg);
  }
  const f=pr.features&&pr.features['solana:signAndSendTransaction'];
  if(f){
    const acc=(pr.accounts||[]).find(a=>a.address===ADMIN)||(pr.accounts||[])[0];
    const r=await f.signAndSendTransaction({account:acc,chain:'solana:mainnet',
      transaction:tx.serialize({requireAllSignatures:false,verifySignatures:false})});
    return b58((Array.isArray(r)?r[0]:r).signature);
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
    if(s&&s.err)throw new Error('The transfer failed on-chain');
    if(s&&(s.confirmationStatus==='confirmed'||s.confirmationStatus==='finalized'))return;
    await new Promise(x=>setTimeout(x,1500));
  }
  throw new Error('Transfer is taking long. Check your wallet before retrying, do not send twice.');
}
/* ===== Pending BUN (all players' collected BUN) ===== */
let bunData=[],bunQ='',bunMin=1;
const bunRow=w=>bunData.find(r=>r.wallet===w);
const bunEl=w=>document.getElementById('bChk'+w);

async function loadBun(){
  const d=await act(()=>api({action:'bun_list',q:bunQ,min:bunMin}));if(!d||!v())return;
  bunData=d.rows||[];
  const ops=d.pending_ops||[];
  v().innerHTML='<div class="sticker card">'+
   '<div class="adm-stats"><div class="adm-stat"><span class="small">Players with pending BUN</span><b>'+nf(d.players)+'</b></div>'+
   '<div class="adm-stat"><span class="small">Total pending BUN</span><b>'+nf(d.total)+'</b></div></div>'+
   '<div class="adm-row" style="margin-top:12px"><input id="bunQ" placeholder="Search wallet or username" value="'+esc(bunQ)+'">'+
   '<input id="bunMin" type="number" min="1" placeholder="Min BUN" value="'+esc(String(bunMin))+'" style="max-width:130px;flex:none">'+
   '<button class="btn sm" data-act="bun-go">Search</button>'+
   '<button class="btn sm alt" data-act="bchkall">🔎 Check all shown</button></div>'+
   '<p class="small" style="margin:8px 0">Check eligibility first. A wallet is eligible if it holds '+nf(MIN)+'+ FIJI <b>or</b> owns an Access Pass. If eligible, <b>Release</b> sends real BUN tokens from your admin wallet and deducts that amount from their pending BUN. If not, <b>Burn</b> removes their pending BUN permanently.</p>'+
   (ops.length?'<h3 style="margin:12px 0 6px">⏳ In-flight releases</h3><p class="small">BUN is held while the transfer is unconfirmed. If tokens were sent, press Finish. If nothing was sent, press Cancel to refund.</p>'+
     ops.map(o=>'<div class="adm-req"><b>'+nf(o.amount)+' BUN</b> · #'+o.id+' · '+when(o.created_at)+
      '<div class="adm-mono">'+esc(o.wallet)+'</div><div class="adm-acts">'+
      '<button class="btn sm ok" data-act="bfin" data-id="'+o.id+'">✅ Finish (paste tx)</button>'+
      '<button class="btn sm bad" data-act="bcancel" data-id="'+o.id+'">↩️ Cancel &amp; refund</button></div></div>').join(''):'')+
   '<h3 style="margin:14px 0 6px">Players</h3>'+
   (bunData.length?bunData.map(r=>
     '<div class="adm-req"><div class="adm-head"><div><b style="font-size:18px">'+nf(r.points)+' BUN</b> <span class="pill">'+esc(r.username||'Player')+'</span>'+
     '<div class="adm-mono">'+esc(r.wallet)+'</div></div>'+
     '<div class="small" style="text-align:right">'+nf(r.bunxp)+' BunXP<br>🔥 '+nf(r.streak)+'</div></div>'+
     '<div class="adm-box small" id="bChk'+esc(r.wallet)+'">Eligibility not checked yet.</div>'+
     '<div class="adm-acts"><button class="btn sm alt" data-act="bchk" data-w="'+esc(r.wallet)+'">🔎 Check eligibility</button>'+
     '<button class="btn sm ok" data-act="brelease" data-w="'+esc(r.wallet)+'">🚀 Release BUN</button>'+
     '<button class="btn sm bad" data-act="bburn" data-w="'+esc(r.wallet)+'">🔥 Burn BUN</button>'+
     '<button class="btn sm alt" data-act="user" data-w="'+esc(r.wallet)+'">👤 User</button></div></div>').join('')
    :'<div class="small" style="padding:14px">No players with pending BUN 🌿</div>')+
   '</div>';
}

async function bchk(w){
  const el=bunEl(w);if(!el)return;
  el.textContent='Checking…';
  const d=await act(()=>api({action:'balance',wallet:w}));
  if(!d){el.textContent='Could not check. Try again.';return}
  el.innerHTML=eligText(d);
  el.dataset.ok=isOk(d)?'1':'0';
}
async function bchkAll(){
  for(const r of bunData.slice()){
    if(!bunEl(r.wallet))break;
    await bchk(r.wallet);
    await new Promise(x=>setTimeout(x,250));
  }
}

async function burnBun(w){
  const r=bunRow(w);if(!r)return;
  const ok=(bunEl(w)||{dataset:{}}).dataset.ok;
  if(ok!=='0'&&ok!=='1')return toast('Check eligibility first');
  if(ok==='1'&&!confirm('This wallet is ELIGIBLE (holds '+nf(MIN)+'+ FIJI or owns an Access Pass). Burn their BUN anyway?'))return;
  const a=prompt('How much BUN to burn? (max '+nf(r.points)+')',String(r.points));
  if(a===null)return;
  const amt=Math.floor(Number(a));
  if(!(amt>0)||amt>Number(r.points))return toast('Enter a valid amount');
  const note=prompt('Reason (saved in audit log)','not eligible: below '+nf(MIN)+' FIJI and no Access Pass');
  if(note===null)return;
  if(!confirm('Burn '+nf(amt)+' BUN from '+short(w)+'? This cannot be undone.'))return;
  const d=await act(()=>api({action:'bun_reserve',wallet:w,amount:amt,kind:'burn',note}),'🔥 Burned '+nf(amt)+' BUN');
  if(d)loadBun();
}

async function cancelOp(id,note){
  try{await api({action:'bun_cancel',id:Number(id),note:note||'transfer not sent'});return true}
  catch(e){console.warn('cancel failed',e);return false}
}
async function finishOp(id){
  const sig=prompt('Paste the transaction signature (tokens must already be sent):','');
  if(sig===null||!sig.trim())return;
  if(await act(()=>api({action:'bun_finish',id:Number(id),signature:sig.trim(),note:'finished manually'}),'Marked as released'))loadBun();
}
async function cancelPending(id){
  if(!confirm('Only cancel if you are SURE no tokens were sent. The BUN will be returned to the player. Continue?'))return;
  if(await act(()=>api({action:'bun_cancel',id:Number(id),note:'cancelled by admin'}),'Cancelled, BUN returned'))loadBun();
}

function releaseBun(w){
  const r=bunRow(w);if(!r)return;
  const okv=(bunEl(w)||{dataset:{}}).dataset.ok;
  const d=document.createElement('div');d.className='modal';
  d.innerHTML='<div class="sticker card" style="max-width:440px;width:100%;max-height:90vh;overflow:auto"><h3>🚀 Release BUN</h3>'+
   '<p class="small">Sends real tokens from <b>your admin wallet</b> to the player and deducts that BUN from their pending balance. Your wallet will ask you to approve.</p>'+
   '<div class="adm-box adm-mono">'+esc(w)+'</div>'+
   eligHtml(okv)+
   '<label>Token mint address</label><input id="rMint" value="'+BUN_MINT+'">'+
   '<label>Pending BUN to release (max '+nf(r.points)+')</label><input id="rBun" type="number" step="1" min="1" value="'+Number(r.points)+'">'+
   '<label>Tokens per 1 BUN</label><input id="rRate" type="number" step="any" value="1">'+
   '<label>Tokens to send</label><input id="rAmt" type="number" step="any" value="'+Number(r.points)+'">'+
   '<div class="adm-row" style="margin-top:14px"><button class="btn alt" id="rNo">Cancel</button><button class="btn ok" id="rGo">Send &amp; mark released</button></div></div>';
  document.body.appendChild(d);
  const q=i=>d.querySelector('#'+i);
  const sync=()=>{q('rAmt').value=+(Number(q('rBun').value||0)*Number(q('rRate').value||0)).toFixed(9)};
  q('rBun').oninput=sync;q('rRate').oninput=sync;
  q('rNo').onclick=()=>d.remove();
  q('rGo').onclick=async()=>{
    const mint=q('rMint').value.trim(),bun=Math.floor(Number(q('rBun').value)),a=Number(q('rAmt').value);
    if(!(bun>0)||bun>Number(r.points))return toast('Enter a valid BUN amount');
    if(!(a>0))return toast('Enter an amount to send');
    if(okv==='0'&&!confirm('This wallet is NOT eligible (no '+nf(MIN)+' FIJI and no Access Pass). Release anyway?'))return;
    if(!confirm('Send '+nf(a)+' tokens to '+short(w)+' for '+nf(bun)+' BUN?'))return;
    q('rGo').disabled=true;q('rGo').textContent='Reserving BUN…';
    let op=null;
    try{
      const res=await api({action:'bun_reserve',wallet:w,amount:bun,kind:'release',note:'release '+a+' of '+mint});
      op=res.op_id;
      q('rGo').textContent='Waiting for wallet…';
      let sig;
      try{sig=await sendTokens(w,mint,a)}
      catch(e){await cancelOp(op,'send cancelled or failed');op=null;throw e}
      toast('Sent. Confirming…');
      try{await waitConfirmed(sig)}
      catch(e){
        if(/failed on-chain/i.test(e.message||'')){await cancelOp(op,'failed on-chain');op=null;throw e}
        throw new Error('Tokens may have been sent ('+sig+'). The BUN stays held under "In-flight releases". Check the transaction, then press Finish or Cancel. '+e.message);
      }
      let done=false;
      for(let i=0;i<6&&!done;i++){
        try{await api({action:'bun_finish',id:Number(op),signature:sig,note:'released '+a+' of '+mint});done=true}
        catch(e){
          if(i===5)throw new Error('Tokens were SENT ('+short(sig)+') but recording failed: '+e.message+'. Press Finish under "In-flight releases" with this signature: '+sig);
          await new Promise(x=>setTimeout(x,2500));
        }
      }
      toast('✅ Released and recorded');d.remove();loadBun();
    }catch(e){
      const m=e&&e.message?e.message:String(e);
      toast(e&&e.code===4001||/reject|denied|cancel/i.test(m)?'Cancelled, nothing sent, BUN refunded':m);
      q('rGo').disabled=false;q('rGo').textContent='Send & mark released';
      if(v()&&view==='bun')loadBun();
    }
  };
}

/* ===== Users ===== */
let userFilter='';
function viewUsers(){
  if(!v())return;
  v().innerHTML='<div class="sticker card"><h3>Find a user</h3><div class="adm-row" style="margin-top:8px"><input id="admQ" placeholder="Wallet address or username">'+
    '<select id="admUF" style="max-width:170px;flex:none">'+
    [['','All players'],['pass','🎟️ Access Pass'],['nopass','No Access Pass']].map(o=>'<option value="'+o[0]+'"'+(o[0]===userFilter?' selected':'')+'>'+o[1]+'</option>').join('')+
    '</select><button class="btn" data-act="find">Search</button></div>'+
    '<div id="admUList" style="overflow-x:auto"></div></div><div id="admUser"></div>';
  const q=document.getElementById('admQ');
  q.addEventListener('keydown',e=>{if(e.key==='Enter')findUsers()});
  findUsers();
}
async function findUsers(){
  const q=document.getElementById('admQ'),f=document.getElementById('admUF');
  if(f)userFilter=f.value;
  const d=await act(()=>api({action:'find',q:q?q.value:'',filter:userFilter}));if(!d)return;
  const el=document.getElementById('admUList');if(!el)return;
  el.innerHTML='<table><tr><th>Player</th><th>Pass</th><th>BUN</th><th>BunXP</th><th>Streak</th><th></th></tr>'+
    (d.length?d.map(u=>'<tr><td>'+esc(u.username||'')+'<div class="adm-mono">'+esc(short(u.wallet))+'</div></td>'+
      '<td>'+(u.has_pass?'<span class="pill g">🎟️ Yes</span>':'<span class="small">No</span>')+'</td>'+
      '<td>'+nf(u.points)+'</td><td>'+nf(u.bunxp)+'</td><td>'+nf(u.streak)+'</td>'+
      '<td><button class="btn sm" data-act="user" data-w="'+esc(u.wallet)+'">Open</button></td></tr>').join(''):'<tr><td colspan="6" class="small">No players found</td></tr>')+'</table>';
}
function logRows(l){
  if(!l||!l.length)return '<div class="small">None</div>';
  return '<div style="overflow-x:auto"><table>'+l.map(x=>'<tr><td>'+esc(x.action)+'</td><td class="adm-mono">'+esc(JSON.stringify(x.detail))+'</td><td>'+when(x.created_at)+'</td></tr>').join('')+'</table></div>';
}

/* Same numbers badges.js uses to decide which badges are unlocked */
function badgeState(d){
  const bs=d.badge_stats||{},p=d.profile||{},pass=d.pass||{};
  const st={
    days:bs.active_days,
    xp:Number(p.bunxp||0)+Number(d.phase_p2_xp||0),
    harvested:bs.harvested,
    market:bs.market_items,
    hold:d.fiji_balance,
    referrals:bs.referrals,
    nfts:bs.nfts,
    vip:pass.has_pass?1:0,
    passes:bs.passes
  };
  if(pass.has_pass&&(st.passes==null||st.passes<1))st.passes=Math.max(st.passes||0,1);
  return st;
}

async function openUser(w){
  if(view!=='usr'){view='usr';paint();await new Promise(r=>setTimeout(r,50))}
  const d=await act(()=>api({action:'user',wallet:w}));if(!d)return;
  const p=d.profile,box=document.getElementById('admUser');if(!box)return;
  const pass=d.pass||{},crops=d.crops||[],inv=d.inventory||[],subs=d.quests||[],prods=d.products||[];
  const hold=d.fiji_balance,holdOk=hold!=null&&hold>=MIN;
  const invQty=id=>{const r=inv.find(x=>x.item_id===id);return r?Number(r.qty)||0:0};

  /* items that can be added / removed: water, seeds, harvested crops (carrots live on the profile) */
  const opts=[['water','💧 Water',invQty('water')]];
  crops.forEach(k=>{
    opts.push(['seed:'+k.id,(k.seed_emoji||'🌱')+' '+k.name+' seed',invQty('seed:'+k.id)]);
    opts.push(['crop:'+k.id,(k.crop_emoji||'🥬')+' '+k.name+(k.to_carrots?' (Carrots)':' (harvested)'),k.to_carrots?(Number(p.carrots)||0):invQty('crop:'+k.id)]);
  });
  const haveItems=opts.filter(o=>o[2]>0);

  /* quests */
  const questRows=prods.length?prods.map(pr=>{
    const s=subs.find(x=>x.quest_id===pr.id);
    let t;
    if(!s)t='❌ Not active';
    else if(Date.parse(s.expires_at)>=Date.parse('9999-01-01'))t='♾️ Lifetime';
    else if(Date.parse(s.expires_at)>Date.now())t='✅ Active until '+when(s.expires_at);
    else t='⌛ Expired '+when(s.expires_at);
    return '<span class="pill'+(s&&Date.parse(s.expires_at)>Date.now()?' g':'')+'">'+esc((pr.emoji||'')+' '+pr.name)+': '+t+'</span>';
  }).join(''):'<span class="small">No quests found</span>';

  /* badges */
  const bst=badgeState(d);
  const okOf=b=>{const x=bst[b.key];return x!=null&&Number(x)>=b.need};
  const got=BADGES.filter(okOf).length;
  const bdHtml=BADGES.map(b=>{
    const ok=okOf(b),x=bst[b.key];
    const prog=!ok&&x!=null&&b.key!=='vip'?nf(Math.floor(Number(x)))+' / '+nf(b.need):'';
    return '<div class="adm-bdi'+(ok?' on':'')+'" title="'+esc(b.desc)+'"><img src="'+esc(BD_BASE+b.file)+'" alt="'+esc(b.name)+'" loading="lazy">'+
      '<span>'+esc(b.name)+'</span><small>'+esc(ok?b.desc:(prog||b.desc))+'</small></div>';
  }).join('');

  box.innerHTML='<div class="sticker card" style="margin-top:14px"><div class="adm-row"><h3 style="margin-right:auto">'+esc(p.username||'Player')+'</h3>'+
   '<button class="btn sm alt" id="uRef">🔄 Refresh</button></div>'+
   '<div class="adm-mono" style="margin:6px 0">'+esc(p.wallet)+'</div>'+

   '<div class="adm-pills">'+
   (pass.has_pass?'<span class="pill g">🎟️ Access Pass · '+esc(pass.code)+(pass.admin_granted?' (admin gift)':'')+'</span>':'<span class="pill">No Access Pass</span>')+
   (hold!=null?(holdOk?'<span class="pill g">✅ '+nf(hold)+' FIJI</span>':'<span class="pill">❌ '+nf(hold)+' FIJI (needs '+nf(MIN)+')</span>'):'<span class="pill">FIJI balance unavailable</span>')+
   ((pass.has_pass||holdOk)?'<span class="pill g">✅ Eligible (Access Pass or '+nf(MIN)+' FIJI)</span>':'<span class="pill">🔒 Not eligible</span>')+
   '</div>'+
   (pass.has_pass?'<div class="small">Pass since '+esc(when(pass.since))+' · '+nf(pass.referrals)+' referral'+(Number(pass.referrals)===1?'':'s')+'</div>':'')+
   (pass.referred_by?'<div class="small">Joined with referral code '+esc(pass.referred_by)+'</div>':'')+

   '<div class="adm-stats" style="margin-top:10px"><div class="adm-stat"><span class="small">BUN (no value)</span><b>'+nf(p.points)+'</b></div>'+
   '<div class="adm-stat"><span class="small">BunXP (profile)</span><b>'+nf(p.bunxp)+'</b></div>'+
   (d.phase_p2_xp!=null?'<div class="adm-stat"><span class="small">Phase 2 BunXP</span><b>'+nf(d.phase_p2_xp)+'</b></div>':'')+
   '<div class="adm-stat"><span class="small">Carrots</span><b>'+nf(p.carrots)+'</b></div>'+
   '<div class="adm-stat"><span class="small">Streak</span><b>'+nf(p.streak)+'</b></div></div>'+

   '<div class="adm-sec"><h3>Quest access</h3><div class="adm-pills">'+questRows+'</div></div>'+

   '<div class="adm-sec"><h3>Bag (water, seeds, crops)</h3><div class="adm-pills">'+
   (haveItems.length?haveItems.map(o=>'<span class="pill">'+esc(o[1])+' × '+nf(o[2])+'</span>').join(''):'<span class="small">Empty</span>')+
   '</div></div>'+

   '<div class="adm-sec"><h3>Badges · '+got+' / '+BADGES.length+' unlocked</h3><div class="adm-bd">'+bdHtml+'</div></div>'+

   '<div class="adm-sec"><h3>Fix BUN / BunXP</h3><p class="small">Use a positive number to add, negative to deduct. Cannot go below 0.</p>'+
   '<div class="adm-row" style="margin-top:6px"><select id="aKind" style="max-width:130px;flex:none"><option value="bun">BUN</option><option value="xp">BunXP</option></select>'+
   '<input id="aAmt" type="number" placeholder="Amount (+ or −)"><input id="aNote" placeholder="Reason (saved in audit log)"><button class="btn" id="aGo">Apply</button></div></div>'+

   '<div class="adm-sec"><h3>Add / remove water &amp; crops</h3><p class="small">Positive adds, negative removes. Cannot go below 0. Max 100,000 at once.</p>'+
   '<div class="adm-row" style="margin-top:6px"><select id="iItem">'+
   opts.map(o=>'<option value="'+esc(o[0])+'">'+esc(o[1])+' · have '+nf(o[2])+'</option>').join('')+'</select>'+
   '<input id="iAmt" type="number" placeholder="Amount (+ or −)"><input id="iNote" placeholder="Reason (saved in audit log)"><button class="btn" id="iGo">Apply</button></div></div>'+

   '<div class="adm-sec"><h3>Grant quest access</h3><p class="small">Gives free access to quests without payment. Days are added to what the wallet already has. Lifetime never expires.</p>'+
   '<div class="adm-row" style="margin-top:6px"><select id="gQuest"><option value="">All quests</option>'+
   prods.map(pr=>'<option value="'+esc(pr.id)+'">'+esc((pr.emoji||'')+' '+pr.name)+'</option>').join('')+'</select>'+
   '<input id="gDays" type="number" min="1" max="3650" placeholder="Days (1 to 3650)">'+
   '<button class="btn ok" id="gGo">Grant days</button><button class="btn ok" id="gLife">♾️ Grant lifetime</button></div></div>'+

   '<div class="adm-sec"><h3>Access Pass</h3>'+
   (pass.has_pass
     ?'<p class="small">This wallet already owns an Access Pass (code <b>'+esc(pass.code)+'</b>).</p>'
     :'<p class="small">Gives a FREE Access Pass: lifetime quests, their own referral code and 30% off seeds. It is tied to this wallet.</p>'+
      '<div class="adm-row" style="margin-top:6px"><button class="btn ok" id="pGo">🎟️ Grant free Access Pass</button></div>')+
   '</div>'+

   '<div class="adm-sec"><h3>Recent admin actions</h3>'+logRows(d.log)+'</div>'+
   '<div class="adm-sec"><h3>Recent BunXP</h3>'+
   (d.xp_log.length?'<div style="overflow-x:auto"><table>'+d.xp_log.map(x=>'<tr><td>'+esc(x.source)+'</td><td>+'+nf(x.xp)+'</td><td>'+when(x.created_at)+'</td></tr>').join('')+'</table></div>':'<div class="small">None</div>')+'</div></div>';

  const q=i=>box.querySelector('#'+i);
  q('uRef').onclick=()=>openUser(w);

  q('aGo').onclick=async()=>{
    const delta=Number(q('aAmt').value),kind=q('aKind').value;
    if(!delta)return toast('Enter an amount');
    if(!confirm((delta>0?'Add ':'Deduct ')+nf(Math.abs(delta))+' '+(kind==='bun'?'BUN':'BunXP')+' for '+short(w)+'?'))return;
    const r=await act(()=>api({action:'adjust',wallet:w,kind,delta,note:q('aNote').value}));
    if(r){toast('Done: '+nf(r.before)+' → '+nf(r.after));openUser(w)}
  };

  q('iGo').onclick=async()=>{
    const delta=Math.trunc(Number(q('iAmt').value)),item=q('iItem').value;
    if(!delta)return toast('Enter an amount');
    const label=(q('iItem').selectedOptions[0]||{}).textContent||item;
    if(!confirm((delta>0?'Add ':'Remove ')+nf(Math.abs(delta))+' × '+label.split(' · ')[0]+' for '+short(w)+'?'))return;
    const r=await act(()=>api({action:'adjust_item',wallet:w,item,delta,note:q('iNote').value}));
    if(r){toast('Done: '+nf(r.before)+' → '+nf(r.after));openUser(w)}
  };

  const grantQ=async(lifetime)=>{
    const quest=q('gQuest').value,days=Math.floor(Number(q('gDays').value));
    if(!lifetime&&!(days>=1&&days<=3650))return toast('Enter days from 1 to 3650, or press Grant lifetime');
    const what=quest?(q('gQuest').selectedOptions[0].textContent.trim()):'all quests';
    if(!confirm('Grant '+(lifetime?'LIFETIME':nf(days)+' days of')+' access to '+what+' for '+short(w)+'?'))return;
    const body=lifetime?{action:'grant_quests',wallet:w,quest,lifetime:true,note:'admin grant'}:{action:'grant_quests',wallet:w,quest,days,note:'admin grant'};
    const r=await act(()=>api(body));
    if(r){toast('Quest access granted ('+r.granted+' quest'+(r.granted===1?'':'s')+')');openUser(w)}
  };
  q('gGo').onclick=()=>grantQ(false);
  q('gLife').onclick=()=>grantQ(true);

  const pGo=q('pGo');
  if(pGo)pGo.onclick=async()=>{
    if(!confirm('Grant a FREE Access Pass to '+short(w)+'? They get lifetime quests, a referral code and 30% off seeds.'))return;
    const r=await act(()=>api({action:'grant_pass',wallet:w,note:'admin gift'}));
    if(r){toast('🎟️ Access Pass granted. Code: '+r.code);openUser(w)}
  };

  box.scrollIntoView({behavior:'smooth'});
}

async function loadLog(){
  const d=await act(()=>api({action:'logs'}));if(!d||!v())return;
  v().innerHTML='<div class="sticker card"><div class="adm-row"><h3 style="margin-right:auto">Audit log</h3><button class="btn sm alt" data-act="tab" data-t="log">Refresh</button></div>'+
   '<div style="overflow-x:auto"><table><tr><th>When</th><th>Action</th><th>Wallet</th><th>Detail</th></tr>'+
   (d.length?d.map(x=>'<tr><td>'+when(x.created_at)+'</td><td>'+esc(x.action)+'</td><td class="adm-mono">'+esc(short(x.wallet))+'</td><td class="adm-mono">'+esc(JSON.stringify(x.detail))+'</td></tr>').join(''):'<tr><td colspan="4" class="small">No admin actions yet</td></tr>')+
   '</table></div></div>';
}

sec.addEventListener('change',e=>{
  if(e.target.id==='admWdF'){wdFilter=e.target.value;loadWd()}
  else if(e.target.id==='admUF')findUsers();
});
sec.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act;
  if(a==='login')signIn();
  else if(a==='logout'){clearTok();paint();toast('Signed out')}
  else if(a==='tab'){view=b.dataset.t;paint()}
  else if(a==='wd-refresh')loadWd();
  else if(a==='chk')chk(b.dataset.id);
  else if(a==='release')release(b.dataset.id);
  else if(a==='paid')markPaid(b.dataset.id);
  else if(a==='reject')reject(b.dataset.id);
  else if(a==='find')findUsers();
  else if(a==='user')openUser(b.dataset.w);
  else if(a==='bun-go'){bunQ=(document.getElementById('bunQ')||{}).value||'';bunMin=Math.max(1,Math.floor(Number((document.getElementById('bunMin')||{}).value)||1));loadBun()}
  else if(a==='bchk')bchk(b.dataset.w);
  else if(a==='bchkall')bchkAll();
  else if(a==='brelease')releaseBun(b.dataset.w);
  else if(a==='bburn')burnBun(b.dataset.w);
  else if(a==='bfin')finishOp(b.dataset.id);
  else if(a==='bcancel')cancelPending(b.dataset.id);
});

setInterval(()=>{
  const w=C.getWallet()||null;
  if(w===lastW)return;
  lastW=w;
  const admin=w===ADMIN;
  link.style.display=admin?'':'none';
  if(!admin){
    clearTok();autoOpened=false;
    if(sec.classList.contains('on')&&typeof window.go==='function')window.go('home');
    body.innerHTML='';
    return;
  }
  if(!autoOpened){autoOpened=true;openAdmin();toast('Admin wallet detected 🛡️')}
},800);
})();
