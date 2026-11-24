(function(){
'use strict';

const $=id=>document.getElementById(id);
const mkPage=$('market'),host=$('mkInline');
const DATA=window.FIJI_NFT_DATA;
if(!mkPage||!host||!Array.isArray(DATA)){console.warn('nft-gallery: Market page or nft-data.js not found');return}
if($('nftGallery'))return;

const COLLECTION='CQq6WVfkrjTaSMBhuwbdAEKhZhiUKQY7QYQK16MFBD3q';
const CORE_PROGRAM='CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d';
const DEVNET_RPC='https://api.devnet.solana.com';
const GATEWAY='https://gateway.irys.xyz/';
const PAGE=40;
const RARITIES=['Common','Uncommon','Rare','Epic','Legendary'];
const RCOL={Common:'#E8EEF7',Uncommon:'#B8F5D2',Rare:'#BFE0FF',Epic:'#E3CCFF',Legendary:'#FFD21F'};

const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short=a=>{const s=String(a||'');return s.length<=10?s:s.slice(0,4)+'…'+s.slice(-4)};
const toast=m=>{try{window.FIJI_CORE.toast(m)}catch(e){console.log(m)}};
const pad3=n=>String(n).padStart(3,'0');

const NFTS=DATA.map(r=>({id:r[0],name:r[1],rarity:r[2],img:GATEWAY+r[3],meta:GATEWAY+r[4],metaId:r[4]}));
const byMeta=new Map(NFTS.map(n=>[n.metaId,n]));
const byName=new Map(NFTS.map(n=>[n.name.toLowerCase(),n]));

const S={rarity:'All',status:'All',q:'',shown:PAGE,chain:{},loaded:false,loading:false,err:'',at:0};

const css=document.createElement('style');
css.textContent=`
#nftGallery{margin-top:34px}
.ng-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;text-align:center;margin-bottom:14px}
.ng-stats b{display:block;font:700 26px Fredoka}
.ng-bar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;align-items:center}
.ng-bar .sw{flex:1;min-width:180px}
.ng-pills{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.ng-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(168px,1fr));gap:14px}
.ng-card{background:#fff;border:3px solid var(--ink);border-radius:20px;box-shadow:0 4px 0 var(--ink);overflow:hidden;cursor:pointer;transition:transform .08s,box-shadow .08s;padding:0;text-align:left;font:inherit;color:inherit;min-width:0;display:block;width:100%}
.ng-card:hover{transform:translateY(2px);box-shadow:0 2px 0 var(--ink)}
.ng-img{position:relative;aspect-ratio:1/1;background:var(--sb);border-bottom:3px solid var(--ink);display:flex;align-items:center;justify-content:center;font-size:40px}
.ng-img img{width:100%;height:100%;object-fit:cover;display:block}
.ng-id{position:absolute;left:8px;top:8px;background:#fff;border:2px solid var(--ink);border-radius:99px;padding:0 9px;font:600 12px Fredoka}
.ng-st{position:absolute;right:8px;top:8px;border:2px solid var(--ink);border-radius:99px;padding:0 9px;font:600 12px Fredoka;background:#fff}
.ng-st.on{background:#7CF0A8}
.ng-info{padding:9px 11px 11px}
.ng-info b{display:block;font:600 15px Fredoka;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ng-r{display:inline-block;margin-top:5px;border:2px solid var(--ink);border-radius:99px;padding:0 10px;font:600 12px Fredoka}
.ng-more{text-align:center;margin-top:16px}
.ng-modal{position:fixed;inset:0;background:rgba(18,48,92,.5);z-index:470;display:flex;align-items:center;justify-content:center;padding:16px}
.ng-sheet{width:100%;max-width:440px;max-height:92vh;overflow-y:auto;padding:16px;background:var(--bg);text-align:center}
.ng-sheet .ng-big{width:100%;aspect-ratio:1/1;border:3px solid var(--ink);border-radius:20px;object-fit:cover;background:var(--sb);display:block;margin:8px 0 10px}
.ng-sheet h3{font-size:24px;margin:4px 0}
.ng-sheet .mint{margin:8px 0;font-size:12px;text-align:left}
.ng-sheet table{text-align:left;font-size:14px}
.ng-acts{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:12px}
@media(max-width:760px){
 .ng-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
 .ng-modal{align-items:flex-end;padding:10px 10px calc(10px + env(safe-area-inset-bottom))}
}
`;
document.head.appendChild(css);

const box=document.createElement('div');
box.id='nftGallery';
box.innerHTML='<div class="tag">collection</div><h2>FIJI NFT Gallery</h2>'+
 '<p class="small" style="margin-bottom:14px">All 250 FIJI characters. Minted ones are checked live on Solana Devnet (testing network).</p>'+
 '<div class="sticker card" id="ngBody"></div>';
host.after(box);
const body=$('ngBody');

function parseAssets(list){
  const out={};
  const dec=new TextDecoder();
  list.forEach(it=>{
    try{
      const bin=atob(it.account.data[0]);
      const b=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);
      const dv=new DataView(b.buffer);
      const owner=new solanaWeb3.PublicKey(b.slice(1,33)).toBase58();
      let p=34+32;
      const nl=dv.getUint32(p,true);p+=4;
      const name=dec.decode(b.slice(p,p+nl));p+=nl;
      const ul=dv.getUint32(p,true);p+=4;
      const uri=dec.decode(b.slice(p,p+ul));
      let nft=null;
      for(const [mid,n] of byMeta){if(uri.indexOf(mid)>=0){nft=n;break}}
      if(!nft)nft=byName.get(name.toLowerCase())||null;
      if(nft)out[nft.id]={asset:it.pubkey,owner,onName:name};
    }catch(e){console.warn('nft-gallery: could not read an asset',e)}
  });
  return out;
}

async function loadChain(){
  if(S.loading)return;
  S.loading=true;S.err='';render();
  try{
    const r=await fetch(DEVNET_RPC,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      jsonrpc:'2.0',id:1,method:'getProgramAccounts',
      params:[CORE_PROGRAM,{encoding:'base64',commitment:'confirmed',filters:[
        {memcmp:{offset:0,bytes:'2'}},
        {memcmp:{offset:34,bytes:COLLECTION}}
      ]}]
    })});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const j=await r.json();
    if(j.error)throw new Error(j.error.message||'RPC error');
    S.chain=parseAssets(j.result||[]);
    S.loaded=true;S.at=Date.now();
  }catch(e){
    console.warn('nft-gallery: devnet lookup failed',e);
    S.err='Could not reach Solana Devnet right now. Showing the artwork only 💧';
  }
  S.loading=false;render();
}

