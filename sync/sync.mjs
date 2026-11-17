#!/usr/bin/env node
/**
 * 从官方 Discography 同步曲目数据。
 *
 *   node sync/sync.mjs                 # 抓列表前 3 页 + 最近 8 张新作品的曲目，写回 data/
 *   node sync/sync.mjs --pages 6       # 多翻几页
 *   node sync/sync.mjs --details 0     # 只看列表，不抓曲目
 *   node sync/sync.mjs --dry           # 只打印差异，不写文件
 *
 * 设计：只做「增量新增」，从不删除已有条目；所有网络请求带缓存（sync/.cache，7 天），
 * 失败不破坏现有数据。抓不到就报告，不编造。
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(ROOT, "sync", ".cache");
const BASE = "https://bang-dream.com";
const UA = "bangdream-fansite/1.0 (+personal fan project; contact: none)";
const TTL = 7 * 24 * 3600 * 1000;

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf("--" + name);
  if (i < 0) return def;
  const v = args[i + 1];
  return v && !v.startsWith("--") ? Number(v) : true;
};
const PAGES = Number(opt("pages", 3));
const DETAILS = Number(opt("details", 8));
const DRY = !!opt("dry", false);
const FORCE = !!opt("force", false);

const sleep = ms => new Promise(r => setTimeout(r, ms));

function cachePath(url) {
  return path.join(CACHE, crypto.createHash("sha1").update(url).digest("hex") + ".html");
}

async function get(url) {
  fs.mkdirSync(CACHE, { recursive: true });
  const f = cachePath(url);
  if (!FORCE && fs.existsSync(f)) {
    const st = fs.statSync(f);
    if (Date.now() - st.mtimeMs < TTL) return fs.readFileSync(f, "utf8");
  }
  const res = await fetch(url, { headers: { "user-agent": UA, "accept-language": "ja,en" } });
  if (!res.ok) throw new Error(url + " → HTTP " + res.status);
  const html = await res.text();
  fs.writeFileSync(f, html);
  await sleep(350); // 礼貌间隔
  return html;
}

const strip = s => String(s).replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"')
  .replace(/&#039;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();

/* ---------- 列表页 ---------- */
function parseList(html) {
  const out = [];
  const re = /<article class="p-discography-list__item">([\s\S]*?)<\/article>/g;
  let m;
  while ((m = re.exec(html))) {
    const a = m[1];
    const link = /href="(https:\/\/bang-dream\.com\/discographies\/(\d+)\/)"/.exec(a);
    if (!link) continue;
    const cat = /item-category-item">([\s\S]*?)<\/span>/.exec(a);
    const title = /item-title">([\s\S]*?)<\/div>/.exec(a);
    const date = /item-date">[\s\S]*?<\/h2>\s*<p>([\s\S]*?)<\/p>/.exec(a);
    const artists = [...a.matchAll(/item-artist-item">([\s\S]*?)<\/span>/g)].map(x => strip(x[1]));
    out.push({
      id: link[2], url: link[1].split("?")[0],
      category: cat ? strip(cat[1]) : "",
      title: title ? strip(title[1]) : "",
      dateRaw: date ? strip(date[1]) : "",
      artists: artists.filter(Boolean),
    });
  }
  return out;
}

function isoDate(raw) {
  const m = /(\d{4})年(\d{1,2})月(\d{1,2})日/.exec(raw || "");
  if (!m) return "";
  return m[1] + "-" + String(m[2]).padStart(2, "0") + "-" + String(m[3]).padStart(2, "0");
}

/* ---------- 作品页 ---------- */
function parseDetail(html) {
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(html);
  const tracks = [];
  const m = /<h2[^>]*id="toc-\d+"[^>]*>\s*収録内容\s*<\/h2>([\s\S]*?)(?:<h2|<h3)/.exec(html);
  if (m) {
    const block = m[1];
    const p = /<p[^>]*>([\s\S]*?)<\/p>/.exec(block);
    if (p) {
      const lines = p[1].split(/<br\s*\/?>/i).map(strip).filter(Boolean);
      for (const line of lines) {
        const t = /^\d+[.．]\s*(.+)$/.exec(line);
        if (!t) continue;
        const title = t[1].trim();
        // 官网有时先占位，未定曲名不当作真实曲目导入
        if (/^(タイトル未定|未定|TBD|未発表)/i.test(title)) continue;
        tracks.push(title);
      }
    }
  }
  const artists = [...html.matchAll(/p-discography-detail__related-artist-item[^>]*>([\s\S]*?)<\/[^>]+>/g)]
    .map(x => strip(x[1])).filter(Boolean);
  const date = /発売日[\s\S]{0,200}?(\d{4}年\s*\d{1,2}月\s*\d{1,2}日)/.exec(html);
  return {
    title: h1 ? strip(h1[1]).replace(/\s*\|\s*BanG Dream.*$/, "") : "",
    tracks, artists,
    date: date ? isoDate(date[1]) : "",
  };
}

/* ---------- 乐队映射 ---------- */
const BANDS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/bands.json"), "utf8"));
const normName = s => String(s).toLowerCase().replace(/[\s\u3000＊*!！?？·・\-—–_'’"]/g, "");
function bandId(artist) {
  const n = normName(artist);
  for (const b of BANDS) {
    if (normName(b.ja) === n || normName(b.id) === n) return b.id;
  }
  const alias = {
    "poppinparty": "poppinparty", "pasuteruparetto": "pastelpalettes",
    "dreaming": "other", "夢ノ結唱": "other",
  };
  return alias[n] || null;
}

function inferKind(releaseTitle, tracks, artists) {
  const s = (releaseTitle + " " + tracks.join(" ")).toLowerCase();
  if (/カバー|cover/.test(s)) return "cover";
  if (/live|ライブ|劇場版/.test(s)) return "live";
  if (new Set(artists.map(a => bandId(a))).size > 1) return "collab";
  return "orig";
}

/* ---------- 主流程 ---------- */
const songsPath = path.join(ROOT, "data/songs.json");
const metaPath = path.join(ROOT, "data/meta.json");
const logPath = path.join(ROOT, "data/changelog.json");
const songs = JSON.parse(fs.readFileSync(songsPath, "utf8"));
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
const changelog = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, "utf8")) : [];

const normT = s => String(s).toLowerCase().replace(/[\s\u3000'"’＊*!！?？·・\-—–_()（）\[\]「」『』～~]/g, "");
const known = new Map();
for (const s of songs) known.set(normT(s.t) + "|" + s.b, s);

console.log(`已有 ${songs.length} 首 / ${new Set(songs.map(s => s.al)).size} 张作品，开始抓取列表…`);
const items = [];
for (let p = 1; p <= PAGES; p++) {
  const url = p === 1 ? BASE + "/discographies" : BASE + "/discographies/page/" + p + "/";
  const html = await get(url);
  const part = parseList(html);
  console.log(`  第 ${p} 页：${part.length} 条`);
  if (!part.length) break;
  items.push(...part);
}

const seen = new Set();
const uniq = items.filter(it => (seen.has(it.id) ? false : (seen.add(it.id), true)));
const newReleases = uniq.filter(it => {
  const d = isoDate(it.dateRaw);
  if (!d) return false;
  return !songs.some(s => s.al && normT(s.al) === normT(it.title));
});
console.log(`列表共 ${uniq.length} 条，其中 ${newReleases.length} 条是数据里没有的作品`);

const added = [];
let fetched = 0;
for (const it of newReleases.slice(0, DETAILS)) {
  if (!/CD|Blu-ray|配信|Single|Album/i.test(it.category + " " + it.title)) continue;
  let detail;
  try {
    detail = parseDetail(await get(it.url));
  } catch (e) {
    console.log("  跳过 " + it.url + "：" + e.message);
    continue;
  }
  fetched++;
  const date = detail.date || isoDate(it.dateRaw);
  if (!date || !detail.tracks.length) {
    console.log(`  ${it.title}：无确切发行日或没有解析到曲目，跳过`);
    continue;
  }
  const artists = (it.artists.length ? it.artists : detail.artists).filter(Boolean);
  const bid = artists.map(bandId).find(Boolean) || "other";
  const kind = inferKind(it.title, detail.tracks, artists);
  if (!bandId(artists[0] || "")) console.log(`  ⚠ 未知艺人「${artists.join(" / ")}」，归入「其他」：${it.title}`);
  for (const t of detail.tracks) {
    const k = normT(t) + "|" + bid;
    if (known.has(k)) {
      const ex = known.get(k);
      if (ex && !ex.al) { ex.al = it.title; ex.d = ex.d || date }
      continue;
    }
    const row = { t, b: bid, k: kind, d: date, al: it.title, off: it.url };
    if (date > new Date().toISOString().slice(0, 10)) row.pre = true;
    songs.push(row);
    known.set(k, row);
    added.push(row);
  }
  console.log(`  + ${it.title}（${date}，${detail.tracks.length} 曲）`);
}

if (!added.length) {
  console.log("\n没有新增曲目。数据已是最新。");
} else {
  console.log(`\n新增 ${added.length} 首：`);
  added.forEach(s => console.log("  · " + s.t + " — " + (BANDS.find(b => b.id === s.b) || {}).ja + " / " + s.al));
}

if (!DRY) {
  const now = new Date();
  const byYear = {}, byKind = {};
  for (const s of songs) {
    const y = (s.d || "").slice(0, 4); if (/^\d{4}$/.test(y)) byYear[y] = (byYear[y] || 0) + 1;
    byKind[s.k || "orig"] = (byKind[s.k || "orig"] || 0) + 1;
  }
  fs.writeFileSync(songsPath, JSON.stringify(songs));
  fs.writeFileSync(metaPath, JSON.stringify({
    version: now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14),
    cut: now.toISOString().slice(0, 10),
    syncedAt: now.toISOString(),
    source: BASE + "/discographies",
    counts: { bands: BANDS.length, songs: songs.length, albums: new Set(songs.filter(s => s.al).map(s => s.al + '|' + (s.d || ''))).size, images: 12 },
    byYear, byKind,
  }, null, 1));
  if (added.length) {
    changelog.unshift({
      date: now.toISOString().slice(0, 10),
      text: `自动同步：从官网新增 ${added.length} 首（${[...new Set(added.map(s => s.al))].slice(0, 3).join("、")}${added.length > 3 ? " 等" : ""}）。`,
    });
    fs.writeFileSync(logPath, JSON.stringify(changelog.slice(0, 60), null, 1));
  }
  console.log(`\n已写入 data/（抓取作品 ${fetched} 张，新增曲目 ${added.length} 首）`);
} else {
  console.log("\n[dry-run] 未写入文件。");
}
