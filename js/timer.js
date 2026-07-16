// timer.js -- Temporizador de descanso desacoplado del render principal (evita re-render global)
export class RestTimer {
  constructor({ onTick, onDone, sound = true, vibration = true }) {
    this.onTick = onTick;
    this.onDone = onDone;
    this.sound = sound;
    this.vibration = vibration;
    this.remaining = 0;
    this.total = 0;
    this.intervalId = null;
    this.paused = false;
  }

  start(seconds) {
    this.stop();
    this.total = seconds;
    this.remaining = seconds;
    this.paused = false;
    this._tick();
    this.intervalId = setInterval(() => {
      if (this.paused) return;
      this.remaining -= 1;
      this._tick();
      if (this.remaining <= 0) {
        this._finish();
      }
    }, 1000);
  }

  _tick() {
    if (this.onTick) this.onTick(this.remaining, this.total);
  }

  _finish() {
    this.stop();
    this._notify();
    if (this.onDone) this.onDone();
  }

  _notify() {
    if (this.vibration && 'vibrate' in navigator) {
      try { navigator.vibrate([200, 100, 200]); } catch (e) {}
    } else {
      this._flashVisual();
    }
    if (this.sound) this._playBeep();
  }

  _flashVisual() {
    document.body.classList.add('flash-alert');
    setTimeout(() => document.body.classList.remove('flash-alert'), 600);
  }

  _playBeep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.stop(ctx.currentTime + 0.42);
      setTimeout(() => ctx.close(), 600);
    } catch (e) { /* audio no soportado, se ignora silenciosamente */ }
  }

  adjust(deltaSeconds) {
    this.remaining = Math.max(0, this.remaining + deltaSeconds);
    this.total = Math.max(this.total, this.remaining);
    this._tick();
    if (this.remaining <= 0) this._finish();
  }

  pause() { this.paused = true; }
  resume() { this.paused = false; }

  skip() {
    this._finish();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isRunning() {
    return this.intervalId !== null;
  }
}
