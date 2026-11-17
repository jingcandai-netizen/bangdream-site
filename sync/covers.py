#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从官网 Discography 抓专辑封面，压缩后存到 images/covers/，并生成 data/covers.json。

用法：
  python3 sync/covers.py            # 增量：已存在的封面跳过
  python3 sync/covers.py --force    # 全部重抓
依赖：pip install pillow
"""
import json, os, re, sys, time, hashlib, urllib.request, io
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "https://bang-dream.com"
CACHE = os.path.join(ROOT, "sync", ".cache")
OUT_DIR = os.path.join(ROOT, "images", "covers")
WIDTH, QUALITY = 160, 72
FORCE = "--force" in sys.argv

os.makedirs(CACHE, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

UA = {"user-agent": "bangdream-fansite/1.0 (personal fan project)"}


def fetch(url, cache_name=None, ttl=7 * 86400):
    if cache_name:
        f = os.path.join(CACHE, cache_name)
        if os.path.exists(f) and time.time() - os.path.getmtime(f) < ttl:
            return open(f, "rb").read()
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    if cache_name:
        open(f, "wb").write(data)
    time.sleep(0.23)
    return data


def strip(s):
    s = re.sub(r"<[^>]*>", "", s)
    for a, b in [("&amp;", "&"), ("&#038;", "&"), ("&quot;", '"'), ("&#039;", "'"),
                 ("&nbsp;", " "), ("&lt;", "<"), ("&gt;", ">")]:
        s = s.replace(a, b)
    return s.strip()


def norm(s):
    return re.sub(r"[\s\u3000'\"’＊*!！?？·・\-—–_()（）\[\]「」『』～~,、:：]", "", s.lower())


def inner(s):
    m = re.search(r"[「『](.+?)[」』]", s)
    return m.group(1) if m else s


# ---------- 1. 扫描列表页 ----------
items = {}
if os.path.exists("/tmp/cover-items.json") and not FORCE:
    items = json.load(open("/tmp/cover-items.json", encoding="utf-8"))
else:
    for p in range(1, 81):
        url = BASE + "/discographies" if p == 1 else BASE + f"/discographies/page/{p}/"
        try:
            html = fetch(url, f"disc-{p}.html", ttl=3 * 86400).decode("utf-8", "ignore")
        except Exception as e:
            print("停在第", p, "页：", e)
            break
        arts = re.findall(r'<article class="p-discography-list__item">(.*?)</article>', html, re.S)
        if not arts:
            print("第", p, "页没有条目，结束")
            break
        for a in arts:
            thumb = re.search(r'item-thumb"><img src="([^"]+)"', a)
            title = re.search(r'item-title">(.*?)</div>', a, re.S)
            date = re.search(r'item-date">.*?</h2>\s*<p>(.*?)</p>', a, re.S)
            if not (thumb and title):
                continue
            t = strip(title.group(1))
            items.setdefault(norm(t), {"title": t, "thumb": thumb.group(1),
                                       "date": strip(date.group(1)) if date else ""})
        print(f"  第 {p} 页：累计 {len(items)} 张作品")
    json.dump(items, open("/tmp/cover-items.json", "w", encoding="utf-8"), ensure_ascii=False)

# ---------- 2. 匹配数据里的专辑 ----------
songs = json.load(open(os.path.join(ROOT, "data/songs.json"), encoding="utf-8"))
albums = list(dict.fromkeys([s["al"] for s in songs if s.get("al")]))
lst = list(items.values())
matched, missed = {}, []
for al in albums:
    n, ni = norm(al), norm(inner(al))
    best = None
    for it in lst:
        if norm(it["title"]) == n:
            best = it
            break
    if not best:
        for it in lst:
            if norm(inner(it["title"])) == ni and len(ni) >= 4:
                best = it
                break
    if not best:
        for it in lst:
            c = norm(inner(it["title"]))
            if len(c) >= 6 and (c in ni or ni in c):
                best = it
                break
    if best:
        matched[al] = best
    else:
        missed.append(al)
print(f"专辑 {len(albums)} 张，匹配到封面 {len(matched)} 张，未匹配 {len(missed)} 张")

# ---------- 3. 下载 + 压缩 ----------
covers = {}
if os.path.exists(os.path.join(ROOT, "data/covers.json")) and not FORCE:
    covers = json.load(open(os.path.join(ROOT, "data/covers.json"), encoding="utf-8"))

downloaded = 0
for i, (al, it) in enumerate(matched.items(), 1):
    slug = hashlib.md5(al.encode("utf-8")).hexdigest()[:10]
    out = os.path.join(OUT_DIR, slug + ".webp")
    rel = f"images/covers/{slug}.webp"
    if os.path.exists(out) and not FORCE:
        covers[al] = rel
        continue
    try:
        raw = fetch(it["thumb"], f"cover-{slug}.jpg", ttl=30 * 86400)
        im = Image.open(io.BytesIO(raw)).convert("RGB")
        w = WIDTH
        h = round(im.size[1] * w / im.size[0])
        im.resize((w, h), Image.LANCZOS).save(out, "WEBP", quality=QUALITY, method=6)
        covers[al] = rel
        downloaded += 1
        if downloaded % 25 == 0:
            print(f"  已处理 {downloaded} 张…")
    except Exception as e:
        print("  跳过", al, e)

json.dump(covers, open(os.path.join(ROOT, "data/covers.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=0)
json.dump(missed, open(os.path.join(CACHE, "covers-missed.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
total = sum(os.path.getsize(os.path.join(OUT_DIR, f)) for f in os.listdir(OUT_DIR))
print(f"完成：新下载 {downloaded} 张，封面目录共 {len(os.listdir(OUT_DIR))} 个文件 / {total/1024:.0f}KB")
print(f"未匹配封面 {len(missed)} 张（翻唱单曲与网易云独家合集居多），页面会退回渐变色块")
