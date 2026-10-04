
(function (global) {
  'use strict';

  class RiffAudioEngine {
    constructor() {
      this.ctx = null;
      this.mediaSource = null;
      this.graphInitialized = false;

      this.stdInput = null;
      this.dryGain = null;
      this.distortionNode = null;
      this.distortionGain = null;
      this.delayNode = null;
      this.delayFeedback = null;
      this.delayGain = null;
      this.convolverNode = null;
      this.reverbGain = null;

      this.hqInput = null;
      this.hqCompressor = null;
      this.hqBass = null;
      this.hqVocal = null;
      this.hqAir = null;
      this.hqSaturation = null;
      this.hqLimiter = null;

      this.masterGain = null;
      this.analyserNode = null;

      this.hqEnabled = false;
      this.hqSettings = {
        engine: 'hqmusic-3',
        preset: 'studio',
        vocal: 0,
        air: 0,
        bass: 0
      };
      this.audioSettings = {
        speed: 1.0,
        speedPitch: 1.0,
        pitch: 0,
        reverb: 0,
        distortion: 0,
        volume: 1.0,
        echo: 0
      };
      this.isMuted = false;
      this.volume = 0.85;
    }


    _createReverbImpulse(ctx) {
      const rate = ctx.sampleRate;
      const len = Math.floor(rate * 0.6);
      const impulse = ctx.createBuffer(2, len, rate);
      const left = impulse.getChannelData(0);
      const right = impulse.getChannelData(1);
      for (let i = 0; i < len; i++) {
        const decay = Math.exp(-i / (rate * 0.15));
        left[i] = (Math.random() * 2 - 1) * decay;
        right[i] = (Math.random() * 2 - 1) * decay;
      }
      return impulse;
    }

    _makeDistortionCurve(amount = 0) {
      const n = 256;
      const curve = new Float32Array(n);
      const k = amount * 2.5;
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        if (k <= 0) {
          curve[i] = x;
        } else {
          curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
        }
      }
      return curve;
    }

    _makeHarmonicCurve(amount = 0) {
      const n = 256;
      const curve = new Float32Array(n);
      const k = amount * 0.02;
      for (let i = 0; i < n; i++) {
        const x = (i * 2) / n - 1;
        curve[i] = x - k * Math.pow(x, 3);
      }
      return curve;
    }


    init(audioElement) {
      if (!audioElement) return;

      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      } else {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC({ latencyHint: 'playback' });
      }

      if (!this.graphInitialized) {
        try {
          this.mediaSource = this.ctx.createMediaElementSource(audioElement);

          this.stdInput = this.ctx.createGain();
          this.hqInput = this.ctx.createGain();

          this.hqCompressor = this.ctx.createDynamicsCompressor();

          this.hqBass = this.ctx.createBiquadFilter();
          this.hqBass.type = 'lowshelf';
          this.hqBass.frequency.value = 80;

          this.hqVocal = this.ctx.createBiquadFilter();
          this.hqVocal.type = 'peaking';
          this.hqVocal.frequency.value = 2500;
          this.hqVocal.Q.value = 1.2;

          this.hqAir = this.ctx.createBiquadFilter();
          this.hqAir.type = 'highshelf';
          this.hqAir.frequency.value = 9000;

          this.hqSaturation = this.ctx.createWaveShaper();
          this.hqSaturation.oversample = '4x';

          this.hqLimiter = this.ctx.createDynamicsCompressor();
          this.hqLimiter.threshold.value = -1;
          this.hqLimiter.knee.value = 0;
          this.hqLimiter.ratio.value = 20;
          this.hqLimiter.attack.value = 0.005;
          this.hqLimiter.release.value = 0.05;

          this.dryGain = this.ctx.createGain();
          this.dryGain.gain.value = 1.0;

          this.distortionNode = this.ctx.createWaveShaper();
          this.distortionNode.oversample = 'none';
          this.distortionNode.curve = this._makeDistortionCurve(0);
          this.distortionGain = this.ctx.createGain();
          this.distortionGain.gain.value = 0.0;

          this.delayNode = this.ctx.createDelay(1.0);
          this.delayNode.delayTime.value = 0.3;
          this.delayFeedback = this.ctx.createGain();
          this.delayFeedback.gain.value = 0.35;
          this.delayGain = this.ctx.createGain();
          this.delayGain.gain.value = 0.0;
          this.delayNode.connect(this.delayFeedback);
          this.delayFeedback.connect(this.delayNode);

          this.convolverNode = this.ctx.createConvolver();
          this.convolverNode.buffer = this._createReverbImpulse(this.ctx);
          this.reverbGain = this.ctx.createGain();
          this.reverbGain.gain.value = 0.0;

          this.masterGain = this.ctx.createGain();
          this.analyserNode = this.ctx.createAnalyser();
          this.analyserNode.fftSize = 128;
          this.analyserNode.smoothingTimeConstant = 0.8;

          this.hqInput.connect(this.hqCompressor);
          this.hqCompressor.connect(this.hqBass);
          this.hqBass.connect(this.hqVocal);
          this.hqVocal.connect(this.hqAir);
          this.hqAir.connect(this.hqSaturation);
          this.hqSaturation.connect(this.hqLimiter);
          this.hqLimiter.connect(this.masterGain);

          this.stdInput.connect(this.dryGain);
          this.dryGain.connect(this.masterGain);

          this.stdInput.connect(this.distortionNode);
          this.distortionNode.connect(this.distortionGain);
          this.distortionGain.connect(this.masterGain);

          this.stdInput.connect(this.delayNode);
          this.delayNode.connect(this.delayGain);
          this.delayGain.connect(this.masterGain);

          this.stdInput.connect(this.convolverNode);
          this.convolverNode.connect(this.reverbGain);
          this.reverbGain.connect(this.masterGain);

          this.masterGain.connect(this.analyserNode);
          this.analyserNode.connect(this.ctx.destination);

          this.graphInitialized = true;
          this._updateRouting();
        } catch (e) {
          console.warn('[AudioEngine] Graph initialization notice:', e);
        }
      }

      this.applySettings();
    }


    _updateRouting() {
      if (!this.mediaSource) return;
      this.mediaSource.disconnect();
      if (this.hqEnabled) {
        this.mediaSource.connect(this.hqInput);
      } else {
        this.mediaSource.connect(this.stdInput);
      }
      this._applyHqParams();
    }


    setHqEnabled(enabled) {
      this.hqEnabled = enabled;
      if (this.graphInitialized) this._updateRouting();
    }

    setHqSettings(settings) {
      Object.assign(this.hqSettings, settings);
      if (this.graphInitialized) this._applyHqParams();
    }

    _applyHqParams() {
      if (!this.hqCompressor) return;

      let baseBass = 0, baseVocal = 0, baseAir = 0;
      let satAmount = 0;

      this.hqCompressor.threshold.value = -12;
      this.hqCompressor.knee.value = 10;
      this.hqCompressor.ratio.value = 1.5;
      this.hqCompressor.attack.value = 0.01;
      this.hqCompressor.release.value = 0.1;

      switch (this.hqSettings.engine) {
        case 'hqmusic-3':
          satAmount = 0.5;
          break;
        case 'glyphs-7B':
          satAmount = 0.2;
          baseAir = 2.5;
          this.hqAir.frequency.value = 9000;
          break;
        case 'fyro1.1':
          satAmount = 0.2;
          baseBass = 3.0;
          this.hqBass.frequency.value = 80;
          this.hqCompressor.ratio.value = 2.0;
          break;
      }

      this.hqSaturation.curve = this._makeHarmonicCurve(satAmount);

      this.hqBass.gain.value = Math.max(-4, Math.min(4, baseBass + (this.hqSettings.bass * 0.08)));
      this.hqVocal.gain.value = Math.max(-4, Math.min(4, baseVocal + (this.hqSettings.vocal * 0.08)));
      this.hqAir.gain.value = Math.max(-4, Math.min(4, baseAir + (this.hqSettings.air * 0.08)));
    }


    setAudioSettings(settings) {
      Object.assign(this.audioSettings, settings);
      this.applySettings();
    }

    setVolume(volume, isMuted) {
      this.volume = volume;
      this.isMuted = isMuted;
      this._applyMasterVolume();
    }

    applySettings(audioElement) {
      const s = this.audioSettings;

      if (audioElement) {
        if (s.speedPitch !== 1.0 || s.pitch !== 0) {
          audioElement.preservesPitch = false;
          audioElement.webkitPreservesPitch = false;
          audioElement.mozPreservesPitch = false;
          const pitchMultiplier = Math.pow(2, s.pitch / 12);
          audioElement.playbackRate = s.speedPitch * pitchMultiplier;
        } else {
          audioElement.preservesPitch = true;
          audioElement.webkitPreservesPitch = true;
          audioElement.mozPreservesPitch = true;
          audioElement.playbackRate = s.speed;
        }
      }

      if (this.reverbGain) this.reverbGain.gain.value = s.reverb / 100;

      if (this.delayGain) this.delayGain.gain.value = s.echo / 100;

      if (this.distortionNode && this.distortionGain) {
        if (s.distortion > 0) {
          this.distortionNode.curve = this._makeDistortionCurve(s.distortion);
          this.distortionGain.gain.value = (s.distortion / 100) * 0.75;
          if (this.dryGain) this.dryGain.gain.value = 1.0 - (s.distortion / 100) * 0.4;
        } else {
          this.distortionGain.gain.value = 0.0;
          if (this.dryGain) this.dryGain.gain.value = 1.0;
        }
      }

      this._applyMasterVolume();
    }

    _applyMasterVolume() {
      const vol = this.isMuted ? 0 : this.volume;
      if (this.masterGain) {
        this.masterGain.gain.value = vol * this.audioSettings.volume;
      }
    }

    isModified() {
      const s = this.audioSettings;
      return s.speed !== 1.0 || s.speedPitch !== 1.0 || s.pitch !== 0 ||
        s.reverb !== 0 || s.distortion !== 0 || s.volume !== 1.0 || s.echo !== 0;
    }


    fadeOut(durationSec = 0.25) {
      if (this.masterGain && this.ctx) {
        const current = this.masterGain.gain.value;
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(Math.max(0.001, current), this.ctx.currentTime);
        this.masterGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + durationSec);
      }
    }

    fadeIn(durationSec = 0.35) {
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.masterGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
        const targetVol = (this.isMuted ? 0 : this.volume) * this.audioSettings.volume;
        this.masterGain.gain.exponentialRampToValueAtTime(
          Math.max(0.001, targetVol), this.ctx.currentTime + durationSec
        );
      }
    }


    getAnalyserNode() {
      return this.analyserNode;
    }

    getFrequencyData(buffer) {
      if (this.analyserNode) this.analyserNode.getByteFrequencyData(buffer);
    }

    getTimeDomainData(buffer) {
      if (this.analyserNode) this.analyserNode.getByteTimeDomainData(buffer);
    }


    isLiveStream(audioElement) {
      if (!audioElement) return false;
      const dur = audioElement.duration;
      return !isFinite(dur) || isNaN(dur);
    }


    async renderOffline(sourceBuffer, settingsOverride, hqOverride) {
      const s = settingsOverride || { ...this.audioSettings };
      const hq = hqOverride || { ...this.hqSettings };
      const useHq = this.hqEnabled;

      const speedFactor = (s.speedPitch !== 1.0 || s.pitch !== 0)
        ? s.speedPitch * Math.pow(2, s.pitch / 12)
        : s.speed;
      const outputLength = Math.ceil(sourceBuffer.length / Math.max(0.1, speedFactor));

      const offline = new OfflineAudioContext(
        sourceBuffer.numberOfChannels,
        outputLength,
        sourceBuffer.sampleRate
      );

      const src = offline.createBufferSource();
      src.buffer = sourceBuffer;
      src.playbackRate.value = speedFactor;

      if (useHq) {
        const comp = offline.createDynamicsCompressor();
        comp.threshold.value = -12;
        comp.knee.value = 10;
        comp.ratio.value = hq.engine === 'fyro1.1' ? 2.0 : 1.5;
        comp.attack.value = 0.01;
        comp.release.value = 0.1;

        const bass = offline.createBiquadFilter();
        bass.type = 'lowshelf';
        bass.frequency.value = 80;
        const baseBass = hq.engine === 'fyro1.1' ? 3.0 : 0;
        bass.gain.value = Math.max(-4, Math.min(4, baseBass + (hq.bass * 0.08)));

        const vocal = offline.createBiquadFilter();
        vocal.type = 'peaking';
        vocal.frequency.value = 2500;
        vocal.Q.value = 1.2;
        vocal.gain.value = Math.max(-4, Math.min(4, hq.vocal * 0.08));

        const air = offline.createBiquadFilter();
        air.type = 'highshelf';
        air.frequency.value = 9000;
        const baseAir = hq.engine === 'glyphs-7B' ? 2.5 : 0;
        air.gain.value = Math.max(-4, Math.min(4, baseAir + (hq.air * 0.08)));

        const sat = offline.createWaveShaper();
        sat.oversample = '4x';
        const satAmount = hq.engine === 'hqmusic-3' ? 0.5 : 0.2;
        sat.curve = this._makeHarmonicCurve(satAmount);

        const limiter = offline.createDynamicsCompressor();
        limiter.threshold.value = -1;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.005;
        limiter.release.value = 0.05;

        const master = offline.createGain();
        master.gain.value = s.volume;

        src.connect(comp);
        comp.connect(bass);
        bass.connect(vocal);
        vocal.connect(air);
        air.connect(sat);
        sat.connect(limiter);
        limiter.connect(master);
        master.connect(offline.destination);

      } else {
        const dry = offline.createGain();
        const distNode = offline.createWaveShaper();
        distNode.oversample = 'none';
        const distGain = offline.createGain();
        const delay = offline.createDelay(1.0);
        delay.delayTime.value = 0.3;
        const feedback = offline.createGain();
        feedback.gain.value = 0.35;
        const echoGain = offline.createGain();
        const conv = offline.createConvolver();
        conv.buffer = this._createReverbImpulse(offline);
        const revGain = offline.createGain();
        const master = offline.createGain();

        revGain.gain.value = s.reverb / 100;
        echoGain.gain.value = s.echo / 100;

        if (s.distortion > 0) {
          distNode.curve = this._makeDistortionCurve(s.distortion);
          distGain.gain.value = (s.distortion / 100) * 0.75;
          dry.gain.value = 1.0 - (s.distortion / 100) * 0.4;
        } else {
          distNode.curve = this._makeDistortionCurve(0);
          distGain.gain.value = 0.0;
          dry.gain.value = 1.0;
        }

        master.gain.value = s.volume;

        delay.connect(feedback);
        feedback.connect(delay);

        src.connect(dry);
        dry.connect(master);

        src.connect(distNode);
        distNode.connect(distGain);
        distGain.connect(master);

        src.connect(delay);
        delay.connect(echoGain);
        echoGain.connect(master);

        src.connect(conv);
        conv.connect(revGain);
        revGain.connect(master);

        master.connect(offline.destination);
      }

      src.start(0);
      return offline.startRendering();
    }

    audioBufferToWav(buffer) {
      const numChannels = buffer.numberOfChannels;
      const sampleRate = buffer.sampleRate;
      const bitDepth = 16;

      const channels = [];
      for (let i = 0; i < numChannels; i++) {
        channels.push(buffer.getChannelData(i));
      }

      const length = channels[0].length;
      const bytesPerSample = bitDepth / 8;
      const blockAlign = numChannels * bytesPerSample;
      const dataSize = length * blockAlign;
      const headerSize = 44;
      const totalSize = headerSize + dataSize;

      const arrayBuffer = new ArrayBuffer(totalSize);
      const view = new DataView(arrayBuffer);

      const writeString = (offset, str) => {
        for (let i = 0; i < str.length; i++) {
          view.setUint8(offset + i, str.charCodeAt(i));
        }
      };

      writeString(0, 'RIFF');
      view.setUint32(4, totalSize - 8, true);
      writeString(8, 'WAVE');

      writeString(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * blockAlign, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitDepth, true);

      writeString(36, 'data');
      view.setUint32(40, dataSize, true);

      let offset = 44;
      for (let i = 0; i < length; i++) {
        for (let ch = 0; ch < numChannels; ch++) {
          const sample = Math.max(-1, Math.min(1, channels[ch][i]));
          view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
          offset += 2;
        }
      }

      return new Blob([arrayBuffer], { type: 'audio/wav' });
    }
  }

  global.RiffAudioEngine = RiffAudioEngine;

})(typeof window !== 'undefined' ? window : globalThis);
