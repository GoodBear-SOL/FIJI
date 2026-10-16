(function () {
  const SRC = 'cute-bgmusic.mp3?v=2';
  const DEFAULT_VOL = 0.3;
  const KEY = 'fiji_bgm';


  let st = { vol: DEFAULT_VOL, muted: false };
  try { Object.assign(st, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  const audio = new Audio(SRC);
  audio.loop = true;
  audio.preload = 'auto';
  const apply = () => { audio.volume = Math.min(1, Math.max(0, st.vol)); audio.muted = st.muted; };
  apply();

  let started = false;
  function start() {
    if (started) return;
    audio.play().then(() => { started = true; removeUnlock(); }).catch(() => {});
  }

  const unlockEvents = ['pointerdown', 'touchend', 'keydown', 'click'];
  const unlock = () => start();
  const removeUnlock = () => unlockEvents.forEach(ev => window.removeEventListener(ev, unlock, true));
  unlockEvents.forEach(ev => window.addEventListener(ev, unlock, true));
  start();


  document.addEventListener('visibilitychange', () => {
    if (!started) return;
    if (document.hidden) audio.pause();
    else audio.play().catch(() => {});
  });

  const css = document.createElement('style');
  css.textContent = `
  .bgm-wrap{position:relative;display:flex;align-items:center}
  .bgm-gear{width:36px;height:36px;padding:0;display:flex;align-items:center;justify-content:center;
    border:2.5px solid var(--ink);border-radius:50%;background:#fff;cursor:pointer;position:relative}
  .bgm-gear:hover,.bgm-gear.open{background:var(--sun)}
  .bgm-gear svg{width:19px;height:19px;fill:var(--ink)}
  .bgm-gear.muted:after{content:"";position:absolute;width:22px;height:2.5px;background:var(--dni);
    transform:rotate(-45deg);border-radius:2px}
  .bgm-panel{display:none;position:absolute;right:0;top:calc(100% + 12px);width:230px;z-index:50;
    background:#fff;border:3px solid var(--ink);border-radius:20px;box-shadow:0 5px 0 var(--ink);padding:14px}
  .bgm-panel.open{display:block}
  .bgm-panel h4{font:600 17px Fredoka,sans-serif;margin:0 0 10px}
  .bgm-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;font-size:14px}
  .bgm-mute{border:2.5px solid var(--ink);border-radius:99px;background:var(--sun);padding:4px 14px;
    font:600 14px Fredoka,sans-serif;cursor:pointer;color:var(--ink)}
  .bgm-mute.on{background:#FFD0D8}
  .bgm-vol{display:flex;align-items:center;gap:8px}
  .bgm-vol input[type=range]{flex:1;margin:0;padding:0;border:0;border-radius:99px;height:8px;
    accent-color:var(--blue);background:transparent;cursor:pointer}
  .bgm-vol input[type=range]:focus{box-shadow:none}
  .bgm-vol span{font:600 13px Fredoka,sans-serif;min-width:38px;text-align:right}
  @media(max-width:760px){.bgm-gear{width:32px;height:32px}.bgm-panel{width:210px}}
  `;
  document.head.appendChild(css);


  const gearSvg = '<svg viewBox="0 0 24 24"><path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.49.49 0 0 0-.48-.41h-3.84a.49.49 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.74 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.05.31-.08.63-.08.94s.03.63.08.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.37.29.6.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z"/></svg>';

  const wrap = document.createElement('div');
  wrap.className = 'bgm-wrap';
  wrap.innerHTML =
    '<button type="button" class="bgm-gear" aria-label="Music settings" aria-expanded="false">' + gearSvg + '</button>' +
    '<div class="bgm-panel" role="dialog" aria-label="Music settings">' +
      '<h4>🎵 Music</h4>' +
      '<div class="bgm-row"><span>Background music</span><button type="button" class="bgm-mute"></button></div>' +
      '<div class="bgm-vol"><span style="min-width:auto">🔈</span>' +
        '<input type="range" min="0" max="100" step="1" aria-label="Volume"><span class="bgm-pct"></span></div>' +
    '</div>';

  const gear = wrap.querySelector('.bgm-gear');
  const panel = wrap.querySelector('.bgm-panel');
  const muteBtn = wrap.querySelector('.bgm-mute');
  const slider = wrap.querySelector('input[type=range]');
  const pct = wrap.querySelector('.bgm-pct');

  function refresh() {
    slider.value = Math.round(st.vol * 100);
    pct.textContent = Math.round(st.vol * 100) + '%';
    muteBtn.textContent = st.muted ? '🔇 Off' : '🔊 On';
    muteBtn.classList.toggle('on', st.muted);
    gear.classList.toggle('muted', st.muted);
  }
  refresh();

  muteBtn.addEventListener('click', () => {
    st.muted = !st.muted; apply(); save(); refresh(); start();
  });
  slider.addEventListener('input', () => {
    st.vol = slider.value / 100;
    if (st.vol > 0 && st.muted) st.muted = false;
    apply(); save(); refresh(); start();
  });
  gear.addEventListener('click', e => {
    e.stopPropagation();
    const open = panel.classList.toggle('open');
    gear.classList.toggle('open', open);
    gear.setAttribute('aria-expanded', open);
  });
  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) { panel.classList.remove('open'); gear.classList.remove('open'); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { panel.classList.remove('open'); gear.classList.remove('open'); }
  });

  function mount() {
    const cbtn = document.getElementById('cbtn');
    if (cbtn && cbtn.parentNode) cbtn.parentNode.insertBefore(wrap, cbtn);
    else document.body.appendChild(wrap);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();

  window.FIJI_MUSIC = { audio, getState: () => ({ ...st }) };
})();
