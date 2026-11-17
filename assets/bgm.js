/* 站点背景音乐（BGM）
   两种来源，都不在仓库里预置音频：
   1) 你自己放到 audio/bgm.mp3 —— 页面自动识别（需要你自己上传，版权自负）
   2) 在本机点按钮选一首本地音乐 —— 只存进浏览器（IndexedDB），只在这台设备播放
   浏览器禁止无交互自动播放，所以一定需要点一下按钮。 */
(function () {
  "use strict";
  const DB_NAME = "bdx-audio", STORE = "files", KEY = "bgm";
  const LS_ON = "bdx_bgm_on";
  let ctx = null, url = null, enabled = (() => { try { return localStorage.getItem(LS_ON) === "1" } catch (e) { return false } })(), btn = null, input = null, tip = null;

  const setLS = v => { try { localStorage.setItem(LS_ON, v ? "1" : "0") } catch (e) { } };

  function db() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("no idb"));
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE) };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  function idbGet(k) {
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(STORE, "readonly").objectStore(STORE).get(k);
      t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error);
    }));
  }
  function idbPut(k, v) {
    return db().then(d => new Promise((res, rej) => {
      const t = d.transaction(STORE, "readwrite").objectStore(STORE).put(v, k);
      t.onsuccess = () => res(); t.onerror = () => rej(t.error);
    }));
  }

  function ui() {
    if (btn) return;
    btn = document.createElement("button");
    btn.id = "bgm-btn";
    btn.type = "button";
    btn.className = "bgm-btn";
    btn.setAttribute("aria-label", "背景音乐");
    btn.textContent = "🎵";
    btn.onclick = e => { e.stopPropagation(); toggle() };
    document.body.appendChild(btn);
    input = document.createElement("input");
    input.type = "file"; input.accept = "audio/*"; input.style.display = "none";
    input.onchange = async () => {
      const f = input.files && input.files[0]; if (!f) return;
      try { await idbPut(KEY, f); } catch (err) { }
      play(f);
    };
    document.body.appendChild(input);
  }

  function toast(msg) {
    if (!tip) {
      tip = document.createElement("div");
      tip.className = "bgm-tip"; document.body.appendChild(tip);
    }
    tip.textContent = msg; tip.classList.add("on");
    clearTimeout(tip._t); tip._t = setTimeout(() => tip.classList.remove("on"), 2600);
  }

  function play(fileOrUrl) {
    try {
      if (url) { URL.revokeObjectURL(url); url = null }
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      if (typeof fileOrUrl === "string") { url = fileOrUrl }
      else { url = URL.createObjectURL(fileOrUrl) }
      const a = ensureAudio();
      a.src = url; a.volume = 0.32; a.loop = true;
      return a.play().then(() => {
        enabled = true; setLS(true); paint();
        toast("背景音乐已开启");
      }).catch(() => { toast("浏览器拦了自动播放，再点一下 🎵") });
    } catch (e) { toast("这个格式播不了") }
  }

  function ensureAudio() {
    let a = document.getElementById("bgm-audio");
    if (!a) { a = document.createElement("audio"); a.id = "bgm-audio"; a.loop = true; a.preload = "none"; document.body.appendChild(a) }
    return a;
  }

  async function toggle() {
    const a = ensureAudio();
    if (enabled && url) {
      a.pause(); enabled = false; setLS(false); paint(); toast("背景音乐已关闭");
      return;
    }
    // 优先：仓库里自带的 audio/bgm.mp3（你自己放的话）
    if (!url) {
      const ok = await fetch("audio/bgm.mp3", { method: "HEAD" }).then(r => r.ok).catch(() => false);
      if (ok) { play("audio/bgm.mp3"); return }
    }
    // 其次：本机存过的文件
    if (!url) {
      try {
        const f = await idbGet(KEY);
        if (f) { play(f); return }
      } catch (e) { }
    }
    if (!url) {
      // 什么也没有：让用户选一首本地音乐
      toast("选一首本地音乐（只存本机）");
      input && input.click();
      return;
    }
    a.play().then(() => { enabled = true; setLS(true); paint() }).catch(() => { });
  }

  function paint() {
    if (!btn) return;
    btn.classList.toggle("on", !!enabled);
    btn.textContent = enabled ? "🎶" : "🎵";
    btn.title = enabled ? "关闭背景音乐" : "播放背景音乐（点一下选歌）";
  }

  function boot() {
    ui(); paint();
    // 若设过开启状态，尝试恢复（仍需用户手势，失败就静默）
    if (enabled) {
      idbGet(KEY).then(f => { if (f) play(f) }).catch(() => { });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
