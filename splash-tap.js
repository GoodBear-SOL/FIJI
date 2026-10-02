/* ============================================================
   FIJI SPLASH TAP: SMILE + MOOD FACE + SPLASH EFFECT
   Load AFTER market-trade.js (last script in index.html):
     <script src="market-tab.js"></script>
     <script src="market-trade.js"></script>
     <script src="splash-tap.js"></script>

   Images (put them in the same folder as fiji.png):
     fiji-smile.png   Fiji smiling, shown while nobody is tapping
     fiji-hurt.png    face shown for a moment on every tap
                      (already used by the site today)
   Want more moods? Add more file names to TAP_FACES below.
   A random one is picked on each tap.

   Points rules are NOT changed: 10 taps = +5 points, 5 plays a day,
   wallet required. Only the look of the tap changes.
   ============================================================ */
(function(){
'use strict';

const C=window.FIJI_CORE||{};
const pad=document.getElementById('pad');
const bar=document.getElementById('tb');
if(!pad||!bar||!C.getWallet||typeof window.doEarn!=='function'){
  console.warn('splash-tap: load it after the core script');return;
}

/* ---------------- settings ---------------- */
const IDLE='fiji-smile.png';                 // smiling face while idle
const TAP_FACES=['fiji-hurt.png','fiji-shock.png','fiji-angry.png']; // faces used when tapped, e.g. ['fiji-hurt.png','fiji-shock.png']
const FACE_MS=350;                           // how long the tap face stays
const DROPS=8;                               // splash drops per tap
const FALLBACK=pad.getAttribute('src')||'fiji.png';

/* ---------------- styles ---------------- */
const css=document.createElement('style');
css.textContent=`
.st-wrap{position:relative;display:inline-block;vertical-align:middle;line-height:0}
.st-pop{animation:st-pop .35s ease}
@keyframes st-pop{0%{transform:scale(.85) rotate(-6deg)}50%{transform:scale(1.1) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
.st-p{position:absolute;left:50%;top:50%;font-size:20px;line-height:1;pointer-events:none;z-index:2;
 animation:st-fly .6s ease-out forwards}
@keyframes st-fly{
 0%{transform:translate(calc(-50% + var(--sx)),calc(-50% + var(--sy))) scale(.5);opacity:0}
 15%{opacity:1}
 100%{transform:translate(calc(-50% + var(--dx)),calc(-50% + var(--dy))) scale(1.1);opacity:0}}
.st-ring{position:absolute;left:50%;top:50%;border:3px solid var(--blue);border-radius:50%;pointer-events:none;z-index:1;
 transform:translate(-50%,-50%) scale(.8);animation:st-ring .5s ease-out forwards}
@keyframes st-ring{to{transform:translate(-50%,-50%) scale(1.3);opacity:0}}
@media(prefers-reduced-motion:reduce){.st-p,.st-ring{display:none}}
`;
document.head.appendChild(css);

/* ---------------- wrap the image so the splash can sit around it ---------------- */
const wrap=document.createElement('span');
wrap.className='st-wrap';
pad.parentNode.insertBefore(wrap,pad);
wrap.appendChild(pad);

/* ---------------- preload faces (missing files are skipped safely) ---------------- */
const ok={};
let faceTimer=null,tapping=false;
const idle=()=>ok[IDLE]?IDLE:FALLBACK;
[IDLE].concat(TAP_FACES).forEach(f=>{
  const i=new Image();
  i.onload=()=>{ok[f]=true;if(f===IDLE&&!tapping)pad.src=IDLE};
  i.src=f;
});

/* ---------------- tap visuals ---------------- */
function face(){
  const faces=TAP_FACES.filter(f=>ok[f]);
  tapping=true;
  clearTimeout(faceTimer);
  pad.classList.remove('st-pop');void pad.offsetWidth;pad.classList.add('st-pop');
  if(faces.length)pad.src=faces[Math.floor(Math.random()*faces.length)];
  faceTimer=setTimeout(()=>{tapping=false;pad.src=idle();pad.classList.remove('st-pop')},FACE_MS);
}

function splash(){
  const s=pad.offsetWidth||120;
  const made=[];

  const ring=document.createElement('span');
  ring.className='st-ring';
  ring.style.width=ring.style.height=s+'px';
  made.push(ring);

  const off=Math.random()*40;
  for(let i=0;i<DROPS;i++){
    const a=(i*360/DROPS+off+Math.random()*20-10)*Math.PI/180,c=Math.cos(a),n=Math.sin(a);
    const d=document.createElement('span');
    d.className='st-p';
    d.textContent=i%2?'💧':'💦';
    d.style.setProperty('--sx',(c*s*.3).toFixed(1)+'px');
    d.style.setProperty('--sy',(n*s*.3).toFixed(1)+'px');
    d.style.setProperty('--dx',(c*s*.58).toFixed(1)+'px');
    d.style.setProperty('--dy',(n*s*.58).toFixed(1)+'px');
    made.push(d);
  }
  made.forEach(el=>wrap.appendChild(el));
  setTimeout(()=>made.forEach(el=>el.remove()),700);
}

/* ---------------- the tap itself (same rules as before) ---------------- */
let taps=0;
window.tap=function(){
  if(!C.getWallet())return C.toast('Connect your wallet first');
  face();
  splash();
  bar.style.width=(++taps*10)+'%';
  if(taps>=10){
    taps=0;
    setTimeout(()=>bar.style.width='0',300);
    window.doEarn('game');
  }
};

})();