const minted=n=>Boolean(S.chain[n.id]);
function filtered(){
  const q=S.q.trim().toLowerCase();
  return NFTS.filter(n=>{
    if(S.rarity!=='All'&&n.rarity!==S.rarity)return false;
    if(S.status==='Minted'&&!minted(n))return false;
    if(S.status==='Not minted'&&minted(n))return false;
    if(q&&n.name.toLowerCase().indexOf(q)<0&&String(n.id)!==q.replace('#','').replace(/^0+/,'')&&pad3(n.id)!==q.replace('#',''))return false;
    return true;
  });
}

function card(n){
  const m=minted(n);
  return '<button type="button" class="ng-card" data-id="'+n.id+'">'+
   '<div class="ng-img"><img src="'+esc(n.img)+'" alt="'+esc(n.name)+'" loading="lazy" decoding="async" data-nid="'+n.id+'">'+
   '<span class="ng-id">#'+pad3(n.id)+'</span>'+
   '<span class="ng-st'+(m?' on':'')+'">'+(m?'Minted':S.loaded?'Not minted':'Preview')+'</span></div>'+
   '<div class="ng-info"><b>'+esc(n.name)+'</b><span class="ng-r" style="background:'+RCOL[n.rarity]+'">'+esc(n.rarity)+'</span></div></button>';
}

function render(){
  const list=filtered();
  const mintedCount=Object.keys(S.chain).length;
  const ctr=r=>NFTS.filter(n=>n.rarity===r).length;
  const pill=(grp,v,label)=>'<button class="mk-p'+(S[grp]===v?' on':'')+'" type="button" data-g="'+grp+'" data-v="'+esc(v)+'">'+label+'</button>';
  body.innerHTML=
   '<div class="ng-stats">'+
    '<div><b>'+NFTS.length+'</b><span class="small">Total</span></div>'+
    '<div><b>'+(S.loaded?mintedCount:'–')+'</b><span class="small">Minted (Devnet)</span></div>'+
    '<div><b>'+(S.loaded?NFTS.length-mintedCount:'–')+'</b><span class="small">Not minted</span></div>'+
    '<div><b>'+ctr('Legendary')+'</b><span class="small">Legendary</span></div></div>'+
   '<div class="ng-bar"><div class="sw"><i>🔎</i><input id="ngSearch" placeholder="Search name or number, e.g. 12" autocomplete="off" value="'+esc(S.q)+'"></div>'+
   '<button class="btn sm alt" type="button" data-a="refresh"'+(S.loading?' disabled':'')+'>'+(S.loading?'Checking…':'Refresh')+'</button></div>'+
   '<div class="ng-pills">'+pill('rarity','All','All')+RARITIES.map(r=>pill('rarity',r,r+' ('+ctr(r)+')')).join('')+'</div>'+
   '<div class="ng-pills">'+pill('status','All','All')+pill('status','Minted','✅ Minted')+pill('status','Not minted','⏳ Not minted')+'</div>'+
   (S.err?'<p class="small" style="margin-bottom:10px">'+esc(S.err)+'</p>':'')+
   (list.length
     ?'<div class="ng-grid">'+list.slice(0,S.shown).map(card).join('')+'</div>'+
      (list.length>S.shown?'<div class="ng-more"><button class="btn alt" type="button" data-a="more">Show more ('+(list.length-S.shown)+' left)</button></div>':'')
     :'<div class="empty-state"><div class="empty-icon">🐰</div><p class="small">No NFTs match this filter.</p></div>');
  const inp=$('ngSearch');
  if(inp&&document.activeElement===document.body&&S._focus){inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length)}
}

