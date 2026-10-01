/* ============================================================
   FIJI TRADE PAD v3
   Solana-only mobile-first discovery + watchlist + trade router
   ============================================================

   FILE:
     tradepad.js

   LOAD AFTER index.html's main <script>.

   CURRENT FEATURES:
     • 🆕 New
     • 🔥 Trending
     • 📈 Bonding
     • 🎓 Migrated
     • ⭐ Supabase Watchlist
     • Live PumpPortal new-token / migration feed
     • DexScreener enrichment
     • Search
     • Token details
     • Quick Buy UI
     • Portfolio-aware SOL / token amounts
     • Security information hooks
     • Trade-router integration hook
     • Mobile-first rendering

   IMPORTANT:
     Actual signing/execution is routed through:
       TPCFG.TRADE_ROUTER_URL

   Do NOT put private keys or seed phrases here.
   ============================================================ */

(function(){

'use strict';


/* ============================================================
   CONFIG
============================================================ */

const TPCFG={

  /*
    Leave blank until we create the Supabase Edge Function.

    Example later:

    https://YOUR_PROJECT.supabase.co/functions/v1/trade-router
  */
  TRADE_ROUTER_URL:'https://tmceqqciccnnlxjiobgc.supabase.co/functions/v1/trade-router',

  /*
    Optional PumpPortal API key.

    New-token and migration streams are the useful realtime feeds.
    Keep this configurable rather than hardcoding a production key
    into the repository.
  */
  PUMPPORTAL_KEY:'',

  /*
    FIJI platform fee.

    25 bps = 0.25%

    IMPORTANT:
    This is a DISPLAY / requested fee setting only.
    The backend must enforce the actual fee.
  */
  FEE_BPS:25,

  /*
    Used only as a safety reminder when calculating MAX.
    We leave some SOL for network costs.
  */
  SOL_RESERVE:0.005,

  /*
    Discovery refresh.
  */
  REFRESH_MS:15000,

  /*
    How many tokens to keep in each feed.
  */
  MAX_FEED:30,

  /*
    How many items to keep in local live-event memory.
  */
  MAX_LIVE_EVENTS:80,

  /*
    Max addresses requested in one DexScreener token request.
  */
  DS_BATCH:30,

  /*
    API timeout.
  */
  TIMEOUT_MS:10000

};


/* ============================================================
   CORE REFERENCES
============================================================ */

const CORE=
  window.FIJI_CORE||
  {};

const CFG=
  CORE.CFG||
  window.CFG||
  {};

const $=
  CORE.$||
  (id=>document.getElementById(id));

const toast=
  CORE.toast||
  (m=>{
    console.log('[FIJI]',m);
  });

const DS=
  'https://api.dexscreener.com';

const PUMP_WS_BASE=
  'wss://pumpportal.fun/api/data';


/* ============================================================
   SOLANA CONSTANTS
============================================================ */

const SOL_MINT=
  'So11111111111111111111111111111111111111112';

const FIJI_MINT=
  CFG.FIJI_MINT||
  '98kfF7rmsg1QDUEoCqNE7g7M1FdrTt92TEp2CLzypump';


/* ============================================================
   TRADE PAD STATE
============================================================ */

const TP={

 started:false,

 mode:'new',

 action:'buy',

 selected:null,

 feed:[],

 liveNew:[],

 liveMigrated:[],

 cache:new Map(),

 watch:new Set(),

 portfolio:{
   sol:0,
   tokens:[]
 },

 loading:false,

 watchLoading:false,

 refreshTimer:null,

 ageTimer:null,

 ws:null,

 wsReconnectTimer:null,

 wsOnline:false,

 search:'',

 updatedAt:0,

 error:'',

 sniper:false

};


/* ============================================================
   SMALL HELPERS
============================================================ */

function num(v){

  const n=
    Number(v);

  return Number.isFinite(n)
    ?n
    :null;

}


function escapeHtml(v){

  return String(
    v==null
      ?''
      :v
  )
  .replace(
    /[&<>"']/g,
    c=>({

      '&':'&amp;',
      '<':'&lt;',
      '>':'&gt;',
      '"':'&quot;',
      "'":'&#39;'

    }[c])
  );

}


function short(v){

  const s=
    String(v||'');

  if(
    s.length<=12
  )
    return s;

  return(
    s.slice(0,5)+
    '…'+
    s.slice(-5)
  );

}


function clamp(
  n,
  min,
  max
){

  return Math.max(
    min,
    Math.min(
      max,
      n
    )
  );

}


function sleep(ms){

  return new Promise(
    resolve=>
      setTimeout(
        resolve,
        ms
      )
  );

}


function feePercent(){

  return TPCFG.FEE_BPS/100;

}


function formatPercent(v){

  const n=
    num(v);

  if(
    n===null
  )
    return '—';

  return(
    n>0?'+':''
  )+
  n.toFixed(
    Math.abs(n)>=100
      ?0
      :1
  )+
  '%';

}


function formatUsd(v){

  const n=
    num(v);

  if(
    n===null
  )
    return '—';

  const a=
    Math.abs(n);

  if(
    a>=1e9
  )
    return '$'+
      (n/1e9).toFixed(2)+
      'B';

  if(
    a>=1e6
  )
    return '$'+
      (n/1e6).toFixed(2)+
      'M';

  if(
    a>=1e3
  )
    return '$'+
      (n/1e3).toFixed(1)+
      'K';

  if(
    a>=1
  )
    return '$'+
      n.toFixed(
        n>=10
          ?2
          :3
      );

  if(
    a>=0.01
  )
    return '$'+
      n.toFixed(4);

  return '$'+
    n.toPrecision(3);

}


function formatSol(v){

  const n=
    num(v);

  if(
    n===null
  )
    return '—';

  return n.toLocaleString(
    undefined,
    {
      minimumFractionDigits:4,
      maximumFractionDigits:4
    }
  );

}


function formatNumber(v){

  const n=
    num(v);

  if(
    n===null
  )
    return '—';

  return n.toLocaleString(
    undefined,
    {
      maximumFractionDigits:4
    }
  );

}


function safeImage(v){

  return(
    /^https?:\/\//i.test(
      String(v||'')
    )
  )
    ?String(v)
    :'';

}


function liquidity(p){

  return num(
    p?.liquidity?.usd
  )||0;

}


function volume24(p){

  return num(
    p?.volume?.h24
  )||0;

}


function volume1h(p){

  return num(
    p?.volume?.h1
  )||0;

}


function transactions24(p){

  const t=
    p?.txns?.h24||
    {};

  return(
    num(t.buys)||0
  )+
  (
    num(t.sells)||0
  );

}


function ageMs(
  timestamp
){

  const n=
    num(timestamp);

  if(
    n===null
  )
    return null;

  const ms=
    n<
    1000000000000
      ?n*1000
      :n;

  return(
    Date.now()-ms
  );

}


function formatAge(
  timestamp
){

  const diff=
    ageMs(timestamp);

  if(
    diff===null
  )
    return '—';

  if(
    diff<60000
  )
    return Math.max(
      1,
      Math.floor(
        diff/1000
      )
    )+
    's';


  if(
    diff<3600000
  )
    return Math.floor(
      diff/60000
    )+
    'm';


  if(
    diff<86400000
  )
    return Math.floor(
      diff/3600000
    )+
    'h';


  return Math.floor(
    diff/86400000
  )+
  'd';

}


function changeClass(v){

  const n=
    num(v);

  if(
    n===null
  )
    return 'flat';

  if(
    Math.abs(n)<0.05
  )
    return 'flat';

  return n>0
    ?'up'
    :'dn';

}


function tokenKey(
  p
){

  if(
    !p?.chainId||
    !p?.baseToken?.address
  )
    return '';

  return(
    p.chainId+
    ':'+
    p.baseToken.address
  );

}


function tokenKeyParts(
  key
){

  const s=
    String(key||'');

  const i=
    s.indexOf(':');

  if(
    i<0
  )
    return null;

  return{

    chain:s.slice(0,i),

    mint:s.slice(i+1)

  };

}


function isSolanaPair(
  p
){

  return(
    p?.chainId===
    'solana'
  );

}


/* ============================================================
   NETWORK
============================================================ */

async function fetchJson(
  url,
  options={}
){

  const controller=
    new AbortController();

  const timer=
    setTimeout(
      ()=>controller.abort(),
      TPCFG.TIMEOUT_MS
    );

  try{

    const response=
      await fetch(
        url,
        {
          ...options,
          signal:
            controller.signal
        }
      );

    if(
      !response.ok
    ){

      throw new Error(
        'HTTP '+
        response.status
      );

    }

    return await response.json();

  }finally{

    clearTimeout(timer);

  }

}


async function ds(
  path,
  cacheMs=10000
){

  const cached=
    TP.cache.get(
      path
    );

  if(
    cached&&
    Date.now()-
    cached.time<
    cacheMs
  ){

    return cached.data;

  }


  const data=
    await fetchJson(
      DS+
      path
    );


  TP.cache.set(
    path,
    {
      time:Date.now(),
      data
    }
  );


  return data;

}


/* ============================================================
   DEXSCREENER ENRICHMENT
============================================================ */

async function fetchTokenPairs(
  mints
){

  const unique=
    [...new Set(
      mints.filter(Boolean)
    )];


  if(
    !unique.length
  )
    return[];


  const all=[];


  for(
    let i=0;
    i<unique.length;
    i+=TPCFG.DS_BATCH
  ){

    const chunk=
      unique.slice(
        i,
        i+TPCFG.DS_BATCH
      );


    try{

      const data=
        await ds(
          '/tokens/v1/solana/'+
          chunk
            .map(
              encodeURIComponent
            )
            .join(','),
          7000
        );


      if(
        Array.isArray(data)
      ){

        data.forEach(
          p=>{

            if(
              p?.chainId===
              'solana'
            )
              all.push(
                p
              );

          }
        );

      }

    }catch(e){

      console.warn(
        'Token enrichment failed',
        e
      );

    }

  }


  /*
    Keep the best liquidity pair for each mint.
  */

  const best=
    new Map();


  all.forEach(
    p=>{

      const mint=
        p?.baseToken?.address;

      if(
        !mint
      )
        return;


      const current=
        best.get(
          mint
        );


      if(
        !current||
        liquidity(p)>
        liquidity(current)
      ){

        best.set(
          mint,
          p
        );

      }

    }
  );


  return[
    ...best.values()
  ];

}


/* ============================================================
   LATEST DEXSCREENER PROFILES
============================================================ */

async function fetchLatestProfiles(){

  const data=
    await ds(
      '/token-profiles/latest/v1',
      8000
    );


  if(
    Array.isArray(data)
  )
    return data;


  if(
    data&&
    typeof data==='object'
  )
    return[data];


  return[];

}


async function buildProfileFeed(){

  const profiles=
    await fetchLatestProfiles();


  const solProfiles=
    profiles
      .filter(
        p=>
          p?.chainId===
          'solana'&&
          p?.tokenAddress
      )
      .slice(
        0,
        40
      );


  const pairs=
    await fetchTokenPairs(
      solProfiles.map(
        p=>p.tokenAddress
      )
    );


  const pairMap=
    new Map(
      pairs.map(
        p=>[
          p.baseToken.address,
          p
        ]
      )
    );


  return solProfiles.map(
    profile=>{

      const pair=
        pairMap.get(
          profile.tokenAddress
        );


      if(
        pair
      ){

        return{
          ...pair,
          discoveryType:'new',
          profile
        };

      }


      /*
        Token profile without a pair yet.
        We retain it as a lightweight discovery
        item until market data becomes available.
      */

      return{

        chainId:'solana',

        pairAddress:'',

        dexId:'launch',

        baseToken:{

          address:
            profile.tokenAddress,

          symbol:
            'NEW',

          name:
            profile.tokenAddress

        },

        info:{
          imageUrl:
            profile.icon||''
        },

        pairCreatedAt:
          Date.now(),

        priceChange:{},

        volume:{},

        liquidity:{},

        profile,

        discoveryType:'new'

      };

    }
  );

}


/* ============================================================
   BOOST / TRENDING FEED
============================================================ */

async function fetchTrending(){

  const data=
    await ds(
      '/token-boosts/top/v1',
      7000
    );


  const rows=
    Array.isArray(data)
      ?data
      :[];


  const sol=
    rows
      .filter(
        x=>
          x?.chainId===
          'solana'&&
          x?.tokenAddress
      )
      .slice(
        0,
        45
      );


  const pairs=
    await fetchTokenPairs(
      sol.map(
        x=>x.tokenAddress
      )
    );


  const boostMap=
    new Map(
      sol.map(
        x=>[
          x.tokenAddress,
          x
        ]
      )
    );


  return pairs
    .map(
      p=>({

        ...p,

        discoveryType:
          'trending',

        boost:
          boostMap.get(
            p.baseToken.address
          )||null

      })
    )
    .sort(
      (a,b)=>{

        /*
          Current activity signal:
            volume + tx count + price movement.

          This is a discovery sort, not a safety
          or investment score.
        */

        const scoreA=
          volume1h(a)+
          transactions24(a)*25+
          Math.abs(
            num(
              a.priceChange?.h1
            )||0
          )*1000;


        const scoreB=
          volume1h(b)+
          transactions24(b)*25+
          Math.abs(
            num(
              b.priceChange?.h1
            )||0
          )*1000;


        return scoreB-scoreA;

      }
    )
    .slice(
      0,
      TPCFG.MAX_FEED
    );

}


/* ============================================================
   LIVE PUMPPORTAL DATA
============================================================ */

function pumpWsUrl(){

  if(
    TPCFG.PUMPPORTAL_KEY
  ){

    return(
      PUMP_WS_BASE+
      '?api-key='+
      encodeURIComponent(
        TPCFG.PUMPPORTAL_KEY
      )
    );

  }


  return PUMP_WS_BASE;

}


function normalizeNewEvent(
  event
){

  if(
    !event||
    !event.mint
  )
    return null;


  return{

    chainId:'solana',

    pairAddress:
      '',

    dexId:
      'pump',

    baseToken:{

      address:
        event.mint,

      symbol:
        event.symbol||
        'NEW',

      name:
        event.name||
        event.mint

    },

    info:{

      imageUrl:
        event.uri&&
        /^https?:\/\//.test(
          event.uri
        )
          ?event.uri
          :'',

    },

    priceUsd:null,

    marketCap:
      null,

    fdv:null,

    liquidity:{
      usd:0
    },

    volume:{
      h24:0,
      h1:0
    },

    priceChange:{
      h24:0,
      h1:0,
      m5:0
    },

    txns:{
      h24:{
        buys:
          event.txType===
          'create'
            ?1
            :0,

        sells:0
      }
    },

    pairCreatedAt:
      Date.now(),

    discoveryType:
      'new',

    bonding:true,

    bondingCurveKey:
      event.bondingCurveKey||
      '',

    vSolInBondingCurve:
      num(
        event.vSolInBondingCurve
      ),

    vTokensInBondingCurve:
      num(
        event.vTokensInBondingCurve
      ),

    marketCapSol:
      num(
        event.marketCapSol
      ),

    initialBuy:
      num(
        event.initialBuy
      ),

    signature:
      event.signature||
      '',

    creator:
      event.traderPublicKey||
      ''

  };

}


function normalizeMigration(
  event
){

  if(
    !event||
    !event.mint
  )
    return null;


  return{

    chainId:'solana',

    pairAddress:
      event.pool||
      '',

    dexId:
      event.pool||
      'migration',

    baseToken:{

      address:
        event.mint,

      symbol:
        event.symbol||
        'MIGRATED',

      name:
        event.name||
        event.mint

    },

    info:{
      imageUrl:''
    },

    pairCreatedAt:
      event.timestamp
        ?Number(
          event.timestamp
        )*1000
        :Date.now(),

    priceUsd:null,

    marketCap:null,

    fdv:null,

    liquidity:{
      usd:0
    },

    volume:{
      h24:0,
      h1:0
    },

    priceChange:{
      h24:0,
      h1:0,
      m5:0
    },

    txns:{
      h24:{
        buys:0,
        sells:0
      }
    },

    discoveryType:
      'migrated',

    migrated:true,

    migrationSignature:
      event.signature||
      '',

    migrationPool:
      event.pool||
      ''

  };

}


async function enrichLiveEvents(
  events
){

  const mints=
    events
      .map(
        e=>
          e?.baseToken?.address
      )
      .filter(Boolean);


  if(
    !mints.length
  )
    return events;


  const pairs=
    await fetchTokenPairs(
      mints
    );


  const map=
    new Map(
      pairs.map(
        p=>[
          p.baseToken.address,
          p
        ]
      )
    );


  return events.map(
    e=>{

      const mint=
        e?.baseToken?.address;

      const p=
        map.get(
          mint
        );


      if(
        !p
      )
        return e;


      return{

        ...p,

        discoveryType:
          e.discoveryType,

        bonding:
          e.bonding||
          false,

        migrated:
          e.migrated||
          false,

        bondingCurveKey:
          e.bondingCurveKey||

          undefined,

        vSolInBondingCurve:
          e.vSolInBondingCurve,

        vTokensInBondingCurve:
          e.vTokensInBondingCurve,

        marketCapSol:
          e.marketCapSol,

        initialBuy:
          e.initialBuy,

        migrationSignature:
          e.migrationSignature,

        migrationPool:
          e.migrationPool

      };

    }
  );

}


/* ============================================================
   WEBSOCKET
============================================================ */

function closePumpSocket(){

  clearTimeout(
    TP.wsReconnectTimer
  );


  TP.wsReconnectTimer=
    null;


  if(
    TP.ws
  ){

    try{

      TP.ws.close();

    }catch(e){}

  }


  TP.ws=
    null;

  TP.wsOnline=
    false;

}


function schedulePumpReconnect(){

  clearTimeout(
    TP.wsReconnectTimer
  );


  if(
    !TP.started
  )
    return;


  TP.wsReconnectTimer=
    setTimeout(
      openPumpSocket,
      3500
    );

}


function openPumpSocket(){

  if(
    !TP.started
  )
    return;


  if(
    TP.ws
  )
    return;


  let socket;


  try{

    socket=
      new WebSocket(
        pumpWsUrl()
      );

  }catch(e){

    console.warn(
      'Pump websocket unavailable',
      e
    );

    schedulePumpReconnect();

    return;

  }


  TP.ws=
    socket;


  socket.onopen=
    ()=>{

      TP.wsOnline=
        true;


      /*
        New token events and migration events are
        the two primary realtime discovery streams.
      */

      try{

        socket.send(
          JSON.stringify({
            method:
              'subscribeNewToken'
          })
        );


        socket.send(
          JSON.stringify({
            method:
              'subscribeMigration'
          })
        );

      }catch(e){

        console.warn(
          'Pump subscription failed',
          e
        );

      }


      updateLiveStatus();

    };


  socket.onmessage=
    async event=>{

      try{

        const data=
          JSON.parse(
            event.data
          );


        if(
          data.txType===
          'create'&&
          data.mint
        ){

          const item=
            normalizeNewEvent(
              data
            );


          if(
            item
          ){

            TP.liveNew.unshift(
              item
            );


            TP.liveNew=
              TP.liveNew.slice(
                0,
                TPCFG.MAX_LIVE_EVENTS
              );


            /*
              Enrich asynchronously.
            */

            enrichLiveEvents(
              [item]
            )
            .then(
              rows=>{

                if(
                  rows[0]
                ){

                  Object.assign(
                    item,
                    rows[0]
                  );

                }


                if(
                  TP.mode==='new'||
                  TP.mode==='bonding'
                ){

                  renderFeed();

                }

              }
            );


            if(
              TP.mode==='new'||
              TP.mode==='bonding'
            ){

              renderFeed();

            }

          }

        }


        /*
          PumpPortal migration event.
        */

        if(
          String(
            data.txType||
            data.type||
            ''
          ).toLowerCase()
          .includes(
            'migrat'
          ) &&
          data.mint
        ){

          const item=
            normalizeMigration(
              data
            );


          if(
            item
          ){

            TP.liveMigrated.unshift(
              item
            );


            TP.liveMigrated=
              TP.liveMigrated.slice(
                0,
                TPCFG.MAX_LIVE_EVENTS
              );


            const enriched=
              await enrichLiveEvents(
                [item]
              );


            if(
              enriched[0]
            ){

              Object.assign(
                item,
                enriched[0]
              );

            }


            if(
              TP.mode==='migrated'
            ){

              renderFeed();

            }

          }

        }

      }catch(e){

        console.warn(
          'Pump event error',
          e
        );

      }

    };


  socket.onerror=
    ()=>{
      TP.wsOnline=
        false;

      updateLiveStatus();


      try{
        socket.close();
      }catch(e){}

    };


  socket.onclose=
    ()=>{

      if(
        TP.ws===
        socket
      ){

        TP.ws=
          null;

      }


      TP.wsOnline=
        false;


      updateLiveStatus();


      schedulePumpReconnect();

    };

}


/* ============================================================
   WATCHLIST
============================================================ */

async function loadWatchlist(){

  if(
    !walletAddress()
  ){

    TP.watch.clear();

    return;

  }


  if(
    !CORE.getSupabase
  ){

    TP.watch.clear();

    return;

  }


  const db=
    CORE.getSupabase();


  if(
    !db
  ){

    TP.watch.clear();

    return;

  }


  if(
    TP.watchLoading
  )
    return;


  TP.watchLoading=
    true;


  try{

    const {
      data,
      error
    }=
      await db.rpc(
        'fiji_get_watchlist',
        {
          p_wallet:
            walletAddress()
        }
      );


    if(
      error
    )
      throw error;


    TP.watch.clear();


    (
      Array.isArray(data)
        ?data
        :[]
    )
    .forEach(
      row=>{

        if(
          row?.chain&&
          row?.mint
        ){

          TP.watch.add(
            row.chain+
            ':'+
            row.mint
          );

        }

      }
    );


  }catch(e){

    console.warn(
      'Supabase watchlist load failed',
      e
    );


  }finally{

    TP.watchLoading=
      false;

  }

}


/* ============================================================
   WALLET ADDRESS
============================================================ */

function walletAddress(){

  if(
    CORE.getWallet
  ){

    return CORE.getWallet();

  }


  return(
    window.wallet||
    null
  );

}


/* ============================================================
   PORTFOLIO
============================================================ */

function portfolioToken(
  mint
){

  return(
    TP.portfolio.tokens||
    []
  )
  .find(
    token=>
      token?.mint===
      mint
  );

}


function portfolioTokenAmount(
  mint
){

  const token=
    portfolioToken(
      mint
    );


  return num(
    token?.tokenAmount?.uiAmount||
    token?.amount||
    0
  )||0;

}


function updatePortfolioFromCore(
  payload
){

  if(
    !payload
  )
    return;


  if(
    num(payload.sol)!==
    null
  ){

    TP.portfolio.sol=
      num(payload.sol)||0;

  }


  if(
    Array.isArray(
      payload.tokens
    )
  ){

    TP.portfolio.tokens=
      payload.tokens;

  }


  updateTradeBalances();

}


function updateTradeBalances(){

  const sol=
    TP.portfolio.sol||0;


  if(
    $('tradeSolBalance')
  ){

    $('tradeSolBalance').textContent=
      formatSol(
        sol
      );

  }


  if(
    $('portfolioSolTotal')
  ){

    $('portfolioSolTotal').textContent=
      formatSol(
        sol
      )+
      ' SOL';

  }


  if(
    $('swapWalletBalance')
  ){

    $('swapWalletBalance').textContent=
      '◎ '+
      formatSol(
        sol
      )+
      ' SOL';

  }


  const payBalance=
    $('tradePayBalance');


  if(
    payBalance
  ){

    if(
      TP.action==='buy'
    ){

      payBalance.textContent=
        'Balance: '+
        formatSol(sol)+
        ' SOL';

    }else{

      const mint=
        TP.selected
          ?.baseToken
          ?.address;


      payBalance.textContent=
        'Balance: '+
        formatNumber(
          portfolioTokenAmount(
            mint
          )
        );

    }

  }

}


/* ============================================================
   DISCOVERY BUILDERS
============================================================ */

function mergeByMint(
  rows
){

  const map=
    new Map();


  rows.forEach(
    p=>{

      const key=
        p?.baseToken?.address;


      if(
        !key
      )
        return;


      const current=
        map.get(
          key
        );


      if(
        !current||
        liquidity(p)>
        liquidity(current)
      ){

        map.set(
          key,
          p
        );

      }

    }
  );


  return[
    ...map.values()
  ];

}


async function getFeed(){

  /*
    NEW
  */

  if(
    TP.mode==='new'
  ){

    const live=
      TP.liveNew.slice();


    let fallback=[];


    try{

      fallback=
        await buildProfileFeed();

    }catch(e){

      console.warn(
        'New fallback failed',
        e
      );

    }


    return mergeByMint(
      [
        ...live,
        ...fallback
      ]
    )
    .sort(
      (a,b)=>
        Number(
          b.pairCreatedAt||0
        )-
        Number(
          a.pairCreatedAt||0
        )
    )
    .slice(
      0,
      TPCFG.MAX_FEED
    );

  }


  /*
    BONDING
  */

  if(
    TP.mode==='bonding'
  ){

    const bonding=
      TP.liveNew.filter(
        item=>
          item.bonding!==false
      );


    /*
      Enrich recent live bonding tokens.
    */

    const enriched=
      await enrichLiveEvents(
        bonding
      );


    return mergeByMint(
      enriched
    )
    .sort(
      (a,b)=>{

        const am=
          num(
            a.marketCapSol
          );


        const bm=
          num(
            b.marketCapSol
          );


        if(
          am!==null&&
          bm!==null
        )
          return am-bm;


        return(
          Number(
            b.pairCreatedAt||0
          )-
          Number(
            a.pairCreatedAt||0
          )
        );

      }
    )
    .slice(
      0,
      TPCFG.MAX_FEED
    );

  }


  /*
    MIGRATED
  */

  if(
    TP.mode==='migrated'
  ){

    const enriched=
      await enrichLiveEvents(
        TP.liveMigrated
      );


    return mergeByMint(
      enriched
    )
    .sort(
      (a,b)=>
        Number(
          b.pairCreatedAt||0
        )-
        Number(
          a.pairCreatedAt||0
        )
    )
    .slice(
      0,
      TPCFG.MAX_FEED
    );

  }


  /*
    WATCHLIST
  */

  if(
    TP.mode==='watchlist'
  ){

    if(
      !walletAddress()
    )
      return[];


    await loadWatchlist();


    const wanted=
      [...TP.watch]
      .map(
        tokenKeyParts
      )
      .filter(Boolean)
      .map(
        x=>x.mint
      );


    const pairs=
      await fetchTokenPairs(
        wanted
      );


    const chainAllowed=
      pairs.filter(
        p=>
          p.chainId===
          'solana'
      );


    return mergeByMint(
      chainAllowed
        .map(
          p=>({

            ...p,

            discoveryType:
              'watchlist'

          })
        )
    )
    .slice(
      0,
      TPCFG.MAX_FEED
    );

  }


  /*
    TRENDING
  */

  return fetchTrending();

}


/* ============================================================
   RENDER LIVE STATUS
============================================================ */

function updateLiveStatus(){

  const text=
    $('tradeLiveText');


  const updated=
    $('tradeUpdated');


  if(
    text
  ){

    if(
      TP.wsOnline
    ){

      text.textContent=
        'Live Solana feed connected';

    }else if(
      TPCFG.PUMPPORTAL_KEY
    ){

      text.textContent=
        'Reconnecting to live feed…';

    }else{

      text.textContent=
        'Live discovery · Pump feed optional';

    }

  }


  if(
    updated&&
    TP.updatedAt
  ){

    updated.textContent=
      'Updated '+
      formatAge(
        TP.updatedAt
      )+
      ' ago';

  }

}


/* ============================================================
   FEED TOKEN CARD
============================================================ */

function bondingProgress(
  p
){

  /*
    Pump bonding curve reserves are useful for
    displaying a rough progress value when the
    event supplies the virtual reserves.

    This is intentionally a UI estimate, not a
    guarantee of graduation timing.
  */

  const v=
    num(
      p?.vTokensInBondingCurve
    );


  const initial=
    1000000000;


  if(
    v===null||
    v<=0
  )
    return null;


  /*
    As virtual token reserves fall, curve progress
    increases.

    This is only used when Pump-style virtual reserves
    are available.
  */

  const progress=
    clamp(
      (
        1-
        v/initial
      )*
      100,
      0,
      100
    );


  return progress;

}


function discoveryBadge(
  p
){

  if(
    p.discoveryType==='migrated'
  ){

    return`
      <span class="token-badge">
       🎓 Migrated
      </span>
    `;

  }


  if(
    p.discoveryType==='bonding'||
    p.bonding
  ){

    return`
      <span class="token-badge">
       📈 Bonding
      </span>
    `;

  }


  if(
    p.discoveryType==='trending'
  ){

    return`
      <span class="token-badge">
       🔥 Trending
      </span>
    `;

  }


  if(
    p.discoveryType==='watchlist'
  ){

    return`
      <span class="token-badge">
       ⭐ Saved
      </span>
    `;

  }


  return`
    <span class="token-badge">
     🆕 New
    </span>
  `;

}


function tradeTokenCard(
  p
){

  const mint=
    p?.baseToken?.address;


  const key=
    tokenKey(
      p
    );


  const image=
    safeImage(
      p?.info?.imageUrl
    );


  const price=
    num(
      p?.priceUsd
    );


  const change=
    num(
      p?.priceChange?.h1
    );


  const watched=
    TP.watch.has(
      key
    );


  const progress=
    bondingProgress(
      p
    );


  const quickAmount=
    TP.action==='buy'
      ?'0.10 SOL'
      :'SELL';


  return`

   <article
    class="token-card"
    data-token-key="${escapeHtml(key)}"
    onclick="tradeSelectByKey(this.dataset.tokenKey)">

    <div class="token-main">


     ${
       image

       ?`

        <img
         class="token-icon"
         src="${escapeHtml(image)}"
         alt=""
         loading="lazy"
         onerror="this.outerHTML='<span class=&quot;token-icon&quot;>🪙</span>'"
        >

       `

       :`

        <span class="token-icon">
         🪙
        </span>

       `
     }


     <div class="token-name">

      <b>
       ${escapeHtml(
        p?.baseToken?.symbol||
        'TOKEN'
       )}
      </b>

      <span>
       ${escapeHtml(
        p?.baseToken?.name||
        short(mint)
       )}
      </span>

     </div>


     ${discoveryBadge(p)}


     ${
       watched

       ?`

        <span
         class="token-badge">
         ⭐
        </span>

       `

       :''
     }

    </div>


    <div class="token-price">

     ${
       price!==null
        ?formatUsd(price)
        :'Live price loading…'
     }

    </div>


    <div class="token-meta">


     <div class="meta-item">

      <b>
       ${
        formatUsd(
         p?.marketCap||
         p?.fdv
        )
       }
      </b>

      <span>
       Market cap
      </span>

     </div>


     <div class="meta-item">

      <b>
       ${formatUsd(
        liquidity(p)
       )}
      </b>

      <span>
       Liquidity
      </span>

     </div>


     <div class="meta-item">

      <b>
       ${formatUsd(
        volume24(p)
       )}
      </b>

      <span>
       24h volume
      </span>

     </div>


     <div class="meta-item">

      <b>
       ${formatAge(
        p?.pairCreatedAt
       )}
      </b>

      <span>
       Age
      </span>

     </div>


    </div>


    ${
      (
        p.bonding||
        p.discoveryType==='bonding'
      )

      &&progress!==null

      ?`

       <div
        style="
         margin-top:8px;
         background:#F7FAFF;
         border:2px dashed #CFD9EA;
         border-radius:12px;
         padding:7px 8px">

        <div
         style="
          display:flex;
          justify-content:space-between;
          gap:8px;
          font:600 12px Fredoka">

         <span>
          Bonding progress
         </span>

         <b>
          ${progress.toFixed(0)}%
         </b>

        </div>


        <div
         style="
          height:8px;
          border:2px solid #12305C;
          border-radius:999px;
          background:#fff;
          overflow:hidden;
          margin-top:4px">

         <div
          style="
           width:${progress}%;
           height:100%;
           background:#3FB6C9">

         </div>

        </div>

       </div>

      `

      :''
    }


    <div class="token-bottom">


     <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap">


      <span
       class="mini-pill change ${
        changeClass(change)
       }">

       1h
       ${
        change===null
         ?'—'
         :formatPercent(change)
       }

      </span>


      <span class="mini-pill">

       ${escapeHtml(
        p?.dexId||
        'Solana'
       )}

      </span>


      ${
       p?.pairCreatedAt

       ?`

        <span class="mini-pill">
         ${formatAge(
          p.pairCreatedAt
         )}
        </span>

       `

       :''
      }

     </div>


     <button
      class="quick-buy"
      type="button"
      data-buy-key="${escapeHtml(key)}"
      onclick="event.stopPropagation();tradeQuickBuy(this.dataset.buyKey)">

      ⚡
      ${
       TP.action==='buy'
        ?'Buy 0.10 SOL'
        :'Sell'
      }

     </button>

    </div>


   </article>

  `;

}


/* ============================================================
   FEED RENDER
============================================================ */

function renderFeed(){

  const box=
    $('tradeList');


  if(
    !box
  )
    return;


  if(
    TP.loading&&
    !TP.feed.length
  ){

    box.innerHTML=`

      <div class="empty-state">

       <div class="empty-icon">
        🌊
       </div>

       <h3>
        Finding live Solana tokens…
       </h3>

       <p class="small">
        Looking for current ${escapeHtml(
          modeLabel(TP.mode)
        )} activity.
       </p>

      </div>

    `;

    return;

  }


  if(
    TP.error&&
    !TP.feed.length
  ){

    box.innerHTML=`

      <div class="empty-state">

       <div class="empty-icon">
        💧
       </div>

       <h3>
        Trade Pad needs another splash
       </h3>

       <p class="small">
        ${escapeHtml(
          TP.error
        )}
       </p>

       <br>

       <button
        class="btn sm"
        onclick="tradeRefresh(true)">

        Try again

       </button>

      </div>

    `;

    return;

  }


  if(
    !TP.feed.length
  ){

    let message=
      'No tokens found in this feed right now.';


    if(
      TP.mode==='watchlist'
    ){

      message=
        walletAddress()
          ?'Your watchlist has no currently visible Solana pairs.'
          :'Connect your wallet to view your watchlist.';

    }


    if(
      TP.mode==='bonding'
    ){

      message=
        'Bonding tokens will appear here from the live launch feed.';

    }


    if(
      TP.mode==='migrated'
    ){

      message=
        'Fresh migrations will appear here from the live migration feed.';

    }


    box.innerHTML=`

      <div class="empty-state">

       <div class="empty-icon">
        ${
          TP.mode==='watchlist'
           ?'⭐'
           :'🌿'
        }
       </div>

       <h3>
        ${
          TP.mode==='watchlist'
            ?'Watchlist'
            :'Nothing here yet'
        }
       </h3>

       <p class="small">
        ${message}
       </p>

      </div>

    `;

    return;

  }


  box.innerHTML=
    TP.feed
      .map(
        tradeTokenCard
      )
      .join('');


}


/* ============================================================
   MODE LABEL
============================================================ */

function modeLabel(
  mode
){

  const labels={

    new:'New',

    trending:'Trending',

    bonding:'Bonding',

    migrated:'Migrated',

    watchlist:'Watchlist'

  };


  return(
    labels[mode]||
    'tokens'
  );

}


/* ============================================================
   SELECTED TOKEN
============================================================ */

function findByKey(
  key
){

  return(
    TP.feed.find(
      p=>
        tokenKey(p)===
        key
    )
  )||
  TP.liveNew.find(
    p=>
      tokenKey(p)===
      key
  )||
  TP.liveMigrated.find(
    p=>
      tokenKey(p)===
      key
  )||
  null;

}


function updateSelectedUI(){

  const p=
    TP.selected;


  if(
    !p
  ){

    $('tradeDetailSymbol').textContent=
      'Select a token';


    $('tradeDetailName').textContent=
      'Choose a token from the live feed.';


    $('tradePrice').textContent=
      '—';


    $('tradeMc').textContent=
      '—';


    $('tradeLiq').textContent=
      '—';


    $('tradeVol').textContent=
      '—';


    $('summaryToken').textContent=
      '—';


    $('summaryLiq').textContent=
      '—';


    $('summaryImpact').textContent=
      '—';


    $('summaryRoute').textContent=
      '—';


    $('summaryNetworkFee').textContent=
      '—';


    $('tradeReceiveAsset').textContent=
      'TOKEN';


    $('tradeReceiveAmount').value=
      '';


    $('tradeContract').textContent=
      'Contract address will appear here';


    $('securityAddress').textContent=
      '—';


    $('securityAge').textContent=
      '—';


    $('securityLiq').textContent=
      '—';


    $('securityDex').textContent=
      '—';


    $('securityStatus').textContent=
      'Not checked';


    $('tradeChartLabel').textContent=
      '24h';


    $('tradeChartEmpty').style.display=
      'flex';


    $('tradeExecuteButton').textContent=
      'Select a token';


    updateTradeBalances();

    return;

  }


  const mint=
    p.baseToken?.address||'';


  const symbol=
    p.baseToken?.symbol||
    'TOKEN';


  const image=
    safeImage(
      p.info?.imageUrl
    );


  $('tradeDetailIcon').src=
    image||
    'fiji.png';


  $('tradeDetailSymbol').textContent=
    symbol;


  $('tradeDetailName').textContent=
    (
      p.baseToken?.name||
      'Token'
    )+
    ' · Solana · '+
    (
      p.dexId||
      'market'
    );


  $('tradePrice').innerHTML=
    p.priceUsd!=null
      ?formatUsd(
        p.priceUsd
      )
      :'—';


  $('tradeMc').textContent=
    formatUsd(
      p.marketCap||
      p.fdv
    );


  $('tradeLiq').textContent=
    formatUsd(
      liquidity(p)
    );


  $('tradeVol').textContent=
    formatUsd(
      volume24(p)
    );


  $('summaryToken').textContent=
    symbol;


  $('summaryLiq').textContent=
    formatUsd(
      liquidity(p)
    );


  $('summaryImpact').textContent=
    '—';


  $('summaryRoute').textContent=
    p.dexId||
    'Solana';


  $('summaryNetworkFee').textContent=
    '—';


  $('tradeReceiveAsset').textContent=
    TP.action==='buy'
      ?symbol
      :'SOL';


  $('tradeContract').textContent=
    mint||
    '—';


  $('securityAddress').textContent=
    short(mint);


  $('securityAge').textContent=
    formatAge(
      p.pairCreatedAt
    );


  $('securityLiq').textContent=
    formatUsd(
      liquidity(p)
    );


  $('securityDex').textContent=
    p.dexId||
    '—';


  $('securityStatus').textContent=
    'Market check pending';


  $('tradeChartLabel').textContent=
    symbol+
    ' · 24h';


  $('tradeChartEmpty').style.display=
    p.priceChange
      ?'none'
      :'flex';


  updateChart(
    p
  );


  updateTradeStar();


  updateTradeActionUI();


  updateTradeBalances();


  /*
    Update fee label.
  */

  $('tradeFeeNote').innerHTML=
    'FIJI platform fee · '+
    feePercent().toFixed(2)+
    '% · shown before signing.';


  /*
    Tell router-aware UI that a token changed.
  */

  updateTradePreview();

}


/* ============================================================
   CHART
============================================================ */

function updateChart(
  p
){

  const pc=
    p.priceChange||
    {};


  const h24=
    num(
      pc.h24
    );


  if(
    h24===null
  ){

    $('tradeChartEmpty').style.display=
      'flex';

    return;

  }


  $('tradeChartEmpty').style.display=
    'none';


  const positive=
    h24>=0;


  const path=
    positive

      ?'0,40 8,37 16,39 25,31 33,34 42,25 50,28 58,19 66,22 75,14 83,17 92,9 100,12'

      :'0,12 8,17 16,14 25,23 33,20 42,29 50,25 58,34 66,30 75,38 83,34 92,43 100,40';


  $('tradeChartPath').setAttribute(
    'points',
    path
  );

}


/* ============================================================
   WATCH STAR
============================================================ */

function updateTradeStar(){

  const star=
    $('tradeStar');


  if(
    !star
  )
    return;


  const watched=
    TP.selected&&
    TP.watch.has(
      tokenKey(
        TP.selected
      )
    );


  star.classList.toggle(
    'on',
    Boolean(
      watched
    )
  );


  star.textContent=
    watched
      ?'★'
      :'☆';

}


async function toggleWatch(
  p
){

  const wallet=
    walletAddress();


  if(
    !wallet
  ){

    toast(
      'Connect your wallet first'
    );

    return;

  }


  if(
    !p
  ){

    toast(
      'Select a token first'
    );

    return;

  }


  const db=
    CORE.getSupabase
      ?CORE.getSupabase()
      :null;


  if(
    !db
  ){

    toast(
      'Supabase is unavailable'
    );

    return;

  }


  const chain=
    p.chainId||
    'solana';


  const mint=
    p.baseToken?.address;


  if(
    !mint
  ){

    toast(
      'Token address unavailable'
    );

    return;

  }


  try{

    const {
      data,
      error
    }=
      await db.rpc(
        'fiji_watch_toggle',
        {

          p_wallet:
            wallet,

          p_chain:
            chain,

          p_mint:
            mint

        }
      );


    if(
      error
    )
      throw error;


    const key=
      chain+
      ':'+
      mint;


    if(
      data===true
    ){

      TP.watch.add(
        key
      );


      toast(
        'Added to watchlist ⭐'
      );

    }else{

      TP.watch.delete(
        key
      );


      toast(
        'Removed from watchlist'
      );

    }


    updateTradeStar();


    renderFeed();


    if(
      TP.mode==='watchlist'
    ){

      await tradeRefresh(
        false
      );

    }

  }catch(e){

    console.error(
      'Watchlist toggle error',
      e
    );


    toast(
      'Watchlist error: '+
      (
        e.message||
        e
      )
    );

  }

}


/* ============================================================
   ACTION UI
============================================================ */

function updateTradeActionUI(){

  const buy=
    $('buyTab');

  const sell=
    $('sellTab');


  buy.classList.toggle(
    'on',
    TP.action==='buy'
  );


  sell.classList.toggle(
    'on',
    TP.action==='sell'
  );


  buy.classList.toggle(
    'buy',
    TP.action==='buy'
  );


  sell.classList.toggle(
    'sell',
    TP.action==='sell'
  );


  $('tradePayAsset').textContent=
    TP.action==='buy'
      ?'SOL'
      :(
        TP.selected
          ?.baseToken
          ?.symbol||
        'TOKEN'
      );


  $('tradeAmountUnit').textContent=
    TP.action==='buy'
      ?'SOL'
      :(
        TP.selected
          ?.baseToken
          ?.symbol||
        'TOKEN'
      );


  $('tradeReceiveAsset').textContent=
    TP.action==='buy'
      ?(
        TP.selected
          ?.baseToken
          ?.symbol||
        'TOKEN'
      )
      :'SOL';


  $('tradeExecuteButton').textContent=
    TP.selected

      ?(
        TP.action==='buy'
          ?'BUY NOW'
          :'SELL NOW'
       )

      :'Select a token';


  updateTradeBalances();

}


function setAction(
  action
){

  TP.action=
    action==='sell'
      ?'sell'
      :'buy';


  updateTradeActionUI();


  /*
    Re-render token cards because their
    Quick Buy / Sell buttons depend on action.
  */

  renderFeed();


  updateTradePreview();

}


/* ============================================================
   QUICK PRESETS
============================================================ */

function getAvailableSol(){

  return Math.max(
    0,
    (
      TP.portfolio.sol||
      0
    )-
    TPCFG.SOL_RESERVE
  );

}


function setPreset(
  percent
){

  if(
    !TP.selected
  ){

    toast(
      'Select a token first'
    );

    return;

  }


  const pct=
    clamp(
      Number(percent)||
      0,
      0,
      100
    );


  if(
    TP.action==='buy'
  ){

    const available=
      getAvailableSol();


    if(
      available<=0
    ){

      toast(
        'Not enough SOL after network reserve'
      );

      return;

    }


    const amount=
      available*
      pct/100;


    $('tradeAmount').value=
      amount
        .toFixed(4);


  }else{

    $('tradeAmount').value=
      String(
        pct
      );


  }


  updateTradePreview();

}


/* ============================================================
   PREVIEW
============================================================ */

function routerUrl(
  path
){

  if(
    !TPCFG.TRADE_ROUTER_URL
  )
    return '';


  return(
    TPCFG.TRADE_ROUTER_URL
      .replace(
        /\/$/,
        ''
      )+
    path
  );

}


async function routerPost(
  path,
  body
){

  const url=
    routerUrl(
      path
    );


  if(
    !url
  ){

    throw new Error(
      'Trade router is not configured'
    );

  }


  return fetchJson(
    url,
    {
      method:'POST',

      headers:{
        'Content-Type':
          'application/json'
      },

      body:
        JSON.stringify(
          body
        )
    }
  );

}


function currentTradeAmount(){

  return num(
    $('tradeAmount')?.value
  );

}


function tradeAmountValid(){

  const amount=
    currentTradeAmount();


  if(
    amount===null||
    amount<=0
  )
    return false;


  if(
    TP.action==='buy'
  ){

    return amount<=
      getAvailableSol();

  }


  return amount<=100;

}


async function updateTradePreview(){

  if(
    !TP.selected
  )
    return;


  if(
    !routerUrl('/quote')
  ){

    $('summaryImpact').textContent=
      '—';


    $('summaryNetworkFee').textContent=
      '—';


    $('tradeReceiveAmount').value=
      '';


    return;

  }


  if(
    !tradeAmountValid()
  ){

    $('tradeReceiveAmount').value=
      '';


    $('summaryImpact').textContent=
      '—';


    $('summaryRoute').textContent=
      '—';


    return;

  }


  const mint=
    TP.selected
      ?.baseToken
      ?.address;


  if(
    !mint
  )
    return;


  const amount=
    currentTradeAmount();


  const slippage=
    getSlippageBps();


  try{

    const result=
      await routerPost(
        '/quote',
        {

          wallet:
            walletAddress(),

          mint,

          side:
            TP.action,

          amount,

          slippageBps:
            slippage,

          feeBps:
            TPCFG.FEE_BPS

        }
      );


    const receive=
      num(
        result.outAmount
      );


    if(
      receive!==null
    ){

      $('tradeReceiveAmount').value=
        result.outDecimals!==null
          ?Number(
            receive
          ).toLocaleString(
            undefined,
            {
              maximumFractionDigits:6
            }
          )
          :String(
            receive
          );

    }


    $('summaryImpact').textContent=
      result.priceImpactPct!=null

        ?(
          Number(
            result.priceImpactPct
          )*100
        ).toFixed(2)+
        '%'

        :'—';


    $('summaryRoute').textContent=
      result.routeLabel||
      result.route||
      'Solana';


    $('summaryNetworkFee').textContent=
      result.networkFeeSol!=null

        ?formatSol(
          result.networkFeeSol
        )+
        ' SOL'

        :'—';


    if(
      result.platformFeeBps!=null
    ){

      $('tradeFeeNote').textContent=
        'FIJI platform fee · '+
        (
          Number(
            result.platformFeeBps
          )/100
        ).toFixed(2)+
        '% · shown before signing.';

    }

  }catch(e){

    $('tradeReceiveAmount').value=
      '';


    $('summaryImpact').textContent=
      '—';


    $('summaryNetworkFee').textContent=
      '—';


    $('summaryRoute').textContent=
      'Quote unavailable';


    console.debug(
      'Trade preview unavailable',
      e
    );

  }

}


/* ============================================================
   SLIPPAGE
============================================================ */

function getSlippageBps(){

  const v=
    $('tradeSlippage')?.value||
    'auto';


  if(
    v==='auto'
  )
    return100;


  const pct=
    Number(v)||1;


  return Math.round(
    pct*
    100
  );

}


/* ============================================================
   WALLET SIGNING HELPERS
============================================================ */

function decodeBase64(
  value
){

  const binary=
    atob(
      value
    );


  const bytes=
    new Uint8Array(
      binary.length
    );


  for(
    let i=0;
    i<binary.length;
    i++
  ){

    bytes[i]=
      binary.charCodeAt(i);

  }


  return bytes;

}


async function signAndSend(
  encodedTransaction
){

  const provider=
    CORE.getProvider
      ?CORE.getProvider()
      :null;


  const connection=
    CORE.getConnection
      ?CORE.getConnection()
      :null;


  const address=
    walletAddress();


  if(
    !provider||
    !connection||
    !address
  ){

    throw new Error(
      'Wallet is not connected'
    );

  }


  if(
    !window.solanaWeb3
  ){

    throw new Error(
      'Solana Web3 library is unavailable'
    );

  }


  const bytes=
    decodeBase64(
      encodedTransaction
    );


  /*
    First try VersionedTransaction.

    Modern Solana swap routers normally return
    versioned transactions.
  */

  let versioned;


  try{

    versioned=
      solanaWeb3.VersionedTransaction.deserialize(
        bytes
      );

  }catch(e){

    versioned=
      null;

  }


  /*
    Legacy provider.
  */

  if(
    provider.signTransaction
  ){

    if(
      versioned
    ){

      const signed=
        await provider.signTransaction(
          versioned
        );


      const raw=
        signed.serialize();


      return connection.sendRawTransaction(
        raw,
        {
          maxRetries:2,
          skipPreflight:false
        }
      );

    }


    /*
      Fallback legacy transaction.
    */

    const legacy=
      solanaWeb3.Transaction.from(
        bytes
      );


    const signed=
      await provider.signTransaction(
        legacy
      );


    return connection.sendRawTransaction(
      signed.serialize(),
      {
        maxRetries:2,
        skipPreflight:false
      }
    );

  }


  /*
    Wallet Standard.
  */

  const features=
    provider
      ?.features||
    {};


  const signFeature=
    features[
      'solana:signTransaction'
    ];


  const accounts=
    provider?.accounts||
    [];


  const account=
    accounts.find(
      x=>
        x.address===
        address
    )||
    accounts[0];


  if(
    signFeature&&
    account
  ){

    const result=
      await signFeature.signTransaction({

        account,

        transaction:
          bytes,

        chain:
          'solana:mainnet'

      });


    const signed=
      result?.signedTransaction||
      result?.[0]?.signedTransaction;


    if(
      !signed
    ){

      throw new Error(
        'Wallet did not return a signed transaction'
      );

    }


    return connection.sendRawTransaction(
      signed,
      {
        maxRetries:2,
        skipPreflight:false
      }
    );

  }


  throw new Error(
    'This wallet cannot sign transactions through FIJI yet'
  );

}


/* ============================================================
   EXECUTE TRADE
============================================================ */

async function executeTrade(){

  if(
    !walletAddress()
  ){

    toast(
      'Connect your wallet first'
    );

    return;

  }


  if(
    !TP.selected
  ){

    toast(
      'Select a token first'
    );

    return;

  }


  const amount=
    currentTradeAmount();


  if(
    !tradeAmountValid()
  ){

    toast(
      TP.action==='buy'
        ?'Enter a valid SOL amount'
        :'Enter a sell percentage from 1 to 100'
    );

    return;

  }


  const button=
    $('tradeExecuteButton');


  button.disabled=
    true;


  const mint=
    TP.selected
      ?.baseToken
      ?.address;


  try{

    if(
      !routerUrl('/build')
    ){

      toast(
        'Trade router is not configured yet'
      );

      return;

    }


    /*
      Request the server-side transaction.

      The router must enforce the actual FIJI fee.
    */

    const result=
      await routerPost(
        '/build',
        {

          wallet:
            walletAddress(),

          mint,

          side:
            TP.action,

          amount,

          slippageBps:
            getSlippageBps(),

          feeBps:
            TPCFG.FEE_BPS

        }
      );


    if(
      !result?.transaction
    ){

      throw new Error(
        result?.error||
        'Trade router did not return a transaction'
      );

    }


    /*
      Explicit confirmation before the wallet popup.
    */

    const symbol=
      TP.selected
        ?.baseToken
        ?.symbol||
      'TOKEN';


    const amountText=
      TP.action==='buy'
        ?amount.toFixed(4)+
         ' SOL'
        :amount+
         '%';


    const confirmed=
      window.confirm(
        (
          TP.action==='buy'
            ?'Buy '
            :'Sell '
        )+
        symbol+
        ' · '+
        amountText+
        '\n\n'+
        'FIJI platform fee: '+
        feePercent().toFixed(2)+
        '%\n\n'+
        'Your wallet will ask you to sign the transaction.'
      );


    if(
      !confirmed
    ){

      return;

    }


    const signature=
      await signAndSend(
        result.transaction
      );


    toast(
      'Transaction sent ✔ '+
      short(signature)
    );


    /*
      Give the network a moment.
    */

    try{

      const connection=
        CORE.getConnection
          ?CORE.getConnection()
          :null;


      if(
        connection
      ){

        await connection.confirmTransaction(
          signature,
          'confirmed'
        );

      }

    }catch(e){

      console.warn(
        'Confirmation lookup failed',
        e
      );

    }


    toast(
      'Trade submitted ✔'
    );


    /*
      Refresh portfolio.
    */

    if(
      CORE.loadAssets
    ){

      await CORE.loadAssets();

    }


    await refreshSelectedToken();

  }catch(e){

    console.error(
      'Trade execution failed',
      e
    );


    toast(
      'Trade failed: '+
      (
        e.message||
        e
      )
    );

  }finally{

    button.disabled=
      false;

  }

}


/* ============================================================
   QUICK BUY
============================================================ */

async function quickBuyByKey(
  key
){

  const p=
    findByKey(
      key
    );


  if(
    !p
  ){

    toast(
      'Token data is no longer available'
    );

    return;

  }


  TP.selected=
    p;


  updateSelectedUI();


  TP.action=
    'buy';


  updateTradeActionUI();


  const amount=
    0.10;


  const available=
    getAvailableSol();


  if(
    available<
    amount
  ){

    toast(
      'You need at least 0.10 SOL available'
    );

    return;

  }


  $('tradeAmount').value=
    amount.toFixed(2);


  updateTradePreview();


  await executeTrade();

}


/* ============================================================
   SELECT TOKEN
============================================================ */

async function selectByKey(
  key
){

  let p=
    findByKey(
      key
    );


  if(
    !p
  )
    return;


  /*
    Enrich live lightweight objects before
    showing them when possible.
  */

  if(
    !p.priceUsd
  ){

    try{

      const rows=
        await fetchTokenPairs(
          [
            p.baseToken.address
          ]
        );


      if(
        rows[0]
      ){

        const oldDiscovery=
          p.discoveryType;


        const oldBond=
          p.bonding;


        Object.assign(
          p,
          rows[0]
        );


        p.discoveryType=
          oldDiscovery;


        p.bonding=
          oldBond;

      }

    }catch(e){}

  }


  TP.selected=
    p;


  updateSelectedUI();


  /*
    Refresh the exact selected pair shortly after.
  */

  refreshSelectedToken();

}


async function refreshSelectedToken(){

  const p=
    TP.selected;


  if(
    !p?.baseToken?.address
  )
    return;


  try{

    const rows=
      await fetchTokenPairs(
        [
          p.baseToken.address
        ]
      );


    const latest=
      rows[0];


    if(
      !latest
    )
      return;


    const discovery=
      p.discoveryType;


    const bonding=
      p.bonding;


    Object.assign(
      p,
      latest
    );


    p.discoveryType=
      discovery;


    p.bonding=
      bonding;


    /*
      If the feed item exists,
      keep it updated too.
    */

    const feedItem=
      TP.feed.find(
        x=>
          tokenKey(x)===
          tokenKey(p)
      );


    if(
      feedItem
    ){

      Object.assign(
        feedItem,
        p
      );

      feedItem.discoveryType=
        discovery;

      feedItem.bonding=
        bonding;

    }


    updateSelectedUI();

  }catch(e){

    console.debug(
      'Selected token refresh unavailable',
      e
    );

  }

}


/* ============================================================
   SECURITY STATUS
============================================================ */

function setSecurityStatus(
 text
){

  if(
    $('securityStatus')
  ){

    $('securityStatus').textContent=
      text;

  }

}


async function runLightSecurity(){

  const p=
    TP.selected;


  if(
    !p
  )
    return;


  /*
    This is intentionally a basic market check.
    Full RugCheck / holder analysis belongs in the
    backend or a separate API integration.
  */

  if(
    liquidity(p)<=0
  ){

    setSecurityStatus(
      'Liquidity not available'
    );

  }else if(
    liquidity(p)<5000
  ){

    setSecurityStatus(
      'Low liquidity'
    );

  }else{

    setSecurityStatus(
      'Basic market data loaded'
    );

  }

}


/* ============================================================
   SEARCH
============================================================ */

let searchTimer=
  null;


async function applySearch(){

  TP.search=
    String(
      $('tradeSearch')
        ?.value||
      ''
    )
    .trim()
    .toLowerCase();


  if(
    !TP.search
  ){

    renderFeed();

    return;

  }


  /*
    First filter currently loaded data.
  */

  const loaded=
    TP.feed.filter(
      p=>{

        const symbol=
          String(
            p?.baseToken?.symbol||
            ''
          )
          .toLowerCase();


        const name=
          String(
            p?.baseToken?.name||
            ''
          )
          .toLowerCase();


        const mint=
          String(
            p?.baseToken?.address||
            ''
          )
          .toLowerCase();


        return(
          symbol.includes(TP.search)||
          name.includes(TP.search)||
          mint.includes(TP.search)
        );

      }
    );


  if(
    loaded.length
  ){

    TP.feed=
      loaded.slice(
        0,
        TPCFG.MAX_FEED
      );


    renderFeed();

    return;

  }


  /*
    Search DEX Screener when the token isn't already loaded.
  */

  try{

    const data=
      await ds(
        '/latest/dex/search?q='+
        encodeURIComponent(
          TP.search
        ),
        4000
      );


    const pairs=
      (
        data?.pairs||
        []
      )
      .filter(
        p=>
          p?.chainId===
          'solana'
      );


    TP.feed=
      mergeByMint(
        pairs
      )
      .slice(
        0,
        TPCFG.MAX_FEED
      );


    renderFeed();

  }catch(e){

    console.warn(
      'Search failed',
      e
    );

  }

}


/* ============================================================
   REFRESH
============================================================ */

async function refresh(
  forced=false
){

  if(
    TP.loading&&
    !forced
  )
    return;


  TP.loading=
    true;


  TP.error=
    '';


  if(
    !TP.feed.length
  )
    renderFeed();


  try{

    if(
      TP.mode==='watchlist'
    ){

      await loadWatchlist();

    }


    let rows=
      await getFeed();


    /*
      Search filter after the current feed is loaded.
    */

    if(
      TP.search
    ){

      const q=
        TP.search;


      rows=
        rows.filter(
          p=>{

            const symbol=
              String(
                p?.baseToken?.symbol||
                ''
              )
              .toLowerCase();


            const name=
              String(
                p?.baseToken?.name||
                ''
              )
              .toLowerCase();


            const mint=
              String(
                p?.baseToken?.address||
                ''
              )
              .toLowerCase();


            return(
              symbol.includes(q)||
              name.includes(q)||
              mint.includes(q)
            );

          }
        );

    }


    /*
      Additional mode-specific sorting.
    */

    if(
      TP.mode==='trending'
    ){

      rows.sort(
        (a,b)=>
          (
            volume1h(b)-
            volume1h(a)
          )+
          (
            transactions24(b)-
            transactions24(a)
          )*25
      );

    }


    if(
      TP.mode==='new'
    ){

      rows.sort(
        (a,b)=>
          Number(
            b.pairCreatedAt||0
          )-
          Number(
            a.pairCreatedAt||0
          )
      );

    }


    if(
      TP.mode==='migrated'
    ){

      rows.sort(
        (a,b)=>
          Number(
            b.pairCreatedAt||0
          )-
          Number(
            a.pairCreatedAt||0
          )
      );

    }


    TP.feed=
      mergeByMint(
        rows
      )
      .slice(
        0,
        TPCFG.MAX_FEED
      );


    TP.updatedAt=
      Date.now();


    renderFeed();


    if(
      TP.selected
    ){

      const updated=
        TP.feed.find(
          p=>
            tokenKey(p)===
            tokenKey(
              TP.selected
            )
        );


      if(
        updated
      ){

        TP.selected=
          updated;

        updateSelectedUI();

      }

    }


    await runLightSecurity();


  }catch(e){

    console.error(
      'Trade refresh error',
      e
    );


    TP.error=
      'Could not load live Solana discovery right now.';


    renderFeed();

  }finally{

    TP.loading=
      false;


    updateLiveStatus();

  }

}


/* ============================================================
   RUNTIME REFRESH
============================================================ */

function startTimers(){

  clearInterval(
    TP.refreshTimer
  );


  clearInterval(
    TP.ageTimer
  );


  TP.refreshTimer=
    setInterval(
      ()=>{

        if(
          TP.started&&
          !document.hidden
        ){

          refresh(
            false
          );

        }

      },
      TPCFG.REFRESH_MS
    );


  TP.ageTimer=
    setInterval(
      ()=>{

        updateLiveStatus();


        /*
          Age labels are part of rendered cards,
          so repaint the current feed without
          triggering a network request.
        */

        if(
          TP.feed.length
        )
          renderFeed();

      },
      30000
    );

}


function stopTimers(){

  clearInterval(
    TP.refreshTimer
  );


  clearInterval(
    TP.ageTimer
  );


  TP.refreshTimer=
    null;


  TP.ageTimer=
    null;

}


/* ============================================================
   TRADE PAD PUBLIC METHODS
============================================================ */

function start(){

  if(
    TP.started
  ){

    updatePortfolioFromCore({
      sol:
        TP.portfolio.sol,
      tokens:
        TP.portfolio.tokens
    });

    return;

  }


  TP.started=
    true;


  TP.mode=
    'new';


  TP.action=
    'buy';


  TP.error=
    '';


  renderModeTabs();


  renderFeed();


  startTimers();


  openPumpSocket();


  loadWatchlist()
    .catch(
      ()=>{}
    );


  refresh(
    true
  );


  updateTradeActionUI();


  updateTradeBalances();

}


function stop(){

  TP.started=
    false;


  stopTimers();


  closePumpSocket();

}


/* ============================================================
   MODE SWITCH
============================================================ */

async function setMode(
  mode
){

  const allowed=[
    'new',
    'trending',
    'bonding',
    'migrated',
    'watchlist'
  ];


  if(
    !allowed.includes(
      mode
    )
  )
    mode='new';


  TP.mode=
    mode;


  TP.feed=[];


  renderModeTabs();


  renderFeed();


  await refresh(
    true
  );

}


function renderModeTabs(){

  document
    .querySelectorAll(
      '.discovery-tab'
    )
    .forEach(
      button=>{

        button.classList.toggle(
          'on',
          button.dataset.mode===
          TP.mode
        );

      }
    );

}


/* ============================================================
   WATCHLIST PUBLIC
============================================================ */

async function publicToggleWatch(){

  if(
    !TP.selected
  ){

    toast(
      'Select a token first'
    );

    return;

  }


  await toggleWatch(
    TP.selected
  );

}


/* ============================================================
   ACTION PUBLIC
============================================================ */

function publicSetAction(
  action
){

  setAction(
    action
  );

}


function publicSetPreset(
  percent
){

  setPreset(
    percent
  );

}


function publicFlipSide(){

  if(
    TP.action==='buy'
  ){

    setAction(
      'sell'
    );

  }else{

    setAction(
      'buy'
    );

  }

}


/* ============================================================
   CONTRACT COPY
============================================================ */

async function publicCopyContract(){

  const mint=
    TP.selected
      ?.baseToken
      ?.address;


  if(
    !mint
  ){

    toast(
      'Select a token first'
    );

    return;

  }


  try{

    await navigator.clipboard.writeText(
      mint
    );


    toast(
      'Contract copied 💧'
    );

  }catch(e){

    toast(
      'Copy failed'
    );

  }

}


/* ============================================================
   PUBLIC REFRESH
============================================================ */

async function publicRefresh(
  forced=false
){

  await refresh(
    Boolean(
      forced
    )
  );

}


/* ============================================================
   PUBLIC SEARCH
============================================================ */

function publicSearch(
  value
){

  TP.search=
    String(
      value||''
    )
    .trim()
    .toLowerCase();


  clearTimeout(
    searchTimer
  );


  searchTimer=
    setTimeout(
      applySearch,
      180
    );

}


/* ============================================================
   PUBLIC EXECUTE
============================================================ */

async function publicExecute(){

  await executeTrade();

}


/* ============================================================
   PUBLIC QUICK BUY
============================================================ */

async function publicQuickBuy(
  key
){

  await quickBuyByKey(
    key
  );

}


/* ============================================================
   PUBLIC SNIPER
============================================================ */

function publicToggleSniper(){

  /*
    This remains a configuration UI only.
    Automated execution will be enabled later
    through the backend after the normal trade
    path has been tested.
  */

  TP.sniper=
    !TP.sniper;


  const button=
    $('sniperButton');


  if(
    !button
  )
    return;


  button.textContent=
    TP.sniper
      ?'🛑 Disarm Sniper'
      :'⚡ Arm Sniper';


  toast(
    TP.sniper
      ?'Sniper monitor armed'
      :'Sniper monitor disarmed'
  );

}


/* ============================================================
   WALLET CHANGE HOOK
============================================================ */

async function walletChanged(
  address
){

  if(
    address
  ){

    await loadWatchlist();

  }else{

    TP.watch.clear();

  }


  updateTradeBalances();


  updateTradeStar();


  if(
    TP.mode==='watchlist'
  ){

    TP.feed=[];

    await refresh(
      true
    );

  }

}


/* ============================================================
   PORTFOLIO UPDATE HOOK
============================================================ */

function portfolioUpdated(
  payload
){

  updatePortfolioFromCore(
    payload
  );


  updateTradePreview();

}


/* ============================================================
   EXPOSE API
============================================================ */

window.FIJI_TRADE={

  start,

  stop,

  setMode,

  refresh:publicRefresh,

  search:publicSearch,

  setAction:publicSetAction,

  setPreset:publicSetPreset,

  flipSide:publicFlipSide,

  toggleWatch:publicToggleWatch,

  copyContract:
    publicCopyContract,

  execute:
    publicExecute,

  quickBuy:
    publicQuickBuy,

  toggleSniper:
    publicToggleSniper,

  walletChanged,

  portfolioUpdated,

  getState:
    ()=>TP

};


/*
  The index.html already calls these names directly,
  but expose the helpers globally too.
*/

window.tradeSetMode=
  setMode;

window.tradeRefresh=
  publicRefresh;

window.tradeToggleWatch=
  publicToggleWatch;

window.tradeSetAction=
  publicSetAction;

window.tradeSetPreset=
  publicSetPreset;

window.tradeFlipSide=
  publicFlipSide;

window.tradeExecute=
  publicExecute;

window.tradeQuickBuy=
  publicQuickBuy;

window.tradeSelectByKey=
  selectByKey;

window.tradeCopyContract=
  publicCopyContract;

window.tradeToggleSniper=
  publicToggleSniper;


/* ============================================================
   DOM HOOKS
============================================================ */

/*
  Search input.
*/

const tradeSearch=
  $('tradeSearch');


if(
  tradeSearch
){

  tradeSearch.addEventListener(
    'input',
    ()=>{
      publicSearch(
        tradeSearch.value
      );
    }
  );

}


/*
  Slippage.
*/

const slippage=
  $('tradeSlippage');


if(
  slippage
){

  slippage.addEventListener(
    'change',
    ()=>{
      updateTradePreview();
    }
  );

}


/*
  Amount.
*/

const amount=
  $('tradeAmount');


if(
  amount
){

  amount.addEventListener(
    'input',
    ()=>{
      updateTradePreview();
    }
  );

}


/*
  Wallet Core event support.

  The main index.html will call
  FIJI_TRADE.walletChanged()
  and FIJI_TRADE.portfolioUpdated().
*/


/* ============================================================
   INITIAL STATIC UI
============================================================ */

updateTradeActionUI();

updateTradeBalances();

renderModeTabs();


/* ============================================================
   START ONLY WHEN TRADE TAB OPENS
============================================================ */

if(
  document
    .getElementById(
      'trade'
    )
    ?.classList.contains(
      'on'
    )
){

  start();

}


})();
