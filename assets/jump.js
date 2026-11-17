/* 邦多利跳一跳 —— Canvas isometric hop game
   按住蓄力，松开起跳；落在方块中心有「完美」加成。纯前端，无素材、无音频依赖。 */
(function () {
  "use strict";
  const ISO_X = 0.866, ISO_Y = 0.5;
  const CHARGE_MS = 820;
  const MIN_D = 1.7, MAX_D = 3.6;
  const HALF = 0.5;                 // 方块半宽（世界单位）
  let A = null, cv = null, ctx = null, W = 0, H = 0, PX = 76;
  let state = "idle";               // idle | charge | jump | fall | over
  let platforms = [], cur = 0, camera = { x: 0, y: 0 }, camTarget = { x: 0, y: 0 };
  let power = 0, holding = false, chargeStart = 0, raf = 0, lastT = 0;
  let jump = null, score = 0, combo = 0, best = 0;
  let popups = [];

  const el = id => document.getElementById(id);
  const store = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch (e) { return d } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } };
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function iso(p) { return { x: (p.x - p.z) * ISO_X * PX, y: (p.x + p.z) * ISO_Y * PX }; }

  function makePlatform(x, z) {
    const band = A.BANDS[(platforms.length) % A.BANDS.length];
    const scale = clamp(1 - score * 0.006, 0.78, 1);
    return { x, z, size: HALF * scale, band, h: 24 + Math.random() * 6 };
  }

  function reset() {
    platforms = [makePlatform(0, 0)];
    cur = 0; score = 0; combo = 0; power = 0; holding = false; popups = [];
    state = "idle"; jump = null;
    camTarget = iso(platforms[0]);
    camera.x = camTarget.x; camera.y = camTarget.y;
    addNext();
    el("jump-score") && (el("jump-score").textContent = "0");
    el("jump-combo") && (el("jump-combo").textContent = "");
  }

  function addNext() {
    const last = platforms[platforms.length - 1];
    const axis = platforms.length % 2 ? "z" : "x";       // 交替：右下 / 右上
    const dist = MIN_D + Math.random() * (MAX_D - MIN_D) * (0.55 + score * 0.004);
    const p = axis === "x" ? makePlatform(last.x + dist, last.z) : makePlatform(last.x, last.z - dist);
    p.dist = dist; p.axis = axis;
    platforms.push(p);
  }

  function resize() {
    if (!cv) return;
    const rect = cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = Math.max(280, Math.round(rect.width));
    H = Math.round(Math.min(430, Math.max(320, rect.height || 360)));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx = cv.getContext && cv.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    PX = clamp(Math.min(W / 6.4, 92), 46, 92);
  }

  /* ---------------- 绘制 ---------------- */
  function screen(p) {
    const s = iso(p);
    return { x: s.x - camera.x + W * 0.32, y: s.y - camera.y + H * 0.66 };
  }

  function drawPlatform(p, isCur) {
    const s = screen(p);
    const hw = p.size * PX * ISO_X, hh = p.size * PX * ISO_Y;
    const top = s.y - p.h, bottom = s.y;
    const color = p.band.color || "#e8426e";
    // 侧面
    ctx.beginPath();
    ctx.moveTo(s.x - hw, top); ctx.lineTo(s.x, top + hh);
    ctx.lineTo(s.x, bottom + hh); ctx.lineTo(s.x - hw, bottom);
    ctx.closePath(); ctx.fillStyle = shade(color, -0.42); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s.x + hw, top); ctx.lineTo(s.x, top + hh);
    ctx.lineTo(s.x, bottom + hh); ctx.lineTo(s.x + hw, bottom);
    ctx.closePath(); ctx.fillStyle = shade(color, -0.26); ctx.fill();
    // 顶面
    ctx.beginPath();
    ctx.moveTo(s.x, top - hh); ctx.lineTo(s.x + hw, top);
    ctx.lineTo(s.x, top + hh); ctx.lineTo(s.x - hw, top);
    ctx.closePath();
    const g = ctx.createLinearGradient(s.x - hw, top - hh, s.x + hw, top + hh);
    g.addColorStop(0, shade(color, 0.24)); g.addColorStop(1, shade(color, -0.06));
    ctx.fillStyle = g; ctx.fill();
    if (isCur) {
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 2; ctx.stroke();
    }
    // 中心点
    ctx.beginPath(); ctx.ellipse(s.x, top, 3.5, 2, 0, 0, 7);
    ctx.fillStyle = "rgba(255,255,255,.75)"; ctx.fill();
    // 名子
    if (p.size * PX > 26) {
      ctx.font = "600 " + clamp(p.size * PX * 0.19, 8, 12) + "px system-ui,sans-serif";
      ctx.fillStyle = "rgba(10,11,18,.72)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(p.band.ja, s.x, top + 1);
    }
  }

  function shade(hex, amt) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#999999");
    if (!m) return "#999";
    const f = (v) => clamp(Math.round(parseInt(v, 16) * (1 + amt)), 0, 255);
    return "rgb(" + f(m[1]) + "," + f(m[2]) + "," + f(m[3]) + ")";
  }

  function drawPlayer() {
    const s = playerScreen();
    const squash = state === "charge" ? 1 - power * 0.28 : 1;
    const h = 30 * squash, w = 16 / squash;
    ctx.save();
    ctx.translate(s.x, s.y);
    // 影子
    ctx.beginPath(); ctx.ellipse(0, 2, w * 0.9, 5, 0, 0, 7);
    ctx.fillStyle = "rgba(0,0,0,.32)"; ctx.fill();
    if (state === "fall") ctx.rotate(jump ? jump.rot : 0);
    // 身体
    const g = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
    g.addColorStop(0, "#fff"); g.addColorStop(1, "#ffd9e4");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-w / 2, -h, w, h, 7) : ctx.rect(-w / 2, -h, w, h);
    ctx.fill();
    // 头
    ctx.beginPath(); ctx.arc(0, -h - 7, 8, 0, 7);
    ctx.fillStyle = "#fff"; ctx.fill();
    ctx.beginPath(); ctx.arc(0, -h - 7, 8, 0, 7);
    ctx.strokeStyle = "rgba(232,66,110,.85)"; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }

  function playerScreen() {
    if (state === "jump" && jump) {
      const t = jump.t;
      const p = { x: lerp(jump.from.x, jump.to.x, t), z: lerp(jump.from.z, jump.to.z, t) };
      const s = screen(p);
      s.y -= lerp(jump.fromH, jump.toH, t) + Math.sin(Math.PI * t) * jump.height;
      return s;
    }
    const s = screen(platforms[cur]);
    s.y -= platforms[cur] ? platforms[cur].h - 1 : 0;
    if (state === "fall" && jump) {
      const t = clamp(jump.fallT || 0, 0, 1);
      s.y += t * t * 220;
      s.x += t * 24;
    }
    return s;
  }

  /* ---------------- 逻辑 ---------------- */
  function chargeStartNow() {
    if (state !== "idle") return;
    state = "charge"; holding = true; power = 0; chargeStart = performance.now();
  }
  function release() {
    if (state !== "charge") return;
    holding = false;
    const next = platforms[cur + 1];
    const d = MIN_D + power * (MAX_D - MIN_D);
    const from = { x: platforms[cur].x, z: platforms[cur].z };
    const to = next.axis === "x" ? { x: from.x + d, z: from.z } : { x: from.x, z: from.z - d };
    jump = { from, to,
      fromH: platforms[cur].h, toH: platforms[cur + 1].h,
      t: 0, dur: 230 + power * 220, height: 44 + power * 56, rot: 0, fallT: 0 };
    state = "jump";
    const diff = Math.abs(d - next.dist);
    const tol = next.size + 0.06;
    jump.ok = diff <= tol;
    jump.perfect = jump.ok && diff <= Math.max(0.09, next.size * 0.2);
  }

  function land() {
    const next = platforms[cur + 1];
    if (!jump || !jump.ok) {
      state = "fall"; jump.fallT = 0;
      combo = 0;
      setTimeout(gameOver, 520);
      return;
    }
    cur++;
    const gain = jump.perfect ? 2 : 1;
    score += gain + (combo >= 2 ? 1 : 0);
    if (jump.perfect) {
      combo++;
      popups.push({ x: W * 0.5, y: H * 0.32, t: 0, text: combo > 1 ? "完美 ×" + combo : "完美", color: "#ffd9e4" });
    } else combo = 0;
    state = "idle"; jump = null;
    addNext();
    camTarget = iso(platforms[cur]);
    if (el("jump-score")) el("jump-score").textContent = score;
    if (el("jump-combo")) el("jump-combo").textContent = combo >= 2 ? "连击 " + combo : "";
    if (score > best) { best = score; save("bdx_jump_best", best); if (el("jump-best")) el("jump-best").textContent = best }
  }

  function gameOver() {
    state = "over";
    jump = null;
    const ov = el("jump-overlay");
    if (ov) {
      ov.hidden = false;
      ov.innerHTML = '<div class="jump-result"><b>' + score + '</b><span>本局得分</span>' +
        '<em>最高 ' + best + '</em></div>' +
        '<button class="btn primary" id="jump-start" type="button">再来一局</button>';
      const btn = ov.querySelector("#jump-start");
      if (btn) btn.onclick = start;
    }
  }

  function start() {
    const ov = el("jump-overlay");
    if (ov) ov.hidden = true;
    reset();
    state = "idle";
    if (el("jump-score")) el("jump-score").textContent = "0";
    lastT = performance.now();
    if (!raf) loop(lastT);
  }

  /* ---------------- 主循环 ---------------- */
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(50, t - lastT); lastT = t;
    if (state === "charge") power = clamp((t - chargeStart) / CHARGE_MS, 0, 1);
    if (state === "jump" && jump) {
      jump.t += dt / jump.dur;
      if (jump.t >= 1) { jump.t = 1; land(); }
    }
    if (state === "fall" && jump) jump.fallT = (jump.fallT || 0) + dt / 520;

    // 相机跟随
    if (platforms[cur]) {
      camTarget = iso(platforms[cur]);
      camera.x = lerp(camera.x, camTarget.x, clamp(dt / 260, 0, 0.3));
      camera.y = lerp(camera.y, camTarget.y, clamp(dt / 260, 0, 0.3));
    }
    draw(t);
  }

  function draw(t) {
    if (!ctx) return;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#14151d"); g.addColorStop(0.55, "#1b1a26"); g.addColorStop(1, "#241726");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.save();
    for (let i = 0; i < platforms.length; i++) drawPlatform(platforms[i], i === cur);
    drawPlayer();
    // 蓄力条
    if (state === "charge") {
      const bw = W * 0.46, bx = (W - bw) / 2, by = H - 26;
      ctx.fillStyle = "rgba(255,255,255,.14)";
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, bw, 7, 4) : ctx.rect(bx, by, bw, 7); ctx.fill();
      const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      pg.addColorStop(0, "#ff4d7d"); pg.addColorStop(1, "#7b6cff");
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, by, bw * power, 7, 4) : ctx.rect(bx, by, bw * power, 7); ctx.fill();
    }
    // 飘字
    popups = popups.filter(p => p.t < 1);
    popups.forEach(p => {
      p.t += 0.02;
      ctx.globalAlpha = 1 - p.t;
      ctx.fillStyle = p.color; ctx.textAlign = "center"; ctx.font = "800 20px system-ui,sans-serif";
      ctx.fillText(p.text, p.x, p.y - p.t * 40);
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  /* ---------------- 输入 ---------------- */
  function bindInput() {
    if (!cv) return;
    const down = e => { e.preventDefault(); chargeStartNow(); cv.setPointerCapture && e.pointerId != null && cv.setPointerCapture(e.pointerId) };
    const up = e => { e.preventDefault(); release() };
    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    window.addEventListener("keydown", e => {
      if (e.code === "Space" && !e.repeat && document.activeElement === document.body) { e.preventDefault(); chargeStartNow() }
    });
    window.addEventListener("keyup", e => { if (e.code === "Space") release() });
    window.addEventListener("resize", () => { resize(); });
  }

  function init(api) {
    A = api;
    cv = el("jump-canvas");
    best = store("bdx_jump_best", 0);
    if (el("jump-best")) el("jump-best").textContent = best;
    if (!cv) return;
    resize(); bindInput();
    reset();
    draw(0);
    const ov = el("jump-overlay");
    if (ov) {
      ov.hidden = false;
      ov.innerHTML = '<div class="jump-tip">按住蓄力，松开起跳</div><button class="btn primary" id="jump-start" type="button">开始游戏</button>';
      const btn = ov.querySelector("#jump-start");
      if (btn) btn.onclick = start;
    }
  }

  window.JumpGame = { init, start, refresh: () => { resize(); draw(0) } };
})();
