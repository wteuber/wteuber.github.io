/*
  Language choice for the standalone games (English or German).

  GameLang.pick() returns, in this order:
    1. ?lang=xx in the URL: blog posts link to a game with their own language,
    2. the language last picked on the site (the navbar switch) or in a game,
    3. the first of the browser's languages that the games support,
    4. English.

  GameLang.set(lang) is for a game's own language switch. It remembers the
  choice under the same key as the blog's switch, rewrites ?lang= so a reload
  keeps it, and updates <html lang>.
*/
(function () {
  'use strict';
  var SUPPORTED = ['en', 'de'], KEY = 'lang';

  function norm(code) {
    code = String(code || '').toLowerCase().split('-')[0];
    return SUPPORTED.indexOf(code) >= 0 ? code : null;
  }

  function pick() {
    var m = /[?&]lang=([a-z-]+)/i.exec(location.search), lang = m && norm(m[1]);
    if (!lang) { try { lang = norm(localStorage.getItem(KEY)); } catch (e) {} }
    if (!lang) {
      var prefs = navigator.languages || [navigator.language];
      for (var i = 0; i < prefs.length && !lang; i++) lang = norm(prefs[i]);
    }
    lang = lang || SUPPORTED[0];
    document.documentElement.lang = lang;
    return lang;
  }

  function set(lang) {
    lang = norm(lang) || SUPPORTED[0];
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    try {
      var url = new URL(location.href);
      url.searchParams.set('lang', lang);
      history.replaceState(history.state, '', url);
    } catch (e) {}
    document.documentElement.lang = lang;
    return lang;
  }

  window.GameLang = { pick: pick, set: set };
})();
