// Procedural spray hiss via Web Audio. A click must stay audible: browsers
// unlock AudioContext on the gesture, and we keep a minimum hiss after pointerup.

type AudioEngine = {
  sampleRate: number;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
  createBiquadFilter(): BiquadFilterNode;
  createGain(): GainNode;
  destination: AudioDestinationNode;
  currentTime: number;
  state: string;
  resume(): Promise<void>;
  close(): Promise<void>;
};

const MIN_HISS_MS = 320;

function audioContextCtor(): (new () => AudioContext) | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

export class SprayCanAudio {
  private context?: AudioEngine;
  private gain?: GainNode;
  private source?: AudioBufferSourceNode;
  private wantPlay = false;
  private enabled = true;
  private startedAt = 0;
  private stopTimer?: number;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.wantPlay = false;
      if (this.stopTimer !== undefined) {
        clearTimeout(this.stopTimer);
        this.stopTimer = undefined;
      }
      this.ramp(0, 0.04);
    }
  }

  start(): void {
    if (!this.enabled) return;
    const Ctor = audioContextCtor();
    if (!Ctor) return;
    this.wantPlay = true;
    this.startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.stopTimer !== undefined) {
      clearTimeout(this.stopTimer);
      this.stopTimer = undefined;
    }
    try { this.ensureGraph(Ctor); } catch { return; }
    if (!this.context || !this.gain) return;
    const ramp = (): void => { if (this.wantPlay) this.ramp(0.14, 0.03); };
    if (this.context.state === 'suspended') void this.context.resume().then(ramp);
    else ramp();
  }

  stop(): void {
    if (!this.wantPlay && !this.gain) return;
    const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - this.startedAt;
    const wait = Math.max(0, MIN_HISS_MS - elapsed);
    if (this.stopTimer !== undefined) clearTimeout(this.stopTimer);
    this.stopTimer = window.setTimeout(() => {
      this.stopTimer = undefined;
      this.wantPlay = false;
      this.ramp(0, 0.12);
    }, wait) as unknown as number;
  }

  dispose(): void {
    this.wantPlay = false;
    if (this.stopTimer !== undefined) clearTimeout(this.stopTimer);
    this.stopTimer = undefined;
    this.ramp(0, 0.01);
    try { this.source?.stop(); } catch { /* already stopped */ }
    this.source = undefined;
    this.gain = undefined;
    const context = this.context;
    this.context = undefined;
    void context?.close();
  }

  private ramp(value: number, seconds: number): void {
    if (!this.context || !this.gain) return;
    const now = this.context.currentTime;
    this.gain.gain.cancelScheduledValues(now);
    this.gain.gain.setValueAtTime(this.gain.gain.value, now);
    this.gain.gain.linearRampToValueAtTime(value, now + seconds);
  }

  private ensureGraph(Ctor: new () => AudioContext): void {
    if (this.context) return;
    const context = new Ctor() as unknown as AudioEngine;
    const length = Math.max(1, Math.floor(context.sampleRate * 0.4));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (0.7 + Math.random() * 0.3);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2400;
    filter.Q.value = 0.45;
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start();
    this.context = context;
    this.source = source;
    this.gain = gain;
  }
}
