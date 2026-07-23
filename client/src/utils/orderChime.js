let audioCtx = null;
let chimeAudio = null;
let audioPrimed = false;

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

const getChimeAudio = () => {
  if (typeof window === 'undefined') return null;
  if (!chimeAudio) {
    chimeAudio = new Audio(makeBeepDataUri());
    chimeAudio.preload = 'auto';
  }
  return chimeAudio;
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
  const audio = getChimeAudio();
  if (!audio) return false;

  audio.currentTime = 0;
  audio.volume = 1;
  await audio.play();
  return true;
};

/** Call during a user gesture so later socket/poll chimes can play on mobile. */
export const unlockOrderChimeAudio = async () => {
  const ctx = getAudioContext();
  if (ctx) {
    try {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      if (ctx.state === 'running') {
        audioPrimed = true;
      }
    } catch {
      // fall through
    }
  }

  try {
    const audio = getChimeAudio();
    if (!audio) return audioPrimed;
    const prevVolume = audio.volume;
    audio.volume = 0.001;
    audio.currentTime = 0;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.volume = prevVolume || 1;
    audioPrimed = true;
  } catch {
    // expected before first user gesture
  }

  return audioPrimed;
};

if (typeof window !== 'undefined') {
  const unlockFromGesture = () => {
    unlockOrderChimeAudio().catch(() => {});
  };

  window.addEventListener('pointerdown', unlockFromGesture, true);
  window.addEventListener('touchstart', unlockFromGesture, true);
  window.addEventListener('keydown', unlockFromGesture, true);
}

/** @returns {Promise<boolean>} */
export const playOrderChime = async () => {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
        } catch {
          // resume outside gesture — try HTML fallback
        }
      }
      if (ctx.state === 'running') {
        playOscillatorChime(ctx);
        return true;
      }
    }
  } catch {
    // try HTML fallback
  }

  try {
    await playHtmlChime();
    return true;
  } catch (e) {
    console.log('Audio playback prevented or unsupported', e);
    return false;
  }
};

export const isOrderChimePrimed = () => audioPrimed;
