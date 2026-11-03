(function(){
'use strict';

/* Fixes the Swap box icons:
   - SOL icon: built-in logo (no solana.svg file needed)
   - Token icon: real logo of the selected token (FIJI uses fiji.png) */

const C=window.FIJI_CORE||{},T=window.FIJI_TRADE;
const FIJI=(C.CFG&&C.CFG.FIJI_MINT)||'';
const $=id=>document.getElementById(id);
const https=u=>/^https:\/\//i.test(u||'')?String(u):'';

const SOL_SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'+
 '<defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#9945FF"/><stop offset="1" stop-color="#14F195"/></linearGradient></defs>'+
 '<circle cx="50" cy="50" r="50" fill="#0d0d12"/>'+
 '<g transform="translate(18.2 25) scale(.16)" fill="url(#g)">'+
 '<path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>'+
 '<path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>'+
 '<path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>'+
 '</g></svg>';
const SOL_URI='data:image/svg+xml;utf8,'+encodeURIComponent(SOL_SVG);

const css=document.createElement('style');
css.textContent=`
.swap-dot{overflow:hidden;padding:0}
.swap-dot img.tk-ic{width:100%;height:100%;object-fit:cover;border-radius:50%;display:block}
`;
document.head.appendChild(css);

const bad=new Set();

function paintDot(dot,src,fallback){
  if(!dot)return;
  if(src&&bad.has(src))src='';
  const tag=src?'img:'+src:'fb:'+fallback;
  if(dot.dataset.ic===tag)return;
  dot.dataset.ic=tag;
  dot.textContent='';
  if(src){
    const i=new Image();
    i.className='tk-ic';i.alt='';
    i.onerror=()=>{bad.add(src);dot.dataset.ic='';};
    i.src=src;
    dot.appendChild(i);
  }else{
    dot.textContent=fallback;
  }
}

function sync(){
  /* any leftover Solana images (balance chip, nav balance) */
  document.querySelectorAll('img.solana-icon,.sol-icon img').forEach(i=>{
    if(i.getAttribute('src')!==SOL_URI)i.setAttribute('src',SOL_URI);
  });

  const payAsset=$('tradePayAsset'),recAsset=$('tradeReceiveAsset');
  if(!payAsset||!recAsset)return;
  const payDot=payAsset.parentNode.querySelector('.swap-dot');
  const recDot=recAsset.parentNode.querySelector('.swap-dot');
  const sell=!!($('sellTab')&&$('sellTab').classList.contains('on'));

  let tok='';
  const p=T&&T.getState&&T.getState().selected;
  if(p&&p.baseToken){
    tok=p.baseToken.address===FIJI?'fiji.png':https(p.info&&p.info.imageUrl);
  }

  /* BUY: pay SOL, receive token.  SELL: pay token, receive SOL. */
  paintDot(payDot,sell?tok:SOL_URI,'💧');
  paintDot(recDot,sell?SOL_URI:tok,'💧');
}

setInterval(sync,500);
sync();
})();
