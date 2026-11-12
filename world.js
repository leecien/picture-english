/* Top-down field engine: canvas scene, click-to-walk pathfinding, animated actors.
   Game content (maps, NPC, quests, saves) lives in rpg.js; this file knows nothing about English or pm-* keys.
   Any sprite or tile sheet listed in assets/manifest.json replaces the procedural placeholder art. */
const World = (() => {
  const T = 32,
    SOLID = new Set("THR~BF"),
    SPEED = 112,
    DIRS = ["down", "left", "right", "up"];
  let cv = null,
    ctx = null,
    host = null,
    dpr = 1,
    vw = 0,
    vh = 0,
    map = null,
    bg = null,
    ents = [],
    hero = null,
    cam = { x: 0, y: 0 },
    raf = 0,
    last = 0,
    marker = null,
    ro = null,
    opts = {},
    clock = 0;
  const held = new Set(),
    art = { sprites: {}, tiles: {} },
    reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const api = { paused: false, T };

  /* ---------- art loading (manifest.sprites / manifest.tiles) ---------- */
  function loadArt(m) {
    for (const group of ["sprites", "tiles"])
      for (const [k, s] of Object.entries((m && m[group]) || {})) {
        if (!s || !s.file) continue;
        const img = new Image();
        img.onload = () => {
          art[group][k] = { img, ...s };
          if (group === "tiles" && map) paintStatic();
        };
        img.src = s.file;
      }
  }

  /* ---------- map helpers ---------- */
  const cell = (x, y) =>
    map && y >= 0 && y < map.h && x >= 0 && x < map.w ? map.rows[y][x] : "T";
  const solid = (x, y) =>
    SOLID.has(cell(x, y)) ||
    ents.some((e) => e.block && e.tx === x && e.ty === y);
  const walkable = (x, y) => !solid(x, y);
  const center = (t) => (t + 0.5) * T;
  const tileOf = (p) => Math.floor(p / T);
  function find(ch) {
    for (let y = 0; y < map.h; y++) {
      const x = map.rows[y].indexOf(ch);
      if (x >= 0) return { x, y };
    }
    return null;
  }
  function findAll(ch) {
    const out = [];
    map.rows.forEach((r, y) =>
      [...r].forEach((c, x) => c === ch && out.push({ x, y })),
    );
    return out;
  }

  /* Dijkstra on the small grid, 8 directions, diagonal only when both orthogonal neighbours are open. */
  function path(sx, sy, gx, gy, pass = walkable) {
    if (!pass(gx, gy) || (sx === gx && sy === gy)) return [];
    const W = map.w,
      N = W * map.h,
      dist = new Float64Array(N).fill(Infinity),
      prev = new Int32Array(N).fill(-1),
      done = new Uint8Array(N),
      open = [sy * W + sx];
    dist[sy * W + sx] = 0;
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++)
        if (dist[open[i]] < dist[open[bi]]) bi = i;
      const cur = open.splice(bi, 1)[0];
      if (done[cur]) continue;
      done[cur] = 1;
      const cx = cur % W,
        cy = (cur / W) | 0;
      if (cx === gx && cy === gy) break;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx,
            ny = cy + dy;
          if (!pass(nx, ny)) continue;
          if (dx && dy && (!pass(cx + dx, cy) || !pass(cx, cy + dy))) continue;
          const ni = ny * W + nx,
            nd = dist[cur] + (dx && dy ? 1.414 : 1);
          if (nd < dist[ni]) {
            dist[ni] = nd;
            prev[ni] = cur;
            open.push(ni);
          }
        }
    }
    const goal = gy * W + gx;
    if (prev[goal] < 0) return null;
    const out = [];
    for (let i = goal; i !== sy * W + sx; i = prev[i])
      out.unshift({ x: i % W, y: (i / W) | 0 });
    return out;
  }

  /* ---------- entities ---------- */
  function actor(kind, tx, ty, extra) {
    return {
      kind,
      tx,
      ty,
      px: center(tx),
      py: center(ty),
      dir: "down",
      path: [],
      moving: false,
      t: Math.random() * 10,
      ...extra,
    };
  }
  function setPath(e, p) {
    e.path = p || [];
  }
  function step(e, dt, speed) {
    if (!e.path.length) {
      e.moving = false;
      return false;
    }
    const n = e.path[0],
      tx = center(n.x),
      ty = center(n.y),
      dx = tx - e.px,
      dy = ty - e.py,
      d = Math.hypot(dx, dy),
      mv = speed * dt;
    e.moving = true;
    if (Math.abs(dx) > Math.abs(dy) + 0.5) e.dir = dx < 0 ? "left" : "right";
    else if (Math.abs(dy) > 0.5) e.dir = dy < 0 ? "up" : "down";
    if (d <= mv) {
      e.px = tx;
      e.py = ty;
      e.tx = n.x;
      e.ty = n.y;
      e.path.shift();
      return true;
    }
    e.px += (dx / d) * mv;
    e.py += (dy / d) * mv;
    return false;
  }

  /* ---------- mounting ---------- */
  function mount(el, def, o) {
    stop();
    host = el;
    opts = o || {};
    map = {
      ...def,
      rows: def.layout,
      w: def.layout[0].length,
      h: def.layout.length,
    };
    ents = [];
    const s =
      o.start && walkableRaw(o.start.x, o.start.y) ? o.start : find("P");
    hero = actor("hero", s.x, s.y, { look: def.heroLook || {} });
    ents.push(hero);
    const n = find("N");
    if (n)
      ents.push(
        actor("npc", n.x, n.y, {
          block: true,
          look: def.npcLook,
          name: def.npcName,
          mark: true,
        }),
      );
    const c = find("C");
    if (c) ents.push(actor("chest", c.x, c.y, { block: true, open: !!o.chestOpen }));
    findAll("m").forEach((p, i) =>
      ents.push(
        actor("mob", p.x, p.y, {
          home: p,
          wait: 0.5 + i * 0.4,
          look: def.mob,
          name: def.mob.name,
        }),
      ),
    );
    if (!cv) {
      cv = document.createElement("canvas");
      cv.className = "world-canvas";
      cv.tabIndex = 0;
      cv.setAttribute("role", "application");
      cv.addEventListener("pointerdown", onTap);
      ctx = cv.getContext("2d");
    }
    cv.setAttribute(
      "aria-label",
      `${def.name}探索場景。點地面走路，點居民或寶箱互動；鍵盤可用方向鍵與 E。`,
    );
    el.appendChild(cv);
    if (ro) ro.disconnect();
    ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();
    snapCam();
    run();
  }
  const walkableRaw = (x, y) =>
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    !SOLID.has(cell(x, y)) &&
    !"NC".includes(cell(x, y));
  function resize() {
    if (!host) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = Math.max(240, host.clientWidth);
    vh = Math.round(Math.min(Math.max(vw * 0.72, 280), 460, map.h * T));
    cv.style.width = vw + "px";
    cv.style.height = vh + "px";
    cv.width = Math.round(vw * dpr);
    cv.height = Math.round(vh * dpr);
    paintStatic();
    snapCam();
  }
  function snapCam() {
    if (!hero) return;
    const mw = map.w * T,
      mh = map.h * T,
      clamp = (v, size, full) =>
        full <= size ? (full - size) / 2 : Math.min(Math.max(v, 0), full - size);
    cam.x = clamp(hero.px - vw / 2, vw, mw);
    cam.y = clamp(hero.py - vh / 2, vh, mh);
  }
  function run() {
    if (raf) return;
    last = performance.now();
    const loop = (now) => {
      raf = 0;
      if (!cv || !cv.isConnected || cv.offsetParent === null) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  /* ---------- input ---------- */
  function toTile(cx, cy) {
    const r = cv.getBoundingClientRect(),
      wx = cx - r.left + cam.x,
      wy = cy - r.top + cam.y;
    return { wx, wy, x: tileOf(wx), y: tileOf(wy) };
  }
  function hitEntity(wx, wy) {
    let best = null,
      bd = 22;
    for (const e of ents) {
      if (e === hero) continue;
      const d = Math.hypot(e.px - wx, e.py - 8 - wy);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    if (best) return best;
    return ents.find(
      (e) => e !== hero && e.block && e.tx === tileOf(wx) && e.ty === tileOf(wy),
    );
  }
  function onTap(ev) {
    if (api.paused) return;
    ev.preventDefault();
    cv.focus({ preventScroll: true });
    const p = toTile(ev.clientX, ev.clientY),
      e = hitEntity(p.wx, p.wy);
    if (e) {
      approach(e);
      return;
    }
    walkTo(p.x, p.y);
  }
  function walkTo(x, y, then) {
    hero.pending = then || null;
    const f = from(),
      p = path(f.x, f.y, x, y);
    if (p === null || (!p.length && !(f.x === x && f.y === y))) {
      marker = { x, y, bad: true, t: 0 };
      if (opts.onStatus) opts.onStatus("那裡走不過去，換個地方試試。");
      hero.pending = null;
      return false;
    }
    marker = { x, y, t: 0 };
    setPath(hero, lead().concat(p));
    if (!hero.path.length) arrive();
    return true;
  }
  /* Mid-step, finish the tile already under way so a new route never snaps backwards. */
  const from = () => (hero.path.length ? hero.path[0] : { x: hero.tx, y: hero.ty });
  const lead = () => (hero.path.length ? [hero.path[0]] : []);
  const near = (e) => Math.max(Math.abs(e.tx - hero.tx), Math.abs(e.ty - hero.ty)) <= 1;
  function approach(e) {
    if (e.kind === "mob") {
      if (opts.onTap) opts.onTap(e);
      return;
    }
    const act = () => opts.onTap && opts.onTap(e);
    if (near(e) && !hero.path.length) {
      face(e);
      act();
      return;
    }
    let best = null;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = e.tx + dx,
          y = e.ty + dy;
        if ((!dx && !dy) || !walkable(x, y)) continue;
        const f = from(),
          p = x === f.x && y === f.y ? [] : path(f.x, f.y, x, y);
        if (p && (!best || p.length < best.p.length)) best = { x, y, p };
      }
    if (!best) return;
    marker = { x: e.tx, y: e.ty, t: 0 };
    hero.pending = () => {
      face(e);
      act();
    };
    setPath(hero, lead().concat(best.p));
    if (!hero.path.length) arrive();
  }
  function face(e) {
    const dx = e.tx - hero.tx,
      dy = e.ty - hero.ty;
    hero.dir =
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
  }
  function arrive() {
    marker = null;
    if (opts.onMove) opts.onMove(hero.tx, hero.ty);
    const f = hero.pending;
    hero.pending = null;
    if (f) f();
  }
  const KEYS = {
    ArrowUp: [0, -1],
    w: [0, -1],
    ArrowDown: [0, 1],
    s: [0, 1],
    ArrowLeft: [-1, 0],
    a: [-1, 0],
    ArrowRight: [1, 0],
    d: [1, 0],
  };
  function key(e, down) {
    const k = KEYS[e.key] ? e.key : KEYS[e.key.toLowerCase()] ? e.key.toLowerCase() : null;
    if (!k) return false;
    if (down) held.add(k);
    else held.delete(k);
    return true;
  }
  addEventListener("blur", () => held.clear());
  function heldStep() {
    let dx = 0,
      dy = 0;
    held.forEach((k) => {
      dx += KEYS[k][0];
      dy += KEYS[k][1];
    });
    dx = Math.sign(dx);
    dy = Math.sign(dy);
    if (!dx && !dy) return;
    let nx = hero.tx + dx,
      ny = hero.ty + dy;
    if (dx && dy && (!walkable(nx, ny) || !walkable(hero.tx + dx, hero.ty) || !walkable(hero.tx, ny))) {
      if (walkable(hero.tx + dx, hero.ty)) ny = hero.ty;
      else if (walkable(hero.tx, ny)) nx = hero.tx;
    }
    hero.dir = dx ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
    if (walkable(nx, ny)) {
      marker = null;
      hero.pending = null;
      setPath(hero, [{ x: nx, y: ny }]);
    }
  }

  /* ---------- simulation ---------- */
  function update(dt) {
    clock += dt;
    if (marker) marker.t += dt;
    if (api.paused) {
      hero.moving = false;
      ents.forEach((e) => (e.moving = false));
      return;
    }
    if (!hero.path.length && held.size) heldStep();
    const wasMoving = hero.path.length > 0;
    step(hero, dt, SPEED);
    if (wasMoving && !hero.path.length) arrive();
    for (const e of ents) {
      e.t += dt;
      if (e.kind !== "mob") continue;
      if (e.path.length) {
        step(e, dt, 38);
        continue;
      }
      e.moving = false;
      e.wait -= dt;
      if (e.wait > 0) continue;
      e.wait = 1.2 + Math.random() * 2.4;
      const ok = (x, y) =>
        walkable(x, y) && cell(x, y) !== "=" && Math.abs(x - e.home.x) <= 3 && Math.abs(y - e.home.y) <= 3;
      for (let i = 0; i < 6; i++) {
        const x = e.tx + rnd3(),
          y = e.ty + rnd3();
        if (ok(x, y) && !(x === hero.tx && y === hero.ty)) {
          const p = path(e.tx, e.ty, x, y, ok);
          if (p && p.length <= 4) {
            setPath(e, p);
            break;
          }
        }
      }
    }
    const mw = map.w * T,
      mh = map.h * T,
      tx = mw <= vw ? (mw - vw) / 2 : Math.min(Math.max(hero.px - vw / 2, 0), mw - vw),
      ty = mh <= vh ? (mh - vh) / 2 : Math.min(Math.max(hero.py - vh / 2, 0), mh - vh),
      k = Math.min(1, dt * 8);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }
  const rnd3 = () => Math.floor(Math.random() * 5) - 2;

  /* ---------- drawing: static layer ---------- */
  function hash(x, y, s = 0) {
    let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function paintStatic() {
    if (!map) return;
    bg = document.createElement("canvas");
    bg.width = map.w * T * dpr;
    bg.height = map.h * T * dpr;
    const g = bg.getContext("2d");
    g.scale(dpr, dpr);
    const P = map.palette,
      sheet = art.tiles[map.id];
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        const c = cell(x, y);
        ground(g, x, y, c === "=" ? "path" : c === "~" ? "water" : "grass", P, sheet);
      }
    const houses = [],
      seen = new Set();
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        const c = cell(x, y);
        if (c === "H" && !seen.has(x + "," + y)) {
          let w = 0,
            h = 0;
          while (cell(x + w, y) === "H") w++;
          while (cell(x, y + h) === "H") h++;
          for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) seen.add(x + i + "," + (y + j));
          houses.push({ x, y, w, h });
        } else if (c === ",") flower(g, x, y, P);
        else if (c === "R") rock(g, x, y);
        else if (c === "F") fence(g, x, y, P);
        else if (c === "B") bush(g, x, y, P);
      }
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) if (cell(x, y) === "T") tree(g, x, y, P);
    houses.forEach((h, i) => house(g, h, P, i));
  }
  function ground(g, x, y, kind, P, sheet) {
    const X = x * T,
      Y = y * T;
    if (sheet && sheet.index && sheet.index[kind] !== undefined) {
      const fw = sheet.frame || 64,
        i = sheet.index[kind],
        cols = Math.floor(sheet.img.width / fw);
      g.drawImage(sheet.img, (i % cols) * fw, Math.floor(i / cols) * fw, fw, fw, X, Y, T, T);
      return;
    }
    if (kind === "water") {
      g.fillStyle = P.water || "#8fcde8";
      g.fillRect(X, Y, T, T);
      g.strokeStyle = "#ffffff70";
      g.lineWidth = 1.5;
      g.beginPath();
      const o = hash(x, y) * 10;
      g.arc(X + 8 + o, Y + 12, 4, Math.PI * 1.1, Math.PI * 1.9);
      g.arc(X + 20 - o / 2, Y + 24, 4, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
      // shoreline on edges touching land
      g.fillStyle = "#e9f6fb";
      [[0, -1, X, Y, T, 3], [0, 1, X, Y + T - 3, T, 3], [-1, 0, X, Y, 3, T], [1, 0, X + T - 3, Y, 3, T]].forEach(
        ([dx, dy, rx, ry, rw, rh]) => cell(x + dx, y + dy) !== "~" && g.fillRect(rx, ry, rw, rh),
      );
      return;
    }
    g.fillStyle = kind === "path" ? P.path : P.grass;
    g.fillRect(X, Y, T, T);
    // Soft organic patches instead of a checkerboard, so the field never reads as a grid.
    if (kind !== "path" && hash(x >> 1, y >> 1, 9) > 0.6) {
      g.fillStyle = P.grass2;
      g.beginPath();
      g.ellipse(X + 16 + (hash(x, y, 4) - 0.5) * 10, Y + 16 + (hash(y, x, 4) - 0.5) * 10, 15, 11, 0, 0, 7);
      g.fill();
    }
    if (kind === "path") {
      g.fillStyle = P.pathDot;
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.arc(X + 4 + hash(x, y, i) * 24, Y + 4 + hash(y, x, i) * 24, 1.6, 0, 7);
        g.fill();
      }
      g.fillStyle = P.grass + "aa";
      [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
        if (cell(x + dx, y + dy) === "=") return;
        g.fillRect(dx > 0 ? X + T - 3 : X, dy > 0 ? Y + T - 3 : Y, dx ? 3 : T, dy ? 3 : T);
      });
    } else {
      g.strokeStyle = P.blade;
      g.lineWidth = 1.4;
      for (let i = 0; i < 2; i++) {
        if (hash(x, y, i + 7) < 0.45) continue;
        const bx = X + 4 + hash(x, y, i) * 24,
          by = Y + 8 + hash(y, x, i) * 20;
        g.beginPath();
        g.moveTo(bx - 2, by - 4);
        g.lineTo(bx, by);
        g.lineTo(bx + 2, by - 5);
        g.stroke();
      }
    }
  }
  function flower(g, x, y, P) {
    const X = x * T + 16,
      Y = y * T + 16;
    for (let i = 0; i < 3; i++) {
      const fx = X - 9 + hash(x, y, i) * 18,
        fy = Y - 8 + hash(y, x, i) * 16;
      g.fillStyle = P.flower[i % P.flower.length];
      for (let k = 0; k < 5; k++) {
        g.beginPath();
        g.arc(fx + Math.cos(k * 1.26) * 2.6, fy + Math.sin(k * 1.26) * 2.6, 2, 0, 7);
        g.fill();
      }
      g.fillStyle = "#fff3a6";
      g.beginPath();
      g.arc(fx, fy, 1.5, 0, 7);
      g.fill();
    }
  }
  function tree(g, x, y, P) {
    const X = x * T + 16,
      Y = y * T + 16,
      s = 0.9 + hash(x, y) * 0.25;
    g.fillStyle = "#00000022";
    g.beginPath();
    g.ellipse(X + 2, Y + 12, 12 * s, 5, 0, 0, 7);
    g.fill();
    g.fillStyle = "#9a6b45";
    g.fillRect(X - 3, Y, 6, 12);
    const [a, b] = P.tree;
    g.fillStyle = b;
    g.beginPath();
    g.arc(X, Y - 4, 15 * s, 0, 7);
    g.fill();
    g.fillStyle = a;
    g.beginPath();
    g.arc(X - 3, Y - 7, 11 * s, 0, 7);
    g.fill();
    g.fillStyle = "#ffffff38";
    g.beginPath();
    g.arc(X - 6, Y - 11, 4 * s, 0, 7);
    g.fill();
    if (P.fruit && hash(x, y, 3) > 0.55) {
      g.fillStyle = P.fruit;
      [[5, -2], [-6, 2], [2, -12]].forEach(([dx, dy]) => {
        g.beginPath();
        g.arc(X + dx, Y + dy, 2.2, 0, 7);
        g.fill();
      });
    }
  }
  function bush(g, x, y, P) {
    const X = x * T + 16,
      Y = y * T + 18;
    g.fillStyle = "#00000020";
    g.beginPath();
    g.ellipse(X, Y + 9, 13, 4, 0, 0, 7);
    g.fill();
    g.fillStyle = P.tree[1];
    [[-6, 2, 8], [6, 2, 8], [0, -3, 10]].forEach(([dx, dy, r]) => {
      g.beginPath();
      g.arc(X + dx, Y + dy, r, 0, 7);
      g.fill();
    });
    g.fillStyle = P.berry || "#e5677d";
    [[-5, 0], [4, -4], [6, 4]].forEach(([dx, dy]) => {
      g.beginPath();
      g.arc(X + dx, Y + dy, 2, 0, 7);
      g.fill();
    });
  }
  function rock(g, x, y) {
    const X = x * T + 16,
      Y = y * T + 18;
    g.fillStyle = "#00000022";
    g.beginPath();
    g.ellipse(X, Y + 8, 12, 4, 0, 0, 7);
    g.fill();
    g.fillStyle = "#a9a9b8";
    g.beginPath();
    g.ellipse(X, Y, 12, 9, 0, 0, 7);
    g.fill();
    g.fillStyle = "#cfd0dc";
    g.beginPath();
    g.ellipse(X - 3, Y - 3, 6, 4, 0, 0, 7);
    g.fill();
  }
  function fence(g, x, y, P) {
    const X = x * T,
      Y = y * T;
    g.fillStyle = P.fence || "#c79a6b";
    g.fillRect(X, Y + 12, T, 4);
    g.fillRect(X, Y + 21, T, 4);
    g.fillStyle = "#a87a4e";
    g.fillRect(X + 4, Y + 7, 5, 22);
    g.fillRect(X + 21, Y + 7, 5, 22);
  }
  function house(g, h, P, i) {
    const X = h.x * T,
      Y = h.y * T,
      W = h.w * T,
      H = h.h * T,
      roof = P.roof[i % P.roof.length],
      rh = Math.max(18, H * 0.48);
    g.fillStyle = "#00000022";
    g.fillRect(X + 4, Y + H - 4, W, 6);
    g.fillStyle = P.wall || "#fff3dc";
    g.fillRect(X + 3, Y + rh - 4, W - 6, H - rh + 2);
    g.fillStyle = roof;
    g.beginPath();
    g.moveTo(X - 2, Y + rh);
    g.lineTo(X + 6, Y + 2);
    g.lineTo(X + W - 6, Y + 2);
    g.lineTo(X + W + 2, Y + rh);
    g.closePath();
    g.fill();
    g.fillStyle = "#ffffff40";
    for (let sx = X + 10; sx < X + W - 8; sx += 12) g.fillRect(sx, Y + 5, 5, rh - 8);
    g.fillStyle = "#9a6b45";
    const dx = X + W / 2 - 7;
    g.beginPath();
    g.roundRect(dx, Y + H - 18, 14, 16, [7, 7, 0, 0]);
    g.fill();
    g.fillStyle = "#bfe3f2";
    if (W >= 3 * T) {
      g.fillRect(X + 10, Y + rh + 4, 12, 10);
      g.fillRect(X + W - 22, Y + rh + 4, 12, 10);
    }
  }

  /* ---------- drawing: actors ---------- */
  function drawSheet(key, e, row, frames, fps, x, y, size) {
    const s = art.sprites[key];
    if (!s) return false;
    const fw = s.frameW || 96,
      fh = s.frameH || 96,
      rows = Math.max(1, Math.floor(s.img.height / fh)),
      cols = Math.max(1, Math.floor(s.img.width / fw)),
      f = Math.floor(e.t * fps) % Math.min(frames, cols);
    g2(() =>
      ctx.drawImage(s.img, f * fw, Math.min(row, rows - 1) * fh, fw, fh, x - size / 2, y - size + 6, size, size),
    );
    return true;
  }
  const g2 = (fn) => {
    ctx.save();
    fn();
    ctx.restore();
  };
  function shadow(x, y, w) {
    ctx.fillStyle = "#00000028";
    ctx.beginPath();
    ctx.ellipse(x, y, w, w * 0.38, 0, 0, 7);
    ctx.fill();
  }
  /* Chibi traveller / villager. look: skin, hair, cloth, accent, ears */
  function chibi(e, L) {
    const x = e.px,
      foot = e.py + 10,
      walk = e.moving ? Math.sin(e.t * 12) : 0,
      bob = e.moving ? Math.abs(walk) * 2 : reduce ? 0 : Math.sin(e.t * 2.4) * 0.8,
      side = e.dir === "left" ? -1 : e.dir === "right" ? 1 : 0,
      back = e.dir === "up";
    shadow(x, foot, 10);
    // legs
    ctx.fillStyle = L.boots || "#7a5a44";
    ctx.beginPath();
    ctx.roundRect(x - 6 + walk * 2 * (side ? 1 : 0.4), foot - 7 - Math.max(0, walk) * 2, 5, 7, 2);
    ctx.roundRect(x + 1 - walk * 2 * (side ? 1 : 0.4), foot - 7 - Math.max(0, -walk) * 2, 5, 7, 2);
    ctx.fill();
    const by = foot - 7 - bob;
    // body
    ctx.fillStyle = L.cloth;
    ctx.beginPath();
    ctx.roundRect(x - 8, by - 13, 16, 14, [6, 6, 4, 4]);
    ctx.fill();
    if (L.accent) {
      ctx.fillStyle = L.accent;
      ctx.fillRect(x - 8, by - 13, 16, 3);
      if (!back) {
        ctx.beginPath();
        ctx.moveTo(x + side * 3, by - 11);
        ctx.lineTo(x + side * 3 + 3 - side, by - 4);
        ctx.lineTo(x + side * 3 - 3 - side, by - 4);
        ctx.fill();
      }
    }
    // arms
    ctx.fillStyle = L.skin;
    const sw = e.moving ? walk * 3 : 0;
    if (side) {
      ctx.beginPath();
      ctx.arc(x - side * 1 + sw * side, by - 5, 3, 0, 7);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x - 9, by - 5 + sw, 3, 0, 7);
      ctx.arc(x + 9, by - 5 - sw, 3, 0, 7);
      ctx.fill();
    }
    if (L.staff && !back) {
      ctx.strokeStyle = "#9a6b45";
      ctx.lineWidth = 2;
      const sx = side ? x + side * 6 : x + 10;
      ctx.beginPath();
      ctx.moveTo(sx, by + 2);
      ctx.lineTo(sx + (side || 1) * 2, by - 20);
      ctx.stroke();
      ctx.fillStyle = L.staff;
      ctx.beginPath();
      ctx.arc(sx + (side || 1) * 2, by - 22, 3.5, 0, 7);
      ctx.fill();
    }
    // head
    const hy = by - 22;
    earsFor(L, x, hy, "back");
    ctx.fillStyle = L.skin;
    ctx.beginPath();
    ctx.arc(x, hy, 12, 0, 7);
    ctx.fill();
    ctx.fillStyle = L.hair;
    ctx.beginPath();
    if (back) ctx.arc(x, hy, 12.4, 0, 7);
    else {
      ctx.arc(x, hy - 1, 12.4, Math.PI * 1.02, Math.PI * 1.98);
      ctx.lineTo(x + 12 - Math.max(0, side) * 6, hy + 1);
      ctx.quadraticCurveTo(x + side * 4, hy - 7, x - 12 + Math.max(0, -side) * 6, hy + 1);
    }
    ctx.fill();
    earsFor(L, x, hy, "front");
    if (!back) {
      const ex = side * 4;
      ctx.fillStyle = "#3a2e2a";
      if (side) {
        ctx.beginPath();
        ctx.ellipse(x + ex + side * 2, hy + 2, 1.7, 2.4, 0, 0, 7);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.ellipse(x - 4.5, hy + 2, 1.7, 2.4, 0, 0, 7);
        ctx.ellipse(x + 4.5, hy + 2, 1.7, 2.4, 0, 0, 7);
        ctx.fill();
      }
      ctx.fillStyle = "#ff9c9c80";
      ctx.beginPath();
      if (side >= 0) ctx.ellipse(x + 7 + ex - (side ? 2 : 0), hy + 6, 2.6, 1.6, 0, 0, 7);
      if (side <= 0) ctx.ellipse(x - 7 + ex + (side ? 2 : 0), hy + 6, 2.6, 1.6, 0, 0, 7);
      ctx.fill();
    }
    if (L.sprout) {
      ctx.fillStyle = "#7cc56a";
      ctx.beginPath();
      ctx.ellipse(x - 4, hy - 15, 4, 2, -0.6, 0, 7);
      ctx.ellipse(x + 4, hy - 15, 4, 2, 0.6, 0, 7);
      ctx.fill();
      ctx.strokeStyle = "#5a9c4c";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, hy - 11);
      ctx.lineTo(x, hy - 15);
      ctx.stroke();
    }
    return hy - 14;
  }
  function earsFor(L, x, hy, layer) {
    const kind = L.ears;
    if (!kind) return;
    const c = L.hair,
      inner = L.earIn || "#ffc9c9";
    if (layer === "back") {
      if (kind === "bunny") {
        [-5, 5].forEach((dx) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.ellipse(x + dx, hy - 17, 3.6, 9, dx * 0.03, 0, 7);
          ctx.fill();
          ctx.fillStyle = inner;
          ctx.beginPath();
          ctx.ellipse(x + dx, hy - 17, 1.6, 6, dx * 0.03, 0, 7);
          ctx.fill();
        });
      }
      return;
    }
    ctx.fillStyle = c;
    if (kind === "cat" || kind === "fox")
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(x + s * 11, hy - 4);
        ctx.lineTo(x + s * (kind === "fox" ? 10 : 9), hy - (kind === "fox" ? 18 : 15));
        ctx.lineTo(x + s * 3, hy - 10);
        ctx.fill();
      });
    if (kind === "bear")
      [-1, 1].forEach((s) => {
        ctx.beginPath();
        ctx.arc(x + s * 9, hy - 9, 4.5, 0, 7);
        ctx.fill();
        ctx.fillStyle = inner;
        ctx.beginPath();
        ctx.arc(x + s * 9, hy - 9, 2.2, 0, 7);
        ctx.fill();
        ctx.fillStyle = c;
      });
    if (kind === "frog")
      [-1, 1].forEach((s) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + s * 6, hy - 10, 4.5, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x + s * 6, hy - 10, 2.6, 0, 7);
        ctx.fill();
      });
    if (L.hat) {
      ctx.fillStyle = L.hat;
      ctx.beginPath();
      ctx.ellipse(x, hy - 9, 13, 3, 0, 0, 7);
      ctx.fill();
      ctx.beginPath();
      ctx.roundRect(x - 7, hy - 20, 14, 11, [7, 7, 1, 1]);
      ctx.fill();
    }
  }
  /* Original placeholder monsters, one silhouette per map. */
  function monster(e, L) {
    const x = e.px,
      foot = e.py + 10,
      hop = e.moving ? Math.abs(Math.sin(e.t * 9)) * 5 : reduce ? 0 : Math.abs(Math.sin(e.t * 2)) * 1.5,
      sq = e.moving ? 1 + Math.sin(e.t * 18) * 0.05 : 1,
      y = foot - hop,
      side = e.dir === "left" ? -1 : e.dir === "right" ? 1 : 0;
    shadow(x, foot, 10 - hop * 0.6);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sq, 2 - sq);
    const [c1, c2] = L.colors;
    ctx.fillStyle = c1;
    ctx.beginPath();
    switch (L.shape) {
      case "muffin":
        ctx.moveTo(-10, 0);
        ctx.lineTo(-12, -12);
        ctx.lineTo(12, -12);
        ctx.lineTo(10, 0);
        ctx.fill();
        ctx.fillStyle = "#00000018";
        for (let i = -8; i <= 8; i += 4) ctx.fillRect(i, -11, 1.5, 10);
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.arc(0, -14, 13, Math.PI, 0);
        ctx.quadraticCurveTo(10, -9, 0, -11);
        ctx.quadraticCurveTo(-10, -9, -13, -14);
        ctx.fill();
        ctx.fillStyle = "#e5475f";
        ctx.beginPath();
        ctx.arc(0, -27, 3, 0, 7);
        ctx.fill();
        break;
      case "acorn":
        ctx.ellipse(0, -10, 10, 11, 0, 0, 7);
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(0, -19, 12, 6, 0, Math.PI, 0);
        ctx.lineTo(12, -18);
        ctx.quadraticCurveTo(0, -14, -12, -18);
        ctx.fill();
        ctx.fillRect(-1.5, -27, 3, 4);
        break;
      case "drop":
        ctx.moveTo(0, -28);
        ctx.bezierCurveTo(6, -18, 12, -12, 12, -7);
        ctx.arc(0, -7, 12, 0, Math.PI);
        ctx.bezierCurveTo(-12, -12, -6, -18, 0, -28);
        ctx.fill();
        ctx.fillStyle = "#ffffff80";
        ctx.beginPath();
        ctx.ellipse(-5, -12, 2.5, 4, 0.3, 0, 7);
        ctx.fill();
        break;
      case "bird":
        ctx.moveTo(-13, -8);
        ctx.lineTo(13, -14);
        ctx.lineTo(-4, -2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath();
        const flap = Math.sin(e.t * (e.moving ? 16 : 4)) * 6;
        ctx.moveTo(-2, -10);
        ctx.lineTo(4, -20 - flap);
        ctx.lineTo(7, -11);
        ctx.fill();
        break;
      case "teapot":
        ctx.ellipse(0, -9, 12, 9, 0, 0, 7);
        ctx.fill();
        ctx.strokeStyle = c1;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(10, -10);
        ctx.quadraticCurveTo(18, -12, 17, -19);
        ctx.moveTo(-10, -13);
        ctx.arc(-12, -9, 4, -Math.PI / 2, Math.PI / 2, true);
        ctx.stroke();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(0, -17, 7, 3, 0, 0, 7);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, -21, 2.5, 0, 7);
        ctx.fill();
        break;
      default:
        ctx.arc(0, -11, 12, 0, 7);
        ctx.fill();
    }
    // face
    if (e.dir !== "up") {
      const ey = L.shape === "muffin" ? -6 : L.shape === "bird" ? -10 : -9,
        ex = side * 3;
      ctx.fillStyle = "#3a2e2a";
      ctx.beginPath();
      if (L.shape === "bird") ctx.arc(6 * (side || 1), ey, 1.6, 0, 7);
      else {
        ctx.ellipse(ex - 4, ey, 1.6, 2.2, 0, 0, 7);
        ctx.ellipse(ex + 4, ey, 1.6, 2.2, 0, 0, 7);
      }
      ctx.fill();
      ctx.strokeStyle = "#3a2e2a";
      ctx.lineWidth = 1.1;
      if (L.shape !== "bird") {
        ctx.beginPath();
        ctx.arc(ex, ey + 2, 2, 0.2, Math.PI - 0.2);
        ctx.stroke();
      }
    }
    ctx.restore();
    return y - 30;
  }
  function chest(e) {
    const x = e.px,
      y = e.py + 10;
    shadow(x, y, 12);
    ctx.fillStyle = "#b9773f";
    ctx.beginPath();
    ctx.roundRect(x - 11, y - 14, 22, 13, 2);
    ctx.fill();
    ctx.fillStyle = e.open ? "#7a4b26" : "#d18b4a";
    ctx.beginPath();
    if (e.open) ctx.roundRect(x - 11, y - 24, 22, 8, [4, 4, 0, 0]);
    else ctx.roundRect(x - 11, y - 21, 22, 8, [6, 6, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#ffd25e";
    ctx.fillRect(x - 2, y - 15, 4, 6);
    if (!e.open && !reduce) {
      const s = (Math.sin(clock * 3) + 1) / 2;
      ctx.fillStyle = `rgba(255,226,120,${0.25 + s * 0.5})`;
      star(x + 12, y - 24, 3 + s * 1.5);
    }
    return y - 28;
  }
  function star(x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        rr = i % 2 ? r * 0.4 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.fill();
  }
  function label(text, x, y, color, sub) {
    ctx.font = "600 11px 'Noto Sans TC', system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#2b2f2acc";
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    if (sub) {
      ctx.font = "600 9px 'Noto Sans TC', system-ui, sans-serif";
      ctx.strokeText(sub, x, y + 11);
      ctx.fillStyle = "#ffe9a8";
      ctx.fillText(sub, x, y + 11);
    }
  }
  function questMark(x, y) {
    const b = reduce ? 0 : Math.sin(clock * 4) * 2;
    ctx.fillStyle = "#ffbf3f";
    ctx.strokeStyle = "#8a5a1d";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x, y - 6 + b, 7, 0, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#5a3610";
    ctx.font = "700 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("!", x, y - 2 + b);
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = map.palette.edge || "#5d8a52";
    ctx.fillRect(0, 0, vw, vh);
    const ox = Math.round(cam.x * dpr) / dpr,
      oy = Math.round(cam.y * dpr) / dpr;
    ctx.translate(-ox, -oy);
    ctx.drawImage(bg, 0, 0, map.w * T, map.h * T);
    if (marker) {
      const a = Math.max(0, 1 - marker.t / 1.2);
      if (a > 0) {
        const mx = center(marker.x),
          my = center(marker.y) + 6,
          r = 6 + marker.t * 10;
        ctx.strokeStyle = marker.bad ? `rgba(230,80,80,${a})` : `rgba(255,255,255,${a})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(mx, my, r, r * 0.45, 0, 0, 7);
        ctx.stroke();
      }
    }
    const labels = [];
    [...ents]
      .sort((a, b) => a.py - b.py)
      .forEach((e) => {
        let top;
        const row = DIRS.indexOf(e.dir);
        if (e.kind === "hero" || e.kind === "npc") {
          const key = e.kind === "hero" ? "hero" : e.look.sprite;
          const sheet = key && (e.moving ? art.sprites[key + "-walk"] : art.sprites[key + "-idle"]);
          if (sheet && drawSheet(key + (e.moving ? "-walk" : "-idle"), e, row, e.moving ? 4 : 2, e.moving ? 8 : 2, e.px, e.py + 10, 48))
            top = e.py - 34;
          else top = chibi(e, e.look);
          if (e.kind === "npc") labels.push(() => {
            label(e.name, e.px, e.py + 24, "#ffffff");
            if (e.mark) questMark(e.px, top - 6);
          });
        } else if (e.kind === "chest") chest(e);
        else if (e.kind === "mob") {
          const key = e.look.sprite;
          if (key && drawSheet(key + (e.moving ? "-walk" : "-idle"), e, row, e.moving ? 4 : 2, e.moving ? 8 : 2, e.px, e.py + 10, 44))
            top = e.py - 30;
          else top = monster(e, e.look);
          labels.push(() => label(e.name, e.px, e.py + 23, "#ffd9e0", "Lv." + (e.look.lv || 1)));
        }
      });
    labels.forEach((f) => f());
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  Object.assign(api, {
    loadArt,
    mount,
    stop,
    run,
    walkTo,
    approach,
    key,
    near,
    clearKeys: () => held.clear(),
    setChest(open) {
      ents.forEach((e) => e.kind === "chest" && (e.open = open));
    },
    /* Viewport position of a tile centre, for tests and tutorial pointers. */
    tileToClient(x, y) {
      const r = cv.getBoundingClientRect();
      return { x: r.left + center(x) - cam.x, y: r.top + center(y) - cam.y };
    },
    centerOn() {
      snapCam();
    },
    validate(def) {
      const rows = def.layout,
        w = rows[0].length,
        errs = [];
      rows.forEach((r, i) => r.length !== w && errs.push(`row ${i} length ${r.length}`));
      ["N", "C", "P"].forEach((c) => rows.join("").split(c).length !== 2 && errs.push(`need one ${c}`));
      return errs;
    },
  });
  // Getters are defined separately: Object.assign would copy their value once instead of keeping them live.
  Object.defineProperties(api, {
    hero: { get: () => hero && { x: hero.tx, y: hero.ty, moving: hero.path.length > 0, dir: hero.dir } },
    entities: { get: () => ents },
    canvas: { get: () => cv },
  });
  return api;
})();