function openNft(id){
  const n=NFTS.find(x=>x.id===id);if(!n)return;
  const c=S.chain[n.id];
  const d=document.createElement('div');
  d.className='ng-modal';
  const ex=a=>'https://explorer.solana.com/address/'+a+'?cluster=devnet';
  d.innerHTML='<div class="sticker card ng-sheet">'+
   '<div style="display:flex;justify-content:space-between;align-items:center"><span class="pill">#'+pad3(n.id)+'</span><button class="btn sm alt" type="button" data-x>✕</button></div>'+
   '<img class="ng-big" src="'+esc(n.img)+'" alt="'+esc(n.name)+'" data-nid="'+n.id+'">'+
   '<h3>'+esc(n.name)+'</h3>'+
   '<span class="ng-r" style="background:'+RCOL[n.rarity]+';border:2px solid var(--ink);border-radius:99px;padding:0 12px;font:600 14px Fredoka">'+esc(n.rarity)+'</span>'+
   '<table style="margin-top:12px"><tr><td>Status</td><td>'+(c?'✅ Minted on Devnet':S.loaded?'⏳ Not minted yet':'Not checked')+'</td></tr>'+
   (c?'<tr><td>Owner</td><td>'+esc(short(c.owner))+'</td></tr><tr><td>Asset</td><td>'+esc(short(c.asset))+'</td></tr>':'')+
   '</table>'+
   '<div class="ng-acts">'+
   (c?'<a class="btn sm" href="'+esc(ex(c.asset))+'" target="_blank" rel="noopener">View on Explorer</a>':'')+
   '<a class="btn sm alt" href="'+esc(n.meta)+'" target="_blank" rel="noopener">Metadata</a>'+
   '<a class="btn sm alt" href="'+esc(n.img)+'" target="_blank" rel="noopener">Full image</a></div></div>';
  d.addEventListener('click',e=>{if(e.target===d||e.target.closest('[data-x]'))d.remove()});
  document.body.appendChild(d);
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.ng-modal').forEach(m=>m.remove())});

body.addEventListener('click',e=>{
  const g=e.target.closest('[data-g]');
  if(g){S[g.dataset.g]=g.dataset.v;S.shown=PAGE;S._focus=false;return render()}
  const a=e.target.closest('[data-a]');
  if(a){
    if(a.dataset.a==='refresh')return loadChain();
    if(a.dataset.a==='more'){S.shown+=PAGE;return render()}
  }
  const c=e.target.closest('.ng-card');
  if(c)openNft(Number(c.dataset.id));
});
body.addEventListener('input',e=>{
  if(e.target.id==='ngSearch'){S.q=e.target.value;S.shown=PAGE;S._focus=true;
    clearTimeout(S.t);S.t=setTimeout(()=>{render();const i=$('ngSearch');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length)}},200)}
});

const BACKUPS=['https://arweave.net/','https://ar-io.net/'];
document.addEventListener('error',e=>{
  const t=e.target;
  if(!t||t.tagName!=='IMG'||!t.dataset||!t.dataset.nid)return;
  const n=NFTS.find(x=>x.id===Number(t.dataset.nid));
  if(!n)return;
  const step=Number(t.dataset.s||0);
  if(step<BACKUPS.length){
    t.dataset.s=step+1;
    t.src=BACKUPS[step]+n.img.split('/').pop();
  }else{
    const sp=document.createElement('span');
    sp.textContent='🐰';
    t.replaceWith(sp);
  }
},true);

render();
let first=true;
function onShow(){
  if(!mkPage.classList.contains('on'))return;
  if(first||(Date.now()-S.at>60000&&!S.loading)){first=false;loadChain()}
}
new MutationObserver(onShow).observe(mkPage,{attributes:true,attributeFilter:['class']});
onShow();
window.FIJI_NFT_GALLERY={refresh:loadChain};
})();
