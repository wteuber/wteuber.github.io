/*
 * Scribble Slide level generator.
 *
 *   LevelGen.get(n)        -> level n (1-based). 1-10 are the original hand-picked pages,
 *                             11 and up are generated on demand, with no upper limit.
 *   LevelGen.difficulty(n) -> target difficulty 0..1 for level n.
 *
 * A level is { w, h, p: [[dir, x1, y1, x2, y2, ...], ...], meta } with dir 0=up 1=right 2=down 3=left.
 *
 * How it works
 *   1. difficulty(n) starts where the classic page 10 ends, rises quickly at first, then ever
 *      more slowly, and never quite reaches 1. On top of that sits a gentle 10-level wave:
 *      each chapter opens slightly easier and ends on a "boss".
 *   2. Difficulty picks the page size, the silhouette (cut corners, notches, holes, a window, stairs),
 *      and the piece style (fine, mixed, chunky, sticks).
 *   3. For each level a few dozen candidates are built: the silhouette is tiled with random
 *      polyominoes, then arrows are assigned along a removal order, so every candidate is
 *      solvable by construction. A "chain" knob runs from loose (many shapes free at once)
 *      to tight (one long dependency chain).
 *   4. Each candidate is measured (how many shapes are free on average, dependency depth,
 *      decoys that look free but are blocked further away) and the one closest to the target
 *      for this difficulty wins.
 *
 * Everything is driven by an integer-seeded PRNG and plain arithmetic, so level n is identical
 * on every device. Changing VERSION or any tuning value reshuffles all generated levels.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LevelGen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var VERSION = 1;
  var CANDIDATES = 40;
  var MAX_W = 11, MAX_H = 14;
  var DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];

  // The original ten pages.
  var CLASSIC = [{"w":4,"h":4,"p":[[3,0,0,1,0,1,1,1,2],[2,0,1,0,2,0,3],[1,1,3,2,3,2,2,3,2,3,3],[0,2,1,3,1,3,0,2,0]]},{"w":5,"h":5,"p":[[0,4,0,4,1,3,1,3,0],[3,0,4,0,3,0,2,1,2],[2,0,1,0,0,1,1],[1,1,0,2,0,2,1,2,2],[1,3,4,3,3,2,4,3,2,4,2,4,3],[3,1,4,1,3,2,3]]},{"w":5,"h":6,"p":[[0,0,5,1,5,0,4,1,4],[1,0,0,1,0,1,1,0,1],[2,4,5,3,5,2,5,2,4],[3,0,2,0,3,1,2],[3,1,3,2,3,3,3],[0,3,4,4,4,4,3,4,2],[1,2,0,2,1,3,1,4,1],[0,2,2,3,2],[0,4,0,3,0]]},{"w":6,"h":6,"p":[[2,0,5,1,5,1,4,1,3],[2,0,4,0,3,0,2],[1,0,1,1,1],[0,1,2,2,2,2,3,2,4],[3,2,5,3,5],[0,4,5,4,4,4,3],[0,5,4,5,3,5,2,4,2],[2,3,4,3,3],[0,3,2,3,1,3,0,4,1],[0,4,0,5,0,5,1],[1,2,1,2,0]]},{"w":6,"h":7,"p":[[3,0,6,0,5,0,4],[0,1,6,2,6,3,6],[1,5,5,5,4],[1,5,3,4,3,4,4,4,5,4,2,5,2],[3,1,5,2,5,3,5],[1,0,0,1,0,1,1],[2,0,1,0,2],[1,0,3,1,3,1,2,2,3],[1,1,4,2,4,3,4],[1,3,3,3,2],[1,2,2,2,1,3,1,2,0,3,0]]},{"w":7,"h":7,"p":[[2,0,4,1,4,1,3,2,4],[1,0,3,0,2,1,2],[0,6,0,6,1,6,2,6,3],[2,2,3,3,3,3,4,4,3],[2,4,4,4,5,3,5,2,5],[2,3,6,2,6,1,6,4,6,1,5],[2,2,2,2,1,3,2],[2,2,0,3,0,3,1,4,1,5,1],[1,4,2,5,2,5,3],[2,4,0,5,0],[3,6,4,5,4,5,5],[3,5,6,6,6,6,5]]},{"w":7,"h":8,"p":[[3,5,0,5,1,4,0],[3,6,1,6,2,6,3,5,3],[3,5,2,4,2,4,3,4,1],[2,0,5,1,5],[2,0,0,1,0,0,1,2,0,0,2],[2,3,0,3,1,2,1,1,1,1,2],[2,3,2,2,2,2,3,1,3],[2,3,3,3,4,3,5],[3,0,3,0,4,1,4],[2,2,4,2,5],[1,5,7,5,6,4,6,3,6,4,7],[1,3,7,2,7,1,7],[1,2,6,1,6],[0,6,5,5,5,4,5],[3,6,4,5,4,4,4]]},{"w":8,"h":8,"p":[[3,6,0,5,0,6,1],[0,7,7,6,7,6,6,7,6],[3,7,5,6,5,6,4],[3,7,4,7,3,7,2],[3,6,2,5,2,6,3],[3,5,1,4,1,3,1,3,2,4,2],[3,4,0,3,0,2,0,1,0],[2,0,0,0,1,0,2,1,2],[3,1,1,2,1,2,2,2,3,2,4],[3,3,3,4,3,5,3],[2,0,3,1,3,1,4],[2,0,4,0,5,1,5],[0,5,4,5,5,4,4],[0,5,6,4,6,3,6,4,5],[0,5,7,4,7,3,7],[1,2,7,2,6],[3,2,5,3,5,3,4]]},{"w":8,"h":9,"p":[[2,0,0,1,0,1,1],[2,0,1,0,2,0,3,1,3],[2,1,2,2,2,2,1,2,3,3,3],[2,2,0,3,0],[1,0,8,1,8,2,8],[1,0,7,1,7,1,6],[1,0,6,0,5,1,5,0,4,1,4],[3,4,0,5,0,5,1,4,1],[0,7,8,6,8],[1,7,7,6,7,6,6],[1,7,6,7,5],[1,7,3,7,4,6,4,6,3,6,5],[2,3,2,3,1,4,2],[3,5,2,5,3],[2,4,3,4,4,5,4],[1,5,8,5,7,4,7],[1,4,8,3,8,3,7],[2,2,7,2,6,3,6,2,5,2,4],[2,3,4,3,5,4,5],[1,4,6,5,6,5,5]]},{"w":9,"h":10,"p":[[0,8,8,8,7,8,6,8,5],[1,6,9,6,8,7,8],[0,8,4,8,3,7,3,7,4],[0,8,2,7,2,6,2,6,3],[1,0,9,1,9],[1,5,9,5,8,4,8],[1,4,9,3,9],[1,2,9,2,8,3,8],[0,6,1,6,0,5,0,4,0],[2,1,0,1,1,2,1,3,1],[1,2,0,3,0],[3,4,1,5,1,4,2],[3,5,2,5,3,5,4],[3,6,4,6,5,5,5,5,6,6,6],[3,7,5,7,6,7,7,6,7],[3,5,7,4,7,4,6],[2,3,7,3,6,2,6],[2,2,7,1,7,0,7,0,6],[1,0,8,1,8],[2,4,5,3,5,4,4,4,3],[2,3,4,2,4],[2,2,5,1,5,0,5,1,6],[2,1,4,1,3,1,2,2,3],[2,3,3,3,2,2,2],[2,0,2,0,3,0,4]]}];

  // ---------- deterministic randomness ----------
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(a, b) {
    var h = Math.imul(a ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul(b + 0x7F4A7C15, 0xC2B2AE35) ^ Math.imul(VERSION, 0x27D4EB2F);
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12; h = Math.imul(h, 0x297A2D39); h ^= h >>> 15;
    return h >>> 0;
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function pickWeighted(items, R) {              // items: [[value, weight], ...]
    var total = 0, i;
    for (i = 0; i < items.length; i++) total += items[i][1];
    var r = R() * total;
    for (i = 0; i < items.length; i++) { r -= items[i][1]; if (r < 0) return items[i][0]; }
    return items[items.length - 1][0];
  }

  // ---------- difficulty curve ----------
  var WAVE = [-0.05, -0.025, -0.01, 0, 0.01, -0.015, 0.015, 0.025, 0.035, 0.055];
  function difficulty(n) {
    if (n <= 10) return (n - 1) / 9 * 0.6;       // the classic pages ramp steeply on their own
    // generated levels pick up where page 10 leaves off (0.6) and keep climbing
    var k = n - 10;
    var base = 0.6 + 0.4 * (0.5 * k / (k + 150) + 0.5 * k / (k + 2500));
    return clamp(base + WAVE[(n - 1) % 10], 0.5, 1);
  }

  // ---------- silhouettes ----------
  function buildMask(W, H, shape, d, R) {
    var mask = [], x, y, i;
    for (y = 0; y < H; y++) { mask.push([]); for (x = 0; x < W; x++) mask[y].push(true); }
    var ri = function (n) { return Math.floor(R() * n); };
    var clear = function (x0, y0, w, h) {
      for (var yy = y0; yy < y0 + h; yy++) for (var xx = x0; xx < x0 + w; xx++)
        if (xx >= 0 && yy >= 0 && xx < W && yy < H) mask[yy][xx] = false;
    };
    var halfW = Math.floor((W - 1) / 2), halfH = Math.floor((H - 1) / 2);

    var corners = function () {
      var m = 1 + Math.floor(d * 2.99);
      for (var c = 0; c < 4; c++) {
        var a = Math.min(ri(m + 1), halfW), b = Math.min(ri(m + 1), halfH);
        clear(c & 1 ? W - a : 0, c & 2 ? H - b : 0, a, b);
      }
    };
    var steps = function () {
      var m = Math.min(3, halfW);
      for (var c = 0; c < 4; c++) {
        var s = ri(m + 1);
        for (var yy = 0; yy < s; yy++) for (var xx = 0; xx + yy < s; xx++)
          mask[c & 2 ? H - 1 - yy : yy][c & 1 ? W - 1 - xx : xx] = false;
      }
    };
    var notches = function () {
      var count = 1 + ri(2) + (d > 0.6 ? 1 : 0);
      for (i = 0; i < count; i++) {
        var side = ri(4), len = 1 + ri(2), depth = 1 + ri(2), at;
        if (side % 2 === 0) { at = 1 + ri(W - len - 1); clear(at, side === 0 ? 0 : H - depth, len, depth); }
        else { at = 1 + ri(H - len - 1); clear(side === 3 ? 0 : W - depth, at, depth, len); }
      }
    };
    var holes = function () {
      var count = 1 + ri(1 + Math.floor(d * 3));
      for (i = 0; i < count; i++) {
        var hw = 1 + ri(2), hh = 1 + ri(2);
        clear(1 + ri(W - hw - 1), 1 + ri(H - hh - 1), hw, hh);
      }
    };
    var windowHole = function () {
      var hw = W >= 7 ? 2 + ri(2) : 2, hh = Math.min(2 + ri(3), H - 4);
      clear(Math.floor((W - hw) / 2), Math.floor((H - hh) / 2) + ri(2), hw, hh);
    };

    if (shape === 'corners') corners();
    else if (shape === 'steps') steps();
    else if (shape === 'notches') notches();
    else if (shape === 'holes') holes();
    else if (shape === 'window') windowHole();
    else if (shape === 'corners+holes') { corners(); holes(); }
    else if (shape === 'steps+notches') { steps(); notches(); }

    var cells = 0;
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) if (mask[y][x]) cells++;
    return cells >= W * H * 0.7 ? mask : null;
  }

  // ---------- tiling with polyominoes ----------
  var STYLES = {
    fine:   { pool: [2, 2, 3, 3, 3, 4], straight: 0 },
    mixed:  { pool: [2, 3, 3, 3, 4, 4, 4, 5], straight: 0 },
    chunky: { pool: [3, 4, 4, 5, 5, 6], straight: 0 },
    sticks: { pool: [2, 3, 3, 4, 4, 5], straight: 0.8 }
  };
  function tile(mask, W, H, style, R) {
    var id = [], x, y, d, i;
    for (y = 0; y < H; y++) { id.push([]); for (x = 0; x < W; x++) id[y].push(-1); }
    var ri = function (n) { return Math.floor(R() * n); };
    var open = function (cx, cy) { return cx >= 0 && cy >= 0 && cx < W && cy < H && mask[cy][cx] && id[cy][cx] < 0; };
    var inMask = function (cx, cy) { return cx >= 0 && cy >= 0 && cx < W && cy < H && mask[cy][cx]; };
    var pieces = [], maxSize = style.pool[style.pool.length - 1] + 1;

    for (;;) {
      // start from the most enclosed open cell, so few lonely single cells are left over
      var best = 9, pool = [];
      for (y = 0; y < H; y++) for (x = 0; x < W; x++) {
        if (!open(x, y)) continue;
        var n = 0;
        for (d = 0; d < 4; d++) if (open(x + DX[d], y + DY[d])) n++;
        if (n < best) { best = n; pool = [[x, y]]; } else if (n === best) pool.push([x, y]);
      }
      if (!pool.length) break;
      var start = pool[ri(pool.length)], target = style.pool[ri(style.pool.length)];
      var p = pieces.length, cells = [start], last = start, lastDir = -1;
      id[start[1]][start[0]] = p;
      while (cells.length < target) {
        var next = null;
        if (lastDir >= 0 && R() < style.straight && open(last[0] + DX[lastDir], last[1] + DY[lastDir]))
          next = [last[0] + DX[lastDir], last[1] + DY[lastDir], lastDir];
        if (!next) {
          var opts = [];
          for (i = 0; i < cells.length; i++) for (d = 0; d < 4; d++)
            if (open(cells[i][0] + DX[d], cells[i][1] + DY[d])) opts.push([cells[i][0] + DX[d], cells[i][1] + DY[d], d]);
          if (!opts.length) break;
          next = opts[ri(opts.length)];
        }
        id[next[1]][next[0]] = p;
        last = [next[0], next[1]]; lastDir = next[2];
        cells.push(last);
      }
      pieces.push(cells);
    }
    // fold single cells into their smallest neighbour where possible
    for (i = 0; i < pieces.length; i++) {
      if (pieces[i].length !== 1) continue;
      var c = pieces[i][0], into = -1;
      for (d = 0; d < 4; d++) {
        var nx = c[0] + DX[d], ny = c[1] + DY[d];
        if (!inMask(nx, ny)) continue;
        var q = id[ny][nx];
        if (q !== i && pieces[q].length && pieces[q].length < maxSize && (into < 0 || pieces[q].length < pieces[into].length)) into = q;
      }
      if (into >= 0) { pieces[into].push(c); id[c[1]][c[0]] = into; pieces[i] = []; }
    }
    var out = [];
    for (i = 0; i < pieces.length; i++) if (pieces[i].length) out.push(pieces[i]);
    for (i = 0; i < out.length; i++) for (d = 0; d < out[i].length; d++) id[out[i][d][1]][out[i][d][0]] = i;
    return { pieces: out, id: id };
  }

  // For every piece and direction: which pieces lie in its path, and how many empty
  // cells there are before the first of them (the "glance distance").
  function sweeps(T, mask, W, H) {
    var blk = [], gap = [], i, d, c;
    for (i = 0; i < T.pieces.length; i++) {
      blk.push([]); gap.push([]);
      for (d = 0; d < 4; d++) {
        var seen = {}, list = [], g = 99;
        for (c = 0; c < T.pieces[i].length; c++) {
          var x = T.pieces[i][c][0] + DX[d], y = T.pieces[i][c][1] + DY[d], dist = 0, hit = false;
          while (x >= 0 && y >= 0 && x < W && y < H) {
            var q = mask[y][x] ? T.id[y][x] : -1;
            if (q >= 0 && q !== i) {
              if (!hit) { hit = true; if (dist < g) g = dist; }
              if (!seen[q]) { seen[q] = true; list.push(q); }
            }
            if (q !== i) dist++; else dist = 0;
            x += DX[d]; y += DY[d];
          }
        }
        blk[i].push(list); gap[i].push(g);
      }
    }
    return { blk: blk, gap: gap };
  }

  // Walk a removal order and give each piece an arrow that is clear at its turn.
  // chain = 0 picks at random (loose, easy); chain = 1 always prefers the arrow that
  // depends on the most already-removed pieces (long chains, hard).
  function assign(P, S, chain, R) {
    var dirs = [], removed = [], need = [], rev = [], i, d, j;
    for (i = 0; i < P; i++) { dirs.push(-1); removed.push(false); rev.push([]); need.push([0, 0, 0, 0]); }
    for (i = 0; i < P; i++) for (d = 0; d < 4; d++) {
      need[i][d] = S.blk[i][d].length;
      for (j = 0; j < S.blk[i][d].length; j++) rev[S.blk[i][d][j]].push([i, d]);
    }
    for (var left = P; left > 0; left--) {
      var bi = -1, bd = -1, bs = -1;
      for (i = 0; i < P; i++) {
        if (removed[i]) continue;
        for (d = 0; d < 4; d++) {
          if (need[i][d] !== 0) continue;
          var cnt = S.blk[i][d].length;
          var sc = chain * (cnt + (cnt ? 0.5 * Math.min(S.gap[i][d], 3) : 0)) + (1 - chain) * R() * 5 + R() * 0.3;
          if (sc > bs) { bs = sc; bi = i; bd = d; }
        }
      }
      if (bi < 0) return null;                   // interlocked tiling, try another candidate
      dirs[bi] = bd; removed[bi] = true;
      for (j = 0; j < rev[bi].length; j++) need[rev[bi][j][0]][rev[bi][j][1]]--;
    }
    return dirs;
  }

  // Play the level through and measure it. Returns null if it cannot be cleared.
  function analyse(P, dirs, S) {
    var need = [], rev = [], depth = [], removed = [], i, j, free = 0;
    for (i = 0; i < P; i++) { rev.push([]); depth.push(1); removed.push(false); }
    for (i = 0; i < P; i++) {
      var b = S.blk[i][dirs[i]];
      need.push(b.length);
      if (!b.length) free++;
      for (j = 0; j < b.length; j++) rev[b[j]].push(i);
    }
    var first = free, sumC = 0, wrong = 0, rounds = 0, decoys = 0, count = [0, 0, 0, 0];
    for (i = 0; i < P; i++) { count[dirs[i]]++; if (need[i] && S.gap[i][dirs[i]] >= 1) decoys++; }
    for (var alive = P; alive > 0; alive--) {
      if (free === 0) return null;
      sumC += free / alive;
      wrong += alive / free - 1;                 // expected wrong taps of a player tapping at random
      var pick = -1;
      for (i = 0; i < P; i++) if (!removed[i] && need[i] === 0) { pick = i; break; }
      removed[pick] = true; free--;
      if (depth[pick] > rounds) rounds = depth[pick];
      for (j = 0; j < rev[pick].length; j++) {
        var q = rev[pick][j];
        if (depth[q] < depth[pick] + 1) depth[q] = depth[pick] + 1;
        if (--need[q] === 0) free++;
      }
    }
    var used = 0, most = 0;
    for (i = 0; i < 4; i++) { if (count[i]) used++; if (count[i] > most) most = count[i]; }
    return { first: first, choice: sumC / P, wrong: wrong, rounds: rounds, decoys: decoys, dirsUsed: used, dirShare: most / P };
  }

  // ---------- one level ----------
  function generate(n) {
    var d = difficulty(n), R = rng(hash(n, 0));
    var area = 20 + 125 * d, aspect = 1.05 + R() * 0.35;
    var W = clamp(Math.round(Math.sqrt(area / aspect)), 5, MAX_W);
    var H = clamp(Math.round(area / W), W, MAX_H);
    var shape = pickWeighted([
      ['rect', Math.max(0.3, 2 - 3 * d)], ['corners', 2],
      ['notches', d >= 0.12 ? 1.5 : 0], ['holes', d >= 0.15 ? 1.5 : 0], ['steps', d >= 0.2 ? 1.2 : 0],
      ['window', d >= 0.3 && W >= 6 ? 1 : 0], ['corners+holes', d >= 0.4 ? 0.6 + d : 0], ['steps+notches', d >= 0.4 ? 0.6 + d : 0]
    ], R);
    var styleName = pickWeighted([
      ['fine', 1.4 - d], ['mixed', 2], ['sticks', d >= 0.1 ? 1 : 0], ['chunky', d >= 0.15 ? 0.6 + d : 0]
    ], R);
    var wantChoice = 0.4 - 0.4 * d;             // average share of shapes that are free at any moment

    var best = null, bestScore = -1e9;
    for (var j = 0; j < CANDIDATES * 8 && (j < CANDIDATES || !best); j++) {
      var C = rng(hash(n, j + 1));
      var mask = buildMask(W, H, j < CANDIDATES ? shape : 'rect', d, C);
      if (!mask) continue;
      var T = tile(mask, W, H, STYLES[styleName], C), P = T.pieces.length;
      if (P < 4) continue;
      var S = sweeps(T, mask, W, H);
      var chain = clamp(0.2 + d + (((j % CANDIDATES) + C()) / CANDIDATES - 0.5) * 0.7, 0, 1);
      var dirs = assign(P, S, chain, C);
      if (!dirs) continue;
      var A = analyse(P, dirs, S);
      if (!A) continue;
      var score = -Math.abs(A.choice - wantChoice) * 10 + A.dirsUsed * 0.3 +
        Math.min(A.decoys, 5) * d * 0.4 - (A.dirShare > 0.5 ? 1 : 0) -
        Math.max(0, A.first - 2) * d * 0.8 + A.rounds / P * d * 3;   // few free shapes, long chains
      if (score > bestScore) { bestScore = score; best = { T: T, dirs: dirs, A: A }; }
    }

    var level = { w: W, h: H, p: [] }, i, c;
    if (!best) {                                 // safety net; the test run never reaches this
      level.w = 5; level.h = 5;
      for (i = 0; i < 5; i++) level.p.push([1, 0, i, 1, i, 2, i, 3, i, 4, i]);
      level.meta = { n: n, d: d, shape: 'fallback', style: 'bars', pieces: 5 };
      return level;
    }
    for (i = 0; i < best.T.pieces.length; i++) {
      var row = [best.dirs[i]];
      for (c = 0; c < best.T.pieces[i].length; c++) row.push(best.T.pieces[i][c][0], best.T.pieces[i][c][1]);
      level.p.push(row);
    }
    level.meta = {
      n: n, d: d, shape: shape, style: styleName, pieces: level.p.length,
      first: best.A.first, rounds: best.A.rounds, decoys: best.A.decoys, choice: best.A.choice, wrong: best.A.wrong
    };
    return level;
  }

  function get(n) {
    n = Math.max(1, Math.floor(n));
    if (n <= CLASSIC.length) {
      var src = CLASSIC[n - 1], p = [];
      for (var i = 0; i < src.p.length; i++) p.push(src.p[i].slice());
      return { w: src.w, h: src.h, p: p, meta: { n: n, d: difficulty(n), shape: 'classic', style: 'classic', pieces: p.length } };
    }
    return generate(n);
  }

  return { VERSION: VERSION, CLASSIC_COUNT: CLASSIC.length, get: get, difficulty: difficulty };
});
