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
    clock = 0,
    fx = [],
    respawns = [],
    Z = 1,
    portals = [],
    ew = 0,
    eh = 0,
    grace = 0;
  const held = new Set(),
    art = { sprites: {}, tiles: {} },
    reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const api = { paused: false, T };

  /* ---------- art loading (manifest.sprites / manifest.tiles) ---------- */
  /* Art rule (#6): characters share the simple NPC look drawn in code. A character sheet is used only when its
     manifest entry says "style": "simple" (drawn to match); anything else, such as the PR #3 hand-painted
     sources, is ignored on purpose rather than waiting for a load failure. Tiles are not affected. */
  function loadArt(m) {
    for (const group of ["sprites", "tiles"])
      for (const [k, s] of Object.entries((m && m[group]) || {})) {
        if (!s || !s.file) continue;
        if (group === "sprites" && !k.startsWith("item-") && s.style !== "simple") continue;
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
  const gateClosed = (c) => /[1-4]/.test(c) && !(opts.gateOpen && opts.gateOpen(c));
  const solid = (x, y) =>
    SOLID.has(cell(x, y)) ||
    gateClosed(cell(x, y)) ||
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
    if (def.npcs)
      def.npcs.forEach((n) => {
        const at = find(n.ch);
        if (at) ents.push(actor("npc", at.x, at.y, { block: true, id: n.id, look: n.look, name: n.name, mark: false, dir: n.dir || "down" }));
      });
    else {
      const n = find("N");
      if (n)
        ents.push(
          actor("npc", n.x, n.y, {
            block: true,
            id: "main",
            look: def.npcLook,
            name: def.npcName,
            mark: true,
          }),
        );
    }
    if (opts.marks) opts.marks();
    const c = find("C");
    if (c) ents.push(actor("chest", c.x, c.y, { block: true, open: !!o.chestOpen }));
    fx = [];
    respawns = [];
    portals = findAll("@");
    findAll("m").forEach((p, i) => ents.push(spawnMob(p, 0.5 + i * 0.4)));
    if (def.petLook) {
      // The companion starts beside the hero, never on top of it.
      const spot = [[-1, 1], [1, 1], [-1, 0], [1, 0], [0, 1]].map(([dx, dy]) => ({ x: hero.tx + dx, y: hero.ty + dy })).find((q) => walkableRaw(q.x, q.y)) || { x: hero.tx, y: hero.ty };
      ents.push(actor("pet", spot.x, spot.y, { look: def.petLook, trail: [] }));
    }
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
  function spawnMob(p, wait) {
    const m = (map.mobAt && map.mobAt(p)) || map.mob;
    return actor("mob", p.x, p.y, {
      home: p,
      wait,
      look: m,
      name: m.name,
      hp: m.hp || 30,
      maxHp: m.hp || 30,
      state: "wander",
      cd: 1,
      hurt: 0,
    });
  }
  const walkableRaw = (x, y) =>
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    !SOLID.has(cell(x, y)) &&
    !gateClosed(cell(x, y)) &&
    !npcAt(x, y) &&
    !"NC".includes(cell(x, y));
  const npcAt = (x, y) => (map.npcs || []).some((n) => cell(x, y) === n.ch);
  function resize() {
    if (!host) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = Math.max(200, host.clientWidth);
    vh = Math.max(160, host.clientHeight || Math.round(vw * 0.72));
    // Zoom so the map fills a tall phone screen (RO-like close camera), never below 1.
    Z = Math.min(1.8, Math.max(1, Math.min(vh / (map.h * T), 1.8), vw < 520 ? 1.25 : 1));
    ew = vw / Z;
    eh = vh / Z;
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
    cam.x = clamp(hero.px - ew / 2, ew, mw);
    cam.y = clamp(hero.py - eh / 2, eh, mh);
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
      wx = (cx - r.left) / Z + cam.x,
      wy = (cy - r.top) / Z + cam.y;
    return { wx, wy, x: tileOf(wx), y: tileOf(wy) };
  }
  function hitEntity(wx, wy) {
    let best = null,
      bd = 22;
    for (const e of ents) {
      if (e === hero || (e.kind === "pet" && !(e.look && e.look.kind === "sprite")) || e.dead) continue;
      const d = Math.hypot(e.px - wx, e.py - (e.kind === "drop" ? 0 : 8) - wy);
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
    if (hero.down) return false;
    hero.target = null;
    standUp();
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
    if (hero.down) return;
    if (e.kind === "pet") {
      if (opts.onTap) opts.onTap(e);
      return;
    }
    standUp();
    if (e.kind === "mob") {
      if (e.dead) return;
      hero.target = e;
      hero.pending = null;
      if (opts.onTarget) opts.onTarget(e);
      return;
    }
    hero.target = null;
    if (e.kind === "drop") {
      walkTo(e.tx, e.ty);
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
    if (cell(hero.tx, hero.ty) === "@" && opts.onPortal) opts.onPortal();
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
    hero.target = null;
    standUp();
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
    if (!hero.down && !hero.path.length && held.size) heldStep();
    const pet = ents.find((e) => e.kind === "pet"),
      wasMoving = hero.path.length > 0,
      from0 = { x: hero.tx, y: hero.ty };
    if (step(hero, dt, SPEED) && pet) pet.trail.push(from0);
    if (wasMoving && !hero.path.length) arrive();
    hero.t += dt;
    hero.swing = Math.max(0, (hero.swing || 0) - dt);
    hero.hurt = Math.max(0, (hero.hurt || 0) - dt);
    if (hero.down) {
      hero.down -= dt;
      if (hero.down <= 0) {
        hero.down = 0;
        const s0 = find("P");
        Object.assign(hero, { tx: s0.x, ty: s0.y, px: center(s0.x), py: center(s0.y), path: [], dir: "down" });
        if (pet) Object.assign(pet, { tx: s0.x, ty: s0.y, px: center(s0.x), py: center(s0.y), path: [], trail: [] });
        snapCam();
        if (opts.onRevive) opts.onRevive();
      }
    } else heroCombat(dt);
    pickUp();
    for (const e of [...ents]) {
      if (e === hero) continue;
      e.t += dt;
      if (e.kind === "mob") mobAI(e, dt);
      else if (e.kind === "pet") petAI(e, dt);
      else if (e.kind === "drop") e.age += dt;
    }
    respawns = respawns.filter((r) => {
      r.t -= dt;
      if (r.t > 0) return true;
      ents.push(spawnMob(r.home, 0.5));
      return false;
    });
    fx = fx.filter((f) => (f.t += dt) < f.life);
    if (opts.onTick) opts.onTick(dt, inCombat());
    const mw = map.w * T,
      mh = map.h * T,
      tx = mw <= ew ? (mw - ew) / 2 : Math.min(Math.max(hero.px - ew / 2, 0), mw - ew),
      ty = mh <= eh ? (mh - eh) / 2 : Math.min(Math.max(hero.py - eh / 2, 0), mh - eh),
      k = Math.min(1, dt * 8);
    cam.x += (tx - cam.x) * k;
    cam.y += (ty - cam.y) * k;
  }
  const rnd3 = () => Math.floor(Math.random() * 5) - 2;
  const cheb = (a, b) => Math.max(Math.abs(a.tx - b.tx), Math.abs(a.ty - b.ty));
  const inCombat = () => !!hero.target || ents.some((e) => e.kind === "mob" && e.state === "chase");
  function standUp() {
    if (!hero.sit) return;
    hero.sit = false;
    if (opts.onSit) opts.onSit(false);
  }
  /* Route `e` to the open tile next to `goal` that is cheapest to reach. */
  function routeNextTo(e, goal, pass = walkable) {
    let best = null;
    const fx0 = e === hero ? from() : { x: e.tx, y: e.ty };
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const x = goal.tx + dx,
          y = goal.ty + dy;
        if ((!dx && !dy) || !pass(x, y)) continue;
        const p = x === fx0.x && y === fx0.y ? [] : path(fx0.x, fx0.y, x, y, pass);
        if (p && (!best || p.length < best.length)) best = p;
      }
    if (!best) return false;
    setPath(e, (e === hero ? lead() : []).concat(best));
    return true;
  }
  function floater(text, x, y, color, big) {
    fx.push({ kind: "num", text: String(text), x, y, color, big, t: 0, life: 0.9 });
  }
  function hitFx(x, y, color) {
    fx.push({ kind: "spark", x, y, color, t: 0, life: 0.3 });
  }
  function heroCombat(dt) {
    const m = hero.target;
    if (!m) return;
    if (m.dead || !ents.includes(m)) {
      hero.target = null;
      return;
    }
    hero.cd = (hero.cd || 0) - dt;
    if (cheb(hero, m) <= 1) {
      if (hero.path.length) {
        // finish the current step only
        hero.path.length = Math.min(hero.path.length, 1);
        return;
      }
      face(m);
      if (opts.onEncounter) {
        hero.target = null;
        opts.onEncounter(m);
        return;
      }
      if (hero.cd <= 0) {
        hero.cd = opts.heroAttackDelay || 0.9;
        hero.swing = 0.25;
        const r = opts.onHeroHit ? opts.onHeroHit(m) : { dmg: 5 };
        damageMob(m, r.dmg, r.crit);
      }
      return;
    }
    hero.repath = (hero.repath || 0) - dt;
    if (!hero.path.length || hero.repath <= 0) {
      hero.repath = 0.4;
      if (!routeNextTo(hero, m)) {
        hero.target = null;
        if (opts.onStatus) opts.onStatus("走不到那隻怪物旁邊。");
      }
    }
  }
  function damageMob(m, dmg, crit) {
    m.hp = Math.max(0, m.hp - dmg);
    m.hurt = 0.25;
    floater(dmg, m.px, m.py - 30, crit ? "#ffd84d" : "#ffffff", crit);
    hitFx(m.px, m.py - 12, crit ? "#ffd84d" : "#fff6c8");
    if (m.state !== "return") {
      m.state = "chase";
      m.path = [];
    }
    if (m.hp <= 0) killMob(m);
  }
  function killMob(m) {
    m.dead = 0.6;
    m.path = [];
    m.state = "dead";
    if (hero.target === m) hero.target = null;
    const items = opts.onKill ? opts.onKill(m) : [];
    const spots = [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1]];
    let k = 0;
    items.forEach((item) => {
      while (k < spots.length && !walkable(m.tx + spots[k][0], m.ty + spots[k][1])) k++;
      const [dx, dy] = spots[Math.min(k++, spots.length - 1)];
      ents.push(actor("drop", m.tx + dx, m.ty + dy, { item, age: 0 }));
    });
    respawns.push({ home: m.home, t: opts.respawnDelay || 14 });
  }
  function pickUp() {
    if (hero.down) return;
    for (const d of ents.filter((e) => e.kind === "drop" && e.age > 0.35 && e.tx === hero.tx && e.ty === hero.ty)) {
      ents.splice(ents.indexOf(d), 1);
      if (opts.onPick) opts.onPick(d.item);
      fx.push({ kind: "num", text: "+", x: d.px, y: d.py - 16, color: "#c8ffcf", t: 0, life: 0.6 });
    }
  }
  function mobAI(e, dt) {
    e.hurt = Math.max(0, e.hurt - dt);
    if (e.dead) {
      e.dead -= dt;
      if (e.dead <= 0) ents.splice(ents.indexOf(e), 1);
      return;
    }
    const L = e.look,
      dHome = Math.max(Math.abs(e.tx - e.home.x), Math.abs(e.ty - e.home.y));
    if (e.state === "wander" && L.aggressive && !hero.down && clock > grace && cheb(e, hero) <= (L.sight || 3)) {
      e.state = "chase";
      e.path = [];
    }
    if (e.state === "chase" && (hero.down || dHome > (L.leash || 6))) {
      e.state = "return";
      e.path = [];
    }
    if (e.state === "return") {
      if (!e.path.length) {
        if (e.tx === e.home.x && e.ty === e.home.y) {
          e.state = "wander";
          e.hp = e.maxHp;
        } else {
          const p = path(e.tx, e.ty, e.home.x, e.home.y);
          if (p) setPath(e, p);
          else Object.assign(e, { tx: e.home.x, ty: e.home.y, px: center(e.home.x), py: center(e.home.y) });
        }
      }
      step(e, dt, 80);
      return;
    }
    if (e.state === "chase") {
      e.cd -= dt;
      if (cheb(e, hero) <= 1 && !e.path.length) {
        const dx = hero.tx - e.tx,
          dy = hero.ty - e.ty;
        e.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
        if (opts.onEncounter) {
          if (clock > grace && !hero.down) opts.onEncounter(e);
          return;
        }
        if (e.cd <= 0) {
          e.cd = L.attackDelay || 1.6;
          e.lunge = 0.2;
          const dmg = opts.onMobHit ? opts.onMobHit(e) : 0;
          if (dmg) {
            hero.hurt = 0.3;
            standUp();
            floater(dmg, hero.px, hero.py - 40, "#ff8a8a");
            hitFx(hero.px, hero.py - 14, "#ff9d9d");
          } else floater("Miss", hero.px, hero.py - 40, "#d6e4ff");
        }
      } else {
        e.repath = (e.repath || 0) - dt;
        if ((!e.path.length || e.repath <= 0) && cheb(e, hero) > 1) {
          e.repath = 0.5;
          routeNextTo(e, hero);
        }
        if (cheb(e, hero) <= 1 && e.path.length > 1) e.path.length = 1;
        step(e, dt, 72);
      }
      e.lunge = Math.max(0, (e.lunge || 0) - dt);
      return;
    }
    if (e.path.length) {
      step(e, dt, 38);
      return;
    }
    e.moving = false;
    e.wait -= dt;
    if (e.wait > 0) return;
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
  /* The companion trails one tile behind, following the tiles the hero actually walked. */
  function petAI(e, dt) {
    if (cheb(e, hero) > 7) {
      Object.assign(e, { tx: hero.tx, ty: hero.ty, px: hero.px, py: hero.py, path: [], trail: [] });
      return;
    }
    if (!e.path.length && cheb(e, hero) > 1) {
      while (e.trail.length > 1 && cheb({ tx: e.trail[0].x, ty: e.trail[0].y }, hero) > 1 && cheb({ tx: e.trail[1].x, ty: e.trail[1].y }, e) <= 1)
        e.trail.shift();
      const next = e.trail.shift();
      if (next && cheb({ tx: next.x, ty: next.y }, e) <= 1) setPath(e, [next]);
      else {
        const p = path(e.tx, e.ty, hero.tx, hero.ty, (x, y) => !SOLID.has(cell(x, y)));
        if (p && p.length > 1) setPath(e, p.slice(0, -1));
      }
    }
    if (e.trail.length > 12) e.trail.splice(0, e.trail.length - 12);
    step(e, dt, SPEED * 1.1);
  }

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
        ground(g, x, y, c === "=" || c === "@" ? "path" : c === "~" || c === "b" || /[1-4]/.test(c) ? "water" : "grass", P, sheet);
        if (c === "b" || /[1-4]/.test(c)) bridge(g, x, y, gateClosed(c));
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
  function bridge(g, x, y, closed) {
    const X = x * T,
      Y = y * T;
    g.fillStyle = "#c99a62";
    g.fillRect(X, Y + 4, T, T - 8);
    g.fillStyle = "#a87a4e";
    for (let i = 0; i < 4; i++) g.fillRect(X + i * 8 + 1, Y + 4, 1.5, T - 8);
    g.fillStyle = "#8a5f38";
    g.fillRect(X, Y + 3, T, 2);
    g.fillRect(X, Y + T - 5, T, 2);
    if (closed) {
      // Rope barrier with a little sign: the bridge opens when the story allows.
      g.fillStyle = "#7a4b26";
      g.fillRect(X + 4, Y + 6, 4, 20);
      g.fillRect(X + T - 8, Y + 6, 4, 20);
      g.strokeStyle = "#e5475f";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(X + 6, Y + 10);
      g.quadraticCurveTo(X + 16, Y + 16, X + T - 6, Y + 10);
      g.stroke();
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
  /* walk sheet while moving, idle sheet while standing; with only a walk sheet, stand on its first frame. */
  function actorSheet(base, e, row, size) {
    if (!base) return false;
    const walk = art.sprites[base + "-walk"],
      idle = art.sprites[base + "-idle"];
    if (e.moving && walk) return drawSheet(base + "-walk", e, row, 4, 8, e.px, e.py + 10, size);
    if (idle) return drawSheet(base + "-idle", e, row, 2, 2, e.px, e.py + 10, size);
    if (walk) return drawSheet(base + "-walk", { t: 0 }, row, 1, 1, e.px, e.py + 10, size);
    return false;
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
    shadow(x, foot, e.sit ? 12 : 10);
    // legs (tucked in when sitting)
    ctx.fillStyle = L.boots || "#7a5a44";
    ctx.beginPath();
    if (e.sit) {
      ctx.roundRect(x - 9, foot - 4, 7, 4, 2);
      ctx.roundRect(x + 2, foot - 4, 7, 4, 2);
    } else {
      ctx.roundRect(x - 6 + walk * 2 * (side ? 1 : 0.4), foot - 7 - Math.max(0, walk) * 2, 5, 7, 2);
      ctx.roundRect(x + 1 - walk * 2 * (side ? 1 : 0.4), foot - 7 - Math.max(0, -walk) * 2, 5, 7, 2);
    }
    ctx.fill();
    const by = foot - (e.sit ? 2 : 7) - bob;
    if (L.cape) {
      // short cape: behind the body from the front, over it from the back
      ctx.fillStyle = L.cape;
      ctx.beginPath();
      const sway = e.moving ? Math.sin(e.t * 12) * 1.5 : 0;
      if (back) ctx.roundRect(x - 9, by - 13, 18, 15 + sway * 0.3, [5, 5, 3, 3]);
      else {
        ctx.moveTo(x - 8, by - 12);
        ctx.lineTo(x + 8, by - 12);
        ctx.lineTo(x + 10 - side * 2 + sway, by + 1);
        ctx.lineTo(x - 10 - side * 2 + sway, by + 1);
      }
      ctx.fill();
    }
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
    if (L.staff && (!back || e.swing)) {
      // Staff swings forward along the facing direction during an attack.
      const sw = e.swing ? Math.sin((1 - e.swing / 0.25) * Math.PI) : 0,
        fwd = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[e.dir],
        sx = side ? x + side * 6 : x + 10,
        tipX = sx + (side || 1) * 2 + fwd[0] * sw * 14,
        tipY = by - 20 + sw * (fwd[1] * 14 + 10);
      ctx.strokeStyle = "#9a6b45";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx, by + 2);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.fillStyle = L.staff;
      ctx.beginPath();
      ctx.arc(tipX, tipY - 2, 3.5 + sw, 0, 7);
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
    const shake = e.hurt ? Math.sin(e.hurt * 80) * 2.5 : 0,
      lf = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[e.dir],
      lg = e.lunge ? Math.sin((e.lunge / 0.2) * Math.PI) * 6 : 0;
    ctx.translate(x + shake + lf[0] * lg, y + lf[1] * lg);
    if (e.dead) {
      ctx.globalAlpha = Math.max(0, e.dead / 0.6);
      ctx.scale(1 + (0.6 - e.dead), 1 - (0.6 - e.dead));
    } else if (e.hurt) ctx.globalAlpha = 0.55 + 0.45 * Math.abs(Math.cos(e.hurt * 40));
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
      case "slime":
        // a round grass slime with a leaf on top
        ctx.moveTo(-12, 0);
        ctx.quadraticCurveTo(-13, -16, 0, -18);
        ctx.quadraticCurveTo(13, -16, 12, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = c2;
        ctx.beginPath();
        ctx.ellipse(3, -19, 5, 2.4, -0.5, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#ffffff60";
        ctx.beginPath();
        ctx.ellipse(-5, -12, 3, 2, -0.4, 0, 7);
        ctx.fill();
        break;
      case "turtle":
        // rock-shell turtle: legs, head, and a stony dome
        ctx.fillStyle = c2;
        [-8, 8].forEach((dx) => ctx.fillRect(dx - 2.5, -4, 5, 5));
        ctx.beginPath();
        ctx.arc(e.dir === "left" ? -12 : 12, -7, 4, 0, 7);
        ctx.fill();
        ctx.fillStyle = c1;
        ctx.beginPath();
        ctx.ellipse(0, -8, 12, 9, 0, Math.PI, 0);
        ctx.lineTo(12, -4);
        ctx.lineTo(-12, -4);
        ctx.fill();
        ctx.strokeStyle = "#00000030";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-6, -15);
        ctx.lineTo(-3, -6);
        ctx.moveTo(5, -16);
        ctx.lineTo(3, -6);
        ctx.stroke();
        break;
      case "guardian":
        // wind guardian: a cloud with a calm mask and a swirl
        [[-9, -12, 8], [9, -12, 8], [0, -18, 10], [0, -8, 11]].forEach(([dx, dy, r]) => {
          ctx.beginPath();
          ctx.arc(dx, dy, r, 0, 7);
          ctx.fill();
        });
        ctx.strokeStyle = c2;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, -26, 4, Math.PI * 0.2, Math.PI * 1.8);
        ctx.stroke();
        break;
      case "bubble":
        // A wobbly letter bubble: translucent body, shine, and a small decorative sparkle.
        ctx.globalAlpha *= 0.85;
        ctx.arc(0, -12, 12 + Math.sin(e.t * 3) * 0.8, 0, 7);
        ctx.fill();
        ctx.globalAlpha /= 0.85;
        ctx.fillStyle = "#ffffffb0";
        ctx.beginPath();
        ctx.ellipse(-5, -18, 3.5, 2.2, -0.6, 0, 7);
        ctx.fill();
        ctx.fillStyle = "#6b4fb0";
        ctx.font = "700 9px serif";
        ctx.textAlign = "center";
        ctx.fillText("✦", 6, -22 + Math.sin(e.t * 2) * 1.5);
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

  function bar(x, y, w, frac, color) {
    ctx.fillStyle = "#2b2f2acc";
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, 5);
    ctx.fillStyle = "#ffffff55";
    ctx.fillRect(x - w / 2, y, w, 3);
    ctx.fillStyle = color;
    ctx.fillRect(x - w / 2, y, Math.max(0, w * frac), 3);
  }
  function dropIcon(e) {
    const x = e.px,
      b = e.age < 0.35 ? -Math.sin((e.age / 0.35) * Math.PI) * 10 : reduce ? 0 : Math.sin(clock * 3 + e.tx) * 1.2,
      y = e.py + 4 + b;
    shadow(x, e.py + 8, 6);
    const art0 = art.sprites["item-" + e.item];
    if (art0) {
      ctx.drawImage(art0.img, x - 10, y - 18, 20, 20);
      return;
    }
    if (e.item === "berry") {
      ctx.fillStyle = "#e5475f";
      ctx.beginPath();
      ctx.arc(x - 3, y - 6, 5, 0, 7);
      ctx.arc(x + 3, y - 6, 5, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#7cc56a";
      ctx.beginPath();
      ctx.ellipse(x, y - 12, 4, 2, 0, 0, 7);
      ctx.fill();
    } else if (e.item === "dew") {
      ctx.fillStyle = "#5aa8f0";
      ctx.beginPath();
      ctx.moveTo(x, y - 16);
      ctx.bezierCurveTo(x + 4, y - 10, x + 6, y - 7, x + 6, y - 4);
      ctx.arc(x, y - 4, 6, 0, Math.PI);
      ctx.bezierCurveTo(x - 6, y - 7, x - 4, y - 10, x, y - 16);
      ctx.fill();
      ctx.fillStyle = "#ffffffa0";
      ctx.beginPath();
      ctx.arc(x - 2, y - 6, 1.6, 0, 7);
      ctx.fill();
    } else {
      ctx.fillStyle = "#fff8e1";
      ctx.strokeStyle = "#c9a45c";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y - 7, 8, 0, 7);
      ctx.fill();
      ctx.stroke();
      ctx.font = "11px " + "'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((opts.itemIcon && opts.itemIcon(e.item)) || "✦", x, y - 6);
      ctx.textBaseline = "alphabetic";
    }
  }
  /* Placeholder puppy companion (replaced by pet-walk / pet-idle sheets). */
  function puppy(e, L) {
    const x = e.px,
      foot = e.py + 10,
      walk = e.moving ? Math.sin(e.t * 14) : 0,
      bob = e.moving ? Math.abs(walk) * 1.5 : 0,
      side = e.dir === "left" ? -1 : e.dir === "right" ? 1 : 0,
      back = e.dir === "up",
      y = foot - 4 - bob;
    shadow(x, foot, 9);
    ctx.fillStyle = L.fur;
    // legs
    ctx.fillRect(x - 6, foot - 5 - Math.max(0, walk) * 2, 3, 5);
    ctx.fillRect(x + 3, foot - 5 - Math.max(0, -walk) * 2, 3, 5);
    // body
    ctx.beginPath();
    ctx.ellipse(x, y - 4, side ? 10 : 8, 6, 0, 0, 7);
    ctx.fill();
    // tail wag
    const wag = Math.sin(e.t * (e.moving ? 18 : 8)) * 0.5;
    ctx.strokeStyle = L.fur;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    const tx0 = side ? x - side * 9 : x + (back ? 0 : 6),
      ty0 = y - 6;
    ctx.moveTo(tx0, ty0);
    ctx.lineTo(tx0 - (side || 0.4) * 4 + wag * 4, ty0 - 6);
    ctx.stroke();
    ctx.lineCap = "butt";
    // head
    const hx = x + side * 7,
      hy = y - 13;
    ctx.fillStyle = L.fur;
    ctx.beginPath();
    ctx.arc(hx, hy, 7.5, 0, 7);
    ctx.fill();
    ctx.fillStyle = L.ear;
    [-1, 1].forEach((s0) => {
      ctx.beginPath();
      ctx.ellipse(hx + s0 * 6, hy - 1, 2.6, 5, s0 * 0.35, 0, 7);
      ctx.fill();
    });
    if (!back) {
      ctx.fillStyle = L.muzzle || "#fff6e8";
      ctx.beginPath();
      ctx.ellipse(hx + side * 3, hy + 3, 4, 3, 0, 0, 7);
      ctx.fill();
      ctx.fillStyle = "#3a2e2a";
      ctx.beginPath();
      ctx.arc(hx + side * 5, hy + 2, 1.4, 0, 7);
      if (side) ctx.arc(hx + side * 2, hy - 2, 1.3, 0, 7);
      else {
        ctx.arc(hx - 3, hy - 2, 1.3, 0, 7);
        ctx.arc(hx + 3, hy - 2, 1.3, 0, 7);
      }
      ctx.fill();
    }
    if (L.scarf) {
      ctx.fillStyle = L.scarf;
      ctx.fillRect(hx - 5, hy + 5, 10, 2.5);
    }
  }
  /* Wind sprite companion: the NPC chibi, scaled down, floating, with leaf-shaped wings. */
  function fairy(e, L) {
    const fl = reduce ? 0 : Math.sin(e.t * 3) * 2.5;
    shadow(e.px, e.py + 10, 6);
    ctx.save();
    ctx.translate(e.px, e.py + 10 - 8 + fl);
    ctx.scale(0.72, 0.72);
    ctx.translate(-e.px, -(e.py + 10));
    const flap = reduce ? 0.2 : Math.abs(Math.sin(e.t * 9)) * 0.35;
    ctx.fillStyle = L.wing || "#c8f4ffb0";
    [-1, 1].forEach((s0) => {
      ctx.beginPath();
      ctx.ellipse(e.px + s0 * 11, e.py - 14, 9, 4.5, s0 * (0.6 + flap), 0, 7);
      ctx.fill();
    });
    chibi({ ...e, moving: false, sit: false }, L);
    ctx.restore();
  }
  function drawFx() {
    for (const f of fx) {
      const k = f.t / f.life;
      if (f.kind === "spark") {
        ctx.strokeStyle = f.color;
        ctx.globalAlpha = 1 - k;
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2,
            r0 = 3 + k * 6,
            r1 = 7 + k * 12;
          ctx.beginPath();
          ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0);
          ctx.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
        ctx.font = `800 ${f.big ? 17 : 13}px Fredoka, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#2b2f2a";
        const yy = f.y - k * 22;
        ctx.strokeText(f.text, f.x, yy);
        ctx.fillStyle = f.color;
        ctx.fillText(f.text, f.x, yy);
        ctx.globalAlpha = 1;
      }
    }
  }
  /* Edge arrow toward the current objective when it is off screen. */
  function drawGuide() {
    const g = opts.guide && opts.guide();
    if (!g || api.paused) return;
    const m = 26,
      x0 = cam.x + m,
      y0 = cam.y + m + 40,
      x1 = cam.x + ew - m,
      y1 = cam.y + eh - m - 60,
      tx = g.px,
      ty = g.py - 10;
    if (tx > x0 && tx < x1 && ty > y0 && ty < y1) return;
    const cx = cam.x + ew / 2,
      cy = cam.y + eh / 2,
      a = Math.atan2(ty - cy, tx - cx),
      ax = Math.min(x1, Math.max(x0, tx)),
      ay = Math.min(y1, Math.max(y0, ty)),
      b = reduce ? 0 : Math.sin(clock * 5) * 3;
    ctx.save();
    ctx.translate(ax + Math.cos(a) * b, ay + Math.sin(a) * b);
    ctx.rotate(a);
    ctx.fillStyle = "#ffbf3f";
    ctx.strokeStyle = "#8a5a1d";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -10);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    label(g.name, ax, ay + 24, "#fff3c4");
  }
  function draw() {
    const k = dpr * Z;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.fillStyle = map.palette.edge || "#5d8a52";
    ctx.fillRect(0, 0, ew, eh);
    const ox = Math.round(cam.x * k) / k,
      oy = Math.round(cam.y * k) / k;
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
    for (const p of portals) {
      const on = !opts.portalOn || opts.portalOn(),
        cx = center(p.x),
        cy = center(p.y),
        t = clock * (on ? 2.4 : 0.6);
      ctx.save();
      ctx.globalAlpha = on ? 0.95 : 0.45;
      for (let i = 0; i < 3; i++) {
        ctx.strokeStyle = on ? ["#8fd3ff", "#c4a7ff", "#ffffff"][i] : "#9aa3b5";
        ctx.lineWidth = 2.5 - i * 0.6;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 2, 13 - i * 3.5, 7 - i * 2, 0, t + i, t + i + Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.restore();
    }
    const tg = hero.target;
    if (tg && !tg.dead) {
      ctx.strokeStyle = "#ff6b6b";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.ellipse(tg.px, tg.py + 9, 13, 5, 0, 0, 7);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const labels = [];
    [...ents]
      .sort((a, b) => a.py - b.py)
      .forEach((e) => {
        let top;
        const row = DIRS.indexOf(e.dir);
        if (e.kind === "drop") return dropIcon(e);
        if (e.kind === "pet") {
          if (e.look.kind === "sprite") fairy(e, e.look);
          else if (!actorSheet("pet", e, row, 32)) puppy(e, e.look);
          return;
        }
        if (e.kind === "hero" && e.down) {
          // Knocked out: lie down and fade, then revive at the map entrance.
          ctx.save();
          ctx.globalAlpha = Math.min(1, e.down / 0.6);
          ctx.translate(e.px, e.py + 6);
          ctx.rotate(-Math.PI / 2);
          ctx.translate(-e.px, -(e.py + 6));
          chibi({ ...e, moving: false, dir: "down", swing: 0 }, e.look);
          ctx.restore();
          return;
        }
        if (e.kind === "hero" && e.hurt) ctx.globalAlpha = 0.5 + 0.5 * Math.abs(Math.cos(e.hurt * 40));
        if (e.kind === "hero" || e.kind === "npc") {
          if (actorSheet(e.kind === "hero" ? "hero" : e.look.sprite, e, row, 48)) top = e.py - 34;
          else top = chibi(e, e.look);
          ctx.globalAlpha = 1;
          if (e.kind === "hero" && opts.heroBars) {
            const b = opts.heroBars();
            labels.push(() => {
              bar(e.px, e.py + 16, 30, b.hp / b.maxHp, b.hp / b.maxHp < 0.3 ? "#ff5d5d" : "#5fd16b");
              bar(e.px, e.py + 21, 30, b.mp / b.maxMp, "#5aa8f0");
            });
          }
          if (e.kind === "npc") labels.push(() => {
            label(e.name, e.px, e.py + 24, "#ffffff");
            if (e.mark) questMark(e.px, top - 6);
          });
        } else if (e.kind === "chest") chest(e);
        else if (e.kind === "mob") {
          if (actorSheet(e.look.sprite, e, row, 44)) top = e.py - 30;
          else top = monster(e, e.look);
          if (!e.dead)
            labels.push(() => {
              label(e.name, e.px, e.py + 23, e.state === "chase" ? "#ffb0b0" : "#ffd9e0", "Lv." + (e.look.lv || 1));
              if (e.hp < e.maxHp) bar(e.px, e.py - 34, 26, e.hp / e.maxHp, "#ff7a7a");
            });
        }
      });
    labels.forEach((f) => f());
    drawFx();
    drawGuide();
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
    npc: (id) => ents.find((e) => e.kind === "npc" && e.id === id),
    /* Companion joins or leaves the party at runtime (story reward, rest/active toggle). */
    setCompanion(look) {
      const old = ents.find((e) => e.kind === "pet");
      if (old) ents.splice(ents.indexOf(old), 1);
      if (!look) return;
      const spot = [[-1, 1], [1, 1], [-1, 0], [1, 0], [0, 1]].map(([dx, dy]) => ({ x: hero.tx + dx, y: hero.ty + dy })).find((q) => walkableRaw(q.x, q.y)) || { x: hero.tx, y: hero.ty };
      ents.push(actor("pet", spot.x, spot.y, { look, trail: [], name: look.name }));
    },
    /* Back to the map's start tile (menu "回到入口" when stuck). */
    toStart() {
      const s0 = find("P");
      hero.path = [];
      hero.target = null;
      Object.assign(hero, { tx: s0.x, ty: s0.y, px: center(s0.x), py: center(s0.y) });
      const pet = ents.find((e) => e.kind === "pet");
      if (pet) Object.assign(pet, { tx: s0.x, ty: s0.y + 1, px: center(s0.x), py: center(s0.y + 1), path: [], trail: [] });
      snapCam();
      if (opts.onMove) opts.onMove(hero.tx, hero.ty);
    },
    setMark(id, on) {
      const n = ents.find((e) => e.kind === "npc" && e.id === id);
      if (n) n.mark = !!on;
    },
    /* Add a monster at runtime (story events, tutorials). */
    spawn(look, x, y, extra) {
      const m = actor("mob", x, y, { home: { x, y }, wait: 1, look, name: look.name, hp: look.hp || 30, maxHp: look.hp || 30, state: "wander", cd: 1, hurt: 0, ...extra });
      ents.push(m);
      return m;
    },
    remove(e) {
      const i = ents.indexOf(e);
      if (i >= 0) ents.splice(i, 1);
      if (hero.target === e) hero.target = null;
    },
    /* Battle outcome on the field: a beaten monster leaves (and respawns later unless unique). */
    defeat(e) {
      this.remove(e);
      if (!e.unique) respawns.push({ home: e.home, t: opts.respawnDelay || 20 });
    },
    /* After fleeing: monsters calm down and nobody can start a fight for a few seconds. */
    calm(sec = 3) {
      grace = clock + sec;
      ents.forEach((e) => e.kind === "mob" && e.state === "chase" && ((e.state = "return"), (e.path = [])));
    },
    refresh() {
      paintStatic();
    },
    /* Draw an actor large on another canvas (battle screen, dialog portrait). */
    portrait(canvas, kind, look, opt = {}) {
      const c2 = canvas.getContext("2d"),
        saved = ctx,
        r = window.devicePixelRatio > 1 ? 2 : 1,
        w = canvas.clientWidth || canvas.width,
        h = canvas.clientHeight || canvas.height;
      canvas.width = w * r;
      canvas.height = h * r;
      const s0 = (h / 64) * (opt.zoom || 1);
      c2.setTransform(r * s0, 0, 0, r * s0, 0, 0);
      c2.clearRect(0, 0, w, h);
      ctx = c2;
      const e = { kind, look, px: w / s0 / 2, py: h / s0 - 18, dir: opt.dir || "down", t: opt.t || 0, moving: false, hurt: opt.hurt || 0, swing: opt.swing || 0, lunge: 0 };
      try {
        const sheet = kind === "hero" ? "hero" : kind === "pet" ? "pet" : look && look.sprite;
        if (look && look.kind === "sprite") fairy(e, look);
        else if (!actorSheet(sheet, e, DIRS.indexOf(e.dir), kind === "mob" ? 44 : 48)) {
          if (kind === "mob") monster(e, look);
          else if (kind === "pet") puppy(e, look);
          else chibi(e, look);
        }
      } finally {
        ctx = saved;
      }
    },
    knockout() {
      hero.down = 1.6;
      hero.path = [];
      hero.target = null;
      hero.pending = null;
      standUp();
      ents.forEach((e) => e.kind === "mob" && e.state === "chase" && ((e.state = "return"), (e.path = [])));
    },
    sit(on) {
      if (hero.down) return false;
      hero.sit = !!on;
      if (on) {
        hero.path = [];
        hero.target = null;
      }
      return true;
    },
    attackNearest() {
      const mobs = ents.filter((e) => e.kind === "mob" && !e.dead).sort((a, b) => cheb(a, hero) - cheb(b, hero));
      if (mobs[0] && cheb(mobs[0], hero) <= 6) {
        approach(mobs[0]);
        return mobs[0];
      }
      return null;
    },
    floater,
    hasArt: (k) => !!art.sprites[k],
    heroFloat(text, color) {
      floater(text, hero.px, hero.py - 40, color);
    },

    setChest(open) {
      ents.forEach((e) => e.kind === "chest" && (e.open = open));
    },
    /* Viewport position of a tile centre, for tests and tutorial pointers. */
    tileToClient(x, y) {
      const r = cv.getBoundingClientRect();
      return { x: r.left + (center(x) - cam.x) * Z, y: r.top + (center(y) - cam.y) * Z };
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
    hero: {
      get: () =>
        hero && { x: hero.tx, y: hero.ty, moving: hero.path.length > 0, dir: hero.dir, sit: !!hero.sit, down: !!hero.down, fighting: !!hero.target },
    },
    combat: { get: () => inCombat() },
    entities: { get: () => ents },
    canvas: { get: () => cv },
  });
  return api;
})();
