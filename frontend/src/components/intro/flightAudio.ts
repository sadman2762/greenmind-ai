import { FLIGHT_DURATION } from "./flightTokens";

type Cue = { time: number; duration: number; from: number; to?: number; volume: number; type: OscillatorType | "wind"; pan?: number; attack?: number };

export function createFlightAudio() {
  const context = new AudioContext();
  const master = context.createGain();
  const compressor = context.createDynamicsCompressor();
  master.gain.value = 0.3;
  compressor.threshold.value = -20;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.01;
  master.connect(compressor).connect(context.destination);
  const sources = new Set<AudioScheduledSourceNode>();
  const nodes = new Set<AudioNode>();
  let disposed = false;
  let generation = 0;

  const wind = context.createBuffer(2, context.sampleRate * 3, context.sampleRate);
  let seed = 91827;
  for (let channel = 0; channel < 2; channel++) {
    const samples = wind.getChannelData(channel);
    let previous = 0;
    for (let index = 0; index < samples.length; index++) {
      seed = (seed * 16807) % 2147483647;
      previous = (previous + 0.035 * (seed / 2147483647 * 2 - 1)) / 1.035;
      samples[index] = previous * 4;
    }
  }

  function stop() {
    generation++;
    sources.forEach((source) => { source.onended = null; source.stop(); source.disconnect(); });
    sources.clear();
    nodes.forEach((node) => node.disconnect());
    nodes.clear();
  }

  function voice(cue: Cue, now: number, offset: number) {
    if (cue.time + cue.duration <= offset) return;
    const skipped = Math.max(0, offset - cue.time);
    const length = cue.duration - skipped;
    const start = now + Math.max(0, cue.time - offset);
    const endFrequency = cue.to ?? cue.from;
    const from = cue.from * Math.pow(endFrequency / cue.from, skipped / cue.duration);
    const source = cue.type === "wind" ? context.createBufferSource() : context.createOscillator();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const panner = context.createStereoPanner();
    panner.pan.value = cue.pan ?? 0;
    if (source instanceof AudioBufferSourceNode) {
      source.buffer = wind; source.loop = true;
      filter.type = "bandpass"; filter.Q.value = 0.45;
      filter.frequency.setValueAtTime(from, start);
      filter.frequency.exponentialRampToValueAtTime(endFrequency, start + length);
    } else {
      source.type = cue.type as OscillatorType;
      source.frequency.setValueAtTime(from, start);
      source.frequency.exponentialRampToValueAtTime(endFrequency, start + length);
      filter.type = "lowpass"; filter.frequency.value = 2000;
    }
    const attack = Math.min(cue.attack ?? 0.025, length * 0.35);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(cue.volume, start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + length);
    source.connect(filter).connect(envelope).connect(panner).connect(master);
    nodes.add(filter); nodes.add(envelope); nodes.add(panner); sources.add(source);
    source.onended = () => {
      sources.delete(source); source.disconnect();
      [filter, envelope, panner].forEach((node) => { node.disconnect(); nodes.delete(node); });
    };
    source.start(start); source.stop(start + length);
  }

  async function playFrom(offset: number) {
    stop();
    const ticket = generation;
    await context.resume();
    if (disposed || ticket !== generation || offset >= FLIGHT_DURATION) return;
    const now = context.currentTime + 0.025;
    const cues: Cue[] = [
      { time: 0, duration: 3.1, from: 330, to: 1400, volume: 0.6, type: "wind", pan: -0.3, attack: 0.5 },
      { time: 0.2, duration: 4.2, from: 130.81, volume: 0.14, type: "sine", attack: 0.7 },
      { time: 0.3, duration: 4.2, from: 196, volume: 0.09, type: "sine", pan: 0.4, attack: 0.9 },
      { time: 0.5, duration: 4.2, from: 261.63, volume: 0.08, type: "triangle", pan: -0.4, attack: 1 },
      { time: 2, duration: 2.8, from: 520, to: 1450, volume: 0.55, type: "wind", pan: 0.35, attack: 0.4 },
      { time: 3.4, duration: 1.7, from: 1100, to: 280, volume: 0.48, type: "wind", attack: 0.12 },
      { time: 4.8, duration: 2.2, from: 523.25, volume: 0.035, type: "sine", pan: -0.2, attack: 0.3 },
      { time: 5.25, duration: 0.5, from: 220, to: 164.81, volume: 0.13, type: "sine" },
      { time: 5.85, duration: 0.45, from: 220, to: 196, volume: 0.1, type: "sine" },
      { time: 6.35, duration: 0.35, from: 420, to: 900, volume: 0.18, type: "sine" },
      { time: 6.55, duration: 0.55, from: 100, to: 55, volume: 0.24, type: "sine" },
      { time: 6.65, duration: 1.3, from: 659.25, volume: 0.14, type: "sine", pan: 0.2 },
      { time: 7.15, duration: 2.8, from: 440, to: 1800, volume: 0.4, type: "wind", pan: -0.2, attack: 0.65 },
      { time: 9.45, duration: 1.6, from: 1300, to: 220, volume: 0.6, type: "wind", attack: 0.3 },
      { time: 10.35, duration: 1.1, from: 130.81, volume: 0.18, type: "sine", attack: 0.1 },
      { time: 10.35, duration: 1.1, from: 261.63, volume: 0.12, type: "triangle", attack: 0.12 },
      { time: 10.4, duration: 1.05, from: 392, volume: 0.09, type: "sine", pan: -0.35 },
      { time: 10.45, duration: 1, from: 523.25, volume: 0.1, type: "sine", pan: 0.35 },
    ];
    const notes = [523.25, 587.33, 659.25, 783.99, 1046.5, 1174.66, 1318.51, 1567.98];
    for (let index = 0; index < 16; index++) cues.push({ time: 7.55 + index * 0.075, duration: 0.6, from: notes[index % notes.length], volume: 0.065, type: "sine", pan: index % 2 ? 0.55 : -0.55 });
    cues.forEach((cue) => voice(cue, now, offset));
  }

  return {
    playFrom,
    stop,
    dispose() {
      disposed = true; stop(); master.disconnect(); compressor.disconnect();
      void context.close().catch(() => {});
    },
  };
}
