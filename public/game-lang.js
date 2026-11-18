/*
  Language support for the standalone games (English or German).

  GameLang.pick() returns, in this order:
    1. ?lang=xx in the URL: blog posts link to a game with their own language,
    2. the language last picked on the site (the navbar switch) or in a game,
    3. the first of the browser's languages that the games support,
    4. English.

  GameLang.set(lang) is for a game's own language switch. It remembers the
  choice under the same key as the blog's switch, rewrites ?lang= so a reload
  keeps it, and updates <html lang>.

  GameLang.init(texts, onChange) picks the language, fills in the page and wires
  the switch buttons ([data-lang="en"], [data-lang="de"]). After a switch it
  calls onChange(lang) so the game can redraw what it renders itself. Returns
  the language. `texts` maps each language to its strings; elements name theirs:
    data-t="key"   text        data-th="key"  HTML
    data-ta="key"  aria-label  data-tt="key"  title   data-tv="key"  value
  A switch button is marked with aria-checked (role="radio") or aria-pressed.

  GameLang.t('{n} pairs left', { n: 3 }) fills in placeholders.
*/
(function () {
  'use strict';
  var SUPPORTED = ['en', 'de'], KEY = 'lang';
  var ATTRS = { 'data-t': 'textContent', 'data-th': 'innerHTML', 'data-ta': 'aria-label', 'data-tt': 'title', 'data-tv': 'value' };

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

  function apply(text, lang) {
    Object.keys(ATTRS).forEach(function (attr) {
      document.querySelectorAll('[' + attr + ']').forEach(function (el) {
        var value = text[el.getAttribute(attr)], prop = ATTRS[attr];
        if (prop === 'aria-label') el.setAttribute(prop, value); else el[prop] = value;
      });
    });
    document.querySelectorAll('[data-lang]').forEach(function (el) {
      var state = el.getAttribute('role') === 'radio' ? 'aria-checked' : 'aria-pressed';
      el.setAttribute(state, el.getAttribute('data-lang') === lang ? 'true' : 'false');
    });
  }

  function init(texts, onChange) {
    var lang = pick();
    apply(texts[lang], lang);
    document.querySelectorAll('[data-lang]').forEach(function (el) {
      el.addEventListener('click', function () {
        var next = set(el.getAttribute('data-lang'));
        if (next === lang) return;
        lang = next;
        apply(texts[lang], lang);
        if (onChange) onChange(lang);
      });
    });
    return lang;
  }

  function t(template, vars) {
    for (var k in vars) template = template.split('{' + k + '}').join(vars[k]);
    return template;
  }

  window.GameLang = { pick: pick, set: set, init: init, t: t };
})();
