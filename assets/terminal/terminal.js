// A fake zsh for the /public/ directory listings. `ls` (and `cd`, so you can
// get around) tell the truth; everything else just looks busy.
(function () {
  'use strict';

  var MANIFEST = '/assets/terminal/files.json';
  var HOME = '/public';
  var STORE = 'wt-terminal';
  var MAX_LINES = 1500;
  var REPO = 'https://github.com/wteuber/wteuber.github.io';
  var HOST = 'wteuber.com';

  var screen = document.getElementById('screen');
  var titleEl = document.getElementById('title');

  var state = { cwd: HOME, oldpwd: HOME, last: 0, dirty: false, history: [] };
  var base = '';
  var root = null;
  var input = null;
  var histPos = 0;
  var draft = '';
  var job = null;

  // ---------------------------------------------------------------- helpers

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function rnd(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
  function chance(p) { return Math.random() < p; }
  function hex(n) { var s = ''; while (s.length < n) s += Math.floor(Math.random() * 16).toString(16); return s; }
  function len(s) { return Array.from(s).length; }
  function padL(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - len(s))) + s; }
  function padR(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - len(s))); }
  function c(cls, s) { return '<span class="' + cls + '">' + esc(s) + '</span>'; }
  function sleep(ms) {
    return new Promise(function (resolve, reject) {
      var j = job;
      setTimeout(function () { (j && j.cancelled) ? reject(new Error('^C')) : resolve(); }, ms);
    });
  }

  function charWidth() {
    var probe = document.createElement('span');
    probe.textContent = 'MMMMMMMMMM';
    probe.style.visibility = 'hidden';
    probe.style.position = 'absolute';
    screen.appendChild(probe);
    var w = probe.getBoundingClientRect().width / 10 || 8;
    probe.remove();
    return w;
  }
  function size() {
    var cs = getComputedStyle(screen);
    var w = screen.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var lh = parseFloat(cs.lineHeight) || 20;
    return { cols: Math.max(20, Math.floor(w / charWidth())), rows: Math.max(5, Math.floor(screen.clientHeight / lh)) };
  }
  function updateTitle() {
    var s = size();
    titleEl.textContent = 'guest@' + HOST + ': ' + prettyPath(state.cwd) + ' — ssh — ' + s.cols + '×' + s.rows;
  }

  // ------------------------------------------------------------- filesystem

  function newDir(name, parent) {
    var d = { name: name, dir: true, children: new Map(), parent: parent, mtime: 0 };
    d.path = parent ? (parent.path === '/' ? '' : parent.path) + '/' + name : '/';
    if (!parent) d.parent = d;
    return d;
  }

  function buildTree(files) {
    var r = newDir('', null);
    files.forEach(function (f) {
      var parts = f.path.split('/').filter(Boolean);
      var node = r;
      parts.forEach(function (part, i) {
        if (i === parts.length - 1) {
          node.children.set(part, { name: part, dir: false, parent: node, path: f.path, mtime: f.mtime });
        } else {
          if (!node.children.has(part)) node.children.set(part, newDir(part, node));
          node = node.children.get(part);
        }
      });
    });
    (function stamp(d) {
      d.children.forEach(function (ch) {
        if (ch.dir) stamp(ch);
        if (ch.mtime > d.mtime) d.mtime = ch.mtime;
      });
    })(r);
    return r;
  }

  function lookup(path) {
    var node = root;
    var parts = path.split('/').filter(Boolean);
    for (var i = 0; i < parts.length; i++) {
      if (!node.dir) return null;
      if (parts[i] === '.') continue;
      if (parts[i] === '..') { node = node.parent; continue; }
      node = node.children.get(parts[i]);
      if (!node) return null;
    }
    return node;
  }

  function absolute(p) {
    if (p === '~' || p.indexOf('~/') === 0) p = HOME + p.slice(1);
    if (p.charAt(0) !== '/') p = state.cwd + '/' + p;
    var out = [];
    p.split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') out.pop(); else out.push(part);
    });
    return '/' + out.join('/');
  }

  function resolve(p) {
    var node = lookup(absolute(p));
    if (node && !node.dir && /\/$/.test(p)) return null;
    return node;
  }

  function prettyPath(p) {
    if (p === HOME) return '~';
    if (p.indexOf(HOME + '/') === 0) return '~' + p.slice(HOME.length);
    return p;
  }

  function url(node) {
    if (node.dir) {
      if (node === root) return base + '/';
      if (node.children.has('index.html')) return encodeURI(base + node.path + '/');
      return location.pathname + '#' + encodeURI(node.path);
    }
    return encodeURI(base + node.path);
  }

  function pageDir() {
    var p;
    try { p = decodeURI(location.pathname); } catch (e) { p = location.pathname; }
    p = p.replace(/index\.html$/, '');
    if (base && p.indexOf(base) === 0) p = p.slice(base.length);
    return absolute(p);
  }

  function hashDir() {
    if (!/^#\//.test(location.hash)) return null;
    var p;
    try { p = decodeURI(location.hash.slice(1)); } catch (e) { return null; }
    var node = lookup(p);
    return node && node.dir ? node.path : null;
  }

  var sizes = new Map();
  var queue = [];
  var active = 0;

  function pump() {
    while (active < 8 && queue.length) {
      active++;
      queue.shift()().then(function () { active--; pump(); });
    }
  }

  function fileSize(node) {
    if (sizes.has(node.path)) return sizes.get(node.path);
    var p = new Promise(function (done) {
      queue.push(function () {
        var u = url(node);
        return fetch(u, { method: 'HEAD' }).then(function (r) {
          var n = r.headers.get('content-length');
          if (r.ok && n && !r.headers.get('content-encoding')) return +n;
          // Compressed or chunked: count the bytes ourselves.
          return fetch(u).then(function (r2) { return r2.ok ? r2.arrayBuffer() : new ArrayBuffer(0); })
            .then(function (b) { return b.byteLength; });
        }).catch(function () { return 0; }).then(function (n) { done(n); });
      });
      pump();
    });
    sizes.set(node.path, p);
    return p;
  }

  // --------------------------------------------------------------- terminal

  function line(html, cls) {
    var div = document.createElement('div');
    if (cls) div.className = cls;
    div.innerHTML = html;
    screen.appendChild(div);
    while (screen.childElementCount > MAX_LINES) screen.firstElementChild.remove();
    return div;
  }
  function out(text) { String(text).split('\n').forEach(function (l) { line(esc(l)); }); }
  function outHTML(html) { html.split('\n').forEach(function (l) { line(l); }); }

  function promptHTML() {
    var cwd = state.cwd === '/' ? '/' : state.cwd.split('/').pop();
    return '<span class="' + (state.last ? 'err' : 'ok') + '">➜</span>  ' +
      c('host', 'guest@' + HOST) + ':' + c('cwd', cwd) + ' <span class="git">git:(<span class="branch">master</span>)</span>' +
      (state.dirty ? ' ' + c('dirty', '✗') : '') + ' ';
  }

  function showPrompt() {
    var div = line('<span>' + promptHTML() + '</span>', 'line-input');
    input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Command');
    input.addEventListener('keydown', onKey);
    div.appendChild(input);
    histPos = state.history.length;
    draft = '';
    input.focus({ preventScroll: true });
    scroll();
  }

  function freeze(text) {
    if (!input) return;
    var div = input.parentNode;
    input.remove();
    input = null;
    div.className = '';
    div.insertAdjacentHTML('beforeend', esc(text));
  }

  function echo(text) { line(promptHTML() + esc(text)); }

  function scroll() { screen.scrollTop = screen.scrollHeight; }

  function save() {
    try {
      // An untouched prompt gets replaced by the `cd` on the next page.
      if (input && !input.value) { input.parentNode.remove(); input = null; }
      if (input) freeze(input.value);
      var data = { html: screen.innerHTML, cwd: state.cwd, oldpwd: state.oldpwd, last: state.last,
        dirty: state.dirty, history: state.history.slice(-200) };
      try {
        sessionStorage.setItem(STORE, JSON.stringify(data));
      } catch (full) {
        // Too big (a long cat): keep only the tail of the scrollback.
        while (screen.childElementCount > 200) screen.firstElementChild.remove();
        data.html = screen.innerHTML;
        sessionStorage.setItem(STORE, JSON.stringify(data));
      }
    } catch (e) { /* storage blocked: start fresh next time */ }
  }

  function restore() {
    try {
      var s = JSON.parse(sessionStorage.getItem(STORE) || 'null');
      if (!s || !s.html) return null;
      screen.innerHTML = s.html;
      return s;
    } catch (e) { return null; }
  }

  function run(text) {
    var cmd = text.trim();
    if (cmd && cmd !== state.history[state.history.length - 1]) state.history.push(cmd);
    job = { cancelled: false };
    var mine = job;
    return execute(cmd).catch(function (e) {
      if (e && e.message === '^C') return 130;
      out('zsh: ' + (e && e.message || e));
      return 1;
    }).then(function (code) {
      if (job !== mine) return;
      job = null;
      state.last = code || 0;
      showPrompt();
      updateTitle();
    });
  }

  function onKey(e) {
    var v = input.value;
    if (e.key === 'Enter') {
      e.preventDefault();
      freeze(v);
      run(v);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histPos === state.history.length) draft = v;
      if (histPos > 0) input.value = state.history[--histPos];
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histPos < state.history.length) {
        histPos++;
        input.value = histPos === state.history.length ? draft : state.history[histPos];
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      freeze(v + '^C');
      state.last = 130;
      showPrompt();
    } else if (e.ctrlKey && (e.key === 'l' || e.key === 'L')) {
      e.preventDefault();
      screen.innerHTML = '';
      showPrompt();
      input.value = v;
    } else if (e.ctrlKey && (e.key === 'd' || e.key === 'D') && !v) {
      e.preventDefault();
      freeze('');
      run('exit');
    }
  }

  document.addEventListener('keydown', function (e) {
    if (job && e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
      e.preventDefault();
      job.cancelled = true;
      var j = job;
      out('^C');
      job = null;
      state.last = 130;
      showPrompt();
      void j;
    }
  });

  screen.addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    if (String(window.getSelection())) return;
    if (input) input.focus({ preventScroll: true });
  });

  function complete() {
    var v = input.value;
    var m = v.match(/^(.*?)(\S*)$/);
    var before = m[1], word = m[2];
    var candidates = [];
    if (!before.trim()) {
      Object.keys(commands).sort().forEach(function (k) {
        if (k.indexOf(word) === 0) candidates.push({ fill: k + ' ', show: k });
      });
    } else {
      var slash = word.lastIndexOf('/');
      var dirPart = slash >= 0 ? word.slice(0, slash + 1) : '';
      var prefix = word.slice(slash + 1);
      var dir = resolve(dirPart || '.');
      if (!dir || !dir.dir) return;
      Array.from(dir.children.keys()).sort().forEach(function (name) {
        var ch = dir.children.get(name);
        if (name.indexOf(prefix) === 0) candidates.push({ fill: dirPart + name + (ch.dir ? '/' : ' '), show: name + (ch.dir ? '/' : '') });
      });
    }
    if (!candidates.length) return;
    if (candidates.length === 1) { input.value = before + candidates[0].fill; return; }
    var common = candidates.map(function (x) { return x.fill; }).reduce(function (a, b) {
      var i = 0;
      while (i < a.length && a[i] === b[i]) i++;
      return a.slice(0, i);
    });
    if (common.length > word.length) { input.value = before + common; return; }
    var keep = v;
    freeze(v);
    outHTML(columns(candidates.map(function (x) { return { text: x.show, html: esc(x.show) }; })));
    showPrompt();
    input.value = keep;
  }

  // ----------------------------------------------------------------- parser

  function tokenize(s) {
    var tokens = [], cur = '', quote = null, has = false;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (quote) {
        if (ch === quote) quote = null; else cur += ch;
      } else if (ch === '"' || ch === "'") {
        quote = ch; has = true;
      } else if (ch === '\\' && i + 1 < s.length) {
        cur += s[++i]; has = true;
      } else if (/\s/.test(ch)) {
        if (cur || has) tokens.push(cur);
        cur = ''; has = false;
      } else {
        cur += ch;
      }
    }
    if (cur || has) tokens.push(cur);
    return tokens;
  }

  function glob(arg) {
    if (!/[*?]/.test(arg)) return [arg];
    var slash = arg.lastIndexOf('/');
    var dirPart = slash >= 0 ? arg.slice(0, slash + 1) : '';
    if (/[*?]/.test(dirPart)) return null;
    var dir = resolve(dirPart || '.');
    if (!dir || !dir.dir) return null;
    var re = new RegExp('^' + arg.slice(slash + 1).replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    var hits = [];
    dir.children.forEach(function (ch) { if (re.test(ch.name)) hits.push(dirPart + ch.name); });
    return hits.length ? hits.sort() : null;
  }

  async function execute(text) {
    var parts = text.split(/\s*(&&|\|\||;)\s*/);
    var code = 0;
    for (var i = 0; i < parts.length; i += 2) {
      var op = parts[i - 1];
      if (op === '&&' && code !== 0) continue;
      if (op === '||' && code === 0) continue;
      var segment = parts[i];
      if (!segment.trim()) continue;
      // Pipes: only the last command gets to talk.
      var pipe = segment.split('|');
      code = await single(pipe[pipe.length - 1].trim() ? pipe[pipe.length - 1] : pipe[0]);
    }
    return code;
  }

  async function single(segment) {
    var tokens = tokenize(segment.trim());
    if (!tokens.length) return 0;
    var redirect = tokens.findIndex(function (t) { return t === '>' || t === '>>' || /^\d?>/.test(t); });
    if (redirect >= 0) tokens = tokens.slice(0, redirect);
    var name = tokens[0];
    var args = [];
    for (var i = 1; i < tokens.length; i++) {
      var g = glob(tokens[i]);
      if (!g) { out('zsh: no matches found: ' + tokens[i]); return 1; }
      args = args.concat(g);
    }
    var handler = commands[name];
    if (!handler) return notFound(name, args);
    if (redirect >= 0) {
      // Pretend it went to the file. It didn't: `ls` won't show it.
      var realOut = screen;
      screen = document.createElement('div');
      try { return (await handler(args, name)) || 0; } finally { screen = realOut; state.dirty = true; }
    }
    return (await handler(args, name)) || 0;
  }

  // --------------------------------------------------------------------- ls

  var LS_USAGE = 'usage: ls [-@ABCFGHILOPRSTUWabcdefghiklmnopqrstuvwxy1%,] [--color=when] [-D format] [file ...]';
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function kind(name) {
    if (/\.(png|jpe?g|gif|svg|ico|webp)$/i.test(name)) return 'ls-img';
    if (/\.(wav|mp3|ogg|mp4|webm)$/i.test(name)) return 'ls-media';
    if (/\.(js|css|json)$/i.test(name)) return 'ls-code';
    return '';
  }

  function columns(items) {
    if (!items.length) return '';
    var cols = size().cols;
    var widths = items.map(function (it) { return len(it.text); });
    var best = 1, bestWidths = [Math.max.apply(null, widths)];
    for (var n = items.length; n > 1; n--) {
      var rows = Math.ceil(items.length / n);
      var ncols = Math.ceil(items.length / rows);
      var w = [];
      for (var col = 0; col < ncols; col++) {
        var mx = 0;
        for (var r = 0; r < rows; r++) {
          var k = col * rows + r;
          if (k < items.length) mx = Math.max(mx, widths[k]);
        }
        w.push(mx);
      }
      var total = w.reduce(function (a, b) { return a + b; }, 0) + 2 * (ncols - 1);
      if (total <= cols) { best = ncols; bestWidths = w; break; }
    }
    var nrows = Math.ceil(items.length / best);
    var lines = [];
    for (var row = 0; row < nrows; row++) {
      var s = '';
      for (var cc = 0; cc < best; cc++) {
        var i = cc * nrows + row;
        if (i >= items.length) break;
        var last = cc === best - 1 || (cc + 1) * nrows + row >= items.length;
        s += items[i].html + (last ? '' : ' '.repeat(bestWidths[cc] - widths[i] + 2));
      }
      lines.push(s);
    }
    return lines.join('\n');
  }

  function human(n) {
    if (n < 1000) return n + 'B';
    var units = ['K', 'M', 'G', 'T'];
    var i = -1;
    do { n /= 1024; i++; } while (n >= 999.5 && i < units.length - 1);
    return (n < 10 ? (Math.round(n * 10) / 10).toFixed(1) : String(Math.round(n))) + units[i];
  }

  function stamp(mtime) {
    var d = new Date(mtime * 1000);
    var recent = Math.abs(Date.now() - d) < 182 * 864e5;
    var two = function (x) { return x < 10 ? '0' + x : String(x); };
    return MONTHS[d.getMonth()] + ' ' + padL(d.getDate(), 2) + ' ' +
      (recent ? two(d.getHours()) + ':' + two(d.getMinutes()) : ' ' + d.getFullYear());
  }

  async function cmdLs(args) {
    var o = { all: false, almost: false, format: 'C', sort: 'name', reverse: false, human: false,
      recursive: false, classify: false, slash: false, directory: false, color: true };
    var operands = [];
    var done = false;
    var longOpts = {
      all: function () { o.all = true; }, 'almost-all': function () { o.almost = true; },
      'human-readable': function () { o.human = true; }, recursive: function () { o.recursive = true; },
      reverse: function () { o.reverse = true; }, classify: function () { o.classify = true; },
      directory: function () { o.directory = true; }, color: function () { o.color = true; },
      'color=always': function () { o.color = true; }, 'color=auto': function () { o.color = true; },
      'color=never': function () { o.color = false; }
    };
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (done || a === '-' || a.charAt(0) !== '-') { operands.push(a); continue; }
      if (a === '--') { done = true; continue; }
      if (a === '--help') {
        out(LS_USAGE);
        out('\n  -a  include . and ..        -A  all but . and ..\n  -l  long format             -h  human readable sizes\n  -1  one per line           -C  columns\n  -m  comma separated        -R  recursive\n  -t  sort by time           -S  sort by size\n  -r  reverse order          -F  append /\n  -p  append / to dirs       -d  list dirs themselves\n  -G  colors (on)            --color=never  no colors');
        return 0;
      }
      if (a.indexOf('--') === 0) {
        if (!longOpts[a.slice(2)]) { out("ls: unrecognized option `" + a + "'\n" + LS_USAGE); return 1; }
        longOpts[a.slice(2)]();
        continue;
      }
      for (var j = 1; j < a.length; j++) {
        var f = a[j];
        switch (f) {
          case 'a': o.all = true; break;
          case 'A': o.almost = true; break;
          case 'l': o.format = 'l'; break;
          case '1': o.format = '1'; break;
          case 'C': o.format = 'C'; break;
          case 'm': o.format = 'm'; break;
          case 'h': o.human = true; break;
          case 'R': o.recursive = true; break;
          case 't': o.sort = 'time'; break;
          case 'S': o.sort = 'size'; break;
          case 'r': o.reverse = true; break;
          case 'F': o.classify = true; break;
          case 'p': o.slash = true; break;
          case 'd': o.directory = true; break;
          case 'G': o.color = true; break;
          default: out('ls: invalid option -- ' + f + '\n' + LS_USAGE); return 1;
        }
      }
    }

    var needSize = o.format === 'l' || o.sort === 'size';
    var implicit = !operands.length;
    if (implicit) operands = ['.'];

    var code = 0;
    var missing = [], files = [], dirs = [];
    operands.forEach(function (p) {
      var node = resolve(p);
      if (!node) { missing.push(p); return; }
      if (node.dir && !o.directory) dirs.push({ name: p, node: node });
      else files.push({ name: p, node: node });
    });
    missing.sort().forEach(function (p) { out('ls: ' + p + ': No such file or directory'); code = 1; });

    if (needSize) {
      var wanted = [];
      var collect = function (n, deep) {
        if (!n.dir) { wanted.push(n); return; }
        n.children.forEach(function (ch) { if (!ch.dir) wanted.push(ch); else if (deep) collect(ch, deep); });
      };
      files.forEach(function (e) { if (!e.node.dir) wanted.push(e.node); });
      dirs.forEach(function (e) { collect(e.node, o.recursive); });
      if (wanted.length > 40) line(c('c-dim', 'reading ' + wanted.length + ' files…'), 'ls-wait');
      await Promise.all(wanted.map(fileSize));
      screen.querySelectorAll('.ls-wait').forEach(function (el) { el.remove(); });
    }

    async function sizeOf(n) { return n.dir ? 32 * (n.children.size + 2) : await fileSize(n); }

    async function sorted(entries) {
      for (var k = 0; k < entries.length; k++) entries[k].size = needSize ? await sizeOf(entries[k].node) : 0;
      entries.sort(function (x, y) {
        var r = 0;
        if (o.sort === 'time') r = y.node.mtime - x.node.mtime;
        if (o.sort === 'size') r = y.size - x.size;
        if (!r) r = x.name < y.name ? -1 : x.name > y.name ? 1 : 0;
        return o.reverse ? -r : r;
      });
      return entries;
    }

    function nameHTML(e) {
      var suffix = e.node.dir && (o.classify || o.slash) ? '/' : '';
      var cls = o.color ? (e.node.dir ? 'ls-dir' : kind(e.node.name)) : '';
      var a = '<a href="' + esc(url(e.node)) + '"' + (cls ? ' class="' + cls + '"' : '') +
        (e.node.dir ? ' data-dir="' + esc(e.node.path) + '"' : '') + '>' + esc(e.name) + '</a>';
      return { text: e.name + suffix, html: a + suffix };
    }

    function render(entries, showTotal) {
      if (o.format === 'l') {
        var rows = entries.map(function (e) {
          var n = e.node;
          var links = n.dir ? 2 + Array.from(n.children.values()).filter(function (x) { return x.dir; }).length : 1;
          return { e: e, mode: n.dir ? 'drwxr-xr-x' : '-rw-r--r--', links: String(links),
            size: o.human ? human(e.size) : String(e.size), date: stamp(n.mtime) };
        });
        var wl = Math.max.apply(null, rows.map(function (r) { return r.links.length; }).concat(1));
        var ws = Math.max.apply(null, rows.map(function (r) { return r.size.length; }).concat(1));
        var lines = [];
        if (showTotal) {
          var blocks = entries.reduce(function (t, e) { return t + (e.node.dir ? 0 : Math.ceil(e.size / 4096) * 8); }, 0);
          lines.push('total ' + blocks);
        }
        rows.forEach(function (r) {
          lines.push(r.mode + '  ' + padL(r.links, wl) + ' wteuber  staff  ' + padL(r.size, ws) + ' ' + r.date + ' ' + nameHTML(r.e).html);
        });
        return lines.join('\n');
      }
      var items = entries.map(nameHTML);
      if (o.format === '1') return items.map(function (it) { return it.html; }).join('\n');
      if (o.format === 'm') {
        var cols = size().cols, lines2 = [], cur = '', curLen = 0;
        items.forEach(function (it, idx) {
          var t = it.text + (idx < items.length - 1 ? ',' : '');
          var h = it.html + (idx < items.length - 1 ? ',' : '');
          if (curLen && curLen + 1 + len(t) > cols) { lines2.push(cur); cur = ''; curLen = 0; }
          cur += (curLen ? ' ' : '') + h;
          curLen += (curLen ? 1 : 0) + len(t);
        });
        if (cur) lines2.push(cur);
        return lines2.join('\n');
      }
      return columns(items);
    }

    var first = true;
    function block(html) {
      if (!first) line('');
      first = false;
      if (html) outHTML(html);
    }

    if (files.length) block(render(await sorted(files), false));

    async function listDir(label, dir, header) {
      var entries = [];
      if (o.all) {
        entries.push({ name: '.', node: dir });
        entries.push({ name: '..', node: dir.parent });
      }
      dir.children.forEach(function (ch) {
        if (ch.name.charAt(0) === '.' && !o.all && !o.almost) return;
        entries.push({ name: ch.name, node: ch });
      });
      await sorted(entries);
      var body = render(entries, true);
      if (!first) line('');
      first = false;
      if (header) out(label + ':');
      if (body) outHTML(body);
      if (o.recursive) {
        for (var k = 0; k < entries.length; k++) {
          var e = entries[k];
          if (e.node.dir && e.name !== '.' && e.name !== '..') {
            await listDir((label === '.' && implicit ? '.' : label.replace(/\/$/, '')) + '/' + e.name, e.node, true);
          }
        }
      }
    }

    var dirList = await sorted(dirs);
    for (var d = 0; d < dirList.length; d++) {
      await listDir(dirList[d].name, dirList[d].node, operands.length > 1);
    }
    return code;
  }

  // --------------------------------------------------------------------- cd

  function cmdCd(args) {
    var target = args[0];
    if (args.length > 1) { out('cd: string not in pwd: ' + args[0]); return 1; }
    if (!target || target === '~') target = HOME;
    if (target === '-') { target = state.oldpwd; out(prettyPath(target)); }
    var node = resolve(target);
    if (!node) { out('cd: no such file or directory: ' + args[0]); return 1; }
    if (!node.dir) { out('cd: not a directory: ' + args[0]); return 1; }
    chdir(node.path);
    return 0;
  }

  function chdir(path) {
    if (path !== state.cwd) state.oldpwd = state.cwd;
    state.cwd = path;
    var hash = path === pageDir() ? '' : '#' + encodeURI(path);
    if (hash !== location.hash) history.replaceState(null, '', location.pathname + location.search + hash);
    updateTitle();
  }

  // -------------------------------------------------- everything else: lies

  var WORDS = ('lorem ipsum dolor sit amet banana kernel quantum turtle waffle segfault ' +
    'yak shaving pixel monad unicorn cache miss legacy synergy blockchain toaster ' +
    'refactor gremlin spaghetti latency penguin hamster deploy friday coffee bug feature').split(' ');
  var NAMES = ['root', 'nobody', 'wteuber', 'guest', 'daemon', 'elvis', 'mario', 'neo', 'admin', 'www-data'];
  var BRANCHES = ['master', 'main', 'feature/everything', 'fix/the-fix', 'wip', 'yolo', 'hotfix-final-v3'];

  function words(n) { var a = []; for (var i = 0; i < n; i++) a.push(pick(WORDS)); return a.join(' '); }
  function sentence() { var s = words(rnd(4, 12)); return s.charAt(0).toUpperCase() + s.slice(1) + pick(['.', '.', '!', '?', '...']); }

  function fakeFile(name) {
    var n = rnd(4, 14), out2 = [];
    if (/\.js$/.test(name)) {
      for (var i = 0; i < n; i++) out2.push(pick([
        'const ' + pick(WORDS) + ' = ' + rnd(0, 9999) + ';',
        'function ' + pick(WORDS) + '(' + pick(WORDS) + ') { return ' + pick(WORDS) + ' * ' + rnd(2, 42) + '; }',
        '// TODO: ' + sentence(),
        'if (' + pick(WORDS) + ' === undefined) throw new Error("' + words(3) + '");',
        'console.log("' + words(2) + '");'
      ]));
    } else if (/\.(html|svg)$/.test(name)) {
      out2.push('<!doctype ' + pick(['html', 'banana', 'pizza']) + '>');
      for (var j = 0; j < n; j++) out2.push('<' + pick(['div', 'marquee', 'blink', 'p', 'span']) + '>' + words(rnd(1, 5)) + '</' + pick(['div', 'marquee', 'blink', 'p', 'span']) + '>');
    } else if (/\.(png|jpe?g|gif|ico|wav|mp3|webp)$/i.test(name)) {
      var bin = '';
      for (var k = 0; k < rnd(200, 500); k++) bin += String.fromCharCode(pick([rnd(33, 126), rnd(0x2580, 0x259f), rnd(0xc0, 0xff)]));
      out2.push(bin);
    } else {
      for (var m = 0; m < n; m++) out2.push(sentence());
    }
    return out2.join('\n');
  }

  async function progress(label, steps) {
    var div = line('');
    for (var i = 0; i <= steps; i++) {
      var pct = Math.round(i / steps * 100);
      var bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
      div.innerHTML = esc(label + ' ' + bar + ' ' + padL(pct, 3) + '%');
      scroll();
      await sleep(rnd(40, 220));
    }
  }

  function needFile(cmd, args, fn) {
    if (!args.length) { out('usage: ' + cmd + ' file ...'); return 1; }
    return fn();
  }

  var commands = {
    ls: cmdLs,
    cd: cmdCd,
    clear: function () { screen.innerHTML = ''; return 0; },
    reset: function () { screen.innerHTML = ''; return 0; },
    help: cmdHelp,
    cat: cmdCat,
    open: cmdOpen,
    pwd: function () {
      out(pick(['/home/' + pick(NAMES), '/var/www/' + pick(WORDS), '/Users/wteuber/Desktop/stuff/old/new/final',
        '/dev/null', '/tmp/' + hex(8), '/usr/local/opt/' + pick(WORDS), '/Volumes/Untitled 3', '/proc/self/cwd']));
      return 0;
    },
    whoami: function () { out(pick(NAMES)); return 0; },
    who: function () {
      var n = rnd(1, 4);
      for (var i = 0; i < n; i++) out(padR(pick(NAMES), 9) + padR('ttys00' + rnd(0, 9), 9) + MONTHS[rnd(0, 11)] + ' ' + padL(rnd(1, 28), 2) + ' ' + rnd(10, 23) + ':' + rnd(10, 59));
      return 0;
    },
    id: function () { var u = pick(NAMES); out('uid=' + rnd(0, 999) + '(' + u + ') gid=' + rnd(0, 99) + '(' + pick(['staff', 'wheel', 'snacks', 'everyone']) + ')'); return 0; },
    hostname: function () { out(pick(['toaster.local', 'deep-thought', 'localhost', 'mainframe-' + rnd(1, 9), 'potato'])); return 0; },
    uname: function (args) {
      out(args.indexOf('-a') >= 0
        ? pick(['Darwin', 'Linux', 'Plan9', 'TempleOS', 'AmigaOS']) + ' ' + pick(['toaster', 'potato']) + ' ' + rnd(1, 30) + '.' + rnd(0, 9) + '.' + rnd(0, 9) + ' #1 SMP ' + pick(['x86_64', 'arm64', 'm68k', 'z80'])
        : pick(['Darwin', 'Linux', 'FreeBSD', 'Windows 95', 'BeOS', 'Commodore 64']));
      return 0;
    },
    date: function () {
      var d = new Date(Date.now() + rnd(-4e11, 4e11));
      out(d.toUTCString().replace('GMT', pick(['UTC', 'CET', 'PST', 'MARS'])));
      return 0;
    },
    uptime: function () {
      out(rnd(0, 23) + ':' + padL(rnd(0, 59), 2).replace(' ', '0') + '  up ' + rnd(1, 9999) + ' days, ' + rnd(1, 23) + ':' + rnd(10, 59) +
        ', ' + rnd(1, 9) + ' users, load averages: ' + (Math.random() * 99).toFixed(2) + ' ' + (Math.random() * 9).toFixed(2) + ' ' + (Math.random() * 3).toFixed(2));
      return 0;
    },
    echo: function (args) {
      var t = args.join(' ');
      out(pick([t.split('').reverse().join(''), t.toUpperCase(), words(rnd(1, 5)), t.replace(/[aeiou]/g, 'o'), t + ' ' + t, '...' + t + '?']));
      return 0;
    },
    head: function (args, cmd) { return needFile(cmd, args, function () { out(fakeFile(args[args.length - 1]).split('\n').slice(0, 3).join('\n')); return 0; }); },
    tail: function (args, cmd) { return needFile(cmd, args, function () { out(fakeFile(args[args.length - 1]).split('\n').slice(-3).join('\n')); return 0; }); },
    less: function (args, cmd) { return needFile(cmd, args, function () { out(fakeFile(args[0])); outHTML(c('c-dim', '(END)')); return 0; }); },
    grep: function (args) {
      if (!args.length) { out('usage: grep [-abcdDEFGHhIiJLlMmnOopqRSsUVvwXxZz] [-A num] [-B num] [-C[num]] [-e pattern] [-f file] [pattern] [file ...]'); return 2; }
      if (chance(0.3)) return 1;
      var n = rnd(1, 5);
      for (var i = 0; i < n; i++) outHTML(c('c-magenta', pick(WORDS) + '.' + pick(['js', 'html', 'txt'])) + c('c-cyan', ':') + c('c-green', String(rnd(1, 999))) + c('c-cyan', ':') + esc(words(2) + ' ') + c('c-red b', args[0]) + esc(' ' + words(3)));
      return 0;
    },
    find: function () {
      var n = rnd(3, 9);
      for (var i = 0; i < n; i++) out('./' + pick(WORDS) + '/' + pick(WORDS) + pick(['.js', '.bak', '.old', '~', '.swp', '']));
      if (chance(0.5)) out('find: ./.secret: Permission denied');
      return 0;
    },
    touch: function (args) { state.dirty = true; return args.length ? 0 : (out('usage: touch [-A [-][[hh]mm]SS] [-acfhm] [-r file] [-t [[CC]YY]MMDDhhmm[.SS]] file ...'), 1); },
    mkdir: function (args) { state.dirty = true; return args.length ? 0 : (out('usage: mkdir [-pv] [-m mode] directory_name ...'), 1); },
    mv: function (args) { state.dirty = true; if (args.length < 2) { out('usage: mv [-f | -i | -n] [-hv] source target'); return 64; } return 0; },
    cp: function (args) { state.dirty = true; if (args.length < 2) { out('usage: cp [-R [-H | -L | -P]] [-fi | -n] [-aclpsvXx] source_file target_file'); return 64; } return 0; },
    chmod: function () { state.dirty = true; return 0; },
    chown: function () { out('chown: ' + pick(['changing ownership: Operation not permitted', 'nice try'])); return 1; },
    rm: async function (args) {
      state.dirty = true;
      if (args.indexOf('-rf') >= 0 || args.indexOf('-fr') >= 0) {
        var victims = ['/bin', '/usr/lib', '/etc/passwd', '/System', '/Users/wteuber/Pictures/cats', '/homework', '/the-internet'];
        for (var i = 0; i < victims.length; i++) { out('removed ' + victims[i]); scroll(); await sleep(rnd(120, 400)); }
        await sleep(600);
        out('\nJust kidding. Everything is still there. Try ls.');
        return 0;
      }
      return args.length ? 0 : (out('usage: rm [-f | -i] [-dIPRrvWx] file ...'), 64);
    },
    sudo: function (args) {
      if (args[0] === 'make' && args[1] === 'me' && args[2] === 'a' && args[3] === 'sandwich') { out('Okay.'); return 0; }
      out(pick(['wteuber is not in the sudoers file. This incident will be reported.',
        'Password: \nSorry, try again.\nPassword: \nsudo: 3 incorrect password attempts',
        'With great power comes great responsibility. Denied.']));
      return 1;
    },
    'make': function (args) {
      if (args.join(' ') === 'me a sandwich') { out('What? Make it yourself.'); return 2; }
      out(pick(["make: *** No targets specified and no makefile found.  Stop.", "make: Nothing to be done for `all'.",
        'cc -O2 -o ' + pick(WORDS) + ' ' + pick(WORDS) + '.c\n' + pick(WORDS) + '.c:' + rnd(1, 300) + ':' + rnd(1, 40) + ": warning: this is fine [-Wfine]"]));
      return chance(0.5) ? 0 : 2;
    },
    git: function (args) {
      var sub = args[0];
      if (sub === 'status') {
        outHTML('On branch ' + esc(pick(BRANCHES)) + '\nChanges not staged for commit:\n  (use "git add &lt;file&gt;..." to update what will be committed)\n\t' +
          c('c-red', 'modified:   ' + pick(WORDS) + '.js') + '\n\t' + c('c-red', 'deleted:    ' + pick(WORDS) + '.html') + '\n\nUntracked files:\n\t' + c('c-red', pick(WORDS) + '.bak'));
      } else if (sub === 'log') {
        for (var i = 0; i < rnd(2, 4); i++) {
          outHTML(c('c-yellow', 'commit ' + hex(40)) + '\nAuthor: ' + esc(pick(NAMES)) + '\nDate:   ' + esc(new Date(Date.now() - rnd(0, 3e10)).toString().slice(0, 24)) +
            '\n\n    ' + esc(pick(['Fix typo', 'Fix the fix', 'WIP', 'asdf', 'Revert "Revert "Fix typo""', 'It works on my machine', 'Final commit', 'Final commit 2'])) + '\n');
        }
      } else if (sub === 'push') {
        out(pick(['Everything up-to-date', 'To github.com:' + pick(NAMES) + '/' + pick(WORDS) + '.git\n ! [rejected]        master -> master (fetch first)\nerror: failed to push some refs',
          'Enumerating objects: ' + rnd(3, 99) + ', done.\nWriting objects: 100% (' + rnd(3, 99) + '/' + rnd(3, 99) + '), done.\nTo github.com:wteuber/' + pick(WORDS) + '.git\n   ' + hex(7) + '..' + hex(7) + '  master -> master']));
      } else if (sub === 'commit') {
        out('[' + pick(BRANCHES) + ' ' + hex(7) + '] ' + pick(['WIP', 'stuff', 'more stuff', 'fix']) + '\n ' + rnd(1, 99) + ' files changed, ' + rnd(1, 9999) + ' insertions(+), ' + rnd(0, 9999) + ' deletions(-)');
        state.dirty = false;
      } else if (sub === 'blame') {
        out(hex(8) + ' (' + pick(NAMES) + ' 2009-04-01) // it was like this when I got here');
      } else if (!sub) {
        out('usage: git [--version] [--help] <command> [<args>]');
        return 1;
      } else {
        out(pick(["git: '" + sub + "' is not a git command. See 'git --help'.", 'Already up to date.', 'fatal: not a git repository (or any of the parent directories): .git', 'OK']));
      }
      return 0;
    },
    vim: function (args, cmd) {
      out(pick(['E37: No write since last change (add ! to override)', '~\n~\n~\n"' + (args[0] || '[No Name]') + '" [readonly] 0L, 0B\n:q!',
        'You have been in ' + cmd + ' for ' + rnd(2, 40) + ' years. To exit, close the browser. Just kidding: :q']));
      return chance(0.5) ? 0 : 1;
    },
    nano: function () { out('  GNU nano 2.0.6\n\n\n^G Get Help  ^O WriteOut  ^X Exit (please)'); return 0; },
    emacs: function () { out('emacs: a great operating system, lacking only a decent editor. Loading ' + rnd(200, 900) + ' packages...'); return 1; },
    man: function (args) {
      if (!args.length) { out('What manual page do you want?\nFor example, try \'man man\'.'); return 1; }
      out(args[0].toUpperCase() + '(1)\n\nNAME\n     ' + args[0] + ' -- ' + words(rnd(3, 6)) + '\n\nDESCRIPTION\n     ' + sentence() + ' ' + sentence());
      return 0;
    },
    which: function (args) { args.forEach(function (a) { out(pick(['/usr/bin/', '/usr/local/bin/', '/opt/homebrew/bin/', '/dev/', '~/.secret/']) + a); }); return 0; },
    history: function () {
      var fake = ['rm -rf node_modules', 'npm install', 'git push --force', 'sudo !!', 'vim ~/.zshrc', 'exit', ':q', ':wq', 'why', 'cd ../../../..', 'make coffee', 'ls'];
      for (var i = 0; i < rnd(5, 9); i++) out(padL(rnd(100, 9999), 5) + '  ' + pick(fake));
      return 0;
    },
    ps: function () {
      out('  PID TTY           TIME CMD');
      for (var i = 0; i < rnd(3, 6); i++) out(padL(rnd(100, 99999), 5) + ' ttys00' + rnd(0, 9) + '    ' + rnd(0, 9) + ':' + padL(rnd(0, 59), 2).replace(' ', '0') + '.' + rnd(10, 99) + ' ' + pick(['-zsh', 'node', 'chrome --tabs=' + rnd(200, 999), 'vim', 'coffee-maker', 'definitely-not-a-miner']));
      return 0;
    },
    top: async function () {
      for (var t = 0; t < 6; t++) {
        out('Processes: ' + rnd(300, 900) + ' total, ' + rnd(1, 9) + ' running. CPU usage: ' + (Math.random() * 100).toFixed(1) + '% user');
        out(padR('PID', 7) + padR('COMMAND', 18) + '%CPU');
        for (var i = 0; i < 3; i++) out(padR(String(rnd(100, 9999)), 7) + padR(pick(['Chrome Helper', 'node', 'kernel_task', 'Slack', 'zsh', 'mds_stores']), 18) + (Math.random() * 300).toFixed(1));
        scroll();
        await sleep(700);
      }
      return 0;
    },
    kill: function (args) { if (!args.length) { out('kill: not enough arguments'); return 1; } out(pick(['', 'kill: kill ' + args[0] + ' failed: operation not permitted', 'It\'s dead, Jim.'])); return 0; },
    df: function () {
      out('Filesystem     Size   Used  Avail Capacity  Mounted on');
      out('/dev/disk1s1   ' + rnd(1, 999) + 'Gi  ' + rnd(1, 999) + 'Gi  ' + rnd(0, 9) + 'Mi   ' + rnd(90, 101) + '%    /');
      out('/dev/cats      ∞Ti    ∞Ti    0Bi    100%    /Users/wteuber/Pictures');
      return 0;
    },
    du: function () { out(rnd(1, 999) + pick(['K', 'M', 'G']) + '\t.'); return 0; },
    free: function () { out('              total        used        free\nMem:       ' + rnd(1000, 9999) + '        ' + rnd(1000, 9999) + '          ' + rnd(0, 3) + '\nSwap:      lol'); return 0; },
    ping: async function (args) {
      var host = args.filter(function (a) { return a.charAt(0) !== '-'; })[0] || 'localhost';
      var ip = rnd(1, 254) + '.' + rnd(0, 255) + '.' + rnd(0, 255) + '.' + rnd(1, 254);
      out('PING ' + host + ' (' + ip + '): 56 data bytes');
      var n = rnd(3, 6), got = 0;
      for (var i = 0; i < n; i++) {
        await sleep(rnd(400, 1000));
        if (chance(0.2)) out('Request timeout for icmp_seq ' + i);
        else { got++; out('64 bytes from ' + ip + ': icmp_seq=' + i + ' ttl=' + rnd(30, 64) + ' time=' + (Math.random() * pick([20, 200, 2000])).toFixed(3) + ' ms'); }
        scroll();
      }
      out('\n--- ' + host + ' ping statistics ---\n' + n + ' packets transmitted, ' + got + ' packets received, ' + Math.round((n - got) / n * 100) + '.0% packet loss');
      return got ? 0 : 2;
    },
    curl: function (args) {
      out(pick(['<html><body><h1>It works!</h1></body></html>', '{"status":"ok","answer":42}', 'curl: (6) Could not resolve host: ' + (args[args.length - 1] || 'the-internet'),
        '<!DOCTYPE html><title>418 I\'m a teapot</title>']));
      return 0;
    },
    wget: async function (args) { await progress((args[0] || 'index.html').split('/').pop(), 20); out('saved. (somewhere)'); return 0; },
    ssh: async function (args) {
      out('ssh: connect to host ' + (args[args.length - 1] || 'localhost') + ' port 22: ' + pick(['Connection refused', 'Operation timed out', 'Too much coffee']));
      return 255;
    },
    npm: async function (args) {
      if (args[0] === 'install' || args[0] === 'i' || !args.length) {
        await progress('npm', 30);
        out('\nadded ' + rnd(800, 2400) + ' packages, and audited ' + rnd(2400, 9999) + ' packages in ' + rnd(2, 90) + 's\n\n' + rnd(1, 99) + ' packages are looking for funding\n\n' + rnd(2, 60) + ' vulnerabilities (' + rnd(1, 20) + ' moderate, ' + rnd(1, 20) + ' high, ' + rnd(1, 9) + ' critical)');
        return 0;
      }
      out(pick(['npm ERR! code ELIFECYCLE', 'npm ERR! Missing script: "' + args[0] + '"', 'npm WARN deprecated everything@1.0.0']));
      return 1;
    },
    yarn: function () { out('yarn install v1.22.' + rnd(0, 22) + '\n[1/4] Resolving packages...\nsuccess Already up-to-date.\n✨  Done in ' + (Math.random() * 3).toFixed(2) + 's.'); return 0; },
    bundle: async function () { await progress('Fetching gems', 15); out('Bundle complete! ' + rnd(20, 200) + ' Gemfile dependencies, ' + rnd(100, 400) + ' gems now installed.'); return 0; },
    brew: async function (args) { out('==> Auto-updating Homebrew...'); await sleep(1500); out('==> ' + pick(['Pouring ' + (args[1] || 'beer') + '--1.0.arm64_sonoma.bottle.tar.gz', 'Downloading the internet', 'Warning: ' + (args[1] || 'something') + ' is already installed'])); out('🍺  Done'); return 0; },
    docker: function () { out(pick(['Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?', 'CONTAINER ID   IMAGE     STATUS\n' + hex(12) + '   whale     Up ' + rnd(2, 99) + ' days (unhealthy)'])); return 1; },
    kubectl: function () { out('The connection to the server localhost:8080 was refused - did you specify the right host or port?'); return 1; },
    ruby: function () { out(pick(['ruby 1.8.7 (2008-05-31 patchlevel 0)', '=> nil', 'Hello, world!', '-e:1: syntax error, unexpected end-of-input'])); return 0; },
    irb: function () { out('irb(main):001:0> ' + pick(['42', 'nil', '"hello"']) + '\n=> ' + pick(['42', 'nil', '"hello"'])); return 0; },
    python: function () { out(pick(['Python 2.7.18\n>>> exit()', '  File "<stdin>", line 1\n    print "hello"\n          ^\nSyntaxError: Missing parentheses', 'import this\nBeautiful is better than ugly.'])); return 0; },
    python3: function (a, n) { return commands.python(a, n); },
    node: function () { out(pick(['Welcome to Node.js v0.10.48.\n> undefined', '> [] + {}\n\'[object Object]\'', '> NaN === NaN\nfalse'])); return 0; },
    code: function () { out('Opening VS Code... Installing ' + rnd(2, 40) + ' updates first.'); return 0; },
    neofetch: function () {
      outHTML(c('c-green', '                    \'c.          ') + c('b', 'wteuber@web') + '\n' +
        c('c-green', '                 ,xNMM.          ') + '-----------\n' +
        c('c-yellow', '      .OMMMMo           ') + '         ' + c('c-cyan b', 'OS: ') + esc(pick(['macOS Toaster', 'BrowserOS 1.0', 'HTML 3.2 Final'])) + '\n' +
        c('c-red', '    .MMMMMMMMMMMMMMMMMMM.   ') + '     ' + c('c-cyan b', 'Uptime: ') + rnd(1, 99) + ' days\n' +
        c('c-magenta', '     MMMMMMMMMMMMMMMMMMM    ') + '     ' + c('c-cyan b', 'Shell: ') + 'zsh 5.9 (mostly fake)\n' +
        c('c-blue', '       .MMMMMMMMMMMMM.   ') + '        ' + c('c-cyan b', 'Memory: ') + rnd(1, 999) + 'MiB / 640KiB');
      return 0;
    },
    fortune: function () {
      out(pick(['There are 10 kinds of people: those who understand binary and those who don\'t.', 'It works on my machine.',
        'You will find a bug in production today.', 'Have you tried turning it off and on again?', 'The cake is a lie.',
        'Weeks of coding can save you hours of planning.', 'Only ls tells the truth here.']));
      return 0;
    },
    cowsay: function (args) {
      var t = args.length && chance(0.5) ? args.join(' ') : words(rnd(2, 5));
      out(' ' + '_'.repeat(t.length + 2) + '\n< ' + t + ' >\n ' + '-'.repeat(t.length + 2) + '\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||');
      return 0;
    },
    sl: async function () {
      var train = ['      ====        ________                ___________ ', '  _D _|  |_______/        \\__I_I_____===__|_________| ', '   |(_)---  |   H\\________/ |   |        =|___ ___|   ', '   /     |  |   H  |  |     |   |         ||_| |_||   ', '  |      |  |   H  |__--------------------| [___] |   ', '  | ________|___H__/__|_____/[][]~\\_______|       |   ', '  |/ |   |-----------I_____I [][] []  D   |=======|__ ', '__/ =| o |=-~~\\  /~~\\  /~~\\  /~~\\ ____Y___________|__ ', ' |/-=|___|=    ||    ||    ||    |_____/~\\___/        ', '  \\_/      \\O=====O=====O=====O_/      \\_/            '];
      var lines = train.map(function () { return line(''); });
      var cols = size().cols;
      for (var x = cols; x > -60; x -= 3) {
        lines.forEach(function (l, i) {
          var s = x >= 0 ? ' '.repeat(x) + train[i] : train[i].slice(-x);
          l.textContent = s.slice(0, cols);
        });
        scroll();
        await sleep(40);
      }
      lines.forEach(function (l) { l.remove(); });
      return 0;
    },
    exit: async function () {
      out('logout\nConnection to ' + HOST + ' closed.');
      try { sessionStorage.removeItem(STORE); } catch (e) { /* nothing to forget */ }
      window.removeEventListener('pagehide', save);
      await sleep(900);
      location.href = base + '/';
      return 0;
    },
    logout: function (a, n) { return commands.exit(a, n); },
    zsh: function () { out(''); return 0; },
    bash: function () { out('bash-3.2$ exit\nNo. We use zsh here.'); return 0; },
    'omz': function () { out('Updating Oh My Zsh\n' + pick(['Oh My Zsh is already at the latest version.', 'Hooray! Oh My Zsh has been updated!'])); return 0; },
    coffee: function () { out('Error 418: I\'m a teapot.'); return 1; },
    please: function (args) { out(args.length ? 'Since you asked nicely: no.' : 'please what?'); return 1; },
    rails: function () { out('=> Booting Puma\n=> Rails ' + rnd(1, 8) + '.' + rnd(0, 2) + ' application starting in development\n* Listening on http://127.0.0.1:3000\nAbort trap: 6'); return 134; },
    rake: function () { out('rake aborted!\nDon\'t know how to build task \'default\''); return 1; },
    vi: function (a, n) { return commands.vim(a, n); },
    more: function (a, n) { return commands.less(a, n); }
  };

  function notFound(name, args) {
    if (chance(0.25)) {
      var close = Object.keys(commands).filter(function (k) { return k[0] === name[0] && k !== name; });
      if (close.length) { out('zsh: correct \'' + name + '\' to \'' + pick(close) + '\' [nyae]? n'); }
    }
    if (chance(0.2)) { out(fakeFile(name + '.txt').split('\n')[0]); return 0; }
    out('zsh: command not found: ' + name);
    void args;
    return 127;
  }

  // ------------------------------------------- the other honest commands

  var BINARY = /\.(png|jpe?g|gif|ico|webp|bmp|wav|mp3|ogg|mp4|webm|woff2?|ttf|otf|eot|pdf|zip|gz)$/i;
  var CAT_MAX_LINES = 1000;

  async function cmdCat(args) {
    var number = false, names = [];
    args.forEach(function (a) { if (a === '-n') number = true; else names.push(a); });
    if (!names.length) { out('usage: cat [-n] file ...'); return 1; }
    var code = 0, n = 0;
    for (var i = 0; i < names.length; i++) {
      var f = names[i];
      var node = resolve(f);
      if (!node) { out('cat: ' + f + ': No such file or directory'); code = 1; continue; }
      if (node.dir) { out('cat: ' + f + ': Is a directory'); code = 1; continue; }
      if (BINARY.test(node.name)) {
        outHTML(esc('cat: ' + f + ': binary file, your terminal would not survive it. Try ') + c('b', 'open ' + f));
        code = 1;
        continue;
      }
      var text;
      try {
        var r = await fetch(url(node));
        if (!r.ok) throw new Error(r.status);
        text = await r.text();
      } catch (e) { out('cat: ' + f + ': Input/output error'); code = 1; continue; }
      var lines = text.replace(/\n$/, '').split('\n');
      var rest = lines.length - CAT_MAX_LINES;
      if (rest > 0) lines = lines.slice(0, CAT_MAX_LINES);
      lines.forEach(function (l) { line(esc(number ? padL(++n, 6) + '  ' + l : l)); });
      if (rest > 0) outHTML(c('c-dim', '… ' + rest + ' more lines. ') + c('b', 'open ' + f));
    }
    return code;
  }

  function cmdOpen(args) {
    if (!args.length) { out('Usage: open <file|directory> ...'); return 1; }
    var code = 0;
    args.forEach(function (a) {
      var node = resolve(a);
      if (!node) { out('The file ' + absolute(a) + ' does not exist.'); code = 1; return; }
      var u = REPO + (node.dir ? '/tree/master' : '/blob/master') + (node === root ? '' : encodeURI(node.path));
      window.open(u, '_blank', 'noopener');
      outHTML(esc('Opening ') + '<a class="c-blue" href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + '</a>');
    });
    return code;
  }

  var HONEST = [
    ['ls [-aAlh1CmRtSrFpdG] [path ...]', 'list files (the real ones)'],
    ['cd [dir]', 'change directory, cd - goes back'],
    ['cat [-n] file ...', 'print files'],
    ['open glob ...', 'show files on GitHub in a new tab'],
    ['clear', 'clear the screen (Ctrl+L)'],
    ['help', 'show this list'],
    ['exit', 'close the connection']
  ];

  function cmdHelp() {
    outHTML(c('b', 'Commands that do what they say:'));
    HONEST.forEach(function (h) { outHTML('  ' + c('c-green', padR(h[0], 34)) + esc(h[1])); });
    line('');
    outHTML(c('b', 'Commands that just look busy:'));
    var honest = ['ls', 'cd', 'cat', 'open', 'clear', 'reset', 'help', 'exit', 'logout'];
    var busy = Object.keys(commands).filter(function (k) { return honest.indexOf(k) < 0; }).sort();
    outHTML(columns(busy.map(function (k) { return { text: k, html: esc(k) }; })));
    line('');
    out('Tab completes, ↑/↓ browse history, Ctrl+C interrupts.');
    return 0;
  }

  // ------------------------------------------------------------- login

  var BANNER = ["           _                 _", "__      __| |_   ___  _   _ | |__    ___  _ __      ___   ___   _ __ ___", "\\ \\ /\\ / /| __| / _ \\| | | || '_ \\  / _ \\| '__|    / __| / _ \\ | '_ ` _ \\", " \\ V  V / | |_ |  __/| |_| || |_) ||  __/| |    _ | (__ | (_) || | | | | |", "  \\_/\\_/   \\__| \\___| \\__,_||_.__/  \\___||_|   (_) \\___| \\___/ |_| |_| |_|"];

  async function login() {
    var ip = '203.0.113.42'; // TEST-NET-3 (RFC 5737), reserved for examples
    var steps = [
      [c('c-dim', 'ssh guest@' + HOST), 80],
      [c('c-dim', 'Connecting to ' + HOST + ' (' + ip + ') port 22...'), 400],
      [c('c-dim', "Warning: Permanently added '" + HOST + "' (ED25519) to the list of known hosts."), 250],
      [c('c-dim', 'Authenticated to ' + HOST + ' using "none". Nobody asked for a password.'), 300]
    ];
    for (var i = 0; i < steps.length; i++) { line(steps[i][0]); await sleep(steps[i][1]); }
    line('');
    var colors = ['c-blue', 'c-blue', 'c-cyan', 'c-cyan', 'c-green'];
    if (size().cols > BANNER[1].length) {
      for (var b = 0; b < BANNER.length; b++) { line(c(colors[b] + ' b', BANNER[b])); await sleep(40); }
    } else {
      line(c('c-cyan b', HOST));
    }
    line('');
    outHTML('Welcome, ' + c('host', 'guest') + '. This is the file server behind ' + esc(HOST) + '.');
    line('');
    outHTML(c('c-yellow b', '⚠  WARNING: you are connected to a live production server.'));
    outHTML(c('c-yellow', '   Be careful what you type. There is no undo, sudo is watching,'));
    outHTML(c('c-yellow', '   and every keystroke is reported to my mom.'));
    line('');
    outHTML('Type ' + c('c-green b', 'help') + ' to list all commands.');
    line('');
    var d = new Date(Date.now() - rnd(3600, 86400 * 3) * 1000);
    out('Last login: ' + d.toString().slice(0, 24) + ' from 10.' + rnd(0, 255) + '.' + rnd(0, 255) + '.' + rnd(1, 254));
  }

  // ------------------------------------------------------------------- boot

  function relative(from, to) {
    if (to.indexOf(from === '/' ? '/' : from + '/') === 0) return to.slice(from === '/' ? 1 : from.length + 1);
    return prettyPath(to);
  }

  screen.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-dir]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    var dir = lookup(a.getAttribute('data-dir'));
    if (!dir) return;
    if (a.getAttribute('href').indexOf('#') >= 0) {
      // No page of its own: change directory right here.
      e.preventDefault();
      if (job) return;
      var cmd = 'cd ' + relative(state.cwd, dir.path);
      if (input) freeze(cmd); else echo(cmd);
      chdir(dir.path);
      echo('ls');
      state.history.push(cmd, 'ls');
      cmdLs([]).then(function (code) { state.last = code; showPrompt(); });
    }
  });

  window.addEventListener('hashchange', function () {
    var p = hashDir() || pageDir();
    if (p === state.cwd || job) return;
    var cmd = 'cd ' + relative(state.cwd, p);
    if (input) freeze(cmd); else echo(cmd);
    chdir(p);
    echo('ls');
    cmdLs([]).then(function (code) { state.last = code; showPrompt(); });
  });

  window.addEventListener('pagehide', save);
  window.addEventListener('pageshow', function (e) {
    // Back/forward cache: save() froze the prompt on the way out.
    if (e.persisted && root && !input && !job) showPrompt();
  });
  window.addEventListener('resize', updateTitle);

  fetch(MANIFEST).then(function (r) { return r.json(); }).then(function (m) {
    base = m.base || '';
    root = buildTree(m.files);
    var target = hashDir() || pageDir();
    if (!lookup(target)) target = HOME;

    screen.textContent = '';
    var saved = restore();
    if (saved) {
      state.cwd = lookup(saved.cwd) ? saved.cwd : target;
      state.oldpwd = saved.oldpwd || HOME;
      state.last = saved.last || 0;
      state.dirty = !!saved.dirty;
      state.history = saved.history || [];
      screen.querySelectorAll('input').forEach(function (el) { el.remove(); });
      screen.querySelectorAll('.line-input').forEach(function (el) { el.className = ''; });
    } else {
      state.cwd = target;
      updateTitle();
      return login().then(function () { return boot2(saved, target); });
    }
    return boot2(saved, target);
  }).then(function (code) {
    state.last = code || 0;
    chdir(state.cwd);
    showPrompt();
  }).catch(function (e) {
    out('ssh: connect to host ' + HOST + ': ' + e.message);
  });

  function boot2(saved, target) {
    if (!saved || state.cwd !== target) {
      if (saved) {
        echo('cd ' + relative(state.cwd, target));
        state.oldpwd = state.cwd;
      }
      state.cwd = target;
      echo('ls');
      return cmdLs([]);
    }
    return state.last;
  }
})();
