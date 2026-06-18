(function () {
    'use strict';

    var KEY = 'ambientAudioOn';
    var POS_KEY = 'audioTogglePos';
    var TARGET = 0.2;
    var NOTES = [130.81, 196.00, 246.94, 293.66, 392.00];

    var ctx = null;
    var master = null;
    var built = false;
    var on = false;
    var btn = null;
    var dragMoved = false;

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
        master.gain.value = 0;
        master.connect(ctx.destination);

        var lowpass = ctx.createBiquadFilter();
        lowpass.type = 'lowpass';
        lowpass.frequency.value = 1100;

        var reverb = ctx.createConvolver();
        reverb.buffer = makeReverbImpulse(4, 3);
        var wet = ctx.createGain(); wet.gain.value = 0.6;
        var dry = ctx.createGain(); dry.gain.value = 0.5;

        lowpass.connect(dry); dry.connect(master);
        lowpass.connect(reverb); reverb.connect(wet); wet.connect(master);

        for (var n = 0; n < NOTES.length; n++) {
            var osc = ctx.createOscillator();
            osc.type = (n % 2 === 0) ? 'sine' : 'triangle';
            osc.frequency.value = NOTES[n];
            osc.detune.value = Math.random() * 8 - 4;

            var vGain = ctx.createGain();
            vGain.gain.value = 0.08;

            var lfo = ctx.createOscillator();
            lfo.frequency.value = 0.03 + Math.random() * 0.05;
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

    function toggle() {
        if (dragMoved) { dragMoved = false; return; } // ignore the click that ends a drag
        on ? pause() : play();
    }

    function updateButton() {
        if (!btn) return;
        btn.textContent = on ? '♪ sound on' : '♪ sound off';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    }

    function makeDraggable(el) {
        function applyPos(left, top) {
            left = Math.max(0, Math.min(left, window.innerWidth - el.offsetWidth));
            top = Math.max(0, Math.min(top, window.innerHeight - el.offsetHeight));
            el.style.left = left + 'px';
            el.style.top = top + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }

        try {
            var p = JSON.parse(localStorage.getItem(POS_KEY));
            if (p) applyPos(p.left, p.top);
        } catch (e) {}

        var dragging = false, offX = 0, offY = 0, startX = 0, startY = 0;
        el.addEventListener('pointerdown', function (e) {
            dragging = true;
            dragMoved = false;
            var r = el.getBoundingClientRect();
            offX = e.clientX - r.left;
            offY = e.clientY - r.top;
            startX = e.clientX;
            startY = e.clientY;
            el.setPointerCapture(e.pointerId);
        });
        el.addEventListener('pointermove', function (e) {
            if (!dragging) return;
            if (!dragMoved && Math.abs(e.clientX - startX) < 4 && Math.abs(e.clientY - startY) < 4) return;
            dragMoved = true;
            applyPos(e.clientX - offX, e.clientY - offY);
        });
        el.addEventListener('pointerup', function (e) {
            if (!dragging) return;
            dragging = false;
            try { el.releasePointerCapture(e.pointerId); } catch (e2) {}
            if (dragMoved) {
                var r = el.getBoundingClientRect();
                localStorage.setItem(POS_KEY, JSON.stringify({ left: r.left, top: r.top }));
            }
        });
    }

    function init() {
        btn = document.getElementById('audio-toggle');
        if (!btn) return;
        btn.addEventListener('click', toggle);
        makeDraggable(btn);

        var saved = localStorage.getItem(KEY);
        var wantOn = (saved === null) ? true : (saved === 'true');

        if (wantOn) {
            // autostart unless explicitly paused; stay stopped if autoplay is blocked
            if (!built) buildGraph();
            var settle = function () {
                if (ctx.state === 'running') {
                    on = true;
                    localStorage.setItem(KEY, 'true');
                    fade(TARGET, 3);
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
