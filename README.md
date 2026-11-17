# 邦多利乐队与歌曲图鉴（网站版）

把原来「一个 1MB HTML 里塞着全部数据和图」的单文件页，改成了数据与页面分离的小站点：
页面只负责渲染，曲目、乐队、专辑、歌单都是 `data/*.json`，立绘是 `images/*.webp`。
官网出新碟时，跑一次同步脚本就能更新，不需要重新打包页面。

- 12 支官网在册乐队 + 3 个特别团体，711 首曲目（含同步进来的未发售新曲）
- 首页：每日一曲、年份分布、类型构成、乐队曲目量、最近发行、收藏进度
- 歌曲：搜索 / 多维筛选 / 三种排序 / 分组年份 / 页面内试听 / 想听·已听
- 专辑：345 张作品按发行日倒序，年份筛选，展开曲目，带官网封面
- 歌单：6 个主题（入门、动画关联、翻唱、LIVE、合唱、深夜系）
- 数据状态：最后同步时间、更新日志，打开页面时每 90 秒检查一次更新
- PWA：manifest + service worker，可安装、可离线看已缓存内容

## 本地运行

浏览器出于安全限制，**不能用 `file://` 直接双击打开**（页面要 fetch JSON）。
用任意静态服务器即可：

```bash
cd bangdream-site
node serve.mjs          # http://127.0.0.1:8787
# 或
python3 -m http.server 8787
```

手机同局域网访问：`http://<电脑 IP>:8787`。

## 更新数据（实时更新）

```bash
node sync/sync.mjs                  # 抓官网列表前 3 页 + 最近 8 张新作品的曲目，写回 data/
node sync/sync.mjs --pages 6        # 多翻几页
node sync/sync.mjs --details 0      # 只看列表，不抓曲目
node sync/sync.mjs --dry            # 只打印会新增什么，不写文件
node sync/sync.mjs --force          # 忽略 7 天缓存重新抓
```

专辑封面单独抓（官网 Discography 缩略图 → 160px WebP，并发下载，已存在的跳过）：

```bash
python3 sync/covers.py              # 需要 pillow
python3 sync/covers.py --force      # 全部重抓
```

目前 335 张专辑里匹配到 275 张封面（约 1.7MB，放在 `images/covers/`，映射表 `data/covers.json`）。
匹配不上的多是翻唱单曲和网易云独家合集，页面会用色块兜底。

脚本做的是**增量新增**：只加数据里没有的曲目，从不删除；抓取失败只会报告，不会破坏已有数据。
新增曲目会写进 `data/songs.json`，同时更新 `data/meta.json`（版本号、同步时间、统计）和
`data/changelog.json`（更新日志）。页面里的「数据同步于 …」就是从 `meta.json` 读的。

已知限制（script 里也有注释）：

- 依赖官网现行 WordPress 模板的类名（`p-discography-list__item` 等），官网改版后需要跟着改选择器。
- 只处理「有确切发行日 + 有收録内容曲目列表」的作品；Blu-ray、周边、未定曲名会跳过。
- 曲目只按标题去重；同名不同版本的曲子仍按「曲名 + 乐队」去重，个别会漏。

## 部署

纯静态，把整个目录丢到任意静态托管即可（GitHub Pages / Cloudflare Pages / Vercel / 对象存储）。

**GitHub Pages**

1. 新建仓库，把本目录推上去；
2. Settings → Pages → Source 选 `main` 分支根目录；
3. 打开 `https://<用户名>.github.io/<仓库名>/`。

**自动更新**：仓库里带 `.github/workflows/sync.yml`，每天 UTC 20:17 自动跑一次同步，
有变化就提交 `data/`，Pages 自动重新发布。也可以手动 trigger（workflow_dispatch）。

## 目录

```
index.html               页面骨架（无内联数据）
assets/style.css         样式
assets/app.js            渲染逻辑（数据由 fetch 载入）
data/bands.json          乐队与成员
data/songs.json          曲目（t 曲名 / b 乐队 / k 类型 / d 发行日 / al 作品 / sid 网易云 / bv B 站）
data/playlists.json      歌单（人工 titles 或 rule 规则）
data/meta.json           版本、同步时间、统计
data/changelog.json      更新日志
data/covers.json         专辑标题 → 封面路径
images/*.webp            乐队全员立绘
images/covers/*.webp     专辑封面（160px）
sync/sync.mjs            官网曲目同步（带缓存，7 天）
sync/covers.py           官网封面抓取（并发 + 压缩）
serve.mjs                本地预览服务器
sw.js / manifest.webmanifest   PWA
```

## 改数据 / 加歌单

- 加歌：往 `data/songs.json` 里加一条 `{"t":"曲名","b":"roselia","k":"orig","d":"2027-01-01","al":"作品名"}`，
  `b` 用 `data/bands.json` 里的 `id`，`k` 取 `orig / cover / collab / live`。
- 加歌单：`data/playlists.json` 里加一项，`titles` 写死曲名列表，或给 `rule`
  （`band` / `kind` / `tie` / `limit` / `sort`）让页面现场筛选。
- 换立绘：直接替换 `images/<id>.webp`，无需改代码。

## 数据来源与声明

乐队、成员、发行信息取自官方 [Artist](https://bang-dream.com/artist/) 与
[Discography](https://bang-dream.com/discographies) 页；试听链接指向网易云公开页面，
MV 指向 B 站官方账号。本站是非官方粉丝整理，与 Bushiroad 及 BanG Dream! Project 无关联，
作品与角色权利归各自权利人所有。立绘来自官方站点，仅作个人资料整理用途。
