/* ============================================================
   FIJI MARKET COIN POPUP: TRADE BUTTON + STATUS + BENEFITS
   Load AFTER market-tab.js (last script in index.html):
     <script src="tradepad.js"></script>
     <script src="tradepad-popup.js"></script>
     <script src="tradepad-gate.js"></script>
     <script src="market-tab.js"></script>
     <script src="market-trade.js"></script>

   What it does (only the popup that opens when a coin is clicked
   on the Market tab):
   - Adds a "Coin status" block (age, holders, top 10, risk, flags)
     for Solana coins, same data source as the Trade tab (RugCheck).
   - Adds a "Trade on Fiji" benefits box: +50 points per trade.
   - Adds a "Trade on Fiji" button that opens the coin in the
     Trade Pad, ready to buy or sell.
   Nothing in index.html or the other files is changed.
   ============================================================ */
(function(){
'use strict';

const C=window.FIJI_CORE||{};
if(typeof window.openPair!=='function'||typeof MK==='undefined'||!C.go){
  console.warn('market-trade: load it after market-tab.js');return;
}

const SOL_MINT='So11111111111111111111111111111111111111112';
const RC='https://api.rugcheck.xyz/v1/tokens/';

const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{if(v==null||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};

/* ---------------- styles (same sticker look as the site) ---------------- */
const css=document.createElement('style');
css.textContent=`
.mt-box{margin:12px 0}
.mt-h{font:600 14px Fredoka;letter-spacing:.1em;text-transform:uppercase;color:var(--blue);margin:0 0 6px}
.mt-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(92px,1fr));gap:7px}
.mt-c{background:var(--sb);border:2px solid var(--ink);border-radius:13px;padding:7px 8px;min-width:0}
.mt-c b{display:block;font:600 15px Fredoka;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mt-c span{display:block;font-size:11px;opacity:.7}
.mt-c.good{background:#B8F5D2}
.mt-c.warn{background:#FFF1B8}
.mt-c.bad{background:#FFD0D8}
.mt-c.na{opacity:.6}
.mt-ben{background:#FFF6CF;border:2.5px dashed var(--ink);border-radius:16px;padding:12px 14px}
.mt-ben b{font:700 18px Fredoka;display:block;margin-bottom:2px}
.mt-ben p{font-size:14px;margin:2px 0}
.mt-ben .small{font-size:12px}
.mt-note{background:var(--soft);border:2px dashed var(--line);border-radius:14px;padding:10px 12px;font-size:14px}
`;
document.head.appendChild(css);

/* ---------------- status cells ---------------- */
const cell=(label,val,tone,tip)=>`<div class="mt-c ${tone||''}"${tip?` title="${esc(tip)}"`:''}><b>${esc(val)}</b><span>${label}</span></div>`;

function ageText(ts){
  const n=Number(ts);if(!n)return '—';
  const s=Math.max(1,Math.floor((Date.now()-(n<1e12?n*1000:n))/1000));
  const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);
  return d?d+'d '+h+'h':h?h+'h '+m+'m':m?m+'m':s+'s';
}
function usd(v){
  const n=num(v);if(n===null||n<=0)return '—';
  return '$'+(n>=1e9?(n/1e9).toFixed(2)+'B':n>=1e6?(n/1e6).toFixed(2)+'M':n>=1e3?(n/1e3).toFixed(1)+'K':n.toFixed(0));
}

function statsHtml(p,rc,state){
  const loading=state==='loading';
  const pick=f=>loading?['…','']:rc?f(rc):['—','na','Security data unavailable right now'];
  const known=(rc&&rc.knownAccounts)||{};
  const isPool=h=>{const k=known[h.address]||known[h.owner];return k&&/amm|pool|lp/i.test((k.type||'')+' '+(k.name||''))};

  const holders=pick(r=>{
    const n=num(r.totalHolders);
    return n===null?['—','na','Holder count not available yet']:[n.toLocaleString(),'','Total holder wallets (RugCheck)'];
  });
  const top=pick(r=>{
    const hs=(r.topHolders||[]).filter(h=>!isPool(h));
    if(!hs.length)return ['—','na','No holder data'];
    const t=hs.slice(0,10).reduce((s,h)=>s+(Number(h.pct)||0),0);
    return [t.toFixed(1)+'%',t>50?'bad':t>30?'warn':'good','Top 10 wallets, liquidity pools excluded'];
  });
  const risks=(rc&&rc.risks)||[];
  const danger=risks.filter(x=>x.level==='danger').length,warn=risks.filter(x=>x.level==='warn').length;
  const flags=pick(r=>{
    if(r.rugged)return ['Rugged','bad','RugCheck marks this token as rugged'];
    return [danger?danger+' found':'None',danger?'bad':'good','Danger-level flags from RugCheck'];
  });
  const risk=pick(r=>{
    if(r.rugged)return ['Rugged','bad'];
    return danger?['High','bad']:warn?['Medium','warn']:['Low','good'];
  });

  return cell('Liquidity',usd(p.liquidity&&p.liquidity.usd))+
    cell('Age',ageText(p.pairCreatedAt),'','Since the pair or launch was created')+
    cell('Holders',holders[0],holders[1],holders[2])+
    cell('Top 10',top[0],top[1],top[2])+
    cell('Scam flags',flags[0],flags[1],flags[2])+
    cell('Risk',risk[0],risk[1]);
}

async function getRug(mint){
  const ac=new AbortController(),t=setTimeout(()=>ac.abort(),10000);
  try{
    const r=await fetch(RC+encodeURIComponent(mint)+'/report',{signal:ac.signal});
    if(!r.ok)throw new Error('HTTP '+r.status);
    return await r.json();
  }finally{clearTimeout(t)}
}

/* ---------------- open the coin in the Trade Pad ---------------- */
function openTrade(p){
  const mint=p.baseToken&&p.baseToken.address;
  if(!mint)return C.toast&&C.toast('Token address unavailable');
  closePair();
  C.go('trade');
  const st=window.FIJI_TRADE&&window.FIJI_TRADE.getState&&window.FIJI_TRADE.getState();
  if(!st||typeof window.tradeSelectByKey!=='function')return C.toast&&C.toast('Trade Pad is still loading. Try again in a moment 💧');
  st.base=[{...p},...st.base.filter(x=>!x.baseToken||x.baseToken.address!==mint)];   // lets the Trade Pad find this coin
  window.tradeSelectByKey('solana:'+mint);
}

/* ---------------- decorate the Market popup ---------------- */
function decorate(k){
  const p=MK.pairs[k];
  const sheet=document.querySelector('.mk-modal .mk-sheet');
  if(!p||!sheet||sheet.dataset.mt)return;
  sheet.dataset.mt='1';

  const mint=p.baseToken&&p.baseToken.address;
  const isSol=p.chainId==='solana'&&mint&&mint!==SOL_MINT;
  const anchor=sheet.querySelector('table');
  const acts=sheet.querySelector('.mk-acts');
  if(!anchor)return;

  const box=document.createElement('div');
  box.className='mt-box';

  if(isSol){
    box.innerHTML=
      '<div class="mt-h">Coin status</div><div class="mt-stats" id="mtStats">'+statsHtml(p,null,'loading')+'</div>'+
      '<p class="small" style="margin-top:6px">Informational only. No check can guarantee a token is safe.</p>'+
      '<div class="mt-ben" style="margin-top:12px"><b>⭐ Trade here, earn points</b>'+
      '<p>+50 points for every successful buy or sell on the Fiji Trade Pad.</p>'+
      '<p class="small">Only trades made through the Fiji Trade Pad count. Points are for community fun only and have no cash value.</p></div>';
  }else if(mint===SOL_MINT){
    box.innerHTML='<div class="mt-note">SOL is the coin you pay with on the Trade Pad. Pick any Solana token to trade and earn <b>+50 points</b> per trade.</div>';
  }else{
    box.innerHTML='<div class="mt-note">The Fiji Trade Pad supports <b>Solana</b> tokens only, so this coin can’t be traded here yet. You can still follow it on DexScreener.</div>';
  }
  anchor.after(box);

  if(isSol&&acts){
    const b=document.createElement('button');
    b.type='button';b.className='btn sm';b.textContent='⚡ Trade on Fiji (+50 pts)';
    b.onclick=()=>openTrade(p);
    acts.prepend(b);

    getRug(mint).then(rc=>{
      const el=box.querySelector('#mtStats');
      if(el&&box.isConnected)el.innerHTML=statsHtml(p,rc,'ok');
    }).catch(()=>{
      const el=box.querySelector('#mtStats');
      if(el&&box.isConnected)el.innerHTML=statsHtml(p,null,'ok');
    });
  }
}

const orig=window.openPair;
window.openPair=function(k){
  const r=orig.apply(this,arguments);
  try{decorate(k)}catch(e){console.warn('market-trade failed',e)}
  return r;
};

})();
