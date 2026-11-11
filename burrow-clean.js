(function(){
'use strict';

const sec=document.getElementById('wallet');
if(!sec){console.warn('burrow-clean: #wallet not found');return}

const css=document.createElement('style');
css.textContent=`
.bc-pend{display:none!important}      /* pending BUN airdrop panel (bun-coin.js) */
#phAir{display:none!important}        /* BUN airdrop request box (phase-end.js) */
#earn{display:none!important}         /* old Earn page stays in the HTML only because other scripts read its ids */
`;
document.head.appendChild(css);

/* 2) Sweeper: remove cards/sections by their heading text */
const BAD=/mining|nft|referral|trade\s*(&|and)?\s*earn|strong\s*bunny|bun[\s-]*a[\s-]*mole|more to dig up|coming soon to the burrow/i;
const KEEP='#pad,#rwInv,#qsHub,#fmFarm,#bag,#plGrid,#plWheels';

function sweep(){
  sec.querySelectorAll('h2,h3,.tag').forEach(h=>{
    if(!h.isConnected||!BAD.test(h.textContent))return;

    // a whole "coming soon" block created as one wrapper directly inside #wallet
    const top=h.closest('#wallet > *');
    if(top&&/more to dig up|coming soon to the burrow/i.test(h.textContent)&&!top.querySelector(KEEP)){
      top.remove();return;
    }

    if(h.matches('h3')){
      const box=h.closest('.sticker,.card,.cs');
      if(box&&!box.querySelector(KEEP)&&box.textContent.length<700)box.remove();
      return;
    }

    // h2 / tag headings: remove the heading, its small tag, and the card right after it
    if(h.matches('h2')){
      const prev=h.previousElementSibling,next=h.nextElementSibling;
      if(prev&&prev.classList.contains('tag'))prev.remove();
      if(next&&next.matches('.sticker,.card')&&!next.querySelector(KEEP))next.remove();
      h.remove();
    }
  });
}

let t=0;
const queue=()=>{clearTimeout(t);t=setTimeout(sweep,80)};
new MutationObserver(queue).observe(sec,{childList:true,subtree:true});
window.addEventListener('load',sweep);
sweep();
})();
