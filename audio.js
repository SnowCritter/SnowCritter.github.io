// Generative ambient synth pad — a soft, slowly evolving wintry drone.
// No audio file: everything is synthesized live with the Web Audio API.
// Lives in the shell (index.html). On/off, volume, and panel position all
// persist in localStorage.
(function () {
    'use strict';

    var KEY = 'ambientAudioOn';
    var VOL_KEY = 'ambientVolume';   // slider value, 0-100
    var POS_KEY = 'audioPanelPos';   // dragged panel position {left, top}
    var MAX_GAIN = 0.5;              // master gain at volume 100
    var NOTES = [130.81, 196.00, 246.94, 293.66, 392.00]; // open Cmaj9-ish chord (Hz)

    var ctx = null;
    var master = null;
    var built = false;               // audio graph constructed
    var on = false;                  // intended playing state
    var volume = clampVol(parseInt(localStorage.getItem(VOL_KEY), 10));
    var btn = null;
    var slider = null;

    function clampVol(v) {
        if (isNaN(v)) return 40;     // default volume
        return Math.max(0, Math.min(100, v));
    }

    function targetGain() {
        return (volume / 100) * MAX_GAIN;
    }

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
        fade(targetGain(), 3);
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

    function setVolume(v) {
        volume = clampVol(v);
        localStorage.setItem(VOL_KEY, String(volume));
        if (on && built) fade(targetGain(), 0.1); // track the slider live
    }

    function updateButton() {
        if (!btn) return;
        btn.textContent = on ? '⏸ pause' : '▶ play';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    // Drag the panel by its handle; clamp to the viewport; remember where.
    function makeDraggable(panel, handle) {
        function applyPos(left, top) {
            left = Math.max(0, Math.min(left, window.innerWidth - panel.offsetWidth));
            top = Math.max(0, Math.min(top, window.innerHeight - panel.offsetHeight));
            panel.style.left = left + 'px';
            panel.style.top = top + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        }

        try {
            var p = JSON.parse(localStorage.getItem(POS_KEY));
            if (p) applyPos(p.left, p.top);
        } catch (e) { /* no saved position */ }

        var dragging = false, offX = 0, offY = 0;
        handle.addEventListener('pointerdown', function (e) {
            dragging = true;
            var r = panel.getBoundingClientRect();
            offX = e.clientX - r.left;
            offY = e.clientY - r.top;
            handle.setPointerCapture(e.pointerId);
            e.preventDefault();
        });
        handle.addEventListener('pointermove', function (e) {
            if (dragging) applyPos(e.clientX - offX, e.clientY - offY);
        });
        handle.addEventListener('pointerup', function (e) {
            if (!dragging) return;
            dragging = false;
            try { handle.releasePointerCapture(e.pointerId); } catch (e2) {}
            var r = panel.getBoundingClientRect();
            localStorage.setItem(POS_KEY, JSON.stringify({ left: r.left, top: r.top }));
        });
    }

    function init() {
        btn = document.getElementById('audio-toggle');
        if (btn) btn.addEventListener('click', toggle);

        slider = document.getElementById('audio-volume');
        if (slider) {
            slider.value = volume;
            slider.addEventListener('input', function () {
                setVolume(parseInt(slider.value, 10));
            });
        }

        var panel = document.getElementById('audio-panel');
        var handle = document.getElementById('audio-drag');
        if (panel && handle) makeDraggable(panel, handle);

        // Autostart by default: play unless the visitor has explicitly paused before.
        var saved = localStorage.getItem(KEY);
        var wantOn = (saved === null) ? true : (saved === 'true');

        if (wantOn) {
            // Try to start immediately (works for engaged/returning visitors). If the
            // browser blocks autoplay, just leave it stopped — the button stays on
            // "play" and one click starts it. No first-interaction ambush.
            if (!built) buildGraph();
            var settle = function () {
                if (ctx.state === 'running') {
                    on = true;
                    localStorage.setItem(KEY, 'true');
                    fade(targetGain(), 3);
                }
                updateButton();
            };
            var resuming = ctx.resume();
            if (resuming && resuming.then) resuming.then(settle, settle);
            else settle();
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
