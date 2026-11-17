/* 邦多利「玩」模块：梗图卡 + 梗图生成器 + 两个小游戏
   全部基于站内已有数据与官方立绘，不引用第三方搬运图。 */
(function () {
  "use strict";
  let A = null;            // app 传进来的数据与工具
  let built = false;

  /* ---------------- 梗图卡（社区流传梗 + 出处） ---------------- */
  const MEMES = [
    {
      band: "mygo", line: "為什麼要演奏春日影！", cn: "なんで春日影やったの！？",
      note: "《BanG Dream! It's MyGO!!!!!》第 7 話，長崎そよ 在 Live 后崩溃的名台词，也是全剧最有名的截图来源。",
      big: true,
    },
    {
      band: "mygo", line: "我什麼都願意做", cn: "なんでもするから",
      note: "同一話里 そよ 的另一句名台词，被网友用来形容「为了乐队什么都肯做」的执念。",
    },
    {
      band: "mygo", line: "え？", cn: "（Anon 的万能反应）",
      note: "千早愛音 在动画里高频出现的「え？」，因为过于好用，成了 MyGO 观众的标准反应图。",
    },
    {
      band: "hello-happy-world", line: "米歇爾裡面是美咲", cn: "ミッシェルの正体",
      note: "ハロー、ハッピーワールド！ 的吉祥物熊「米歇爾」，里面其实是一直在打工的 奥沢美咲。",
    },
    {
      band: "poppinparty", line: "キラキラ、ドキドキ", cn: "kirakira dokidoki",
      note: "戸山香澄 的口头禅。Poppin'Party 的一切都从这句话开始，也成了整个企划的关键词。",
    },
    {
      band: "poppinparty", line: "有咲的傲嬌", cn: "ツンデレ担当",
      note: "市ヶ谷有咲 嘴上嫌弃、行动上最上心，「不是傲娇是本人」已经是 Poppin'Party 的固定笑点。",
    },
  ];

  const TEMPLATES = [
    { id: "nobody", label: "没有人：/ 我：", text: "没有人：\n我：又在听邦多利" },
    { id: "band", label: "这就是邦多利", text: "这就是邦多利" },
    { id: "kira", label: "kirakira", text: "キラキラ、ドキドキ" },
    { id: "loop", label: "今天也在循环", text: "今天也在循环\n同一首" },
    { id: "custom", label: "自己写", text: "" },
  ];

  /* ---------------- 工具 ---------------- */
  const $ = s => document.querySelector(s);
  const esc = s => A.esc(s);
  const store = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v } catch (e) { return d } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } };
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a };

  /* ---------------- 渲染入口 ---------------- */
  function init(api) {
    A = api;
    ensureMarkup();
    built = true;
    renderMemes();
    draw();
    newGuess();
    newMember();
  }
  function render(force) {
    if (!A) return;
    if (!built || force) { ensureMarkup(); renderMemes(); }
    if (force && window.JumpGame && window.JumpGame.refresh) window.JumpGame.refresh();
  }

  window.addEventListener("jump-chibis-ready", () => { if (built) renderJumpChars(); });

  function renderJumpChars() {
    const box = document.getElementById("jump-chars");
    if (!box || !window.JumpGame) return;
    const chars = window.JumpGame.listCharacters();
    box.innerHTML = '<span class="cl">角色</span>' + chars.map(c =>
      '<button class="chip jchip" data-id="' + c.id + '" aria-pressed="' + (c.selected ? "true" : "false") +
      '" style="--bc:' + c.color + '"><img class="cimg" src="' + c.avatar + '" alt="" loading="lazy" decoding="async">' + esc(c.name) + '</button>').join("");
    box.onclick = e => {
      const b = e.target.closest(".jchip");
      if (!b) return;
      window.JumpGame.setCharacter(b.dataset.id);
      box.querySelectorAll(".jchip").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    };
  }

  function ensureMarkup() {
    const view = document.getElementById("v-play");
    if (!view || view.dataset.built === "1") return;
    view.dataset.built = "1";
    view.innerHTML =
      '<div class="sech" style="margin-top:14px"><h2>邦多利梗图</h2><p>官方立绘 + 社区流传的台词，点卡片下载</p></div>' +
      '<div class="memegrid" id="memegrid"></div>' +
      '<div class="panel memegen" id="memegen">' +
      '<h3>梗图生成器 <span class="sm">选乐队 → 选模板 → 改文字 → 下载 PNG</span></h3>' +
      '<div class="gen-row" id="gen-bands"></div>' +
      '<div class="gen-row" id="gen-tpl"></div>' +
      '<textarea id="gen-text" rows="2" maxlength="60" placeholder="写两句…"></textarea>' +
      '<div class="gen-acts"><canvas id="gen-canvas" width="900" height="900"></canvas>' +
      '<div class="gen-btns"><button class="btn primary" id="gen-dl">下载梗图</button>' +
      '<button class="btn" id="gen-rand">换一张底图</button>' +
      '<p class="gen-hint">底图为站内官方立绘；文字与排版是本站自制。</p></div></div>' +
      '</div>' +
      '<div class="sech" style="margin-top:22px"><h2>小游戏</h2><p>用这份图鉴出的题，答错不扣分</p></div>' +
      '<div class="game" id="game-guess"></div>' +
      '<div class="game" id="game-member"></div>' +
      '<div class="game" id="game-jump">' +
      '<div class="ghead"><div><h3>邦多利跳一跳</h3><p>按住蓄力，松开起跳；落在方块中心触发「完美」</p></div>' +
      '<div class="gscore"><b id="jump-best">0</b><span>最高分</span></div>' +
      '<button class="sbtn" id="jump-mute" type="button" style="margin-left:8px">🔊 音效开</button>' +
      '<button class="sbtn" id="jump-sfx-test" type="button" style="margin-left:6px">试听</button></div>' +
      '<div class="jump-chars" id="jump-chars"></div>' +
      '<div class="jumpwrap">' +
      '<canvas id="jump-canvas" aria-label="跳一跳游戏区"></canvas>' +
      '<div class="jump-hud"><span class="jscore" id="jump-score">0</span><span class="jcombo" id="jump-combo"></span></div>' +
      '<div class="jump-overlay" id="jump-overlay"></div>' +
      '</div>' +
      '<p class="jump-credit">角色抠图：抖音 @荆门交运迷 · 仅作粉丝向展示</p>' +
      '</div>';
    bindGenerator();
    bindGames();
    if (window.JumpGame) {
      window.JumpGame.init(A);
      renderJumpChars();
    }
    else {
      const ov = document.getElementById("jump-overlay");
      if (ov) ov.innerHTML = '<div class="jump-tip">游戏脚本没加载成功，刷新页面试试</div>';
    }
  }

  /* ---------------- 梗图卡 ---------------- */
  function memeCard(m, i) {
    const b = A.BMAP[m.band] || { ja: m.band, color: "#999" };
    const img = A.imgOf(b);
    return '<button class="memecard' + (m.big ? " big" : "") + '" data-meme="' + i + '" style="--bc:' + b.color + '">' +
      '<img src="' + img + '" alt="' + esc(b.ja) + '" loading="lazy" decoding="async">' +
      '<span class="memeshade"></span>' +
      '<span class="memelabel">' + esc(m.line) + '</span>' +
      '<span class="memecn">' + esc(m.cn) + '</span>' +
      '<span class="memeband">' + esc(b.ja) + '</span></button>';
  }
  function selectBand(id) {
    gen.band = id;
    const box = $("#gen-bands");
    if (box) box.querySelectorAll(".gband").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.band === id)));
  }
  function renderMemes() {
    const box = $("#memegrid"); if (!box) return;
    box.innerHTML = MEMES.map(memeCard).join("");
    box.onclick = e => {
      const card = e.target.closest(".memecard");
      if (!card) return;
      const m = MEMES[+card.dataset.meme];
      selectBand(m.band);
      $("#gen-text").value = m.line;
      showNote(m);
      draw();
      $("#memegen").scrollIntoView({ block: "center", behavior: "smooth" });
    };
  }
  function showNote(m) {
    const old = $("#memenote");
    if (old) old.remove();
    const el = document.createElement("div");
    el.id = "memenote"; el.className = "memenote";
    el.innerHTML = "<b>" + esc(m.line) + "</b><span>" + esc(m.note) + "</span>";
    $("#memegen").before(el);
    setTimeout(() => el.remove(), 8000);
  }

  /* ---------------- 生成器 ---------------- */
  const gen = { band: "poppinparty", text: "" };
  function bindGenerator() {
    const bands = $("#gen-bands");
    bands.innerHTML = '<span class="cl">底图</span>' + A.BANDS.filter(b => b.slug).map(b =>
      '<button class="chip gband" data-band="' + b.id + '" aria-pressed="' + (b.id === gen.band) + '" style="--bc:' + b.color + '">' + esc(b.ja) + '</button>').join("");
    const tpl = $("#gen-tpl");
    tpl.innerHTML = '<span class="cl">模板</span>' + TEMPLATES.map(t =>
      '<button class="chip gtpl" data-tpl="' + t.id + '" aria-pressed="false">' + esc(t.label) + '</button>').join("");
    bands.onclick = e => {
      const b = e.target.closest(".gband"); if (!b) return;
      selectBand(b.dataset.band);
      draw();
    };
    tpl.onclick = e => {
      const t = e.target.closest(".gtpl"); if (!t) return;
      const item = TEMPLATES.find(x => x.id === t.dataset.tpl);
      tpl.querySelectorAll(".gtpl").forEach(x => x.setAttribute("aria-pressed", String(x === t)));
      if (item && item.text) $("#gen-text").value = item.text;
      draw();
    };
    const text = $("#gen-text");
    text.addEventListener("input", () => { clearTimeout(text._t); text._t = setTimeout(draw, 150) });
    $("#gen-rand").onclick = () => { selectBand(pick(A.BANDS.filter(b => b.slug)).id); draw() };
    $("#gen-dl").onclick = download;
    text.value = TEMPLATES[0].text;
    draw();
  }

  const imgCache = {};
  function loadImg(url) {
    if (imgCache[url]) return Promise.resolve(imgCache[url]);
    return new Promise((res, rej) => {
      const im = new Image();
      im.crossOrigin = "anonymous";
      im.onload = () => { imgCache[url] = im; res(im) };
      im.onerror = rej;
      im.src = url;
    });
  }

  function draw() {
    const cv = $("#gen-canvas"); if (!cv) return;
    let ctx = null;
    try { ctx = cv.getContext && cv.getContext("2d") } catch (e) { ctx = null }
    if (!ctx) return;
    const b = A.BMAP[gen.band] || { ja: "", color: "#999" };
    const url = A.imgOf(b) || "images/poppinparty.webp";
    const text = ($("#gen-text").value || "").trim();
    const W = cv.width, H = cv.height;
    ctx.fillStyle = "#15161e"; ctx.fillRect(0, 0, W, H);
    const render = im => {
      const s = Math.max(W / im.width, H / im.height);
      const w = im.width * s, h = im.height * s;
      ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
      // 上下的暗角，保证文字可读
      const g1 = ctx.createLinearGradient(0, 0, 0, H * 0.34);
      g1.addColorStop(0, "rgba(10,11,18,.82)"); g1.addColorStop(1, "rgba(10,11,18,0)");
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H * 0.34);
      const g2 = ctx.createLinearGradient(0, H, 0, H * 0.62);
      g2.addColorStop(0, "rgba(10,11,18,.86)"); g2.addColorStop(1, "rgba(10,11,18,0)");
      ctx.fillStyle = g2; ctx.fillRect(0, H * 0.62, W, H * 0.38);
      const lines = text ? text.split(/\n/).slice(0, 3) : [];
      const fs = lines.length > 1 ? 54 : 60;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = "800 " + fs + "px system-ui,-apple-system,'PingFang SC','Noto Sans SC',sans-serif";
      ctx.lineWidth = 10; ctx.strokeStyle = "rgba(0,0,0,.55)";
      ctx.fillStyle = "#fff";
      const top = 0.2, bottom = 0.82;
      lines.forEach((ln, i) => {
        const y = lines.length === 1 ? H * 0.5 : (i === 0 ? H * top : H * bottom);
        ctx.strokeText(ln, W / 2, y, W - 80);
        ctx.fillText(ln, W / 2, y, W - 80);
      });
      if (b.ja) {
        ctx.font = "600 26px system-ui,sans-serif";
        ctx.fillStyle = "rgba(255,255,255,.62)";
        ctx.textAlign = "left";
        ctx.fillText(b.ja + " · 邦多利图鉴", 36, H - 34);
      }
    };
    loadImg(url).then(render).catch(() => { });
  }

  function download() {
    const cv = $("#gen-canvas"); if (!cv) return;
    if (!cv.toBlob) { A.tip("这个浏览器不支持导出"); return }
    cv.toBlob(blob => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "邦多利梗图.png";
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500);
      A.tip("已生成梗图");
    }, "image/png");
  }

  /* ---------------- 小游戏 ---------------- */
  const games = {
    guess: { song: null, opts: [], answered: false, score: 0, streak: 0 },
    member: { m: null, band: null, opts: [], answered: false, score: 0, streak: 0 },
  };

  function bindGames() {
    $("#game-guess").innerHTML = gameShell("猜歌名", "看乐队、年份和专辑，从四个选项里挑出正确曲名", "guess");
    $("#game-member").innerHTML = gameShell("这是哪支乐队的？", "给出成员名、担当和 CV，选出所属乐队", "member");
    $("#game-guess").addEventListener("click", e => {
      const opt = e.target.closest("[data-go]");
      if (opt) answerGuess(opt.dataset.go);
      if (e.target.closest("#guess-next")) newGuess();
      if (e.target.closest("#guess-hint")) toggleHint();
      return;
    });
    $("#game-member").addEventListener("click", e => {
      const opt = e.target.closest("[data-mo]");
      if (opt) answerMember(opt.dataset.mo);
      if (e.target.closest("#member-next")) newMember();
    });
  }

  function gameShell(title, sub, key) {
    const g = games[key];
    return '<div class="ghead"><div><h3>' + esc(title) + '</h3><p>' + esc(sub) + '</p></div>' +
      '<div class="gscore"><b id="' + key + '-streak">0</b><span>连对</span><b id="' + key + '-score">0</b><span>得分</span></div></div>' +
      '<div id="' + key + '-body"></div>';
  }

  function updateScores() {
    ["guess", "member"].forEach(k => {
      const s = document.getElementById(k + "-streak"), sc = document.getElementById(k + "-score");
      if (s) s.textContent = games[k].streak;
      if (sc) sc.textContent = games[k].score;
    });
  }

  function newGuess() {
    const g = games.guess;
    const pool = A.SONGS.filter(s => s.t && s.t.length >= 2);
    g.song = pick(pool);
    const others = shuffle(A.SONGS.filter(s => s.t !== g.song.t)).slice(0, 3);
    g.opts = shuffle([g.song].concat(others));
    g.answered = false;
    const b = A.BMAP[g.song.b] || { ja: g.song.b, color: "#999" };
    $("#guess-body").innerHTML =
      '<div class="qcard">' +
      '<div class="qhint"><span class="qdot" style="background:' + b.color + '"></span>' + esc(b.ja) +
      '<span class="qsep">·</span>' + A.fmt(g.song.d) +
      '<span class="qsep">·</span>' + (A.KIND[g.song.k || "orig"] ? A.KIND[g.song.k || "orig"][0] : g.song.k) +
      '</div>' +
      (g.song.al ? '<div class="qline">专辑：' + esc(g.song.al) + '</div>' : '') +
      '<div class="qline dim" id="guess-hintbox" hidden>首字母：' + esc(g.song.t.slice(0, 1) + "…") + '　字数：' + g.song.t.length + '</div>' +
      '</div>' +
      '<div class="opts">' + g.opts.map(s =>
        '<button class="opt" data-go="' + esc(s.t) + '">' + esc(s.t) + '</button>').join("") + '</div>' +
      '<div class="gfoot"><button class="btn" id="guess-hint">看提示</button><span class="gmsg" id="guess-msg"></span></div>';
  }

  function toggleHint() { const h = $("#guess-hintbox"); if (h) h.hidden = !h.hidden }

  function answerGuess(title) {
    const g = games.guess;
    if (g.answered) return;
    g.answered = true;
    const ok = title === g.song.t;
    g.score += ok ? 10 : 0; g.streak = ok ? g.streak + 1 : 0;
    $("#guess-body").querySelectorAll(".opt").forEach(el => {
      const t = el.dataset.go;
      if (t === g.song.t) el.classList.add("right");
      else if (t === title) el.classList.add("wrong");
      el.disabled = true;
    });
    const msg = $("#guess-msg");
    if (msg) msg.innerHTML = ok ? "✅ 对了" : "❌ 是《" + esc(g.song.t) + "》";
    const foot = $("#guess-body .gfoot");
    if (foot) foot.insertAdjacentHTML("beforeend",
      '<button class="btn primary" id="guess-next">下一题</button>' +
      (g.song.sid ? '<a class="btn" href="https://music.163.com/song?id=' + g.song.sid + '" target="_blank" rel="noopener">去听 ↗</a>' : ''));
    updateScores();
    save("bdx_guess_best", Math.max(g.score, store("bdx_guess_best", 0)));
  }

  function newMember() {
    const g = games.member;
    const withMembers = A.BANDS.filter(b => (b.members || []).length);
    const b = pick(withMembers);
    g.band = b;
    g.m = pick(b.members);
    const others = shuffle(A.BANDS.filter(x => x.id !== b.id)).slice(0, 3);
    g.opts = shuffle([b].concat(others));
    g.answered = false;
    $("#member-body").innerHTML =
      '<div class="qcard"><div class="qname">' + esc(g.m.n) + '</div>' +
      '<div class="qhint"><span class="qpill">' + esc(g.m.r || "成员") + '</span>' +
      (g.m.cv ? '<span class="qsep">·</span>CV. ' + esc(g.m.cv) : '') + '</div></div>' +
      '<div class="opts">' + g.opts.map(x =>
        '<button class="opt" data-mo="' + x.id + '"><span class="odot" style="background:' + x.color + '"></span>' + esc(x.ja) + '</button>').join("") + '</div>' +
      '<div class="gfoot"><span class="gmsg" id="member-msg"></span></div>';
  }

  function answerMember(id) {
    const g = games.member;
    if (g.answered) return;
    g.answered = true;
    const ok = id === g.band.id;
    g.score += ok ? 10 : 0; g.streak = ok ? g.streak + 1 : 0;
    $("#member-body").querySelectorAll(".opt").forEach(el => {
      if (el.dataset.mo === g.band.id) el.classList.add("right");
      else if (el.dataset.mo === id) el.classList.add("wrong");
      el.disabled = true;
    });
    const msg = $("#member-msg");
    if (msg) msg.innerHTML = ok ? "✅ 对了" : "❌ 是 " + esc(g.band.ja);
    const foot = $("#member-body .gfoot");
    if (foot) foot.insertAdjacentHTML("beforeend", '<button class="btn primary" id="member-next">下一题</button>');
    updateScores();
  }

  window.PlayModule = { init, render, MEMES };
})();
