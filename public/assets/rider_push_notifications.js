// Bhusawal Connect - Rider Push & Audio Notification Engine
(function(window) {
  'use strict';

  const RiderNotifications = {
    audioCtx: null,

    initAudio() {
      if (!this.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          this.audioCtx = new AudioContext();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    },

    playBeep(freq = 880, duration = 0.15, type = 'sine') {
      try {
        this.initAudio();
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + duration);
      } catch (err) {
        console.warn('Audio play error:', err);
      }
    },

    playNewOrderAlert() {
      // Urgent triple chime
      this.playBeep(659.25, 0.12); // E5
      setTimeout(() => this.playBeep(783.99, 0.12), 140); // G5
      setTimeout(() => this.playBeep(1046.50, 0.25), 280); // C6
      
      // Vibrate if supported
      if ('vibrate' in navigator) {
        navigator.vibrate([300, 100, 300, 100, 500]);
      }
    },

    playSuccessChime() {
      this.playBeep(523.25, 0.1); // C5
      setTimeout(() => this.playBeep(659.25, 0.15), 110); // E5
      setTimeout(() => this.playBeep(1046.50, 0.3), 230); // C6
      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }
    },

    requestPushPermission() {
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    },

    sendNotification(title, body, icon = '/assets/services/service_bike_taxi.jpg') {
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body, icon });
        } catch (e) {
          console.warn('Notification error:', e);
        }
      }
    }
  };

  window.BHUSAWAL_RIDER_NOTIFY = RiderNotifications;
})(window);
