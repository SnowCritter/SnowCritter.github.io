// Generative ambient synth pad — a soft, slowly evolving wintry drone.
// No audio file: everything is synthesized live with the Web Audio API.
// The on/off preference is stored in localStorage so it carries across pages.
(function () {
    'use strict';

    var KEY = 'ambientAudioOn';
    var TARGET = 0.2;        // master volume when playing
    var NOTES = [130.81, 196.00, 246.94, 293.66, 392.00]; // open Cmaj9-ish chord (Hz)

    var ctx = null;
    var master = null;
    var built = false;       // audio graph constructed
    var on = false;          // intended playing state
    var btn = null;

    // Procedural reverb: an impulse response of exponentially decaying noise.
    function makeReverbImpulse(seconds, decay) {
        var rate = ctx.sampleRate;
        var len = Math.floor(rate * seconds);
        var buf = ctx.createBuffer(2, len, rate);
        for (var ch = 0; ch < 2; ch++) {
            var data = buf.getChannelData(ch);
            for (var i = 0; i < len; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
            }
        }
        return buf;
    }

    function buildGraph() {
        ctx = new (window.AudioContext || window.webkitAudioContext)();

        master = ctx.createGain();
        master.gain.value = 0; // silent until faded in
        master.connect(ctx.destination);

        // Soften the high end so the pad stays warm and distant.
        var lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 1100;

        // Wet/dry reverb mix for a spacious, snowy feel.
        var reverb = ctx.createConvolver();
        reverb.buffer = makeReverbImpulse(4, 3);
        var wet = ctx.createGain(); wet.gain.value = 0.6;
        var dry = ctx.createGain(); dry.gain.value = 0.5;

        lowpass.connect(dry); dry.connect(master);
        lowpass.connect(reverb); reverb.connect(wet); wet.connect(master);

        // Each note is a voice that slowly swells in and out on its own LFO,
        // so the chord never sits still.
        for (var n = 0; n < NOTES.length; n++) {
            var osc = ctx.createOscillator();
            osc.type = (n % 2 === 0) ? 'sine' : 'triangle';
            osc.frequency.value = NOTES[n];
            osc.detune.value = Math.random() * 8 - 4; // gentle chorus

            var vGain = ctx.createGain();
            vGain.gain.value = 0.08; // base level the LFO rides on top of

            var lfo = ctx.createOscillator();
            lfo.frequency.value = 0.03 + Math.random() * 0.05; // very slow drift
            var lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.06;
            lfo.connect(lfoGain); lfoGain.connect(vGain.gain);

            osc.connect(vGain); vGain.connect(lowpass);
            osc.start();
            lfo.start();
        }

        built = true;
    }

    function fade(target, seconds) {
        var now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(target, now + seconds);
    }

    function play() {
        if (!built) buildGraph();
        ctx.resume();
        fade(TARGET, 3);
        on = true;
        localStorage.setItem(KEY, 'true');
        updateButton();
    }

    function pause() {
        on = false;
        localStorage.setItem(KEY, 'false');
        if (built) fade(0, 1.5);
        updateButton();
    }

    function toggle() { on ? pause() : play(); }

    function updateButton() {
        if (!btn) return;
        btn.textContent = on ? '♪ sound on' : '♪ sound off';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    function init() {
        btn = document.getElementById('audio-toggle');
        if (btn) btn.addEventListener('click', toggle);

        if (localStorage.getItem(KEY) === 'true') {
            on = true;
            updateButton();
            play(); // best-effort: works once the site has user engagement

            // Fallback: if the browser blocked auto-resume, start on first interaction.
            var resumeOnce = function () {
                if (on && ctx && ctx.state !== 'running') {
                    ctx.resume();
                    fade(TARGET, 3);
                }
                document.removeEventListener('pointerdown', resumeOnce);
            };
            document.addEventListener('pointerdown', resumeOnce, { once: true });
        } else {
            updateButton();
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
