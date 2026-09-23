export const SOUND_STORAGE_KEY = "mooncake-feast-race:sound-enabled";

/**
 * 建立不依賴外部音檔的遊戲音效控制器。
 * 音效必須先由使用者開啟，符合行動瀏覽器的自動播放限制。
 */
export function createGameAudio(options = {}) {
  const AudioContextClass = options.AudioContextClass
    ?? globalThis.AudioContext
    ?? globalThis.webkitAudioContext
    ?? null;
  const storage = options.storage ?? globalThis.localStorage ?? null;
  let enabled = readPreference(storage) && Boolean(AudioContextClass);
  let context = null;

  function isSupported() { return Boolean(AudioContextClass); }
  function isEnabled() { return enabled; }

  async function setEnabled(nextEnabled) {
    enabled = Boolean(nextEnabled) && isSupported();
    persistPreference(storage, enabled);
    if (enabled) {
      await unlock();
    } else if (context) {
      await context.close();
      context = null;
    }
    return enabled;
  }

  async function unlock() {
    if (!enabled || !isSupported()) return false;
    context ||= new AudioContextClass();
    if (context.state === "suspended") await context.resume();
    return context.state !== "suspended";
  }

  function readyContext() {
    if (!enabled || !isSupported()) return null;
    context ||= new AudioContextClass();
    if (context.state === "suspended") context.resume().catch(() => {});
    return context;
  }

  function playReady() {
    const audio = readyContext();
    if (!audio) return false;
    const start = audio.currentTime;
    tone(audio, start, 440, 620, 0.13, 0.055, "sine");
    tone(audio, start + 0.11, 620, 820, 0.15, 0.045, "sine");
    return true;
  }

  function playChew(count = 1) {
    const audio = readyContext();
    if (!audio) return false;
    const repetitions = Math.max(1, Math.min(4, Math.round(count)));
    for (let index = 0; index < repetitions; index += 1) {
      const start = audio.currentTime + index * 0.055;
      noiseBurst(audio, start, 0.085, 820 + index * 90, 0.07);
      tone(audio, start, 185 + index * 15, 92, 0.09, 0.04, "triangle");
    }
    return true;
  }

  function playSprint() {
    const audio = readyContext();
    if (!audio) return false;
    const start = audio.currentTime;
    noiseBurst(audio, start, 0.68, 1250, 0.045);
    [260, 390, 585, 780].forEach((frequency, index) => {
      tone(audio, start + index * 0.1, frequency, frequency * 1.34, 0.26, 0.052, "sawtooth");
    });
    return true;
  }

  function playVictory() {
    const audio = readyContext();
    if (!audio) return false;
    const start = audio.currentTime;
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      tone(audio, start + index * 0.08, frequency, frequency, 0.62, 0.052, "triangle");
      tone(audio, start + 0.42 + index * 0.04, frequency * 1.5, frequency * 1.55, 0.72, 0.045, "sine");
    });
    [0.04, 0.19, 0.36].forEach((offset) => noiseBurst(audio, start + offset, 0.22, 1550, 0.035));
    return true;
  }

  return { isSupported, isEnabled, setEnabled, unlock, playReady, playChew, playSprint, playVictory };
}

function readPreference(storage) {
  try { return storage?.getItem(SOUND_STORAGE_KEY) === "on"; } catch { return false; }
}

function persistPreference(storage, enabled) {
  try { storage?.setItem(SOUND_STORAGE_KEY, enabled ? "on" : "off"); } catch { /* Storage can be unavailable in private browsing. */ }
}

function tone(audio, start, startFrequency, endFrequency, duration, volume, type) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(startFrequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function noiseBurst(audio, start, duration, frequency, volume) {
  const frameCount = Math.max(1, Math.round(audio.sampleRate * duration));
  const buffer = audio.createBuffer(1, frameCount, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = (Math.random() * 2 - 1) * (1 - index / samples.length);
  }
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(frequency, start);
  filter.Q.setValueAtTime(0.85, start);
  gain.gain.setValueAtTime(volume, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start(start);
  source.stop(start + duration + 0.02);
}
