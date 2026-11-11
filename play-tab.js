(function(){
'use strict';

const $=id=>document.getElementById(id);
const sec=$('wallet'),earn=$('earn'),inv=$('rwInv'),hub=$('qsHub'),pad=$('pad');
if(!sec||!earn||!inv||!hub||!pad){
  console.warn('play-tab: some page parts are missing. Load it after profile-tab.js');
  return;
}
if($('plGrid'))return;

const css=document.createElement('style');
css.textContent=`
.pl-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;margin-top:6px}
.pl-left{display:grid;gap:18px;min-width:0}
.pl-right{min-width:0}
.pl-left>.card{margin:0;text-align:center}
.pl-left>.card .btn{margin-top:4px}
.pl-soon{text-align:center;border-style:dashed;background:var(--soft);box-shadow:0 6px 0 var(--line);border-color:var(--ink)}
.pl-soon .pill{font-size:12px;letter-spacing:.08em;padding:1px 12px;transform:rotate(-2deg)}
.pl-soon .em{font-size:44px;line-height:1;margin-top:8px}
.pl-soon h3{margin:8px 0 4px}
.pl-soon p{font-size:15px;opacity:.8;margin:0}
.pl-lock{display:inline-block;margin-top:12px;border:2.5px dashed var(--ink);border-radius:99px;padding:4px 16px;font:600 14px Fredoka;background:#fff;opacity:.7}
@media(max-width:760px){.pl-grid{grid-template-columns:1fr}}
`;
document.head.appendChild(css);

const checkin=[...earn.querySelectorAll('.grid > .card')].find(c=>/daily check-in/i.test(c.textContent));
const splash=pad.closest('.card');
if(!checkin||!splash){
  console.warn('play-tab: could not find the Daily check-in or Splash Tap card');
  return;
}

const grid=document.createElement('div');
grid.id='plGrid';
grid.className='pl-grid';
const left=document.createElement('div');left.className='pl-left';
const right=document.createElement('div');right.className='pl-right';
hub.parentNode.insertBefore(grid,hub); 
left.append(checkin,splash);
right.append(inv);
grid.append(left,right);

const wheels=document.createElement('div');
wheels.id='plWheels';
wheels.innerHTML=
 '<div class="tag">wheels</div><h2>Spin the wheels</h2>'+
 '<div class="grid">'+
  '<div class="sticker card pl-soon"><span class="pill">COMING SOON</span><div class="em">🎡</div><h3>Lucky Wheel</h3>'+
   '<p>Classic Wheel</p><span class="pl-lock">🔒 Locked</span></div>'+
  '<div class="sticker card pl-soon"><span class="pill">COMING SOON</span><div class="em">🌟</div><h3>Jackpot Wheel</h3>'+
   '<p>A bigger wheel with bigger prizes.</p><span class="pl-lock">🔒 Locked</span></div>'+
 '</div>';
hub.after(wheels);

window.openMarket=function(tab){
  if(window.FIJI_FARM&&typeof window.FIJI_FARM.open==='function')window.FIJI_FARM.open('market',tab||'seeds');
  else if(window.FIJI_CORE&&window.FIJI_CORE.toast)window.FIJI_CORE.toast('The Market is still loading. Try again in a moment 🌱');
};
})();
