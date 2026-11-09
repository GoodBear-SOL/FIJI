(function(){
'use strict';

/* Seeds and water are paid with the real BUN token (wallet -> project wallet).
   Load AFTER the core script, bun-coin.js and shop.js. */

const C=window.FIJI_CORE||{};
if(!C.CFG||!C.getWallet||!C.getProvider||!C.getConnection){
  console.warn('seed-pay: load it after the core script');
  return;
}
const toast=C.toast||(m=>console.log('[FIJI]',m));
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Number(n||0).toLocaleString();

const BUN_MINT='6jPrsxYj29kEYMSPDi9uwFBH3iMd9UTCyZby85x2pump';
const TREASURY='9CFHiteoDPmjdNpqo5J2P9LUkt3dRcTpEGaJTxbLNjn4';
const ATA_PROGRAM='ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const MEMO_PROGRAM='MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';
const PAY_URL=C.CFG.SUPABASE_URL.replace(/\/+$/,'')+'/functions/v1/seed-pay';
const PK='fiji_seed_pending';
const TERMINAL=/already used|too old|failed on-chain|does not match|not signed|too small|unknown item|invalid/i;

let buying=false,resuming=false;

function getPending(){
  try{const o=JSON.parse(localStorage.getItem(PK)||'null');return o&&o.w&&o.item&&o.qty&&o.sig?o:null}catch(e){return null}
}
function setPending(o){
  try{if(o)localStorage.setItem(PK,JSON.stringify(o));else localStorage.removeItem(PK)}catch(e){}
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

function confirmBox(o){
  return new Promise(resolve=>{
    const d=document.createElement('div');
    d.className='modal';
    d.style.zIndex=9999;
    d.innerHTML='<div class="sticker card" style="max-width:380px;width:100%;text-align:center">'+
      '<div style="font-size:54px;line-height:1">'+esc(o.emoji||'🌱')+'</div>'+
      '<h3>Buy '+nf(o.qty)+' × '+esc(o.name)+'?</h3>'+
      '<p class="small">You will send BUN tokens from your wallet to the project wallet. Payments are final.</p>'+
      '<div style="font:700 28px Fredoka,sans-serif;margin:10px 0"><img src="./bun-coin.png" alt="" style="width:30px;height:30px;vertical-align:middle;object-fit:contain"> '+nf(o.total)+' BUN</div>'+
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

async function sendPayment(w,o){
  const web3=solanaWeb3,conn=C.getConnection();
  const mint=new web3.PublicKey(BUN_MINT);
  const owner=new web3.PublicKey(w);
  const treasury=new web3.PublicKey(TREASURY);

  const mi=await conn.getParsedAccountInfo(mint);
  if(!mi.value||!mi.value.data||!mi.value.data.parsed)throw new Error('Could not read the BUN token');
  const programId=mi.value.owner;
  const decimals=Number(mi.value.data.parsed.info.decimals);
  const raw=BigInt(Math.round(o.total))*(10n**BigInt(decimals));

  const accs=await conn.getParsedTokenAccountsByOwner(owner,{mint});
  let src=null,best=0n;
  accs.value.forEach(a=>{
    const v=BigInt(a.account.data.parsed.info.tokenAmount.amount);
    if(v>best){best=v;src=a.pubkey}
  });
  if(!src||best<raw)throw new Error('Not enough BUN in your wallet');

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
  // the memo tells the server exactly what was bought
  const memo=new web3.TransactionInstruction({
    programId:new web3.PublicKey(MEMO_PROGRAM),
    keys:[{pubkey:owner,isSigner:true,isWritable:false}],
    data:new TextEncoder().encode('FIJI '+o.item+':'+o.qty)
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
  throw new Error('The payment is taking long. If BUN left your wallet, reopen this page in a minute and your seeds will arrive.');
}

async function verify(w,item,qty,sig){
  let last='';
  for(let i=0;i<8;i++){
    const r=await fetch(PAY_URL,{
      method:'POST',
      headers:{'apikey':C.CFG.SUPABASE_KEY,'Authorization':'Bearer '+C.CFG.SUPABASE_KEY,'Content-Type':'application/json'},
      body:JSON.stringify({wallet:w,item,qty,signature:sig})
    });
    let j={};try{j=await r.json()}catch(e){}
    if(r.ok&&j.ok)return j.data;
    last=j.error||('Verification failed (HTTP '+r.status+')');
    if(j.retry||r.status===404){await new Promise(x=>setTimeout(x,2500));continue}
    break;
  }
  throw new Error(last);
}

function refreshAll(){
  try{window.FIJI_FARM&&window.FIJI_FARM.refresh&&window.FIJI_FARM.refresh()}catch(e){}
  try{window.FIJI_BUNCOIN&&window.FIJI_BUNCOIN.refresh&&window.FIJI_BUNCOIN.refresh()}catch(e){}
}

/* o = {item:'seed:carrot'|'water', name, emoji, qty, unit}  (unit = BUN per piece, only used for the popup; the server uses its own price) */
async function buy(o){
  if(buying)return;
  const w=C.getWallet();
  if(!w){if(typeof window.connect==='function')window.connect();return}
  const qty=Math.max(1,Math.min(99,Math.floor(Number(o.qty))||1));
  const unit=Number(o.unit)||0;
  if(unit<1)return toast('This item has no BUN price yet 💧');
  const p=getPending();
  if(p&&p.w===w){
    toast('A payment is still being confirmed. Please wait a moment…');
    resume();
    return;
  }
  const order={item:o.item,name:o.name,emoji:o.emoji,qty,total:unit*qty};
  buying=true;
  try{
    if(!(await confirmBox(order)))return;
    toast('Approve the payment in your wallet…');
    const sig=await sendPayment(w,order);
    setPending({w,item:order.item,qty,sig,t:Date.now()});
    toast('Payment sent. Confirming… ⏳');
    await waitConfirmed(sig);
    await verify(w,order.item,qty,sig);
    setPending(null);
    toast('✅ Bought '+qty+' × '+order.name+' '+(order.emoji||'🌱'));
    refreshAll();
  }catch(e){
    const m=e&&e.message?e.message:String(e);
    console.warn('seed payment failed',e);
    if(TERMINAL.test(m))setPending(null);
    toast(e&&e.code===4001||/reject|denied|cancel/i.test(m)?'Payment cancelled. Nothing was sent.':m);
  }finally{
    buying=false;
  }
}

/* If the page was closed after paying, finish the delivery next time */
async function resume(){
  const p=getPending(),w=C.getWallet();
  if(!p||!w||p.w!==w||buying||resuming)return;
  resuming=true;
  try{
    await verify(w,p.item,p.qty,p.sig);
    setPending(null);
    toast('✅ Your payment was confirmed. Items delivered 🌱');
    refreshAll();
  }catch(e){
    const m=String((e&&e.message)||e);
    if(TERMINAL.test(m)){
      setPending(null);
      if(/already used/i.test(m))refreshAll();
    }
  }
  resuming=false;
}
setInterval(resume,6000);

window.FIJI_SEEDPAY={buy,resume};
})();
