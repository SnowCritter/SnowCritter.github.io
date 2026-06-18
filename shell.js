// Shell router for the persistent-audio iframe.
// The shell (index.html) never reloads, so the AudioContext in audio.js keeps
// running while pages load inside #view. This swaps which page is framed and
// keeps the address bar / tab title in step with it.
(function () {
    'use strict';

    var view = document.getElementById('view');
    if (!view) return;

    var DEFAULT = '/center.html';

    // On entry, honor a deep link carried in the hash (e.g. /#/writings.html).
    var initial = location.hash ? location.hash.slice(1) : DEFAULT;
    if (initial && initial !== view.getAttribute('src')) {
        view.src = initial;
    }

    // After each framed navigation, mirror the page into the shell URL + title.
    // replaceState (not pushState) avoids doubling history — back/forward already
    // traverse the iframe's own session history without reloading the shell.
    view.addEventListener('load', function () {
        try {
            var path = view.contentWindow.location.pathname;
            history.replaceState(null, '', '#' + path);
            var t = view.contentDocument && view.contentDocument.title;
            if (t) document.title = t;
            window.scrollTo(0, 0);
        } catch (e) {
            /* cross-origin frame (shouldn't happen for our own pages) — ignore */
        }
    });
})();
