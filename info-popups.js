/* ===================================================================
   FIJI info-popups.js — Roadmap + Whitepaper pop-ups (v2: NFT mining plan)
   Replaces the two hero buttons on Home. Self-contained (own CSS).
=================================================================== */
(function(){
'use strict';

/* ---------------- CSS ---------------- */
const css=`
.ip-modal{position:fixed;inset:0;background:rgba(18,48,92,.5);z-index:450;display:flex;align-items:center;justify-content:center;padding:16px;animation:ipfade .2s}
.ip-sheet{width:100%;max-width:760px;height:min(88vh,860px);display:flex;flex-direction:column;overflow:hidden;padding:0;animation:ippop .28s cubic-bezier(.2,1.3,.4,1)}
@keyframes ipfade{from{opacity:0}}
@keyframes ippop{from{transform:translateY(24px) scale(.96);opacity:0}}
.ip-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:3px solid var(--ink);background:var(--sun)}
.ip-head img{width:44px;height:44px;border-radius:50%;border:2.5px solid var(--ink);object-fit:cover;flex:none}
.ip-ttl{flex:1;min-width:0;line-height:1.1}
.ip-ttl b{display:block;font:700 22px Fredoka}
.ip-ttl span{font:600 13px Nunito;opacity:.75}
.ip-prog{height:7px;background:#fff;border-bottom:2.5px solid var(--ink)}
.ip-prog i{display:block;height:100%;width:0;background:var(--blue);transition:width .15s}
.ip-nav{display:flex;gap:8px;overflow-x:auto;padding:10px 14px;border-bottom:2.5px dashed var(--line);scrollbar-width:none;background:var(--soft)}
.ip-nav::-webkit-scrollbar{display:none}
.ip-chip{flex:none;border:2.5px solid var(--ink);background:#fff;color:var(--ink);border-radius:99px;padding:5px 13px;font:600 14px Fredoka;cursor:pointer;white-space:nowrap}
.ip-chip:hover{background:#fff6cf}
.ip-chip.on{background:var(--sun)}
.ip-body{flex:1;overflow-y:auto;padding:20px 22px 26px;scroll-behavior:smooth;-webkit-overflow-scrolling:touch}
.ip-body h3{font:700 26px/1.15 Fredoka;margin:0 0 10px}
.ip-body h4{font:700 19px Fredoka;margin:18px 0 6px}
.ip-body p{margin:0 0 12px}
.ip-body ul{margin:0 0 14px;padding-left:0;list-style:none;display:grid;gap:6px}
.ip-body li{background:var(--soft);border:2px dashed var(--line);border-radius:12px;padding:7px 12px}
.ip-body li:before{content:"🐰 "}
.ip-sec{padding-bottom:22px;margin-bottom:22px;border-bottom:3px dotted var(--line)}
.ip-sec:last-child{border:0}
.ip-num{display:inline-block;background:var(--blue);color:#fff;border:2.5px solid var(--ink);border-radius:99px;padding:1px 12px;font:600 14px Fredoka;margin-bottom:6px}
.ip-q{background:#FFF6CF;border:2.5px dashed var(--ink);border-radius:16px;padding:12px 16px;font:600 18px Fredoka;margin:12px 0}
.ip-big{font:700 clamp(20px,3vw,26px)/1.25 Fredoka;margin:12px 0}
.ip-box{background:var(--sb);border:2.5px solid var(--ink);border-radius:16px;padding:12px 16px;margin:12px 0}
.ip-box b.t{display:block;font:700 18px Fredoka}
.ip-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}
.ip-grid>div{background:#fff;border:2.5px solid var(--ink);border-radius:16px;padding:10px 12px;box-shadow:0 3px 0 var(--ink)}
.ip-grid b{display:block;font:700 18px Fredoka}
.ip-grid em{font-style:normal;color:var(--blue);font:700 15px Fredoka}
.ip-flow{display:flex;flex-direction:column;align-items:center;gap:4px;margin:12px 0}
.ip-flow div{width:100%;max-width:420px;text-align:center;background:#fff;border:2.5px solid var(--ink);border-radius:14px;padding:7px 12px;font:600 16px Fredoka}
.ip-flow span{font-size:18px;line-height:1}
.ip-body table{margin:10px 0 14px;font-size:15px}
.ip-body td,.ip-body th{word-break:normal}
.ip-foot{display:flex;justify-content:space-between;gap:10px;padding:12px 16px;border-top:3px solid var(--ink);background:#fff}
.ip-ph{display:flex;align-items:center;gap:12px;margin-bottom:6px}
.ip-ph .em{font-size:44px}
.ip-ph small{display:block;font:600 14px Fredoka;letter-spacing:.1em;text-transform:uppercase;color:var(--blue)}
.ip-tgt{display:inline-block;background:#B8F5D2;border:2.5px solid var(--ink);border-radius:99px;padding:2px 12px;font:600 14px Fredoka;margin:4px 0 10px}
.ip-goal{background:var(--sun);border:3px solid var(--ink);border-radius:18px;padding:12px 16px;box-shadow:0 4px 0 var(--ink);margin:14px 0}
.ip-goal b{font:700 18px Fredoka}
.ip-tl{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0}
.ip-tl button{border:3px solid var(--ink);background:#fff;border-radius:16px;padding:10px 4px;cursor:pointer;font:600 14px Fredoka;color:var(--ink);box-shadow:0 3px 0 var(--ink)}
.ip-tl button span{display:block;font-size:26px}
.ip-tl button:hover{background:#fff6cf}
.ip-hbtns{display:flex;gap:12px;flex-wrap:wrap}
.ip-meter{height:18px;border:2.5px solid var(--ink);border-radius:99px;background:#fff;overflow:hidden;margin:6px 0 10px}
.ip-meter i{display:block;height:100%;background:var(--teal)}
.ip-calc{background:#FFF6CF;border:3px solid var(--ink);border-radius:18px;box-shadow:0 4px 0 var(--ink);padding:14px 16px;margin:14px 0}
.ip-calc h4{margin:0 0 8px}
.ip-calc label{display:block;font:600 14px Fredoka;margin-top:8px}
.ip-calc input[type=range]{padding:0;margin:6px 0;border:0;box-shadow:none}
.ip-calc select{margin:4px 0}
.ip-calc .res{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.ip-calc .res div{background:#fff;border:2.5px solid var(--ink);border-radius:14px;padding:8px 12px;text-align:center}
.ip-calc .res small{display:block;font:600 12px Fredoka;opacity:.7}
.ip-calc .res b{font:700 22px Fredoka}
@media(max-width:760px){
 .ip-modal{align-items:flex-end;padding:8px 8px calc(8px + env(safe-area-inset-bottom))}
 .ip-sheet{height:92vh;border-radius:24px}
 .ip-body{padding:16px 14px 22px}
 .ip-body h3{font-size:22px}
 .ip-head img{width:38px;height:38px}
 .ip-ttl b{font-size:19px}
 .ip-tl{grid-template-columns:repeat(2,1fr)}
 .ip-body table{font-size:13px}
 .hero .btns .btn{flex:1 1 140px}
}
`;
const st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

/* ---------------- helpers ---------------- */
const L=a=>'<ul>'+a.map(x=>'<li>'+x+'</li>').join('')+'</ul>';
const FLOW=a=>'<div class="ip-flow">'+a.map((x,i)=>(i?'<span>↓</span>':'')+'<div>'+x+'</div>').join('')+'</div>';

/* shared tables */
const RARITY_TBL=`<table><tr><th>Rarity</th><th>Supply</th><th>Mint price</th><th>Multiplier</th><th>Max GEM / 24h</th></tr>
<tr><td>Common</td><td>180</td><td>0.15 SOL</td><td>1.0×</td><td>1,000</td></tr>
<tr><td>Rare</td><td>75</td><td>0.30 SOL</td><td>1.5×</td><td>1,500</td></tr>
<tr><td>Epic</td><td>36</td><td>0.50 SOL</td><td>2.0×</td><td>2,000</td></tr>
<tr><td>Legendary</td><td>9</td><td>1.00 SOL</td><td>3.0×</td><td>3,000</td></tr>
<tr><td><b>Total</b></td><td><b>300</b></td><td>—</td><td>—</td><td>—</td></tr></table>`;

/* ===================================================================
   ROADMAP DATA
=================================================================== */
const PH=[
{em:'🐰',k:'Phase 1',n:'EARN',sub:"FIJI's Little Home",tag:'Launch',lead:'The beginning of the FIJI journey.',
 items:['Fijilabs.fun launch','BUN introduced as FIJI\'s in-website currency','Daily Check-in','Tap Splash activities','Referral system','Community activities','Leaderboard and user ranks','BUN earning opportunities','BUN-based items and ecosystem utilities','FIJI holder access system','Trade tab with a proposed 0.25% fee supporting the Rewards Pool','Continued website improvements'],
 goalT:'The goal',goal:'Give the community a reason to come back every day.<br>Do things. Earn BUN. Climb the leaderboard.'},
{em:'🥕',k:'Phase 2',n:'GROW',sub:'Feed FIJI. Power Your NFT. Mine GEM.',tgt:'Target: approximately 15 days after launch',lead:"FIJI's ecosystem expands into its NFT and mining system.",
 groups:[
  {t:'🐰 The collection',items:['300 FIJI Miner NFTs','NFT rarity system: Common, Rare, Epic and Legendary','Mint prices (proposed): 0.15 / 0.30 / 0.50 / 1.00 SOL','Maximum GEM per 24 hours: 1,000 / 1,500 / 2,000 / 3,000']},
  {t:'⚡ Energy &amp; Food',items:['NFT Energy meter from 100% down to 0%','Mining stops when Energy reaches 0%','Food restores Energy: Lettuce, Carrots, Parsley, Spinach and Celery','Food and feeding mechanics (acquisition methods to be defined; BUN-powered purchases planned)']},
  {t:'🎯 Activity &amp; GEM',items:['Activity meter: 40% check-in · 75% check-in + Earn-tab game · 80% weekly streak · 100% two trades on two different coins','Mining percentage = average of Energy and Activity','NFT mining and GEM production','GEM tracking and NFT progression','Mining campaigns']},
  {t:'🛠️ Build &amp; launch steps',items:['Collection preparation: 300 NFT designs, metadata and minting setup','Mining development: ownership verification, Energy, Activity, GEM balances','Website integration: minting, mining status, GEM history','Devnet testing before any mainnet launch','Public launch with final rates and rules published first']}
 ],
 after:`<h4>Rarity at a glance</h4>${RARITY_TBL}
<p>NFTs become active parts of the FIJI ecosystem rather than simply collectibles.</p>
<p>Users can maintain their NFT's energy through food and increase their productivity through participation in the FIJI ecosystem.</p>
<div class="ip-box"><b class="t">⚡ Energy keeps the NFT mining. 🎯 Activity sets the production percentage. 🐰 Rarity sets the maximum GEM.</b></div>
<div class="ip-box"><b class="t">💎 GEM</b><p style="margin-top:6px">GEM represents the user's eligible contribution to FIJI mining campaigns.</p><p>NFT rarity determines the NFT's maximum GEM production, while energy and ecosystem activity affect actual production.</p><p style="margin:0">Final GEM rates, energy values, multipliers and other parameters may be adjusted during development to maintain a balanced ecosystem.</p></div>
<div class="ip-box"><b class="t">🏦 Rewards Pool</b><p style="margin:6px 0 0">A proposed 0.25% fee on eligible trades through the FIJI Trade tab is directed to a designated Rewards Pool, tracked separately and subject to published rules.</p></div>`},
{em:'⚔️',k:'Phase 3',n:'BATTLE',sub:'Welcome to the FIJI Arena',lead:'FIJI moves beyond earning and mining into interactive gameplay.',
 items:['FIJI Arena','PvP battles','PvE challenges','BUN-based arena entry','Battle progression','Competitive rankings','Battle rewards','New items and gameplay mechanics','Additional BUN sinks','Seasonal events and challenges'],
 after:'<div class="ip-box"><p>The Arena is designed to give BUN another purpose:</p><p class="ip-big" style="margin:0">Earn BUN. Spend BUN. Play FIJI.</p></div><p>The exact battle systems, entry costs, rewards and game modes will be introduced as development progresses.</p>'},
{em:'💎',k:'Phase 4',n:'EXPAND',sub:'FIJI Labs Gets Bigger',lead:'The FIJI ecosystem continues to grow beyond its initial systems.',
 items:['New games','New NFT mechanics','New foods and items','Expanded NFT utility','Additional GEM campaigns','New community activities','Seasonal events','Additional FIJI ecosystem utilities','Community-driven features','New experiments from FIJI Labs'],
 after:'<p>FIJI Labs will continue experimenting with new ways to make the ecosystem more interactive, social and fun.</p>'}
];
const LOOP=['ACTIVITY','BUN','ITEMS &amp; FOOD','NFT ENERGY','GEM MINING','FIJI CAMPAIGNS','FIJI','MORE ECOSYSTEM ACCESS','ARENA &amp; MORE ACTIVITIES'];

function rmIntro(){return `<h3>FIJI Labs</h3><div class="ip-big" style="color:var(--blue)">The Little Bunny's Bigger Adventure</div>
<p>FIJI is a pure meme ecosystem built around a cute bunny, community activities, digital collectibles, and a growing world of games and utilities.</p>
<div class="ip-goal"><b>The goal is simple:</b><br>Have fun. Stay active. Earn BUN. Build your FIJI journey.</div>
<h4>Pick a phase to hop into</h4>
<div class="ip-tl">${PH.map((p,i)=>`<button data-go="${i+1}"><span>${p.em}</span>${p.k}<br>${p.n}</button>`).join('')}</div>
<button class="btn sm alt" data-go="5">🐰 See the FIJI Loop</button>`}
function rmPhase(i){const p=PH[i];
 const list=p.groups?p.groups.map(g=>`<h4>${g.t}</h4>${L(g.items)}`).join(''):L(p.items);
 return `<div class="ip-ph"><div class="em">${p.em}</div><div><small>${p.k} — ${p.n}</small><h3 style="margin:0">${p.sub}</h3></div></div>
${p.tag?`<span class="pill">${p.tag}</span>`:''}${p.tgt?`<div class="ip-tgt">${p.tgt}</div>`:''}
<p style="margin-top:8px">${p.lead}</p>${list}${p.after||''}
${p.goal?`<div class="ip-goal"><b>${p.goalT}</b><br>${p.goal}</div>`:''}`}
function rmLoop(){return `<h3>🐰 The FIJI Loop</h3>${FLOW(LOOP)}
<div class="ip-box"><b class="t">🏦 Alongside the loop</b><p style="margin:6px 0 0">Eligible Trade tab fees (proposed 0.25%) go to the Rewards Pool, which supports future community campaigns subject to available funds and published rules.</p></div>
<h4>A Living Roadmap</h4>
<p>The FIJI roadmap represents the direction of the ecosystem rather than a guarantee that every future feature will launch exactly as described.</p>
<p>Features, mechanics, rates and timelines may be adjusted as FIJI Labs develops and balances the ecosystem.</p>
<div class="ip-q">FIJI is built one hop at a time. 🐰</div>`}

/* ===================================================================
   WHITEPAPER DATA
=================================================================== */
const WP=[
['Welcome',`<p>FIJI started with a simple idea:</p><div class="ip-q">What if a meme could become a little world of its own?</div>
<p>FIJI is a pure meme project built around a cute bunny and an expanding interactive ecosystem.</p>
<p>At the center of that ecosystem is <b>Fijilabs.fun</b> — a place where the community can participate, earn BUN, collect and manage NFTs, mine GEM, compete on leaderboards, and eventually enter the FIJI Arena.</p>
<p>FIJI isn't built around a single feature.</p><p>It is designed to grow through connected systems where each part gives the community another reason to participate.</p>
<div class="ip-big">Play. Earn. Spend. Grow. Battle. Repeat.</div><p>That's the FIJI idea.</p>`],
['Philosophy',`<p>FIJI is first and foremost a meme.</p>
<p>There is no complicated story that users need to understand before joining. FIJI is a bunny, a community, and a growing digital playground.</p>
<p>But being a meme doesn't mean the ecosystem has to stop there.</p>
<p>FIJI Labs is built around a simple question:</p>
<div class="ip-q">What can we build around the community that makes people want to come back?</div>
<p>The answer is an ecosystem where participation matters.</p>
<p>Users can earn BUN by being active, use BUN within the ecosystem, feed and grow their NFTs, produce GEM, participate in campaigns, and eventually compete in interactive game modes.</p>
<p>Every new system is designed to connect with the ones that came before it.</p>`],
['Fijilabs.fun',`<p>Fijilabs.fun is FIJI's home.</p><p>It is designed to bring the ecosystem into one place rather than scattering activities across different platforms.</p>
<p>The website is intended to become the central hub for:</p>${L(['Community activities','BUN earning','BUN spending','Leaderboards','NFT minting and interaction','GEM mining','Trading','Future games','Arena gameplay','Ecosystem utilities'])}
<p>The goal is not simply to create another website.</p><div class="ip-big">The goal is to create a place where FIJI has something to do.</div>`],
['Ecosystem',`<p>The FIJI ecosystem is built around several connected components.</p>
<div class="ip-grid">
<div><b>🟡 BUN</b>The in-website currency used for activities, items, food and future gameplay.</div>
<div><b>🥕 Food</b>Items that restore NFT Energy so it can keep mining.</div>
<div><b>🐰 NFTs</b>300 FIJI Miner NFTs that generate GEM through Energy and Activity.</div>
<div><b>💎 GEM</b>The measurement of eligible NFT mining contribution during campaigns.</div>
<div><b>🔵 FIJI</b>The core FIJI ecosystem asset, with planned utility and access within the ecosystem.</div>
<div><b>🏦 Rewards Pool</b>Funded by the proposed 0.25% Trade tab fee, for future community campaigns.</div>
<div><b>⚔️ Arena</b>A future PvP/PvE gameplay system designed to give BUN another use and introduce competitive gameplay.</div></div>
<p>Together they create the FIJI loop:</p><div class="ip-box"><b>Activity → BUN → Food → NFT Energy → GEM → FIJI → More Utility → More Activity</b></div>`],
['BUN',`<p>BUN is designed to be the everyday currency of the FIJI ecosystem.</p><p>Users can earn BUN through activities on Fijilabs.fun.</p>
<p>Initial and future activities may include:</p>${L(['Daily Check-in','Tap Splash','Referrals','Trading activity','Games','Community activities','Future participation mechanics'])}
<p>The purpose of BUN is not simply to accumulate a large number.</p><p>BUN is designed to be <b>used</b>.</p>
<p>As the ecosystem expands, BUN can be spent on items, foods, gameplay and other utilities introduced by FIJI Labs.</p>
<p>This creates an important economic loop:</p><div class="ip-q">Earn BUN → Spend BUN → Participate → Progress</div>`],
['The NFT Collection',`<p>The initial collection consists of <b>300 FIJI Miner NFTs</b>. Each NFT has a rarity level that determines its maximum potential GEM production.</p>
${RARITY_TBL}
<p>Mint prices and maximum GEM figures are proposed planning values, not guaranteed earnings, and may be adjusted before launch.</p>
<div class="ip-grid">
<div><b>Common</b>Maximum GEM production:<br><em>1,000 GEM / 24 hours</em></div>
<div><b>Rare</b>Maximum GEM production:<br><em>1,500 GEM / 24 hours</em></div>
<div><b>Epic</b>Maximum GEM production:<br><em>2,000 GEM / 24 hours</em></div>
<div><b>Legendary</b>Maximum GEM production:<br><em>3,000 GEM / 24 hours</em></div></div>
<h4>Ownership</h4>${L(['Each FIJI Miner NFT is intended to be a permanent, transferable collectible on Solana.','The NFT itself does not expire. Its Energy can run out and be refilled with food.','Rarity and its associated utility stay tied to the NFT.','GEM already earned belongs to the wallet that earned it and does not transfer with the NFT.','Marketplace listing, royalties and royalty enforcement depend on the marketplace and the collection\'s configuration.'])}
<p>The purpose of rarity is to create different levels of NFT progression and potential within the ecosystem.</p>`],
['Energy &amp; Food',`<p>NFTs will not simply sit inside a user's wallet.</p><p>They are designed to become active parts of the FIJI ecosystem.</p>
<p>Every FIJI Miner NFT has an <b>Energy meter</b> from 100% to 0%.</p>
<div class="ip-meter"><i style="width:100%"></i></div>
${L(['100% Energy: fully energized','75% Energy: partially energized','50% Energy: reduced available Energy','25% Energy: low Energy','0% Energy: mining stops until the NFT is fed'])}
<p>Energy decreases as the NFT mines. When it reaches 0%, the NFT cannot continue mining until the owner feeds it.</p>
<h4>🥕 Food</h4><p>Different foods restore different amounts of Energy. These are the quantities required for a full 100% refill:</p>
<table><tr><th>Food</th><th>Units for 100% Energy</th></tr>
<tr><td>🥬 Lettuce</td><td>100</td></tr><tr><td>🥕 Carrots</td><td>300</td></tr><tr><td>🌿 Parsley</td><td>400</td></tr><tr><td>🥗 Spinach</td><td>450</td></tr><tr><td>🌱 Celery</td><td>500</td></tr></table>
<p>Food restores Energy up to a maximum of 100%. Feeding an NFT that is already full does not create extra Energy.</p>
<p>The website will show how much Energy a feeding restores before the user confirms it. Food acquisition methods and inventory limits will be defined separately, and food quantities are proposed balancing values.</p>
<div class="ip-q">BUN → Food → Energy → Mining</div>`],
['Activity',`<p>FIJI is designed around participation.</p><p>Owning an NFT alone is not intended to be the entire experience.</p>
<p>The <b>Activity meter</b> measures how much a user takes part in Fijilabs.fun:</p>
<table><tr><th>Activity requirement</th><th>Activity %</th></tr>
<tr><td>Daily check-in completed</td><td>40%</td></tr>
<tr><td>Daily check-in + Earn-tab game completed</td><td>75%</td></tr>
<tr><td>Weekly streak requirement completed</td><td>80%</td></tr>
<tr><td>Two qualifying trades on two different coins</td><td>100%</td></tr></table>
<div class="ip-box"><b>The highest applicable level counts.</b> Levels are not added together: a check-in plus a game is 75% Activity, not 40% + 75%.</div>
<p>Activity is tracked separately from Energy. Feeding restores Energy but does not complete Activity requirements.</p>
<h4>Fair play</h4>${L(['Check-ins follow the published schedule.','Games should have server-verified completion records.','Weekly streaks follow a documented calendar and reset policy.','Trades are verified against qualifying on-chain activity or an approved trading integration.','Duplicate transactions, wash trading, bots and fabricated activity do not qualify.'])}
<p>The exact multiplier system, limits and reset rules will be finalized and published during development and balancing.</p>`],
['GEM Mining',`<p>GEM is the measurement used for FIJI's NFT mining system.</p>
<p>The final production percentage is the <b>average of Energy and Activity</b>:</p>
<div class="ip-q">Mining % = (Energy % + Activity %) ÷ 2</div>
<div class="ip-q">Daily GEM = Maximum Daily GEM × Mining %</div>
<div class="ip-box"><b class="t">Example (Common NFT)</b>Energy 100% · Activity 80%<br>Mining % = (100% + 80%) ÷ 2 = <b>90%</b><br>1,000 × 90% = <b>900 GEM per 24 hours</b></div>
<div class="ip-calc"><h4>🧮 Try it yourself</h4>
<label>Rarity<select data-c="r"><option>Common</option><option>Rare</option><option>Epic</option><option>Legendary</option></select></label>
<label>Energy: <b class="ev">100%</b><input data-c="e" type="range" min="0" max="100" step="5" value="100"></label>
<label>Activity<select data-c="a"><option value="0">None (0%)</option><option value="40">Check-in (40%)</option><option value="75">Check-in + game (75%)</option><option value="80" selected>Weekly streak (80%)</option><option value="100">Two trades, two coins (100%)</option></select></label>
<div class="res"><div><small>Mining %</small><b class="pc">90%</b></div><div><small>GEM per 24h</small><b class="out">900 GEM</b></div></div></div>
<h4>More examples (Common)</h4>
<table><tr><th>Energy</th><th>Activity</th><th>Mining %</th><th>GEM / 24h</th></tr>
<tr><td>100%</td><td>100%</td><td>100%</td><td>1,000</td></tr><tr><td>100%</td><td>80%</td><td>90%</td><td>900</td></tr>
<tr><td>100%</td><td>75%</td><td>87.5%</td><td>875</td></tr><tr><td>80%</td><td>80%</td><td>80%</td><td>800</td></tr>
<tr><td>60%</td><td>40%</td><td>50%</td><td>500</td></tr><tr><td>40%</td><td>0%</td><td>20%</td><td>200</td></tr>
<tr><td>0%</td><td>100%</td><td>—</td><td>0 (mining stopped)</td></tr></table>
<div class="ip-box"><b>0% Energy overrides the average.</b> An NFT with no Energy cannot mine, even with 100% Activity.</div>
<h4>Daily caps by rarity (at 90% mining)</h4>
<table><tr><th>Rarity</th><th>Max daily GEM</th><th>At 90%</th></tr><tr><td>Common</td><td>1,000</td><td>900</td></tr><tr><td>Rare</td><td>1,500</td><td>1,350</td></tr><tr><td>Epic</td><td>2,000</td><td>1,800</td></tr><tr><td>Legendary</td><td>3,000</td><td>2,700</td></tr></table>
<p>The cap applies per NFT, and the system must never grant more than an NFT's maximum daily GEM. Any wallet-level mining limits will be published before users purchase NFTs.</p>
<div class="ip-q">Energy keeps the NFT mining. Activity sets the production percentage. Rarity sets the maximum GEM.</div>`],
['Mining Dashboard',`<p>The website is designed to show everything a miner needs at a glance:</p>
${L(['Current Energy percentage','Current Activity percentage','Calculated Mining percentage','GEM earned during the current period','Remaining Energy or estimated time until exhaustion','Available Food and feeding options','Time until the next daily production reset, if a reset is used','GEM balance and claim history'])}
<p>The production accounting period is 24 hours. The final design for how Energy decreases (continuously, at intervals, or in proportion to GEM produced) will be settled before launch, with continuous consumption currently preferred so that Food stays meaningful.</p>
<h4>Safeguards</h4>${L(['Earned GEM is tied to the wallet that generated it.','Duplicate claims and unauthorized balance changes are prevented.','Possible limits on simultaneously active NFTs per wallet or daily GEM per wallet.','Transparent snapshots and eligibility calculations for campaigns.','Wallet caps or mining restrictions are disclosed before users buy NFTs.'])}
<p>GEM is an internal ecosystem unit. It is not automatically a cryptocurrency or a redeemable asset.</p>`],
['GEM Campaigns',`<p>GEM is not designed to create an unlimited FIJI supply.</p>
<p>Instead, FIJI Labs can establish a <b>fixed FIJI campaign pool</b>.</p><p>For example:</p>
<div class="ip-box"><b class="t">30-Day Mining Campaign</b>Campaign Pool: <b>5,000,000 FIJI</b></div>
<p>At the end of the campaign, eligible GEM can be used to determine each participant's proportional share of the campaign pool.</p>
<p>The basic calculation is:</p>
<div class="ip-q">User FIJI Allocation = User Eligible GEM ÷ Total Eligible GEM × Campaign FIJI Pool</div>
<p>For example:</p><p>A user earns: <b>50,000 GEM</b></p><p>All participating users collectively earn: <b>780,000 GEM</b></p>
<p>The user's share would be: <b>50,000 ÷ 780,000 = 6.41%</b></p><p>If the campaign pool is: <b>5,000,000 FIJI</b></p>
<p>the proportional allocation would be: <b>6.41% × 5,000,000 = 320,500 FIJI</b></p>
<h4>Target-based campaigns</h4>
<p>A campaign may instead set a fixed pool and a required GEM target. Completion is capped at 100%:</p>
<div class="ip-q">Eligible FIJI = Campaign Pool × (Qualifying GEM ÷ Required GEM Target)</div>
<p>Illustrative example: with a 1,000,000 FIJI pool and a 1,000,000 GEM target, 750,000 qualifying GEM would make 750,000 FIJI eligible. The remaining 250,000 FIJI stays locked or unallocated and is not automatically redistributed.</p>
<p class="small">These examples explain the mechanism and should not be interpreted as a guaranteed future allocation.</p>
<p class="small">Campaign pools, eligibility requirements, wallet limits, anti-abuse rules and mechanics may vary between campaigns and will be published separately.</p>`],
['Campaign Pool',`<p>The campaign model is designed around a predetermined allocation.</p>
<p>The amount distributed through a campaign is defined before distribution.</p>
<p>Participation therefore changes the <b>share of the pool</b>, rather than automatically increasing the size of the pool.</p>
<p>This creates a system where:</p>
<div class="ip-box"><b>More participants = more competition for the fixed pool</b><br>rather than:<br><b>More participants = unlimited new emissions</b></div>
<p>The model is intended to create a competitive relationship between participation and allocation while keeping the campaign pool defined. Owning more NFTs may increase mining capacity, but campaign rules are designed to prevent a small number of participants from unfairly dominating an allocation.</p>`],
['Trade Fee &amp; Rewards Pool',`<p>Every eligible trade executed through the Fijilabs.fun Trade tab is subject to a proposed <b>0.25% trading fee</b>.</p>
<div class="ip-q">Trading Fee = Eligible Trade Amount × 0.25%</div>
<div class="ip-box"><b class="t">Example</b>Trade amount: 1 SOL<br>Trading fee: <b>0.0025 SOL</b><br>Remaining after the fee: <b>0.9975 SOL</b>, before any network or third-party fees.</div>
<p>The fee applies to trades made through the FIJI Trade tab, not to trades made elsewhere on Solana. Users see the estimated fee and trade amount before they confirm.</p>
<h4>🏦 Rewards Pool</h4>
<p>All fees collected under this policy go to a designated FIJI Rewards Pool, tracked separately from ordinary operating funds. It is intended to support future community reward initiatives, subject to available funds and published program rules.</p>
<p>Potential uses may include:</p>${L(['Community participation campaigns','Eligible GEM-based campaigns','FIJI ecosystem events and competitions','Other officially announced community reward programs'])}
${FLOW(['User trades on the FIJI Trade tab','0.25% proposed trading fee','FIJI Rewards Pool (tracked separately)','Eligible community campaigns (published rules, available funds)'])}
<h4>How it relates to mining</h4>
${L(['NFT Energy decides whether mining can continue.','Activity decides the mining percentage.','Rarity decides the maximum GEM.','Trade fees fund the Rewards Pool.'])}
<p>Two qualifying trades on two different coins can raise a user's Activity to 100%. Fee collection alone does not grant extra GEM unless a separate, transparent reward rule is introduced.</p>
<p class="small">The fee must be supported by the actual transaction route and sent to the designated Rewards Pool address. The 0.25% policy, eligible routes and Rewards Pool rules will be finalized and tested before activation. Fees are not a guaranteed return or a promise of future FIJI distributions.</p>`],
['FIJI Asset',`<p>FIJI is designed to sit above the in-website BUN economy.</p>
<p>BUN is primarily designed for everyday ecosystem activity and spending.</p><p>GEM measures NFT mining contribution.</p><p>FIJI represents the broader FIJI ecosystem layer.</p>
<p>Planned FIJI utility may include:</p>${L(['Ecosystem access','Access to advanced features','Participation in selected systems','Future gameplay utility','Future ecosystem features','Additional FIJI Labs utilities'])}
<p>FIJI holders may also have access to features that require a minimum FIJI balance.</p>
<p>One planned access threshold is:</p><div class="ip-big" style="color:var(--blue)">500,000 FIJI</div>
<p>Holding the required balance may provide access to the broader FIJI experience, including features such as the Trading tab and enhanced ecosystem functionality.</p>
<p>The exact threshold and access requirements may be adjusted as FIJI Labs develops and balances the ecosystem.</p>`],
['Arena',`<p>The FIJI ecosystem is designed to eventually move beyond mining and progression.</p>
<p>Phase 3 introduces the concept of the:</p><div class="ip-big">⚔️ FIJI ARENA</div>
<p>The Arena is planned as an interactive gameplay environment featuring potential:</p>${L(['PvP battles','PvE challenges','Competitive modes','Battle progression','Seasonal events','Rankings','Rewards','Special items'])}
<p>BUN is expected to play an important role in the Arena.</p><p>Users may use BUN to enter battles, creating another reason to earn and spend BUN.</p>
<p>This creates another ecosystem loop:</p><div class="ip-q">Earn BUN → Enter Arena → Play → Progress → Return to FIJI</div>
<p>The exact game modes, entry costs, rewards and mechanics will be revealed as development progresses.</p>`],
['Economic Loop',`<p>The entire ecosystem is designed to connect.</p>${FLOW(['STEP 1 — PARTICIPATE<br><small>Users interact with Fijilabs.fun.</small>','STEP 2 — EARN BUN<br><small>Activities reward BUN.</small>','STEP 3 — SPEND BUN<br><small>Users purchase food, items and future utilities.</small>','STEP 4 — FEED THE NFT<br><small>Food restores NFT Energy so it can keep mining.</small>','STEP 5 — STAY ACTIVE<br><small>Check-ins, games, streaks and trades raise the Activity percentage.</small>','STEP 6 — MINE GEM<br><small>Energy and Activity set the mining percentage of the NFT\'s rarity-based cap.</small>','STEP 7 — PARTICIPATE IN CAMPAIGNS<br><small>Eligible GEM contributes toward proportional campaign allocations.</small>','STEP 8 — RECEIVE FIJI<br><small>Campaign participants may receive a proportional allocation from the defined campaign pool.</small>','STEP 9 — USE FIJI<br><small>FIJI can provide access to additional ecosystem features and future utilities.</small>','STEP 10 — PLAY MORE<br><small>New features such as the FIJI Arena provide additional reasons to return.</small>'])}`],
['Different Jobs',`<p>One of the most important principles of the FIJI economy is keeping the roles of the different systems clear.</p>
<div class="ip-grid">
<div><b>🟡 BUN</b><em>The spending currency.</em><br>Earn it through activity.<br>Use it throughout the FIJI ecosystem.</div>
<div><b>💎 GEM</b><em>The mining contribution unit.</em><br>Produce it through NFT activity.<br>Use it for campaign-based allocation calculations.</div>
<div><b>🔵 FIJI</b><em>The broader ecosystem asset.</em><br>Use it for planned access, utility and future FIJI Labs features.</div>
<div><b>🏦 Rewards Pool</b><em>The pool of funds.</em><br>Filled by Trade tab fees.<br>Supports future community campaigns.</div></div>
<p>This separation is intended to prevent every system from becoming the same thing. GEM stays the mining and activity metric, while the Rewards Pool is the actual pool of funds.</p>`],
['Community',`<p>FIJI is designed to reward participation, not simply ownership.</p>
<p>Leaderboards can provide visibility into community progression and activity.</p><p>Users can compete through:</p>${L(['Points','Activity','Rankings','Mining','Future Arena performance','Other ecosystem achievements'])}
<p>The goal is to give the community something to work toward beyond simply holding an asset.</p>`],
['Roadmap',`<p>Four phases, one hop at a time:</p>
<div class="ip-tl">${PH.map((p,i)=>`<button data-rm="${i+1}"><span>${p.em}</span>${p.k}<br>${p.n}</button>`).join('')}</div>
${PH.map(p=>`<h4>${p.em} ${p.k.toUpperCase()} — ${p.n}</h4><p><b>${p.sub}</b></p>${p.tgt?`<div class="ip-tgt">Target: Approximately 15 days after launch.</div>`:''}`).join('')}
<div class="ip-box"><b>Phase 1 goal:</b> Build the FIJI community and establish the BUN economy.</div>
<h4>Before the NFT launch</h4>${L(['Finalize the 300 NFT designs, metadata and mint prices','Build and test mining, Energy, Food and Activity on Solana Devnet','Test GEM caps, the 0% Energy stop, duplicate-claim prevention and NFT transfers','Publish final mint prices, mining rates, Food and campaign rules before users spend SOL'])}
<p class="small">Tap a phase above for the full list.</p>`],
['Living Ecosystem',`<p>FIJI Labs is designed to evolve.</p>
<p>The roadmap represents the direction of the project, not an unchangeable promise that every feature will launch exactly as described.</p>
<p>Game mechanics, reward structures, energy values, food quantities, activity requirements, GEM production, multipliers, fees, access requirements and other parameters may be adjusted as FIJI Labs learns from the community and balances the ecosystem.</p>
<p>The objective is not to build everything at once.</p><p>The objective is to build something that can continue growing.</p>
<div class="ip-q">One feature. One system. One hop at a time.</div>`],
['Risk',`<p>FIJI is a meme project and an experimental ecosystem.</p>
<p>Participation in FIJI, NFTs, digital assets, campaigns or future features involves risk.</p>
<p>FIJI Miner NFTs are digital collectibles with proposed ecosystem utility. Buying one does not guarantee profit, resale value, passive income, a token allocation or future rewards.</p>
<p>Nothing in this document should be interpreted as a promise of profit, guaranteed rewards, guaranteed appreciation, guaranteed campaign allocations or financial returns.</p>
<p>GEM mining rates, Activity requirements, Food quantities, fees, campaign targets and eligibility rules will be disclosed before the corresponding features become active. Future utilities and features are subject to development, technical feasibility, balancing and other conditions.</p>
<p>Users should participate responsibly and only use funds they can afford to lose.</p>`],
['Vision',`<p>FIJI doesn't need to be the biggest project.</p><p>It doesn't need to promise the world.</p><p>It simply needs to give people a reason to come back.</p>
<p>A place to check in.<br>A reason to play.<br>A reason to collect.<br>A reason to grow.<br>A reason to compete.</p>
<p>And eventually, a little world where everything connects.</p>
<div class="ip-big">Earn BUN.<br>Feed your FIJI.<br>Mine GEM.<br>Build your journey.<br>Enter the Arena.<br>See where FIJI takes you.</div>
<div class="ip-goal" style="text-align:center"><b>🐰 FIJI LABS</b><br>The little bunny with a bigger adventure ahead.</div>`]
];

/* ---------------- GEM calculator (whitepaper) ---------------- */
const CAPS={Common:1000,Rare:1500,Epic:2000,Legendary:3000};
function bindCalc(root){
 const c=root.querySelector('.ip-calc');if(!c)return;
 const r=c.querySelector('[data-c=r]'),e=c.querySelector('[data-c=e]'),a=c.querySelector('[data-c=a]');
 const ev=c.querySelector('.ev'),pc=c.querySelector('.pc'),out=c.querySelector('.out');
 function up(){
  const en=+e.value,ac=+a.value;
  ev.textContent=en+'%';
  const mp=en===0?0:(en+ac)/2;
  pc.textContent=en===0?'0% (stopped)':mp+'%';
  out.textContent=Math.round(CAPS[r.value]*mp/100).toLocaleString()+' GEM';
 }
 [r,e,a].forEach(x=>x.addEventListener('input',up));
 up();
}

/* ---------------- modal engine ---------------- */
let modal=null;
function close(){if(!modal)return;modal.remove();modal=null;document.body.style.overflow=''}
function shell(icon,title,sub){
 close();
 const d=document.createElement('div');d.className='ip-modal';
 d.innerHTML=`<div class="sticker ip-sheet" role="dialog" aria-modal="true" aria-label="${title}">
  <div class="ip-head"><img src="fiji.png" alt=""><div class="ip-ttl"><b>${icon} ${title}</b><span>${sub}</span></div><button class="btn sm alt ip-x" aria-label="Close">✕</button></div>
  <div class="ip-prog"><i></i></div><div class="ip-nav"></div><div class="ip-body"></div><div class="ip-foot"></div></div>`;
 d.onclick=e=>{if(e.target===d)close()};
 d.querySelector('.ip-x').onclick=close;
 document.body.appendChild(d);document.body.style.overflow='hidden';modal=d;
 return{nav:d.querySelector('.ip-nav'),body:d.querySelector('.ip-body'),foot:d.querySelector('.ip-foot'),bar:d.querySelector('.ip-prog i')};
}
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});

