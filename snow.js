// Click a falling snowflake to dissolve it.
// Runs inside each framed content page; harmless on pages with no snow.
(function () {
    'use strict';

    document.addEventListener('click', function (e) {
        var flake = e.target.closest && e.target.closest('.flake');
        if (!flake || flake.classList.contains('dissolving')) return;

        flake.classList.add('dissolving'); // CSS fades + blurs it out
        var remove = function () { flake.remove(); };

        var img = flake.querySelector('img');
        if (img) img.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 800); // safety net if transitionend doesn't fire
    });
})();
