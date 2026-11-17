/* 邦多利跳一跳 v2 —— 可换角色的 Q 版小人 + 更热闹的舞台
   纯 Canvas 绘制，不依赖图片素材；角色按乐队配色与乐器生成。 */
(function () {
  "use strict";
  const ISO_X = 0.866, ISO_Y = 0.5, HALF = 0.5;
  const CHARGE_MS = 820, MIN_D = 1.7, MAX_D = 3.6;

  /* 每支乐队一个代表角色：发色 / 瞳色 / 发色阴影 / 发型 / 乐器 / 发饰 */
  const ROSTER = {
    poppinparty: { name: "戸山 香澄", band: "Poppin'Party", hair: "#a26a49", hairD: "#7d4c31", eye: "#ff5f8f", style: "bob", inst: "guitar", acc: "star" },
    afterglow: { name: "美竹 蘭", band: "Afterglow", hair: "#33303a", hairD: "#211f27", eye: "#e8426e", style: "long", inst: "guitar", acc: "none" },
    pastelpalettes: { name: "丸山 彩", band: "Pastel＊Palettes", hair: "#ff9ec4", hairD: "#e07aa4", eye: "#ff77b0", style: "twin", inst: "mic", acc: "ribbon" },
    roselia: { name: "湊 友希那", band: "Roselia", hair: "#dbe4f2", hairD: "#b9c6dc", eye: "#ffd166", style: "long", inst: "mic", acc: "none" },
    helloworld: { name: "弦巻 こころ", band: "ハロー、ハッピーワールド！", hair: "#f7d97b", hairD: "#dcb94f", eye: "#6ec3ff", style: "long", inst: "mic", acc: "ribbon" },
    morfonica: { name: "倉田 ましろ", band: "Morfonica", hair: "#e9f0fa", hairD: "#c4d2e6", eye: "#7aa7ff", style: "twin", inst: "violin", acc: "none" },
    raiseasuiten: { name: "レイヤ", band: "RAISE A SUILEN", hair: "#7a5b4a", hairD: "#5d4335", eye: "#ffd166", style: "pony", inst: "bass", acc: "none" },
    mygo: { name: "高松 燈", band: "MyGO!!!!!", hair: "#cfd6e4", hairD: "#a9b3c7", eye: "#ff8fa3", style: "short", inst: "mic", acc: "none" },
    avemujica: { name: "ドロリス（三角 初華）", band: "Ave Mujica", hair: "#f0d78c", hairD: "#d2b45f", eye: "#6c7bff", style: "long", inst: "guitar", acc: "none" },
    yumemita: { name: "仲町 あられ", band: "夢限大みゅーたいぷ", hair: "#ffb3c7", hairD: "#e08ba3", eye: "#ff5f8f", style: "twin", inst: "mic", acc: "ribbon" },
    millsage: { name: "汐見 蛍", band: "millsage", hair: "#f0a8c0", hairD: "#cf89a2", eye: "#7aa7ff", style: "bob", inst: "keyboard", acc: "none" },
    ikkadumb: { name: "須賀 蕾叶", band: "一家Dumb Rock!", hair: "#ff9a3d", hairD: "#d97a24", eye: "#e8426e", style: "short", inst: "guitar", acc: "none" },
  };

  let A = null, cv = null, ctx = null, W = 0, H = 0, PX = 76;
  const SPR = {};
  let state = "idle", platforms = [], cur = 0, camera = { x: 0, y: 0 }, camTarget = { x: 0, y: 0 };
  let power = 0, chargeStart = 0, raf = 0, lastT = 0;
  let jump = null, score = 0, combo = 0, best = 0, charId = "poppinparty";
  let particles = [], popups = [], notes = [], shake = 0, tNow = 0;
  let el = id => document.getElementById(id);
  const store = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch (e) { return d } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } };
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = (a, b) => a + Math.random() * (b - a);

  function iso(p) { return { x: (p.x - p.z) * ISO_X * PX, y: (p.x + p.z) * ISO_Y * PX } }

  function roster() {
    return Object.keys(ROSTER).filter(id => A && A.BMAP[id]).map(id => {
      const c = ROSTER[id], b = A.BMAP[id];
      return { id, name: b.ja, band: b.ja, color: b.color, avatar: "images/chibi/" + (b.slug || id) + ".webp" };
    });
  }
  function preloadSprites() {
    Object.keys(ROSTER).forEach(id => {
      const b = A.BMAP[id]; const url = "images/chibi/" + ((b && b.slug) || id) + ".webp";
      const im = new Image();
      im.onload = () => { SPR[id] = im; if (!raf) draw(0) };
      im.src = url;
    });
  }

  /* ---------------- 平台 ---------------- */
  function makePlatform(x, z) {
    const ids = Object.keys(ROSTER).filter(id => A.BMAP[id]);
    const band = A.BMAP[ids[platforms.length % ids.length]];
    const scale = clamp(1 - score * 0.006, 0.78, 1);
    return { x, z, size: HALF * scale, band, h: 24 + Math.random() * 6 };
  }

  function addNext() {
    const last = platforms[platforms.length - 1];
    const axis = platforms.length % 2 ? "z" : "x";
    const dist = MIN_D + Math.random() * (MAX_D - MIN_D) * (0.55 + score * 0.004);
    const p = axis === "x" ? makePlatform(last.x + dist, last.z) : makePlatform(last.x, last.z - dist);
    p.dist = dist; p.axis = axis;
    platforms.push(p);
  }

  function reset() {
    platforms = [makePlatform(0, 0)];
    cur = 0; score = 0; combo = 0; power = 0; particles = []; popups = []; shake = 0;
    state = "idle"; jump = null;
    camera = iso(platforms[0]); camTarget = { ...camera };
    addNext();
    const s = el("jump-score"); if (s) s.textContent = "0";
    const c = el("jump-combo"); if (c) c.textContent = "";
  }

  function resize() {
    if (!cv) return;
    const rect = cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    W = Math.max(280, Math.round(rect.width));
    H = Math.round(clamp(rect.height || 380, 320, 430));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    ctx = cv.getContext && cv.getContext("2d");
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    PX = clamp(Math.min(W / 6.4, 92), 46, 92);
    makeNotes();
  }

  function makeNotes() {
    notes = [];
    const glyphs = ["♪", "♫", "♬", "♪"];
    for (let i = 0; i < 9; i++) notes.push({
      x: rnd(0, W), y: rnd(0, H), s: rnd(10, 20), v: rnd(6, 16), a: rnd(.12, .32),
      g: glyphs[i % glyphs.length]
    });
  }

  /* ---------------- 绘制工具 ---------------- */
  const screen = p => { const s = iso(p); return { x: s.x - camera.x + W * 0.32, y: s.y - camera.y + H * 0.66 } };
  function shade(hex, amt) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "#999999");
    if (!m) return "#999";
    const f = v => clamp(Math.round(parseInt(v, 16) * (1 + amt)), 0, 255);
    return "rgb(" + f(m[1]) + "," + f(m[2]) + "," + f(m[3]) + ")";
  }

  function drawStage(dt) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#14151d"); g.addColorStop(.5, "#1d1a28"); g.addColorStop(1, "#2a1622");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 两束缓缓摆动的舞台光
    const sway = Math.sin(tNow / 1400) * 0.35;
    [[-0.2, "255,77,125"], [0.75, "123,108,255"]].forEach(([bx, col], i) => {
      const x = W * (bx + 0.25) + Math.sin(tNow / 1600 + i) * W * 0.08;
      const grd = ctx.createLinearGradient(x, 0, x + sway * W, H * 0.75);
      grd.addColorStop(0, "rgba(" + col + ",.16)");
      grd.addColorStop(1, "rgba(" + col + ",0)");
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.moveTo(x - 18, 0); ctx.lineTo(x + 18, 0);
      ctx.lineTo(x + 96 + sway * W, H * 0.8); ctx.lineTo(x - 96 + sway * W, H * 0.8);
      ctx.closePath(); ctx.fill();
    });
    // 漂浮的音符
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    notes.forEach(n => {
      n.y -= n.v * dt / 1000;
      if (n.y < -20) { n.y = H + 10; n.x = rnd(0, W) }
      ctx.font = n.s + "px system-ui,sans-serif";
      ctx.fillStyle = "rgba(255,255,255," + n.a + ")";
      ctx.fillText(n.g, n.x, n.y);
    });
  }

  function drawPlatform(p, isCur) {
    const s = screen(p);
    const hw = p.size * PX * ISO_X, hh = p.size * PX * ISO_Y;
    const top = s.y - p.h, bottom = s.y;
    const color = p.band.color || "#e8426e";
    // 地面阴影
    ctx.beginPath(); ctx.ellipse(s.x, bottom + hh * .2, hw * .9, hh * .5, 0, 0, 7);
    ctx.fillStyle = "rgba(0,0,0,.28)"; ctx.fill();
    // 侧面
    ctx.beginPath();
    ctx.moveTo(s.x - hw, top); ctx.lineTo(s.x, top + hh); ctx.lineTo(s.x, bottom + hh); ctx.lineTo(s.x - hw, bottom);
    ctx.closePath(); ctx.fillStyle = shade(color, -0.44); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(s.x + hw, top); ctx.lineTo(s.x, top + hh); ctx.lineTo(s.x, bottom + hh); ctx.lineTo(s.x + hw, bottom);
    ctx.closePath(); ctx.fillStyle = shade(color, -0.26); ctx.fill();
    // 顶面
    ctx.beginPath();
    ctx.moveTo(s.x, top - hh); ctx.lineTo(s.x + hw, top); ctx.lineTo(s.x, top + hh); ctx.lineTo(s.x - hw, top);
    ctx.closePath();
    const g = ctx.createLinearGradient(s.x - hw, top - hh, s.x + hw, top + hh);
    g.addColorStop(0, shade(color, 0.3)); g.addColorStop(1, shade(color, -0.04));
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = isCur ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.18)";
    ctx.lineWidth = isCur ? 2.5 : 1.2; ctx.stroke();
    // 中心音符
    ctx.beginPath(); ctx.arc(s.x, top, 3.2, 0, 7);
    ctx.fillStyle = "rgba(255,255,255,.8)"; ctx.fill();
    // 光晕
    if (isCur) {
      const gg = ctx.createRadialGradient(s.x, top, 2, s.x, top, hw * 1.6);
      gg.addColorStop(0, "rgba(255,255,255,.15)"); gg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = gg;
      ctx.beginPath(); ctx.ellipse(s.x, top, hw * 1.6, hh * 1.6, 0, 0, 7); ctx.fill();
    }
    if (p.size * PX > 26) {
      ctx.font = "600 " + clamp(p.size * PX * 0.17, 8, 11) + "px system-ui,sans-serif";
      ctx.fillStyle = "rgba(12,13,20,.78)"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(p.band.ja, s.x, top + 1);
    }
  }

  /* ---------------- Q 版小人 ---------------- */
  function drawChibi(x, y, Hpx, ch, opt) {
    const t = opt.t || 0, st = opt.state || "idle";
    const bob = st === "idle" ? Math.sin(t / 430) * 1.5 : 0;
    const sq = st === "charge" ? 1 - power * 0.2 : 1;
    const legH = Hpx * 0.17, bodyH = Hpx * 0.30, headR = Hpx * 0.255;
    const bodyW = Hpx * 0.30;
    const outfit = ch.outfit || "#e8426e";
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.scale(1 / sq, sq);

    // 影子
    ctx.fillStyle = "rgba(0,0,0,.22)";
    ctx.beginPath(); ctx.ellipse(0, 2, bodyW * .85, 4.5, 0, 0, 7); ctx.fill();

    // 腿 + 鞋
    ctx.fillStyle = "#f2d6c8";
    ctx.fillRect(-bodyW * .30, -legH, bodyW * .20, legH);
    ctx.fillRect(bodyW * .10, -legH, bodyW * .20, legH);
    ctx.fillStyle = "#2c2a36";
    ctx.fillRect(-bodyW * .34, -legH * .28, bodyW * .28, legH * .28);
    ctx.fillRect(bodyW * .06, -legH * .28, bodyW * .28, legH * .28);

    // 裙子
    ctx.fillStyle = shade(outfit, -0.22);
    ctx.beginPath();
    ctx.moveTo(-bodyW * .52, -legH);
    ctx.lineTo(bodyW * .52, -legH);
    ctx.lineTo(bodyW * .34, -legH - bodyH * .34);
    ctx.lineTo(-bodyW * .34, -legH - bodyH * .34);
    ctx.closePath(); ctx.fill();

    // 上衣
    ctx.fillStyle = outfit;
    ctx.beginPath();
    ctx.moveTo(-bodyW * .34, -legH - bodyH * .30);
    ctx.quadraticCurveTo(-bodyW * .42, -legH - bodyH, 0, -legH - bodyH);
    ctx.quadraticCurveTo(bodyW * .42, -legH - bodyH, bodyW * .34, -legH - bodyH * .30);
    ctx.closePath(); ctx.fill();

    // 领结
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.beginPath();
    ctx.moveTo(-bodyW * .16, -legH - bodyH + 1.5);
    ctx.lineTo(0, -legH - bodyH + bodyH * .26);
    ctx.lineTo(bodyW * .16, -legH - bodyH + 1.5);
    ctx.closePath(); ctx.fill();

    // 手臂
    ctx.fillStyle = shade(outfit, -0.1);
    ctx.beginPath(); ctx.ellipse(-bodyW * .42, -legH - bodyH * .62, bodyW * .12, bodyH * .3, 0.25, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(bodyW * .42, -legH - bodyH * .60, bodyW * .12, bodyH * .3, -0.4, 0, 7); ctx.fill();

    const headY = -legH - bodyH - headR * .86;

    // 后发
    ctx.fillStyle = ch.hairD;
    ctx.beginPath(); ctx.ellipse(0, headY + headR * .10, headR * 1.08, headR * 1.12, 0, 0, 7); ctx.fill();
    if (ch.style === "long") {
      ctx.beginPath();
      ctx.moveTo(-headR * 1.05, headY + headR * .2);
      ctx.quadraticCurveTo(-headR * 1.15, headY + headR * 1.5, -headR * .5, headY + headR * 1.9);
      ctx.lineTo(headR * .5, headY + headR * 1.9);
      ctx.quadraticCurveTo(headR * 1.15, headY + headR * 1.5, headR * 1.05, headY + headR * .2);
      ctx.closePath(); ctx.fill();
    } else if (ch.style === "twin") {
      [-1, 1].forEach(sign => {
        ctx.beginPath();
        ctx.ellipse(sign * headR * 1.02, headY + headR * .85, headR * .34, headR * .78, sign * 0.18, 0, 7); ctx.fill();
        ctx.fillStyle = ch.hair; ctx.beginPath();
        ctx.ellipse(sign * headR * 1.02, headY + headR * .30, headR * .36, headR * .30, 0, 0, 7); ctx.fill();
        ctx.fillStyle = ch.hairD;
      });
    } else if (ch.style === "pony") {
      ctx.beginPath();
      ctx.ellipse(headR * 1.02, headY + headR * .55, headR * .34, headR * .9, -0.35, 0, 7); ctx.fill();
    }

    // 脸
    ctx.fillStyle = "#fff3ec";
    ctx.beginPath(); ctx.arc(0, headY, headR, 0, 7); ctx.fill();

    // 刘海（只盖上半部，留出脸）
    ctx.fillStyle = ch.hair;
    ctx.beginPath();
    ctx.moveTo(-headR * 1.02, headY - headR * .02);
    ctx.quadraticCurveTo(-headR * 1.05, headY - headR * 1.15, 0, headY - headR * 1.12);
    ctx.quadraticCurveTo(headR * 1.05, headY - headR * 1.15, headR * 1.02, headY - headR * .02);
    ctx.quadraticCurveTo(headR * .62, headY - headR * .30, headR * .30, headY - headR * .10);
    ctx.quadraticCurveTo(0, headY - headR * .34, -headR * .30, headY - headR * .10);
    ctx.quadraticCurveTo(-headR * .62, headY - headR * .30, -headR * 1.02, headY - headR * .02);
    ctx.closePath(); ctx.fill();
    // 侧发
    ctx.beginPath();
    ctx.ellipse(-headR * .96, headY + headR * .30, headR * .17, headR * .42, 0.1, 0, 7); ctx.fill();
    ctx.beginPath();
    ctx.ellipse(headR * .96, headY + headR * .30, headR * .17, headR * .42, -0.1, 0, 7); ctx.fill();

    // 发饰
    if (ch.acc === "star") { ctx.fillStyle = "#ffd166"; star(headR * .74, headY - headR * .70, headR * .24) }
    else if (ch.acc === "ribbon") {
      ctx.fillStyle = "#ff5f8f";
      ctx.beginPath(); ctx.ellipse(-headR * .82, headY - headR * .66, headR * .26, headR * .16, .5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-headR * 1.08, headY - headR * .52, headR * .18, headR * .12, .3, 0, 7); ctx.fill();
      ctx.fillStyle = ch.hair; ctx.beginPath(); ctx.arc(-headR * .95, headY - headR * .60, headR * .07, 0, 7); ctx.fill();
    }

    // 眼睛
    const blink = Math.sin(t / 1900) > 0.965;
    if (blink) {
      ctx.strokeStyle = "#4a3b44"; ctx.lineWidth = 1.8;
      [-headR * .36, headR * .36].forEach(ex => {
        ctx.beginPath(); ctx.moveTo(ex - headR * .13, headY + headR * .16); ctx.lineTo(ex + headR * .13, headY + headR * .16); ctx.stroke();
      });
    } else {
      [-headR * .36, headR * .36].forEach(ex => {
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.ellipse(ex, headY + headR * .18, headR * .185, headR * .245, 0, 0, 7); ctx.fill();
        ctx.fillStyle = ch.eye;
        ctx.beginPath(); ctx.ellipse(ex, headY + headR * .21, headR * .145, headR * .205, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "#2b2230";
        ctx.beginPath(); ctx.ellipse(ex, headY + headR * .22, headR * .075, headR * .12, 0, 0, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.95)";
        ctx.beginPath(); ctx.arc(ex + headR * .05, headY + headR * .10, headR * .05, 0, 7); ctx.fill();
      });
    }
    // 眉
    ctx.strokeStyle = shade(ch.hairD, -0.1); ctx.lineWidth = 1.4;
    [-headR * .36, headR * .36].forEach(ex => {
      ctx.beginPath(); ctx.moveTo(ex - headR * .14, headY - headR * .16); ctx.quadraticCurveTo(ex, headY - headR * .24, ex + headR * .14, headY - headR * .16); ctx.stroke();
    });
    // 腮红 + 嘴
    ctx.fillStyle = "rgba(255,130,160,.42)";
    [-headR * .58, headR * .58].forEach(ex => { ctx.beginPath(); ctx.ellipse(ex, headY + headR * .46, headR * .16, headR * .10, 0, 0, 7); ctx.fill() });
    ctx.strokeStyle = "#a8475f"; ctx.lineWidth = 1.7; ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-headR * .2, headY + headR * .43);
    ctx.quadraticCurveTo(0, headY + headR * .55, headR * .2, headY + headR * .43);
    ctx.stroke();

    // 乐器（画在身体前）
    drawInstrument(ch, bodyW, bodyH, legH);

    ctx.restore();

    function star(cx, cy, r) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI * 2 / 5, a2 = a + Math.PI / 5;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.lineTo(cx + Math.cos(a2) * r * .45, cy + Math.sin(a2) * r * .45);
      }
      ctx.closePath(); ctx.fill();
    }
  }

  function drawInstrument(ch, bodyW, bodyH, legH) {
    const y = -legH - bodyH * .45;
    ctx.save();
    ctx.translate(bodyW * .62, y);
    if (ch.inst === "guitar" || ch.inst === "bass") {
      ctx.rotate(0.5);
      const body = ch.inst === "bass" ? "#8a6a52" : "#f6c453";
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.ellipse(0, 6, 6.4, 6.2, 0, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 14.5, 8, 7.4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "rgba(20,18,26,.35)";
      ctx.beginPath(); ctx.ellipse(1.5, 14, 2.2, 2.8, 0, 0, 7); ctx.fill();
      ctx.fillStyle = "#15161e";
      ctx.fillRect(-6.5, 8, 13, 2.2);
      ctx.strokeStyle = "#e9e2d0"; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.lineTo(0, -21); ctx.stroke();
      ctx.fillStyle = "#d9d3c4";
      ctx.beginPath(); ctx.ellipse(0, -22.5, 2.6, 3.4, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.5)"; ctx.lineWidth = .9;
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(i * 2, 0); ctx.lineTo(i * 2, -19); ctx.stroke() }
    } else if (ch.inst === "mic") {
      ctx.rotate(-0.15);
      ctx.strokeStyle = "#d9dee8"; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(0, 14); ctx.lineTo(0, -16); ctx.stroke();
      ctx.fillStyle = ch.outfit;
      ctx.beginPath(); ctx.arc(0, -18.5, 4.4, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, -18.5, 4.4, 0, 7); ctx.stroke();
    } else if (ch.inst === "keyboard") {
      ctx.rotate(0.35);
      ctx.fillStyle = "#f5f7fc";
      ctx.fillRect(-11, 4, 28, 11);
      ctx.fillStyle = "#1a1b24";
      for (let i = 0; i < 5; i++) ctx.fillRect(-8 + i * 5.2, 7, 2.6, 5);
    } else if (ch.inst === "violin") {
      ctx.rotate(0.4);
      ctx.fillStyle = "#b5793f";
      ctx.beginPath(); ctx.ellipse(0, 8, 6.5, 9, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = "#6b4a2b"; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -20); ctx.stroke();
      ctx.strokeStyle = "#e8dccb"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-6, 10); ctx.lineTo(-14, -6); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlayerSprite(x, y, color) {
    const size = 62;
    const bob = state === "idle" ? Math.sin(tNow / 430) * 1.6 : 0;
    const sq = state === "charge" ? 1 - power * 0.18 : 1;
    const img = SPR[charId];
    let rot = 0;
    if (state === "jump" && jump) rot = Math.sin(jump.t * Math.PI) * 0.18;
    if (state === "fall" && jump) rot = clamp(jump.fallT || 0, 0, 1) * 2.4;
    // 地面光斑
    ctx.globalAlpha = .28;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(x, y + 2, size * .42, 5.5, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(rot);
    ctx.scale(1 / sq, sq);
    if (state === "charge") {
      const ring = 30 + power * 18;
      ctx.strokeStyle = "rgba(255,255,255," + (.25 + power * .55) + ")";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(0, -size / 2, ring, 0, Math.PI * 2); ctx.stroke();
    }
    if (img) {
      ctx.save();
      ctx.beginPath(); ctx.arc(0, -size / 2, size / 2, 0, 7);
      if (ctx.clip) ctx.clip();
      ctx.drawImage(img, -size / 2, -size, size, size);
      ctx.restore();
      ctx.beginPath(); ctx.arc(0, -size / 2, size / 2, 0, 7);
      ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, -size / 2, size / 2 + 3, 0, 7);
      ctx.strokeStyle = color; ctx.globalAlpha = .55; ctx.lineWidth = 2; ctx.stroke(); ctx.globalAlpha = 1;
    } else {
      const ch = ROSTER[charId] || ROSTER.poppinparty;
      drawChibi(0, 0, 58, Object.assign({}, ch, { outfit: color }), { t: tNow, state });
    }
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
      s.y += t * t * 200; s.x += t * 26;
    }
    return s;
  }

  /* ---------------- 粒子 ---------------- */
  function spawn(x, y, n, opt) {
    for (let i = 0; i < n; i++) particles.push({
      x, y, vx: rnd(-1, 1) * (opt.spd || 40), vy: rnd(-1.2, .3) * (opt.spd || 40),
      g: opt.g == null ? 60 : opt.g, life: 0, max: rnd(.45, .9),
      r: rnd(1.6, 3.6), col: Array.isArray(opt.col) ? opt.col[Math.floor(Math.random() * opt.col.length)] : opt.col,
      kind: opt.kind || "dot"
    });
  }
  function updateParticles(dt) {
    const d = dt / 1000;
    particles = particles.filter(p => {
      p.life += d; if (p.life >= p.max) return false;
      p.vy += p.g * d; p.x += p.vx * d; p.y += p.vy * d;
      return true;
    });
  }
  function drawParticles() {
    particles.forEach(p => {
      const a = 1 - p.life / p.max;
      ctx.globalAlpha = a;
      if (p.kind === "note") {
        ctx.font = "12px system-ui,sans-serif"; ctx.fillStyle = p.col;
        ctx.fillText("♪", p.x, p.y);
      } else {
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * a, 0, 7); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  /* ---------------- 主循环 ---------------- */
  function loop(t) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(50, t - lastT); lastT = t; tNow = t;
    if (state === "charge") {
      power = clamp((t - chargeStart) / CHARGE_MS, 0, 1);
      if (Math.random() < 0.25) {
        const s = playerScreen();
        spawn(s.x + rnd(-14, 14), s.y - rnd(4, 26), 1, { col: ["#ff5f8f", "#7b6cff", "#ffd166"], spd: 26, g: -30, kind: "note" });
      }
    }
    if (state === "jump" && jump) {
      jump.t += dt / jump.dur;
      if (Math.random() < 0.5) { const s = playerScreen(); spawn(s.x, s.y - 10, 1, { col: "rgba(255,255,255,.8)", spd: 10, g: 0 }) }
      if (jump.t >= 1) { jump.t = 1; land(); }
    }
    if (state === "fall" && jump) jump.fallT = (jump.fallT || 0) + dt / 520;

    if (platforms[cur]) {
      camTarget = iso(platforms[cur]);
      camera.x = lerp(camera.x, camTarget.x, clamp(dt / 260, 0, .3));
      camera.y = lerp(camera.y, camTarget.y, clamp(dt / 260, 0, .3));
    }
    shake = Math.max(0, shake - dt / 40);
    updateParticles(dt);
    draw(dt);
  }

  function draw(dt) {
    if (!ctx) return;
    drawStage(dt);
    ctx.save();
    if (shake > 0) ctx.translate(rnd(-shake, shake), rnd(-shake, shake) * .6);
    for (let i = 0; i < platforms.length; i++) drawPlatform(platforms[i], i === cur);
    const s = playerScreen();
    const band = A.BMAP[charId];
    drawPlayerSprite(s.x, s.y, band ? band.color : "#e8426e");
    drawParticles();
    ctx.restore();

    if (state === "charge") {
      const bw = W * .44, bx = (W - bw) / 2, by = H - 24;
      ctx.fillStyle = "rgba(255,255,255,.16)"; ctx.fillRect(bx, by, bw, 7);
      const pg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      pg.addColorStop(0, "#ff4d7d"); pg.addColorStop(1, "#7b6cff");
      ctx.fillStyle = pg; ctx.fillRect(bx, by, bw * power, 7);
      ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y - 24, 26 + power * 14, 0, Math.PI * 2 * power); ctx.stroke();
    }
    popups = popups.filter(p => p.t < 1);
    popups.forEach(p => {
      p.t += .018;
      ctx.globalAlpha = 1 - p.t;
      ctx.fillStyle = p.color; ctx.textAlign = "center"; ctx.font = "800 22px system-ui,sans-serif";
      ctx.fillText(p.text, p.x, p.y - p.t * 44);
      ctx.globalAlpha = 1;
    });
  }

  /* ---------------- 判定 ---------------- */
  function land() {
    const next = platforms[cur + 1];
    const s = screen(platforms[cur]);
    if (!jump || !jump.ok) {
      state = "fall"; jump.fallT = 0; combo = 0;
      spawn(s.x, s.y - 20, 18, { col: ["#ff5f8f", "#ffd166", "#fff"], spd: 90, g: 160 });
      setTimeout(gameOver, 520); return;
    }
    cur++;
    shake = 7;
    const gain = jump.perfect ? 2 : 1;
    score += gain + (combo >= 2 ? 1 : 0);
    const ns = screen(platforms[cur]);
    spawn(ns.x, ns.y - 2, jump.perfect ? 22 : 10, { col: jump.perfect ? ["#ffd166", "#ff5f8f", "#7b6cff"] : ["rgba(255,255,255,.8)"], spd: 70, g: 120 });
    if (jump.perfect) {
      combo++;
      popups.push({ x: ns.x, y: ns.y - 70, t: 0, text: combo > 1 ? "完美 ×" + combo : "完美", color: "#ffe9a8" });
    } else combo = 0;
    state = "idle"; jump = null;
    addNext();
    const sc = el("jump-score"); if (sc) sc.textContent = score;
    const cc = el("jump-combo"); if (cc) cc.textContent = combo >= 2 ? "连击 " + combo : "";
    if (score > best) { best = score; save("bdx_jump_best", best); const b = el("jump-best"); if (b) b.textContent = best }
  }

  function gameOver() {
    state = "over"; jump = null;
    const ov = el("jump-overlay");
    if (ov) {
      ov.hidden = false;
      ov.innerHTML = '<div class="jump-result"><b>' + score + '</b><span>本局得分</span><em>最高 ' + best + '</em></div>' +
        '<button class="btn primary" id="jump-start" type="button">再来一局</button>';
      const btn = ov.querySelector("#jump-start");
      if (btn) btn.onclick = start;
    }
  }

  function start() {
    const ov = el("jump-overlay"); if (ov) ov.hidden = true;
    reset(); lastT = performance.now();
    if (!raf) loop(lastT);
  }

  function setCharacter(id) {
    if (!ROSTER[id]) return;
    charId = id; save("bdx_jump_char", id);
    const s = playerScreen();
    spawn(s.x, s.y - 16, 12, { col: ["#ffd166", "#ff5f8f", "#7b6cff", "#fff"], spd: 70, g: 60 });
    draw(16);
  }

  function listCharacters() {
    return roster().map(c => Object.assign({ selected: c.id === charId }, c));
  }

  /* ---------------- 输入 ---------------- */
  function bindInput() {
    if (!cv) return;
    cv.addEventListener("pointerdown", e => { e.preventDefault(); if (state === "idle") { state = "charge"; power = 0; chargeStart = performance.now() } });
    const up = e => {
      e.preventDefault();
      if (state !== "charge") return;
      const next = platforms[cur + 1];
      const d = MIN_D + power * (MAX_D - MIN_D);
      const from = { x: platforms[cur].x, z: platforms[cur].z };
      const to = next.axis === "x" ? { x: from.x + d, z: from.z } : { x: from.x, z: from.z - d };
      jump = {
        from, to, fromH: platforms[cur].h, toH: next.h,
        t: 0, dur: 230 + power * 220, height: 44 + power * 56,
        ok: Math.abs(d - next.dist) <= next.size + .06,
        perfect: false, fallT: 0
      };
      jump.perfect = jump.ok && Math.abs(d - next.dist) <= Math.max(.09, next.size * .2);
      state = "jump";
      const s = playerScreen();
      spawn(s.x, s.y, 8, { col: ["rgba(255,255,255,.85)"], spd: 50, g: 120 });
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    window.addEventListener("keydown", e => {
      if (e.code === "Space" && !e.repeat && document.activeElement === document.body) { e.preventDefault(); cv.dispatchEvent(new Event("pointerdown")) }
    });
    window.addEventListener("keyup", e => { if (e.code === "Space") cv.dispatchEvent(new Event("pointerup")) });
    window.addEventListener("resize", resize);
  }

  function init(api) {
    A = api;
    cv = el("jump-canvas");
    best = store("bdx_jump_best", 0);
    charId = store("bdx_jump_char", "poppinparty");
    if (!ROSTER[charId]) charId = "poppinparty";
    const b = el("jump-best"); if (b) b.textContent = best;
    if (!cv) return;
    preloadSprites();
    resize(); bindInput(); reset(); draw(0);
    const ov = el("jump-overlay");
    if (ov) {
      ov.hidden = false;
      ov.innerHTML = '<div class="jump-tip">按住蓄力，松开起跳</div><button class="btn primary" id="jump-start" type="button">开始游戏</button>';
      const btn = ov.querySelector("#jump-start");
      if (btn) btn.onclick = start;
    }
  }

  window.JumpGame = { init, start, setCharacter, listCharacters, refresh: () => { resize(); draw(0) } };
})();
