(function () {
    'use strict';

    document.addEventListener('pointerdown', function (e) {
        var flake = e.target.closest && e.target.closest('.flake');
        if (!flake || flake.classList.contains('dissolving')) return;

        flake.classList.add('dissolving');

        // re-form when the fall animation loops back to the top
        flake.addEventListener('animationiteration', function reform(ev) {
            if (ev.animationName && ev.animationName !== 'fall') return;
            flake.classList.remove('dissolving');
            flake.removeEventListener('animationiteration', reform);
        });
    });
})();
