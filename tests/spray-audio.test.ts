import { afterEach, describe, expect, it, vi } from 'vitest';
import { SprayCanAudio } from '../src/spray-audio';

function installAudio() {
  const ramps: number[] = [];
  const gain = { value: 0, cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn((_, _t) => undefined), linearRampToValueAtTime: (value: number) => { ramps.push(value); } };
  const node = { connect: vi.fn(function (this: unknown) { return this; }), start: vi.fn(), stop: vi.fn() };
  class FakeContext {
    sampleRate = 8000;
    currentTime = 0;
    state = 'running';
    destination = {};
    createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
    createBufferSource() { return { ...node, buffer: null, loop: false }; }
    createBiquadFilter() { return { ...node, type: 'lowpass', frequency: { value: 0 }, Q: { value: 0 } }; }
    createGain() { return { ...node, gain }; }
    resume() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
  }
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('window', Object.assign(new EventTarget(), { AudioContext: FakeContext, setTimeout, clearTimeout }));
  return { ramps, audio: new SprayCanAudio() };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('spray can audio', () => {
  it('stays hissing after a click-sized start/stop so the burst is audible', () => {
    vi.useFakeTimers();
    const { ramps, audio } = installAudio();
    audio.start();
    expect(ramps).toContain(0.14);
    audio.stop();
    expect(ramps).not.toContain(0);
    vi.advanceTimersByTime(319);
    expect(ramps).not.toContain(0);
    vi.advanceTimersByTime(20);
    expect(ramps.at(-1)).toBe(0);
    audio.dispose();
  });

  it('stays silent when sound is turned off', () => {
    const { ramps, audio } = installAudio();
    audio.setEnabled(false);
    audio.start();
    expect(ramps).toEqual([]);
    audio.setEnabled(true);
    audio.start();
    expect(ramps).toContain(0.14);
    audio.setEnabled(false);
    expect(ramps.at(-1)).toBe(0);
    audio.dispose();
  });
});