/* ---------------- ROADMAP pop-up ---------------- */
function openRoadmap(start){
 const m=shell('🗺️','Roadmap','FIJI Labs · one hop at a time');
 const tabs=['🐰 Intro',...PH.map(p=>p.em+' '+p.k),'🔁 Loop'];
 let i=Math.max(0,Math.min(start||0,tabs.length-1));
 m.nav.innerHTML=tabs.map((t,x)=>`<button class="ip-chip" data-i="${x}">${t}</button>`).join('');
 m.foot.innerHTML='<button class="btn sm alt" id="ipPrev">← Back</button><button class="btn sm" id="ipNext">Next →</button>';
 function show(n){
  i=n;
  m.body.innerHTML=n==0?rmIntro():n==tabs.length-1?rmLoop():rmPhase(n-1);
  m.nav.querySelectorAll('.ip-chip').forEach((c,x)=>{c.classList.toggle('on',x==n);if(x==n)c.scrollIntoView({inline:'center',block:'nearest'})});
  m.bar.style.width=((n+1)/tabs.length*100)+'%';
  m.body.scrollTop=0;
  m.foot.querySelector('#ipPrev').style.visibility=n?'visible':'hidden';
  m.foot.querySelector('#ipNext').style.visibility=n<tabs.length-1?'visible':'hidden';
  m.body.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(+b.dataset.go));
 }
 m.nav.onclick=e=>{const c=e.target.closest('.ip-chip');if(c)show(+c.dataset.i)};
 m.foot.querySelector('#ipPrev').onclick=()=>show(i-1);
 m.foot.querySelector('#ipNext').onclick=()=>show(i+1);
 show(i);
}

