let audioCtx = null;
let unlockListenersAttached = false;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx = new AudioCtx();
  }
  return audioCtx;
};

/** Call during a user gesture so later socket/poll chimes can play on mobile. */
export const unlockOrderChimeAudio = () => {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }

  // iOS Safari: play a silent buffer inside the gesture to fully unlock output.
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    // ignore
  }
};

const attachUnlockListeners = () => {
  if (unlockListenersAttached || typeof window === 'undefined') return;
  unlockListenersAttached = true;

  const unlockOnce = () => {
    unlockOrderChimeAudio();
    window.removeEventListener('pointerdown', unlockOnce, true);
    window.removeEventListener('touchstart', unlockOnce, true);
    window.removeEventListener('keydown', unlockOnce, true);
  };

  window.addEventListener('pointerdown', unlockOnce, true);
  window.addEventListener('touchstart', unlockOnce, true);
  window.addEventListener('keydown', unlockOnce, true);
};

attachUnlockListeners();

export const playOrderChime = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch (e) {
    console.log('Audio playback prevented or unsupported', e);
  }
};
