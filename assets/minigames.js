/* 两个动作类小游戏：节奏点点（四轨打歌）与接住音符（拖拽接物）
   全部用 Canvas + WebAudio 实时生成，无图片/音频素材，不涉及版权。 */
(function () {
  "use strict";
  let A = null;
  const $ = id => document.getElementById(id);
  const store = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch (e) { return d } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------- 音频（合成节拍与音效） ---------------- */
  let AC = null;
  function ac() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)() } catch (e) { AC = null } }
    if (AC && AC.state === "suspended") AC.resume().catch(() => { });
    return AC;
  }
  function blip(freq, dur, vol, type) {
    const c = ac(); if (!c) return;
    const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine"; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || .08, t + .01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (dur || .12));
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + (dur || .12) + .02);
  }
  function kick() { blip(120, .18, .12, "sine") }
  function hat() { blip(6000, .05, .04, "square") }

  /* ---------------- 通用画布 ---------------- */
  function setupCanvas(cv) {
    if (!cv || !cv.parentElement) return null;
    const rect = cv.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const W = Math.max(280, Math.round(rect.width || 320));
    const H = Math.round(clamp(rect.height || 360, 300, 420));
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + "px"; cv.style.height = H + "px";
    const ctx = cv.getContext && cv.getContext("2d");
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, W, H };
  }
  function sprite() {
    let img = window.__chibiImg;
    if (!img) {
      img = new Image(); img.src = "images/chibi2/01.webp";
      img.onload = () => { window.__chibiImg = img };
    }
    const id = store("bdx_jump_char", "c01");
    const num = String(id || "c01").replace(/\D/g, "").padStart(2, "0");
    const d = document.createElement("canvas");
    return { img, src: "images/chibi2/" + (num || "01") + ".webp" };
  }

  /* ---------------- 节奏点点 ---------------- */
  const rhythm = {
    cv: null, ctx: null, W: 0, H: 0, raf: 0, last: 0,
    lanes: 4, notes: [], t: 0, beat: 0, speed: 260, score: 0, combo: 0, best: 0,
    lives: 10, running: false, nextSpawn: 0, started: 0, hitFlash: [0, 0, 0, 0], missFlash: 0,
    bpm: 128,
  };

  function rhythmInit() {
    const cv = $("rhythm-canvas"); if (!cv) return;
    const s = setupCanvas(cv); if (!s) return;
    rhythm.cv = cv; rhythm.ctx = s.ctx; rhythm.W = s.W; rhythm.H = s.H;
    rhythm.best = store("bdx_rhythm_best", 0);
    const b = $("rhythm-best"); if (b) b.textContent = rhythm.best;
    rhythmDraw();
  }

  function rhythmStart() {
    const ov = $("rhythm-overlay"); if (ov) ov.hidden = true;
    Object.assign(rhythm, { notes: [], t: 0, beat: 0, score: 0, combo: 0, lives: 10, running: true, nextSpawn: 0, started: 0 });
    const sc = $("rhythm-score"); if (sc) sc.textContent = "0";
    ac(); rhythm.last = performance.now(); rhythm.started = rhythm.last;
    if (!rhythm.raf) rhythmLoop(rhythm.last);
  }

  function rhythmLoop(t) {
    rhythm.raf = requestAnimationFrame(rhythmLoop);
    const dt = Math.min(60, t - rhythm.last); rhythm.last = t;
    if (!rhythm.running) { rhythmDraw(); return }
    rhythm.t += dt;
    const beatMs = 60000 / rhythm.bpm;
    // 每拍生成 1~2 个音符
    if (rhythm.t >= rhythm.nextSpawn) {
      const k = Math.random() < .35 ? 2 : 1;
      for (let i = 0; i < k; i++) {
        rhythm.notes.push({ lane: Math.floor(Math.random() * rhythm.lanes), y: -20, hit: false, dead: false });
      }
      rhythm.nextSpawn = rhythm.t + beatMs * rnd(.85, 1.15);
      rhythm.beat++;
      if (rhythm.beat % 2 === 1) kick(); else hat();
      rhythm.speed = 240 + Math.min(180, rhythm.beat * 2);
    }
    const dtSec = dt / 1000;
    const line = rhythm.H - 78;
    rhythm.notes.forEach(n => {
      n.y += rhythm.speed * dtSec;
      if (!n.hit && n.y > line + 54) { n.dead = true; rhythmMiss() }
    });
    rhythm.notes = rhythm.notes.filter(n => !n.dead);
    rhythm.hitFlash = rhythm.hitFlash.map(v => Math.max(0, v - dt / 160));
    rhythm.missFlash = Math.max(0, rhythm.missFlash - dt / 200);
    rhythmDraw();
  }

  function rhythmMiss() {
    rhythm.combo = 0; rhythm.lives--; rhythm.missFlash = 1;
    const lv = $("rhythm-lives"); if (lv) lv.textContent = "♥".repeat(Math.max(0, rhythm.lives));
    if (rhythm.lives <= 0) rhythmEnd();
  }

  function rhythmTap(lane) {
    if (!rhythm.running) return;
    const line = rhythm.H - 78;
    let bestNote = null, bestDist = 1e9;
    rhythm.notes.forEach(n => {
      if (n.hit || n.lane !== lane) return;
      const d = Math.abs(n.y - line);
      if (d < bestDist) { bestDist = d; bestNote = n }
    });
    rhythm.hitFlash[lane] = 1;
    if (bestNote && bestDist <= 46) {
      bestNote.hit = true; bestNote.dead = true;
      const perfect = bestDist <= 18;
      rhythm.combo++;
      const gain = (perfect ? 100 : 50) + rhythm.combo * 2;
      rhythm.score += gain;
      blip(perfect ? 1320 : 880, .1, .1, "triangle");
      popText(lane, perfect ? "PERFECT" : "GOOD", perfect ? "#ffe9a8" : "#d9e6ff");
      const sc = $("rhythm-score"); if (sc) sc.textContent = rhythm.score;
      const cb = $("rhythm-combo"); if (cb) cb.textContent = rhythm.combo >= 3 ? "COMBO " + rhythm.combo : "";
    } else {
      rhythm.combo = 0;
      const cb = $("rhythm-combo"); if (cb) cb.textContent = "";
      blip(180, .08, .06, "sawtooth");
    }
  }

  let pops = [];
  function popText(lane, text, color) {
    const laneW = rhythm.W / rhythm.lanes;
    pops.push({ x: laneW * (lane + .5), y: rhythm.H - 96, text, color, life: 0, max: .6 });
  }

  function rhythmEnd() {
    rhythm.running = false;
    if (rhythm.score > rhythm.best) { rhythm.best = rhythm.score; save("bdx_rhythm_best", rhythm.best); const b = $("rhythm-best"); if (b) b.textContent = rhythm.best }
    const ov = $("rhythm-overlay");
    if (ov) {
      ov.hidden = false;
      ov.innerHTML = '<div class="jump-result"><b>' + rhythm.score + '</b><span>本局得分</span><em>最高 ' + rhythm.best + '</em></div>' +
        '<button class="btn primary" id="rhythm-start" type="button">再来一次</button>';
      const b = ov.querySelector("#rhythm-start"); if (b) b.onclick = rhythmStart;
    }
  }

  function rhythmDraw() {
    const c = rhythm.ctx; if (!c) return;
    const W = rhythm.W, H = rhythm.H;
    c.fillStyle = "#14151d"; c.fillRect(0, 0, W, H);
    const laneW = W / rhythm.lanes;
    // 轨道
    for (let i = 0; i < rhythm.lanes; i++) {
      const x = laneW * i;
      c.fillStyle = i % 2 ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.055)";
      c.fillRect(x, 0, laneW, H);
      if (rhythm.hitFlash[i] > 0) {
        c.fillStyle = "rgba(255,107,147," + (rhythm.hitFlash[i] * .22) + ")";
        c.fillRect(x, H - 120, laneW, 120);
      }
    }
    // 判定线
    const line = H - 78;
    c.strokeStyle = "rgba(255,255,255,.55)"; c.lineWidth = 3;
    c.beginPath(); c.moveTo(0, line); c.lineTo(W, line); c.stroke();
    // 音符
    rhythm.notes.forEach(n => {
      const x = laneW * (n.lane + .5), y = n.y;
      c.fillStyle = "#ff6b93";
      c.beginPath(); c.arc(x, y, 14, 0, 7); c.fill();
      c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = "800 15px system-ui,sans-serif"; c.fillText("♪", x, y + 1);
    });
    // 飘字
    pops = pops.filter(p => p.life < p.max);
    pops.forEach(p => {
      p.life += .016;
      c.globalAlpha = 1 - p.life / p.max;
      c.fillStyle = p.color; c.font = "800 15px system-ui,sans-serif"; c.textAlign = "center";
      c.fillText(p.text, p.x, p.y - p.life * 50);
      c.globalAlpha = 1;
    });
    if (rhythm.missFlash > 0) { c.fillStyle = "rgba(255,60,90," + rhythm.missFlash * .12 + ")"; c.fillRect(0, 0, W, H) }
  }

  /* ---------------- 接住音符 ---------------- */
  const cat = {
    cv: null, ctx: null, W: 0, H: 0, raf: 0, last: 0, running: false,
    x: 0, targetX: 0, items: [], score: 0, lives: 5, best: 0, spawnT: 0, speed: 120, held: false,
  };
  function catchInit() {
    const cv = $("catch-canvas"); if (!cv) return;
    const s = setupCanvas(cv); if (!s) return;
    cat.cv = cv; cat.ctx = s.ctx; cat.W = s.W; cat.H = s.H;
    cat.x = s.W / 2; cat.targetX = cat.x;
    cat.best = store("bdx_catch_best", 0);
    const b = $("catch-best"); if (b) b.textContent = cat.best;
    catchDraw();
  }
  function catchStart() {
    const ov = $("catch-overlay"); if (ov) ov.hidden = true;
    Object.assign(cat, { items: [], score: 0, lives: 5, spawnT: 0, speed: 120, running: true });
    cat.x = cat.W / 2; cat.targetX = cat.x;
    const sc = $("catch-score"); if (sc) sc.textContent = "0";
    const lv = $("catch-lives"); if (lv) lv.textContent = "♥♥♥♥♥";
    cat.last = performance.now();
    if (!cat.raf) catchLoop(cat.last);
  }
  function catchLoop(t) {
    cat.raf = requestAnimationFrame(catchLoop);
    const dt = Math.min(60, t - cat.last); cat.last = t;
    if (!cat.running) { catchDraw(); return }
    const dtSec = dt / 1000;
    cat.speed += dtSec * 6;
    cat.spawnT += dtSec;
    if (cat.spawnT > Math.max(.42, .95 - cat.score * .006)) {
      cat.spawnT = 0;
      const star = Math.random() < .14;
      cat.items.push({ x: rnd(26, cat.W - 26), y: -20, r: star ? 13 : 11, star, vy: cat.speed * rnd(.85, 1.25) });
    }
    cat.x += (cat.targetX - cat.x) * Math.min(1, dtSec * 12);
    const catY = cat.H - 54;
    cat.items.forEach(it => {
      it.y += it.vy * dtSec;
      if (!it.dead && it.y > catY - 26 && it.y < catY + 30 && Math.abs(it.x - cat.x) < 34) {
        it.dead = true;
        cat.score += it.star ? 100 : 20;
        blip(it.star ? 1568 : 880, .09, .09, "triangle");
        const sc = $("catch-score"); if (sc) sc.textContent = cat.score;
      }
      if (!it.dead && it.y > cat.H + 20) { it.dead = true; catchMiss() }
    });
    cat.items = cat.items.filter(i => !i.dead);
    catchDraw();
  }
  function catchMiss() {
    cat.lives--;
    const lv = $("catch-lives"); if (lv) lv.textContent = "♥".repeat(Math.max(0, cat.lives));
    blip(150, .12, .07, "sawtooth");
    if (cat.lives <= 0) catchEnd();
  }
  function catchEnd() {
    cat.running = false;
    if (cat.score > cat.best) { cat.best = cat.score; save("bdx_catch_best", cat.best); const b = $("catch-best"); if (b) b.textContent = cat.best }
    const ov = $("catch-overlay");
    if (ov) {
      ov.hidden = false;
      ov.innerHTML = '<div class="jump-result"><b>' + cat.score + '</b><span>本局得分</span><em>最高 ' + cat.best + '</em></div>' +
        '<button class="btn primary" id="catch-start" type="button">再来一次</button>';
      const b = ov.querySelector("#catch-start"); if (b) b.onclick = catchStart;
    }
  }
  function catchDraw() {
    const c = cat.ctx; if (!c) return;
    const W = cat.W, H = cat.H;
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#151a24"); g.addColorStop(.6, "#1d1a28"); g.addColorStop(1, "#2a1622");
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    // 背景音符
    c.globalAlpha = .12; c.fillStyle = "#fff"; c.font = "20px system-ui";
    for (let i = 0; i < 8; i++) c.fillText("♪", ((i * 97) % W), ((i * 71 + performance.now() * .02) % H));
    c.globalAlpha = 1;
    // 物品
    cat.items.forEach(it => {
      c.beginPath(); c.arc(it.x, it.y, it.r, 0, 7);
      c.fillStyle = it.star ? "#ffd166" : "#ff6b93"; c.fill();
      c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle";
      c.font = "800 " + (it.r + 2) + "px system-ui"; c.fillText(it.star ? "★" : "♪", it.x, it.y + 1);
    });
    // 底栏提示带
    c.fillStyle = "rgba(255,255,255,.06)"; c.fillRect(0, H - 90, W, 90);
    // 角色
    const size = 64;
    c.save(); c.translate(cat.x, H - 40); c.scale(-1, 1);
    if (window.__chibiImg) c.drawImage(window.__chibiImg, -size / 2, -size, size, size);
    c.restore();
    if (window.__chibiImg === undefined || !window.__chibiImg) {
      c.beginPath(); c.arc(cat.x, H - 58, 18, 0, 7); c.fillStyle = "#e8426e"; c.fill();
      c.fillStyle = "#fff"; c.font = "800 18px system-ui"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText("♪", cat.x, H - 57);
    }
  }

  /* ---------------- 入口 ---------------- */
  function init(api) {
    A = api;
    if (!window.__chibiImg) { const im = new Image(); im.src = "images/chibi2/" + (store("bdx_jump_char", "c01") + "").replace(/\D/g, "").padStart(2, "0") + ".webp"; im.onload = () => { window.__chibiImg = im } }
    rhythmInit(); catchInit();
    bind();
  }
  function bind() {
    const cv = $("rhythm-canvas");
    if (cv) {
      const onTap = e => {
        if (!rhythm.running) { rhythmStart(); return }
        const rect = cv.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        rhythmTap(clamp(Math.floor(x / (rhythm.W / rhythm.lanes)), 0, 3));
      };
      cv.addEventListener("pointerdown", e => { e.preventDefault(); onTap(e) });
      cv.addEventListener("touchstart", e => { e.preventDefault(); onTap(e) }, { passive: false });
    }
    const rb = $("rhythm-start");
    if (rb) rb.onclick = rhythmStart;
    const cvc = $("catch-canvas");
    if (cvc) {
      const move = e => {
        const rect = cvc.getBoundingClientRect();
        const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
        cat.targetX = clamp(x, 20, cat.W - 20);
      };
      cvc.addEventListener("pointerdown", e => { e.preventDefault(); if (!cat.running) { catchStart(); return } move(e) });
      cvc.addEventListener("pointermove", e => { if (cat.running) move(e) });
      cvc.addEventListener("touchmove", e => { e.preventDefault(); if (cat.running) move(e) }, { passive: false });
    }
    const cb = $("catch-start");
    if (cb) cb.onclick = catchStart;
    window.addEventListener("resize", () => { rhythmInit(); catchInit() });
  }
  function render() { rhythmInit(); catchInit() }
  window.MiniGames = { init, render };
})();
