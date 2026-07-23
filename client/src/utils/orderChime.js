let audioCtx = null;
let chimeAudio = null;
let audioPrimed = false;
let needsUnlockPrompt = false;
const primedListeners = new Set();

const notifyPrimedListeners = () => {
  primedListeners.forEach((fn) => {
    try {
      fn(audioPrimed, needsUnlockPrompt);
    } catch {
      /* ignore */
    }
  });
};

export const isMobileBrowser = () => {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
};

export const isOrderChimePrimed = () => audioPrimed;

export const orderChimeNeedsPrompt = () => needsUnlockPrompt || !audioPrimed;

export const subscribeOrderChimeState = (listener) => {
  primedListeners.add(listener);
  listener(audioPrimed, needsUnlockPrompt);
  return () => primedListeners.delete(listener);
};

export const markChimeNeedsUnlock = () => {
  needsUnlockPrompt = true;
  notifyPrimedListeners();
};

const setPrimed = (value) => {
  audioPrimed = value;
  if (value) needsUnlockPrompt = false;
  notifyPrimedListeners();
};

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioCtx = new AudioCtx();
  }
  return audioCtx;
};

const makeBeepDataUri = () => {
  const sampleRate = 44100;
  const duration = 0.45;
  const freq = 880;
  const numSamples = Math.floor(sampleRate * duration);
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const attack = Math.min(1, t * 25);
    const decay = Math.max(0, 1 - Math.max(0, t - 0.12) * 5);
    const sample = Math.sin(2 * Math.PI * freq * t) * attack * decay * 0.65;
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
};

const attachAudioElement = (audio) => {
  if (!audio || typeof document === 'undefined') return;
  audio.setAttribute('playsinline', '');
  audio.setAttribute('webkit-playsinline', '');
  audio.preload = 'auto';
  if (!audio.isConnected) {
    audio.style.display = 'none';
    document.body.appendChild(audio);
  }
};

const getChimeAudio = () => {
  if (typeof window === 'undefined') return null;
  if (!chimeAudio) {
    chimeAudio = new Audio(makeBeepDataUri());
    attachAudioElement(chimeAudio);
  }
  return chimeAudio;
};

/** Synchronous play call — must run inside touch/click handler (Android Chrome). */
const primeHtmlAudioSync = () => {
  const audio = getChimeAudio();
  if (!audio) return false;

  try {
    audio.volume = 0.001;
    audio.currentTime = 0;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = 1;
          setPrimed(true);
        })
        .catch(() => {
          markChimeNeedsUnlock();
        });
    }
    return true;
  } catch {
    markChimeNeedsUnlock();
    return false;
  }
};

const primeWebAudioSync = () => {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => setPrimed(true)).catch(() => {});
  } else if (ctx.state === 'running') {
    setPrimed(true);
  }
};

/** Call during a user gesture so later socket chimes work on mobile. */
export const unlockOrderChimeAudio = async () => {
  primeHtmlAudioSync();
  primeWebAudioSync();
  return audioPrimed;
};

/** Explicit tap — plays audible test chime (best for Android Chrome). */
export const enableOrderChimeWithTestSound = async () => {
  const audio = getChimeAudio();
  if (!audio) return false;

  try {
    attachAudioElement(audio);
    audio.volume = 1;
    audio.currentTime = 0;
    await audio.play();
    setPrimed(true);
    return true;
  } catch {
    markChimeNeedsUnlock();
    return false;
  }
};

const playOscillatorChime = (ctx) => {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(587.33, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.55, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.45);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();
  osc.stop(ctx.currentTime + 0.45);
};

const playHtmlChime = async () => {
  const template = getChimeAudio();
  if (!template) return false;

  const audio = template.cloneNode(true);
  attachAudioElement(audio);
  audio.volume = 1;
  audio.currentTime = 0;

  try {
    await audio.play();
    audio.onended = () => audio.remove();
    setTimeout(() => {
      if (audio.isConnected) audio.remove();
    }, 2000);
    return true;
  } catch {
    if (audio.isConnected) audio.remove();
    return false;
  }
};

if (typeof window !== 'undefined') {
  const unlockFromGesture = () => {
    unlockOrderChimeAudio();
  };

  window.addEventListener('pointerdown', unlockFromGesture, true);
  window.addEventListener('touchstart', unlockFromGesture, true);
  window.addEventListener('click', unlockFromGesture, true);

  if (isMobileBrowser()) {
    needsUnlockPrompt = true;
    notifyPrimedListeners();
  }
}

/** @returns {Promise<boolean>} */
export const playOrderChime = async () => {
  if (isMobileBrowser()) {
    try {
      const htmlPlayed = await playHtmlChime();
      if (htmlPlayed) return true;
    } catch {
      /* try web audio */
    }
  }

  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          /* fall through */
        }
      }
      if (ctx.state === 'running') {
        playOscillatorChime(ctx);
        return true;
      }
    }
  } catch {
    /* fall through */
  }

  try {
    return await playHtmlChime();
  } catch (e) {
    console.log('Audio playback prevented or unsupported', e);
    markChimeNeedsUnlock();
    return false;
  }
};
