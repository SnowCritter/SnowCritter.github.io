(function () {
    'use strict';

    var view = document.getElementById('view');
    if (!view) return;

    var DEFAULT = '/center.html';

    var initial = location.hash ? location.hash.slice(1) : DEFAULT;
    if (initial && initial !== view.getAttribute('src')) {
        view.src = initial;
    }

    // mirror the framed page into the shell URL/title; replaceState lets
    // back/forward ride the iframe's own history without reloading the shell
    view.addEventListener('load', function () {
        try {
            var path = view.contentWindow.location.pathname;
            history.replaceState(null, '', '#' + path);
            var t = view.contentDocument && view.contentDocument.title;
            if (t) document.title = t;
            window.scrollTo(0, 0);
        } catch (e) {}
    });
})();
