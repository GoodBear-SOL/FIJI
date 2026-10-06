/* ============================================================
   FIJI EARN TAB LAYOUT  v1
   Load LAST in index.html (after chat.js):
     <script src="earn-tab.js"></script>

   - Gives all Earn blocks the same size, alignment and spacing
     (4 per row on desktop, 2 on tablet, 1 on phones).
   - Pins buttons / progress bar to the bottom of each block.
   - Adds four "Coming soon" blocks.
   Existing blocks keep their ids, so splash-tap.js, gifts.js and
   the daily check-in keep working untouched.
   ============================================================ */
(function(){
'use strict';

const sec=document.getElementById('earn');
const grid=sec&&sec.querySelector('.grid');
if(!grid||grid.dataset.es)return;
grid.dataset.es='1';

/* ---------------- styles ---------------- */
const css=document.createElement('style');
css.textContent=`
#earn .grid{grid-template-columns:repeat(4,1fr);align-items:stretch;gap:18px}
#earn .grid > .card{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:20px 16px;overflow:visible}
#earn .grid > .card .em{font-size:38px;line-height:1}
#earn .grid > .card h3{font-size:21px;line-height:1.15;margin:0}
#earn .grid > .card p{font-size:15px;line-height:1.4;margin:0}
#earn .grid > .card br{display:none}
#earn .grid > .card input{margin:4px 0 0;text-align:center;font-size:14px}
#earn .grid > .card > .btn{margin-top:auto}
#earn .grid > .card > .bar{width:100%;margin-top:auto}
#earn .grid > .card #pad{margin:2px 0}
#earn .grid > .card #ref{margin-top:auto}
#earn .grid > .card #ref + .btn{margin-top:0}

/* coming soon blocks */
#earn .es-soon{border-style:dashed;background:var(--soft);box-shadow:0 6px 0 var(--line);border-color:var(--ink)}
#earn .es-soon > *:not(.pill){opacity:.8}
#earn .es-soon .pill{font-size:12px;letter-spacing:.08em;padding:1px 12px;transform:rotate(-2deg);opacity:1}
#earn .es-lock{margin-top:auto;border:2.5px dashed var(--ink);border-radius:99px;padding:4px 16px;font:600 14px Fredoka;background:#fff;opacity:.7}

@media(max-width:980px){#earn .grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){#earn .grid{grid-template-columns:1fr}}
`;
document.head.appendChild(css);

/* ---------------- tidy the existing blocks ---------------- */
/* Some blocks have the emoji inline in the title. Move it up so every block has the same header. */
const EMO=/^\s*(\p{Extended_Pictographic}[\uFE0F\u200D\p{Extended_Pictographic}]*)\s*/u;
grid.querySelectorAll(':scope > .card').forEach(card=>{
  if(card.querySelector('.em'))return;
  const h=card.querySelector('h3');
  if(!h||h.children.length)return;
  const m=h.textContent.match(EMO);
  if(!m)return;
  const em=document.createElement('div');
  em.className='em';em.textContent=m[1];
  h.textContent=h.textContent.replace(EMO,'');
  card.insertBefore(em,h);
});
/* Inline style on the Splash Tap block is no longer needed */
grid.querySelectorAll(':scope > .card[style]').forEach(c=>c.style.removeProperty('text-align'));

/* ---------------- coming soon blocks (edit freely) ---------------- */
const SOON=[
  {em:'🎯',t:'Weekly Quests',d:'Simple community goals that earn bonus points.'},
  {em:'🏅',t:'Bunny Badges',d:'Collect badges for streaks, trades and referrals.'},
  {em:'🎡',t:'Lucky Spin',d:'A fun daily spin for a chance at extra points.'},
  {em:'🥕',t:'Team Hops',d:'Hop together with the community to unlock shared goals.'}
];
SOON.forEach(s=>{
  const d=document.createElement('div');
  d.className='sticker card es-soon';
  d.innerHTML='<span class="pill">COMING SOON</span><div class="em">'+s.em+'</div><h3>'+s.t+'</h3><p>'+s.d+'</p><span class="es-lock">🔒 Locked</span>';
  grid.appendChild(d);
});

const note=document.createElement('p');
note.className='small';note.style.marginTop='14px';
note.textContent='Coming soon blocks are not live yet. Points are for community fun only and no rewards are promised.';
grid.after(note);

})();
