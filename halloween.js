(function(){
'use strict';
var CFG={bats:true,max:7,maxMobile:4};

try{document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content','#120A1F')})}catch(e){}

try{
 new MutationObserver(function(list){
  list.forEach(function(r){r.addedNodes.forEach(function(n){
   if(n.nodeType!==1)return;
   var f=n.querySelector&&n.querySelector('iframe.mk-frame');
   if(f&&f.src&&f.src.indexOf('theme=light')>-1)f.src=f.src.replace('theme=light','theme=dark');
  })});
 }).observe(document.body,{childList:true});
}catch(e){}


function rgba(s){var m=String(s).match(/rgba?\(([^)]+)\)/);if(!m)return null;var p=m[1].split(/[ ,\/]+/).filter(Boolean).map(parseFloat);return{r:p[0],g:p[1],b:p[2],a:p.length>3?p[3]:1}}
function lum(c){return(.299*c.r+.587*c.g+.114*c.b)/255}
function effBg(el){
 for(var e=el;e&&e.nodeType===1;e=e.parentElement){
  var c=rgba(getComputedStyle(e).backgroundColor);
  if(c&&c.a>.6)return c;
 }
 return{r:18,g:10,b:31,a:1};
}
function fixEl(el){
 var t=el.tagName;
 if(!t||/^(SCRIPT|STYLE|CANVAS|IMG|IFRAME|svg|path|SVG)$/.test(t))return;
 if(!/^(INPUT|SELECT|TEXTAREA)$/.test(t)){
  var ok=false;
  for(var n=el.firstChild;n;n=n.nextSibling){if(n.nodeType===3&&n.nodeValue.trim()){ok=true;break}}
  if(!ok)return;
 }
 var col=rgba(getComputedStyle(el).color);
 if(!col||lum(col)<.7)return;
 if(lum(effBg(el))>.7)el.style.setProperty('color','#140A1F','important');
}
function scan(root){
 try{
  if(root.nodeType!==1)return;
  fixEl(root);
  root.querySelectorAll('*').forEach(fixEl);
 }catch(e){}
}
var queue=[],qt=0;
function flush(){qt=0;if(document.hidden){return}var q=queue;queue=[];q.forEach(scan)}
try{
 new MutationObserver(function(list){
  list.forEach(function(r){r.addedNodes.forEach(function(n){if(n.nodeType===1)queue.push(n)})});
  if(queue.length&&!qt)qt=setTimeout(flush,300);
 }).observe(document.body,{childList:true,subtree:true});
}catch(e){}
scan(document.body);
setTimeout(function(){scan(document.body)},1200);
setTimeout(function(){scan(document.body)},3500);

if(!CFG.bats||(window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;

var cv=document.createElement('canvas');
cv.setAttribute('aria-hidden','true');
cv.style.cssText='position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:8';
document.body.appendChild(cv);
var ctx=cv.getContext('2d'),W=0,H=0,bats=[],last=0,next=0,raf=0,T=0;

function size(){
 var d=Math.min(window.devicePixelRatio||1,2);
 W=innerWidth;H=innerHeight;
 cv.width=W*d;cv.height=H*d;
 ctx.setTransform(d,0,0,d,0,0);
}
size();addEventListener('resize',size);

function spawn(x,y,burst){
 var dir=Math.random()<.5?1:-1,s=7+Math.random()*9;
 var bx=x!=null?x:(dir>0?-70:W+70);
 var by=y!=null?y:H*(.08+Math.random()*.7);
 bats.push({
  dir:dir,s:s,x:bx,base:by,
  sp:burst?80+Math.random()*100:55+Math.random()*95,
  rise:burst?-(40+Math.random()*60):0,
  amp:burst?10+Math.random()*15:20+Math.random()*35,
  fq:.8+Math.random()*1.4,ph:Math.random()*6.28,
  fr:14+Math.random()*8,fp:Math.random()*6.28
 });
}

function draw(b,y){
 var w=Math.sin(T*b.fr+b.fp)*.6;
 ctx.save();
 ctx.translate(b.x,y);
 ctx.scale(b.dir*b.s,b.s);
 ctx.lineWidth=1.3/b.s;
 ctx.globalAlpha=.92;
 ctx.fillStyle='#2B1650';
 ctx.strokeStyle='#9B5DE5';
 ctx.beginPath();
 ctx.moveTo(0,0);
 ctx.quadraticCurveTo(.6,-.9-w,1.6,-.5-w*1.2);
 ctx.quadraticCurveTo(1.35,-.15-w*.5,1.2,.2);
 ctx.quadraticCurveTo(.9,-.05,.7,.35);
 ctx.quadraticCurveTo(.4,.1,0,.45);
 ctx.quadraticCurveTo(-.4,.1,-.7,.35);
 ctx.quadraticCurveTo(-.9,-.05,-1.2,.2);
 ctx.quadraticCurveTo(-1.35,-.15-w*.5,-1.6,-.5-w*1.2);
 ctx.quadraticCurveTo(-.6,-.9-w,0,0);
 ctx.closePath();
 ctx.fill();ctx.stroke();
 ctx.beginPath();
 ctx.moveTo(-.18,-.05);ctx.lineTo(-.15,-.4);ctx.lineTo(-.03,-.15);
 ctx.lineTo(.03,-.15);ctx.lineTo(.15,-.4);ctx.lineTo(.18,-.05);
 ctx.closePath();ctx.fill();
 ctx.fillStyle='#FF8A1F';
 ctx.beginPath();ctx.arc(-.07,-.08,.045,0,6.28);ctx.arc(.07,-.08,.045,0,6.28);ctx.fill();
 ctx.restore();
}

function frame(ts){
 raf=requestAnimationFrame(frame);
 if(!last){last=ts;next=ts+800}
 var dt=Math.min((ts-last)/1000,.05);last=ts;T+=dt;
 if(ts>next&&bats.length<(W<760?CFG.maxMobile:CFG.max)){spawn();next=ts+1200+Math.random()*2800}
 ctx.clearRect(0,0,W,H);
 for(var i=bats.length-1;i>=0;i--){
  var b=bats[i];
  b.x+=b.dir*b.sp*dt;
  b.base+=b.rise*dt;
  var y=b.base+Math.sin(T*b.fq+b.ph)*b.amp;
  if(b.x<-120||b.x>W+120||y<-80){bats.splice(i,1);continue}
  draw(b,y);
 }
}
function start(){if(!raf){last=0;raf=requestAnimationFrame(frame)}}
function stop(){cancelAnimationFrame(raf);raf=0}
document.addEventListener('visibilitychange',function(){document.hidden?stop():start()});
start();

var lg=document.querySelector('.nav .logo');
if(lg)lg.addEventListener('click',function(){
 var r=lg.getBoundingClientRect();
 for(var i=0;i<8;i++)spawn(r.left+r.width/2,r.top+r.height/2,true);
});
})();
