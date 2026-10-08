/* ============================================================
   FIJI BUN COIN  v1   (total BUN on top of the Burrow inventory)

   Load AFTER reward-box.js (it adds itself to the Inventory card):
     <script src="reward-box.js"></script>
     <script src="bun-coin.js"></script>

   Put your coin picture in the same folder as fiji.png:
     BUN COIN.png     gold coin with the navy bunny
   If that file is missing, a matching gold coin with a navy bunny
   is drawn instead, so the panel always looks right.

   What it does:
   - Shows the connected wallet's total BUN at the TOP of the
     Inventory card in the Burrow tab (same number as the Earn tab).
   - Coin effects:
       * floats up and down with a soft gold glow
       * a shine sweeps across the coin every few seconds
       * little sparkles twinkle around it
       * tap / click the coin: it spins and bursts with mini coins
       * when BUN goes up the number counts up, the coin pops and
         coins rain
   - BUN stays "for fun, no cash value". Nothing about points rules
     is changed. This file only reads the balance.
   Nothing in the other files is changed.
   ============================================================ */
(function(){
'use strict';

const C=window.FIJI_CORE||{};
const $=id=>document.getElementById(id);
const inv=$('rwInv');
const pts=$('spts');
if(!inv||!pts||!C.getWallet){
  console.warn('bun-coin: load it after reward-box.js');
  return;
}

/* ---------------- settings ---------------- */
const COIN_FILE='BUN COIN.png';
const COIN_SRC=encodeURI(COIN_FILE);     // handles the space in the file name
const BURST=10;                           // mini coins per tap
const COUNT_MS=900;                       // count-up time

/* ---------------- styles ---------------- */
const css=document.createElement('style');
css.textContent=`
.bc-panel{display:flex;align-items:center;gap:16px;padding:12px 14px;margin:0 0 14px;background:var(--sb);border:3px solid var(--ink);border-radius:22px;box-shadow:inset 0 4px 0 rgba(18,48,92,.1)}
.bc-stage{position:relative;flex:none;width:96px;height:96px;perspective:600px;display:flex;align-items:center;justify-content:center}
.bc-glow{position:absolute;inset:6px;border-radius:50%;background:radial-gradient(circle,rgba(255,210,31,.75),rgba(255,210,31,0) 70%);animation:bcGlow 2.4s ease-in-out infinite;pointer-events:none}
.bc-float{position:relative;width:84px;height:84px;animation:bcFloat 3.2s ease-in-out infinite}
.bc-coin{position:relative;display:block;width:100%;height:100%;padding:0;border:0;background:none;cursor:pointer;border-radius:50%;transform-style:preserve-3d;-webkit-tap-highlight-color:transparent;filter:drop-shadow(0 5px 0 rgba(18,48,92,.35))}
.bc-coin:focus-visible{outline:3px solid var(--blue);outline-offset:3px}
.bc-coin>img,.bc-coin>svg{display:block;width:100%;height:100%;border-radius:50%;object-fit:contain;user-select:none;-webkit-user-drag:none;pointer-events:none}
.bc-coin.spin{animation:bcSpin .9s cubic-bezier(.3,.7,.3,1)}
.bc-coin.pop{animation:bcPop .7s cubic-bezier(.2,.9,.3,1.3)}
.bc-shine{position:absolute;inset:0;border-radius:50%;overflow:hidden;pointer-events:none}
.bc-shine:after{content:"";position:absolute;top:-20%;bottom:-20%;left:-60%;width:38%;background:linear-gradient(100deg,rgba(255,255,255,0),rgba(255,255,255,.85),rgba(255,255,255,0));transform:skewX(-18deg);animation:bcShine 4.2s ease-in-out infinite}
.bc-sp{position:absolute;font-size:15px;line-height:1;pointer-events:none;opacity:0;animation:bcTwinkle 2.6s ease-in-out infinite}
.bc-sp:nth-child(2){left:4px;top:10px;animation-delay:.2s}
.bc-sp:nth-child(3){right:2px;top:22px;animation-delay:1s;font-size:12px}
.bc-sp:nth-child(4){left:10px;bottom:8px;animation-delay:1.7s;font-size:11px}
.bc-sp:nth-child(5){right:8px;bottom:4px;animation-delay:.6s}
.bc-info{min-width:0;flex:1}
.bc-label{font:600 13px Fredoka,sans-serif;letter-spacing:.1em;text-transform:uppercase;opacity:.7}
.bc-num{font:700 clamp(34px,9vw,46px)/1.05 Fredoka,sans-serif;word-break:break-all;transition:color .3s}
.bc-num.up{color:var(--upi)}
.bc-sub{margin-top:2px}
.bc-mini{position:absolute;left:50%;top:50%;width:18px;height:18px;margin:-9px 0 0 -9px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FFF1A8,#FFD21F 55%,#C98F00);border:2px solid var(--ink);pointer-events:none;z-index:3;animation:bcFly .9s cubic-bezier(.2,.7,.3,1) forwards}
.bc-mini:after{content:"";position:absolute;left:5px;top:3px;width:5px;height:8px;border-radius:50% 50% 40% 40%;background:#12305C}
.bc-rain{position:absolute;top:-8px;width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#FFF1A8,#FFD21F 55%,#C98F00);border:2px solid var(--ink);pointer-events:none;z-index:3;animation:bcRain 1.3s ease-in forwards}
.bc-panel{position:relative;overflow:visible}
@keyframes bcFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-7px) rotate(2deg)}}
@keyframes bcGlow{0%,100%{opacity:.45;transform:scale(.92)}50%{opacity:.95;transform:scale(1.12)}}
@keyframes bcShine{0%,55%{left:-60%}85%,100%{left:130%}}
@keyframes bcTwinkle{0%,100%{opacity:0;transform:scale(.3) rotate(0)}50%{opacity:1;transform:scale(1.1) rotate(25deg)}}
@keyframes bcSpin{0%{transform:rotateY(0) scale(1)}50%{transform:rotateY(540deg) scale(1.2)}100%{transform:rotateY(1080deg) scale(1)}}
@keyframes bcPop{0%{transform:scale(1)}35%{transform:scale(1.3) rotate(-8deg)}70%{transform:scale(.94) rotate(4deg)}100%{transform:scale(1)}}
@keyframes bcFly{0%{transform:translate(0,0) scale(.5);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(300deg);opacity:0}}
@keyframes bcRain{0%{transform:translateY(0) rotate(0);opacity:1}100%{transform:translateY(120px) rotate(360deg);opacity:0}}
@media(max-width:760px){
 .bc-stage{width:84px;height:84px}
 .bc-float{width:74px;height:74px}
 .bc-panel{gap:12px;padding:10px 12px}
}
@media(prefers-reduced-motion:reduce){.bc-shine,.bc-sp,.bc-mini,.bc-rain,.bc-glow{display:none}}
`;
document.head.appendChild(css);

/* ---------------- fallback coin (gold, navy bunny) ---------------- */
const FALLBACK_SVG=
'<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
 '<defs>'+
  '<linearGradient id="bcG1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1A8"/><stop offset=".45" stop-color="#FFD21F"/><stop offset="1" stop-color="#B9820A"/></linearGradient>'+
  '<linearGradient id="bcG2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE680"/><stop offset="1" stop-color="#D9A010"/></linearGradient>'+
  '<linearGradient id="bcG3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2A3F96"/><stop offset="1" stop-color="#0B1B5E"/></linearGradient>'+
 '</defs>'+
 '<circle cx="50" cy="50" r="48" fill="url(#bcG1)" stroke="#8A5F00" stroke-width="1.5"/>'+
 '<circle cx="50" cy="50" r="42" fill="url(#bcG2)" stroke="#B9820A" stroke-width="2"/>'+
 '<circle cx="50" cy="50" r="38" fill="none" stroke="#FFF1A8" stroke-width="1" opacity=".7"/>'+
 '<path d="M36 52 C27 40 26 22 33 14 C41 10 46 20 47 31 L47 41 Z" fill="url(#bcG3)" stroke="#8A5F00" stroke-width=".8"/>'+
 '<path d="M64 52 C73 40 74 22 67 14 C59 10 54 20 53 31 L53 41 Z" fill="url(#bcG3)" stroke="#8A5F00" stroke-width=".8"/>'+
 '<ellipse cx="50" cy="63" rx="21" ry="19" fill="url(#bcG3)" stroke="#8A5F00" stroke-width=".8"/>'+
'</svg>';

/* ---------------- panel ---------------- */
const panel=document.createElement('div');
panel.className='bc-panel';
panel.id='bcPanel';
panel.innerHTML=
 '<div class="bc-stage">'+
  '<div class="bc-glow"></div>'+
  '<span class="bc-sp">✨</span><span class="bc-sp">✨</span><span class="bc-sp">✨</span><span class="bc-sp">✨</span>'+
  '<div class="bc-float"><button type="button" class="bc-coin" id="bcCoin" aria-label="BUN coin. Tap to spin it."><span id="bcFace"></span><span class="bc-shine"></span></button></div>'+
 '</div>'+
 '<div class="bc-info">'+
  '<div class="bc-label">Total BUN earned</div>'+
  '<div class="bc-num" id="bcNum">0</div>'+
  '<div class="small bc-sub" id="bcSub">Connect your wallet to see your BUN.</div>'+
 '</div>';

/* Goes to the very top of the Inventory card */
const card=inv.querySelector('.card');
if(card)card.prepend(panel);else inv.appendChild(panel);

const coin=$('bcCoin'),face=$('bcFace'),numEl=$('bcNum'),sub=$('bcSub');

/* Coin face: your picture first, drawn coin if the file is missing */
function useFallback(){face.innerHTML=FALLBACK_SVG}
(function loadFace(){
  const img=new Image();
  img.alt='';img.draggable=false;
  img.onload=()=>{face.innerHTML='';face.appendChild(img)};
  img.onerror=useFallback;
  useFallback();             // show something right away
  img.src=COIN_SRC;
})();

/* ---------------- effects ---------------- */
function restart(cls){
  coin.classList.remove('spin','pop');
  void coin.offsetWidth;
  coin.classList.add(cls);
  setTimeout(()=>coin.classList.remove(cls),1000);
}

function burst(){
  const made=[];
  const off=Math.random()*40;
  for(let i=0;i<BURST;i++){
    const a=(i*360/BURST+off+Math.random()*20-10)*Math.PI/180;
    const r=46+Math.random()*34;
    const el=document.createElement('span');
    el.className='bc-mini';
    el.style.setProperty('--dx',(Math.cos(a)*r).toFixed(1)+'px');
    el.style.setProperty('--dy',(Math.sin(a)*r-12).toFixed(1)+'px');
    made.push(el);
  }
  const stage=panel.querySelector('.bc-stage');
  made.forEach(el=>stage.appendChild(el));
  setTimeout(()=>made.forEach(el=>el.remove()),1000);
}

function rain(){
  const made=[];
  for(let i=0;i<8;i++){
    const el=document.createElement('span');
    el.className='bc-rain';
    el.style.left=(8+Math.random()*80)+'%';
    el.style.animationDelay=(Math.random()*.4).toFixed(2)+'s';
    made.push(el);
  }
  made.forEach(el=>panel.appendChild(el));
  setTimeout(()=>made.forEach(el=>el.remove()),1900);
}

coin.addEventListener('click',()=>{
  restart('spin');
  burst();
});

/* ---------------- balance ---------------- */
let shown=0,target=0,raf=0,first=true;

function fmt(n){return Math.round(n).toLocaleString()}

function countTo(to){
  cancelAnimationFrame(raf);
  const from=shown,t0=performance.now();
  const up=to>from;
  if(up)numEl.classList.add('up');
  const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  if(reduce||from===to){shown=to;numEl.textContent=fmt(to);numEl.classList.remove('up');return}
  const step=now=>{
    const k=Math.min(1,(now-t0)/COUNT_MS),e=1-Math.pow(1-k,3);
    shown=from+(to-from)*e;
    numEl.textContent=fmt(shown);
    if(k<1)raf=requestAnimationFrame(step);
    else{shown=to;numEl.textContent=fmt(to);setTimeout(()=>numEl.classList.remove('up'),500)}
  };
  raf=requestAnimationFrame(step);
}

function read(){
  const connected=Boolean(C.getWallet());
  const n=connected?Number(String(pts.textContent).replace(/[^\d.-]/g,'')):0;
  const v=Number.isFinite(n)&&n>0?n:0;

  sub.textContent=connected
    ?'Yours to use on future purchases. For fun, no cash value.'
    :'Connect your wallet to see your BUN.';

  if(v===target&&!first)return;
  const gained=v>target;
  target=v;
  countTo(v);
  if(!first&&gained){restart('pop');burst();rain()}
  first=false;
}

/* The Earn tab number changes whenever BUN is earned, so follow it */
new MutationObserver(read).observe(pts,{childList:true,characterData:true,subtree:true});
setInterval(read,1000);   // also catches wallet connect / disconnect
read();

window.FIJI_BUNCOIN={refresh:read,spin:()=>{restart('spin');burst()}};
})();
