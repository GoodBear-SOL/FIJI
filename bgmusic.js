(function () {
  const SRC = 'cute-bgmusic.mp3?v=2';
  const DEFAULT_VOL = 0.3;
  const KEY = 'fiji_bgm';

  let st = { vol: DEFAULT_VOL };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (typeof saved.vol === 'number') st.vol = saved.vol;
  } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} };

  const isMuted = () => !!(window.FIJI_SOUND && window.FIJI_SOUND.isMuted());

  const audio = new Audio(SRC);
  audio.loop = true;
  audio.preload = 'auto';
  const apply = () => {
    audio.volume = Math.min(1, Math.max(0, st.vol));
    audio.muted = isMuted();
  };
  apply();

  window.addEventListener('fiji:sound', apply);

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

  window.FIJI_MUSIC = {
    audio,
    getState: () => ({ vol: st.vol, muted: isMuted() }),
    getVolume: () => st.vol,
    setVolume(v) {
      st.vol = Math.min(1, Math.max(0, Number(v) || 0));
      apply(); save(); start();
    }
  };
})();
