
export const bufferToWav = (buffer: AudioBuffer): Blob => {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while (pos < buffer.length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true); // write 16-bit sample
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArr], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
};

// --- Sound Synthesis Service ---

export class SoundSynthesisService {
    private ctx: AudioContext;

    constructor() {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    private async renderOffline(duration: number, renderFn: (ctx: OfflineAudioContext) => void): Promise<string> {
        const offlineCtx = new OfflineAudioContext(2, duration * 44100, 44100);
        renderFn(offlineCtx);
        const buffer = await offlineCtx.startRendering();
        const blob = bufferToWav(buffer);
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    }

    async generateKick(): Promise<string> {
        return this.renderOffline(0.5, (ctx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.frequency.setValueAtTime(150, 0);
            osc.frequency.exponentialRampToValueAtTime(0.01, 0.5);
            
            gain.gain.setValueAtTime(1, 0);
            gain.gain.exponentialRampToValueAtTime(0.01, 0.5);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(0);
            osc.stop(0.5);
        });
    }

    async generateSnare(): Promise<string> {
        return this.renderOffline(0.3, (ctx) => {
            // Tone
            const osc = ctx.createOscillator();
            osc.type = 'triangle';
            const gainOsc = ctx.createGain();
            osc.frequency.setValueAtTime(250, 0);
            gainOsc.gain.setValueAtTime(0.5, 0);
            gainOsc.gain.exponentialRampToValueAtTime(0.01, 0.2);
            osc.connect(gainOsc);
            gainOsc.connect(ctx.destination);
            osc.start(0);

            // Noise
            const bufferSize = ctx.sampleRate * 0.3;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const noiseFilter = ctx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 1000;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(1, 0);
            noiseGain.gain.exponentialRampToValueAtTime(0.01, 0.3);
            
            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(ctx.destination);
            noise.start(0);
        });
    }

    async generateHiHat(): Promise<string> {
        return this.renderOffline(0.1, (ctx) => {
            const bufferSize = ctx.sampleRate * 0.1;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 5000;
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.6, 0);
            gain.gain.exponentialRampToValueAtTime(0.01, 0.1);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start(0);
        });
    }

    async generateClap(): Promise<string> {
        return this.renderOffline(0.2, (ctx) => {
            const bufferSize = ctx.sampleRate * 0.2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 1200;
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, 0);
            gain.gain.linearRampToValueAtTime(1, 0.01);
            gain.gain.exponentialRampToValueAtTime(0.01, 0.2);
            
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);
            noise.start(0);
        });
    }

    async generateBass(): Promise<string> {
        return this.renderOffline(0.5, (ctx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(60, 0);
            osc.frequency.exponentialRampToValueAtTime(40, 0.5);
            
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(1, 0);
            gain.gain.linearRampToValueAtTime(0.8, 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, 0.5);
            
            // Saturation
            const shaper = ctx.createWaveShaper();
            shaper.curve = this.makeDistortionCurve(50);

            osc.connect(gain);
            gain.connect(shaper);
            shaper.connect(ctx.destination);
            osc.start(0);
        });
    }

    async generatePad(): Promise<string> {
        return this.renderOffline(2.0, (ctx) => {
            const osc1 = ctx.createOscillator();
            osc1.type = 'sine';
            osc1.frequency.value = 261.63; // C4

            const osc2 = ctx.createOscillator();
            osc2.type = 'triangle';
            osc2.frequency.value = 329.63; // E4 (Major 3rd)
            
            const osc3 = ctx.createOscillator();
            osc3.type = 'sine';
            osc3.frequency.value = 392.00; // G4 (5th)

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, 0);
            gain.gain.linearRampToValueAtTime(0.3, 0.5);
            gain.gain.linearRampToValueAtTime(0.3, 1.5);
            gain.gain.linearRampToValueAtTime(0, 2.0);

            osc1.connect(gain);
            osc2.connect(gain);
            osc3.connect(gain);
            gain.connect(ctx.destination);

            osc1.start(0);
            osc2.start(0);
            osc3.start(0);
        });
    }

    private makeDistortionCurve(amount: number) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }
}
