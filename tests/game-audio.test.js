import test from "node:test";
import assert from "node:assert/strict";
import { SOUND_STORAGE_KEY, createGameAudio } from "../src/game-audio.js";

class FakeParam {
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

class FakeNode {
  constructor(context) {
    this.context = context;
    this.frequency = new FakeParam();
    this.Q = new FakeParam();
    this.gain = new FakeParam();
  }

  connect() { return this; }
  start() { this.context.starts += 1; }
  stop() {}
}

class FakeAudioContext {
  constructor() {
    FakeAudioContext.instances += 1;
    this.currentTime = 1;
    this.sampleRate = 8000;
    this.state = "suspended";
    this.destination = {};
    this.starts = 0;
    FakeAudioContext.latest = this;
  }

  async resume() { this.state = "running"; }
  async close() { this.state = "closed"; }
  createOscillator() { return new FakeNode(this); }
  createGain() { return new FakeNode(this); }
  createBufferSource() { return new FakeNode(this); }
  createBiquadFilter() { return new FakeNode(this); }
  createBuffer(_channels, frameCount) {
    const samples = new Float32Array(frameCount);
    return { getChannelData: () => samples };
  }
}

FakeAudioContext.instances = 0;
FakeAudioContext.latest = null;

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    value: (key) => values.get(key) ?? null
  };
}

test("sound stays muted until the user enables it", async () => {
  const storage = memoryStorage();
  const audio = createGameAudio({ AudioContextClass: FakeAudioContext, storage });

  assert.equal(audio.isEnabled(), false);
  assert.equal(audio.playChew(), false);
  assert.equal(FakeAudioContext.instances, 0);

  assert.equal(await audio.setEnabled(true), true);
  assert.equal(storage.value(SOUND_STORAGE_KEY), "on");
  assert.equal(audio.playChew(), true);
  assert.ok(FakeAudioContext.latest.starts >= 2);
});

test("all cues stop immediately after muting", async () => {
  const storage = memoryStorage({ [SOUND_STORAGE_KEY]: "on" });
  const audio = createGameAudio({ AudioContextClass: FakeAudioContext, storage });
  await audio.unlock();
  const before = FakeAudioContext.latest.starts;

  assert.equal(audio.playSprint(), true);
  assert.equal(audio.playVictory(), true);
  assert.ok(FakeAudioContext.latest.starts > before);

  await audio.setEnabled(false);
  const afterMute = FakeAudioContext.latest.starts;
  assert.equal(storage.value(SOUND_STORAGE_KEY), "off");
  assert.equal(FakeAudioContext.latest.state, "closed");
  assert.equal(audio.playReady(), false);
  assert.equal(audio.playChew(), false);
  assert.equal(FakeAudioContext.latest.starts, afterMute);
});