/* ---------------- WHITEPAPER pop-up ---------------- */
function openWhitepaper(){
 const m=shell('📜','Whitepaper','Ecosystem Whitepaper · Version 1.0 — 2026');
 m.nav.innerHTML=WP.map((s,x)=>`<button class="ip-chip" data-i="${x}">${x+1}. ${s[0]}</button>`).join('');
 m.body.innerHTML=`<div class="ip-sec" style="text-align:center"><h3 style="font-size:32px">FIJI LABS</h3><div class="ip-big" style="color:var(--blue)">The Little Bunny. The Bigger Adventure.</div><span class="pill">Ecosystem Whitepaper · Version 1.0 — 2026</span></div>`+
  WP.map((s,x)=>`<section class="ip-sec" id="ipw${x}"><span class="ip-num">${x+1}</span><h3>${s[0]}</h3>${s[1]}</section>`).join('');
 m.foot.innerHTML='<button class="btn sm alt" id="ipTop">↑ Top</button><button class="btn sm" id="ipDone">Got it 🐰</button>';
 const chips=[...m.nav.querySelectorAll('.ip-chip')],secs=WP.map((_,x)=>m.body.querySelector('#ipw'+x));
 m.nav.onclick=e=>{const c=e.target.closest('.ip-chip');if(c)m.body.scrollTo({top:secs[+c.dataset.i].offsetTop-m.body.offsetTop-6})};
 m.body.onclick=e=>{const b=e.target.closest('[data-rm]');if(b)openRoadmap(+b.dataset.rm)};
 m.foot.querySelector('#ipTop').onclick=()=>m.body.scrollTo({top:0});
 m.foot.querySelector('#ipDone').onclick=close;
 bindCalc(m.body);
 let on=-1;
 m.body.addEventListener('scroll',()=>{
  const b=m.body,max=b.scrollHeight-b.clientHeight;
  m.bar.style.width=(max>0?b.scrollTop/max*100:0)+'%';
  let a=0;secs.forEach((s,x)=>{if(s.offsetTop-b.offsetTop-b.scrollTop<b.clientHeight*.35)a=x});
  if(a!==on){on=a;chips.forEach((c,x)=>c.classList.toggle('on',x==a));chips[a].scrollIntoView({inline:'center',block:'nearest'})}
 },{passive:true});
 m.body.dispatchEvent(new Event('scroll'));
}

/* ---------------- swap the hero buttons ---------------- */
const btns=document.querySelector('#home .hero .btns');
if(btns){
 btns.innerHTML='<button class="btn" id="ipRoad">🗺️ Roadmap</button><button class="btn alt" id="ipPaper">📜 Whitepaper</button>';
 $('ipRoad').onclick=()=>openRoadmap(0);
 $('ipPaper').onclick=openWhitepaper;
}
function $(id){return document.getElementById(id)}
window.FIJI_INFO={openRoadmap,openWhitepaper,close};
})();
