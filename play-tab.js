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
.pl-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:stretch;margin-top:6px}
.pl-left{display:grid;grid-template-rows:auto 1fr;gap:0;min-width:0}
.pl-left>.pl-hd .tag{margin-top:0}
.pl-right{min-width:0}
.pl-left>.card{margin:0;text-align:center}

/* one compact panel: Daily check-in + Splash Tap side by side */
.pl-combo{padding:12px;height:100%}
.pl-combo-in{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pl-tile{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;padding:10px 8px;background:var(--soft);border:2.5px dashed var(--line);border-radius:18px;text-align:center}
.pl-tile .em{font-size:30px;line-height:1}
.pl-tile h3{font-size:16px;line-height:1.15;margin:0}
.pl-tile p{font-size:12px;line-height:1.3;margin:0;opacity:.8}
.pl-act{margin-top:auto;padding-top:4px;width:100%;display:flex;justify-content:center;align-items:center;flex-direction:column;gap:6px}
.pl-act .btn{padding:5px 14px;font-size:14px;min-height:0}
.pl-act #pad{width:64px;height:64px;object-fit:contain;cursor:pointer;display:block}
.pl-act .bar{width:100%;max-width:120px;margin:0}

.pl-soon{text-align:center;border-style:dashed;background:var(--soft);box-shadow:0 6px 0 var(--line);border-color:var(--ink)}
.pl-soon .pill{font-size:12px;letter-spacing:.08em;padding:1px 12px;transform:rotate(-2deg)}
.pl-soon .em{font-size:44px;line-height:1;margin-top:8px}
.pl-soon h3{margin:8px 0 4px}
.pl-soon p{font-size:15px;opacity:.8;margin:0}
.pl-lock{display:inline-block;margin-top:12px;border:2.5px dashed var(--ink);border-radius:99px;padding:4px 16px;font:600 14px Fredoka;background:#fff;opacity:.7}
@media(min-width:761px){
 .pl-combo-in{grid-template-columns:1fr;grid-auto-rows:1fr;height:100%}
 .pl-act #pad{width:88px;height:88px}
}
@media(max-width:760px){
 .pl-grid{grid-template-columns:1fr}
 .pl-left{grid-template-rows:auto}
 .pl-combo{padding:10px}
 .pl-combo-in{gap:8px}
 .pl-tile{padding:8px 6px}
 .pl-tile .em{font-size:26px}
 .pl-tile h3{font-size:15px}
 .pl-tile p{font-size:11.5px}
 .pl-act .btn{min-height:36px}
 .pl-act #pad{width:56px;height:56px}
}
`;
document.head.appendChild(css);

const checkin=[...earn.querySelectorAll('.grid > .card')].find(c=>/daily check-in/i.test(c.textContent));
const splash=pad.closest('.card');
if(!checkin||!splash){
  console.warn('play-tab: could not find the Daily check-in or Splash Tap card');
  return;
}
const checkBtn=checkin.querySelector('button');
const padWrap=pad.closest('.st-wrap')||pad;
const barEl=splash.querySelector('.bar');

const combo=document.createElement('div');
combo.className='sticker card pl-combo';
combo.id='plCombo';
combo.innerHTML=
 '<div class="pl-combo-in">'+
  '<div class="pl-tile"><div class="em">📅</div><h3>Daily check-in</h3>'+
   '<p>Up to +300 BUN and +1000 BunXP. Miss a day and the streak resets.</p>'+
   '<div class="pl-act" id="plCheckAct"></div></div>'+
  '<div class="pl-tile"><div class="em">🎮</div><h3>Splash Tap</h3>'+
   '<p>Tap Fiji 10 times for +1 💧 and +30 BunXP (5 plays every 6 hours)</p>'+
   '<div class="pl-act" id="plTapAct"></div></div>'+
 '</div>';
if(checkBtn)combo.querySelector('#plCheckAct').appendChild(checkBtn);
const tapAct=combo.querySelector('#plTapAct');
tapAct.appendChild(padWrap);
if(barEl)tapAct.appendChild(barEl);

const grid=document.createElement('div');
grid.id='plGrid';
grid.className='pl-grid';
const left=document.createElement('div');left.className='pl-left';
const right=document.createElement('div');right.className='pl-right';
hub.parentNode.insertBefore(grid,hub); 
const it=inv.querySelector('.tag'),ih=inv.querySelector('h2');
if(it||ih){
  const hd=document.createElement('div');
  hd.className='pl-hd';
  hd.innerHTML=(it?'<div class="'+it.className+'">play</div>':'')+(ih?'<h2>Daily play</h2>':'');
  left.append(hd);
}
left.append(combo);
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
