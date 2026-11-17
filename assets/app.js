/* ============================================================
   邦多利乐队与歌曲图鉴 · 网站版
   - 数据来自 data/*.json，由 sync/sync.mjs 从官网同步，页面无需重新打包
   - 页面每 90 秒检查一次 data/meta.json，有更新会在顶部提示
   ============================================================ */
(async function () {
  "use strict";
  const bootEl = document.getElementById("boot");
  let BANDS = [], SONGS = [], PLAYLISTS = [], CHANGELOG = [], META = {}, CUT = "";
  const BD = {"牛込 りみ":"3月23日","山吹 沙綾":"5月19日","戸山 香澄":"7月14日","市ヶ谷 有咲":"10月27日","花園 たえ":"12月4日","上原 ひまり":"10月23日","羽沢 つぐみ":"1月7日","美竹 蘭":"4月10日","宇田川 巴":"4月15日","青葉 モカ":"9月3日","白鷺 千聖":"4月6日","若宮 イヴ":"6月27日","丸山 彩":"12月27日","大和 麻弥":"11月3日","氷川 日菜":"3月20日","氷川 紗夜":"3月20日","宇田川 あこ":"7月3日","湊 友希那":"10月26日","白金 燐子":"10月17日","今井 リサ":"8月25日","北沢 はぐみ":"7月30日","ミッシェル / 奥沢 美咲":"10月1日","弦巻 こころ":"8月8日","瀬田 薫":"2月28日","松原 花音":"5月11日","八潮 瑠唯":"11月19日","広町 七深":"6月16日","倉田 ましろ":"2月19日","二葉 つくし":"9月15日","桐ヶ谷 透子":"12月16日","パレオ":"3月25日","マスキング":"5月12日","レイヤ":"1月13日","チュチュ":"12月7日","ロック":"7月17日","千早 愛音":"9月8日","長崎 そよ":"5月27日","高松 燈":"11月22日","椎名 立希":"8月9日","要 楽奈":"2月22日","オブリビオニス / 豊川 祥子":"2月14日","ティモリス / 八幡 海鈴":"4月7日","ドロリス / 三角 初華":"6月26日","アモーリス / 祐天寺 にゃむ":"6月1日","モーティス / 若葉 睦":"1月14日","峰月 律":"2月7日","千石 ユノ":"11月4日","仲町 あられ":"8月16日","藤 都子":"9月19日","宮永 ののか":"4月17日","琴平 凪":"12月10日","浜崎 まほろ":"7月16日","汐見 蛍":"3月12日","和泉 朋花":"10月24日","伊沢 なつめ":"3月30日","矢倉 蓬咲":"5月6日","梅里 ちえり":"4月2日","須賀 蕾叶":"7月28日","四宮 寧月":"3月5日","馬橋 心玖":"10月4日"};
  const IMGR = {"poppinparty":1.1321,"afterglow":1.1321,"hello-happy-world":1.1321,"pastel-palettes":1.1321,"roselia":1.1321,"raise-a-suilen":1.1321,"morfonica":1.1321,"mygo":1.5976,"avemujica":1.8305,"yumemita":1.7763,"millsage":1.4248,"ikka-dumb-rock":1.4136};

  function bootFail(err) {
    if (!bootEl) return;
    bootEl.className = "boot error";
    bootEl.innerHTML = '<div>数据载入失败<br><span style="color:var(--tx3);font-size:12px">' +
      String(err && err.message ? err.message : err) +
      '</span></div><div style="font-size:12px;color:var(--tx3)">' +
      '请确认通过本地服务器或 https 打开本页（直接双击 file:// 打开时浏览器会拦截 fetch）。</div>';
  }

  try {
    const [bands, songs, meta, playlists, changelog] = await Promise.all([
      fetch("data/bands.json").then(r => { if (!r.ok) throw new Error("data/bands.json " + r.status); return r.json() }),
      fetch("data/songs.json").then(r => { if (!r.ok) throw new Error("data/songs.json " + r.status); return r.json() }),
      fetch("data/meta.json", { cache: "no-store" }).then(r => { if (!r.ok) throw new Error("data/meta.json " + r.status); return r.json() }),
      fetch("data/playlists.json").then(r => r.ok ? r.json() : []).catch(() => []),
      fetch("data/changelog.json").then(r => r.ok ? r.json() : []).catch(() => [])
    ]);
    BANDS = bands; SONGS = songs; META = meta; PLAYLISTS = playlists; CHANGELOG = changelog;
    CUT = meta.cut || meta.dataDate || "";
  } catch (e) { bootFail(e); return }

  /* 图片统一走 images/<slug>.webp：站点可缓存，改图也不用动 HTML */
  function imgOf(b) { const k = b && (b.slug || b.id); return k ? "images/" + k + ".webp" : "" }

  /* 收藏/播放按「曲名|乐队|发行日」定位，跨视图（歌曲/乐队/歌单/专辑）都能用 */
  const KEYMAP = new Map();
  const keyOf = s => s.t + "|" + s.b + "|" + (s.d || "");
  SONGS.forEach(s => { KEYMAP.set(keyOf(s), s) });

/* ================= 常量 / 工具 ================= */
const BMAP={};BANDS.forEach(b=>BMAP[b.id]=b);
const KIND={orig:["原创","orig"],cover:["翻唱","cover"],collab:["合唱·合作","collab"],live:["LIVE/剧场","live"]};
const SORTNAME={dateDesc:"新→旧",dateAsc:"旧→新",titleAsc:"曲名"};
const LS_VIEW="bdx_view_v1",LS_WANT="bdx_want_v1",LS_HEARD="bdx_heard_v1";
const BATCH=60;
const $=id=>document.getElementById(id);

function load(k,d){try{const v=JSON.parse(localStorage.getItem(k));return v==null?d:v}catch(e){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function norm(s){return String(s).toLowerCase().replace(/[\s\u3000'"’＊*!！?？·・\-—–_]/g,"")}
function hl(t,q){ if(!q)return esc(t);
  const n=norm(t),nq=norm(q); if(!nq)return esc(t);
  const i=n.indexOf(nq); if(i<0)return esc(t);
  // 映射回原文位置
  let out="",cnt=0,started=false;
  for(let k=0;k<t.length;k++){
    const c=t[k],nc=norm(c);
    if(!nc){out+=esc(c);continue}
    if(cnt===i&&!started){out+="<mark>";started=true}
    if(cnt===i+nq.length&&started){out+="</mark>";started=false}
    out+=esc(c);cnt+=nc.length;
  }
  if(started)out+="</mark>";
  return out;
}
function fmt(d){if(!d)return"";const[y,m,dd]=d.split("-");return y+"."+m+"."+dd}

/* ================= 状态 ================= */
const DEF={tab:"bands",q:"",bands:[],kinds:[],tie:false,fav:"",sort:"dateDesc",shown:BATCH,scrollY:0,openBand:""};
let st=Object.assign({},DEF);
const KEY=s=>s.t+"|"+s.b+"|"+(s.d||"");
let wantK=new Set(load(LS_WANT,load(LS_WANT+"_k",[]))),heardK=new Set(load(LS_HEARD,load(LS_HEARD+"_k",[])));
function isWant(s){return wantK.has(KEY(s))}
function isHeard(s){return heardK.has(KEY(s))}

/* ================= 吸顶高度 ================= */
function measureHd(){const h=document.querySelector(".hdr");if(h)document.documentElement.style.setProperty("--hd",h.offsetHeight+"px")}
window.addEventListener("resize",measureHd);
window.addEventListener("orientationchange",measureHd);

/* ================= 顶部提示 ================= */
const wx=/MicroMessenger/i.test(navigator.userAgent);
if(wx)$("wxnote").hidden=false;

/* ================= 统计 ================= */
(function(){
  const bands=BANDS.filter(b=>b.slug).length;
  const dates=SONGS.map(s=>s.d).filter(Boolean).sort();
  const tie=SONGS.filter(s=>s.tie).length;
  const mv=SONGS.filter(s=>s.bv).length;
  $("hsub").textContent="BanG Dream! "+bands+" 支官网在册乐队 · "+SONGS.length+" 首曲目 · 截至 "+CUT;
  $("stats").innerHTML=
    '<div class="stat"><b>'+bands+'</b><span>官网在册乐队</span></div>'+
    '<div class="stat"><b>'+SONGS.length+'</b><span>收录曲目</span></div>'+
    '<div class="stat"><b>'+mv+'</b><span>B 站官方 MV</span></div>';
  $("foot").innerHTML="非官方粉丝整理 · 乐队与成员以官方 <a href='https://bang-dream.com/artist/' target='_blank' rel='noopener'>Artist</a> 页为准 · 数据截至 "+CUT;
})();
function updateProg(){
  const el=$("mybox");if(!el)return;
  const tot=SONGS.length,w=wantK.size,h=heardK.size;
  const pct=n=>tot?Math.round(n/tot*100):0;
  el.innerHTML='<h3>我的收藏 <span class="sm">存在本机 · 重置不清收藏</span></h3>'+
    '<div class="myrows">'+
    '<div class="myrow2"><div class="lb"><i style="background:var(--want)"></i>♥ 想听<span>Marked 到网易云「去听」</span></div><div class="pbar2"><i style="background:var(--want);width:'+pct(w)+'%"></i></div><span class="pc">'+w+' / '+tot+'</span></div>'+
    '<div class="myrow2"><div class="lb"><i style="background:var(--heard)"></i>✓ 已听<span>听过的打勾，攒自己的歌单</span></div><div class="pbar2"><i style="background:var(--heard);width:'+pct(h)+'%"></i></div><span class="pc">'+h+' / '+tot+'</span></div>'+
    '</div><button class="mygo" id="mygo">看我想听清单 →</button>';
  $("mygo").onclick=()=>{st.fav="want";st.bands=[];st.kinds=[];st.tie=false;st.shown=BATCH;buildChips();switchTab("songs");apply(false)};
}
updateProg();

/* ================= 乐队网格 ================= */
function bandCard(b){
  const n=SONGS.filter(s=>s.b===b.id).length;
  const img=imgOf(b);
  return '<button class="bcard" data-b="'+b.id+'" style="--bc:'+b.color+'">'+
    '<div class="bimgwrap" style="--bir:'+(IMGR[b.slug||b.id]||1.1321)+'">'+
      (img?'<img loading="lazy" src="'+img+'" alt="'+esc(b.ja)+' 全员">':'<div style="height:100%;display:flex;align-items:center;justify-content:center;color:#b9bfd0">无官方立绘</div>')+
      (b.slug?'':'<span class="btag">特别团体</span>')+
    '</div>'+
    '<div class="binfo"><h3>'+esc(b.ja)+'</h3><p class="bkana">'+esc(b.kana||'')+'</p>'+
      '<p class="bmeta"><i style="color:'+b.color+';font-style:normal">●</i>'+n+' 首</p>'+
    '</div></button>';
}
(function(){
  $("bandgrid").innerHTML=BANDS.filter(b=>b.slug).map(bandCard).join("");
  $("bandgrid2").innerHTML=BANDS.filter(b=>!b.slug).map(bandCard).join("");
  document.querySelectorAll(".bcard").forEach(el=>el.onclick=()=>openBand(el.dataset.b));
})();

/* ================= 筛选 / 搜索 ================= */
function match(s,q){
  if(!q)return true;const nq=norm(q);if(!nq)return true;
  const b=BMAP[s.b];
  return norm(s.t).includes(nq)||norm(s.al||"").includes(nq)||(b&&(norm(b.ja).includes(nq)||norm(b.kana||"").includes(nq)));
}
function filtered(){
  const tie=st.tie, fav=st.fav;
  return SONGS.filter(s=>
    (st.bands.length?st.bands.includes(s.b):true)&&
    (st.kinds.length?st.kinds.includes(s.k||"orig"):true)&&
    (!tie||!!s.tie)&&
    (!fav||(fav==="want"?isWant(s):isHeard(s)))&&
    match(s,st.q)
  ).sort((a,b)=>{
    if(st.sort==="titleAsc")return a.t.localeCompare(b.t,"ja");
    const da=a.d||"",db=b.d||"";
    return st.sort==="dateAsc"?da.localeCompare(db):db.localeCompare(da);
  });
}
function chipList(el,items){
  el.innerHTML=el.querySelector(".cl").outerHTML+items.map(it=>{
    const on=(it.k==="band"?st.bands.includes(it.v):it.k==="kind"?st.kinds.includes(it.v):it.k==="tie"?st.tie:false);
    return '<button class="chip" data-t="'+it.k+'" data-v="'+esc(it.v)+'" aria-pressed="'+(on?"true":"false")+'"'+
      (it.k==="want"||it.k==="heard"||it.k==="tie"?' data-kind="'+(it.k==="kind"?"":it.k)+'"':'')+'>'+esc(it.label)+'<span class="n">'+it.n+'</span></button>';
  }).join("");
}
function buildChips(){
  const bc={};SONGS.forEach(s=>bc[s.b]=(bc[s.b]||0)+1);
  const bands=[{k:"band",v:"all",label:"全部",n:SONGS.length}].concat(
    BANDS.filter(b=>bc[b.id]).map(b=>({k:"band",v:b.id,label:b.ja,n:bc[b.id]})));
  chipList($("fband"),bands);
  const kc={};SONGS.forEach(s=>kc[s.k||"orig"]=(kc[s.k||"orig"]||0)+1);
  chipList($("fkind"),[{k:"kind",v:"all",label:"全部",n:SONGS.length}].concat(
    Object.keys(KIND).filter(k=>kc[k]).map(k=>({k:"kind",v:k,label:KIND[k][0],n:kc[k]}))));
  const tie=SONGS.filter(s=>s.tie).length;
  $("fmore").innerHTML='<span class="cl">其他</span>'+
    '<button class="chip" data-t="want" aria-pressed="'+(st.fav==="want")+'" data-kind="want">♥ 想听<span class="n">'+wantK.size+'</span></button>'+
    '<button class="chip" data-t="heard" aria-pressed="'+(st.fav==="heard")+'" data-kind="heard">✓ 已听<span class="n">'+heardK.size+'</span></button>'+
    '<button class="chip" data-t="tie" aria-pressed="'+st.tie+'" data-kind="tie">★ 动画 / 联动关联<span class="n">'+tie+'</span></button>';
}
document.addEventListener("click",e=>{
  const c=e.target.closest(".chip");if(!c||!c.dataset.t)return;
  const t=c.dataset.t,v=c.dataset.v;
  if(t==="band"){
    if(v==="all")st.bands=[]; else if(st.bands.includes(v))st.bands=st.bands.filter(x=>x!==v); else st.bands.push(v);
  }else if(t==="kind"){
    if(v==="all")st.kinds=[]; else if(st.kinds.includes(v))st.kinds=st.kinds.filter(x=>x!==v); else st.kinds.push(v);
  }else if(t==="tie")st.tie=!st.tie;
  else if(t==="want"||t==="heard")st.fav=(st.fav===t?"":t);
  st.shown=BATCH;buildChips();apply(true);
});
$("fbtn").onclick=()=>{
  const p=$("fpanel"),on=p.hidden;
  p.hidden=!on;$("fbtn").setAttribute("aria-expanded",String(on));
};
function activeCount(){return st.bands.length+st.kinds.length+(st.tie?1:0)+(st.fav?1:0)}
function renderAct(){
  const bar=$("actbar"),n=activeCount();
  $("fnum").hidden=n===0;$("fnum").textContent=n;
  if(!n){bar.hidden=true;bar.innerHTML="";return}
  const items=st.bands.map(id=>({lb:BMAP[id]?BMAP[id].ja:id,t:"band",v:id}))
    .concat(st.kinds.map(k=>({lb:KIND[k]?KIND[k][0]:k,t:"kind",v:k})))
    .concat(st.tie?[{lb:"动画/联动关联",t:"tie",v:"1"}]:[])
    .concat(st.fav?[{lb:st.fav==="want"?"♥ 想听":"✓ 已听",t:st.fav,v:st.fav}]:[]);
  bar.hidden=false;
  bar.innerHTML=items.map(it=>'<button class="afilter" data-t="'+it.t+'" data-v="'+esc(it.v)+'">'+esc(it.lb)+'<b>×</b></button>').join("")+
    '<button class="afilter clr" data-t="clr" data-v="1">清除全部</button>';
}
$("actbar").onclick=e=>{
  const b=e.target.closest(".afilter");if(!b)return;
  const t=b.dataset.t,v=b.dataset.v;
  if(t==="band")st.bands=st.bands.filter(x=>x!==v);
  else if(t==="kind")st.kinds=st.kinds.filter(x=>x!==v);
  else if(t==="tie")st.tie=false;
  else if(t==="want"||t==="heard")st.fav="";
  else if(t==="clr"){st.bands=[];st.kinds=[];st.tie=false;st.fav=""}
  st.shown=BATCH;buildChips();apply(true);
};

/* ================= 歌曲列表 ================= */
let rows=[],playing=-1,seqOn=false;
function yOf(s){return (s.d||"").slice(0,4)||"未标注"}
function songRows(arr,from,to,prevY){
  let out="",last=(prevY===undefined?"":prevY);const yc={};
  for(let i=from;i<to;i++){const y=yOf(arr[i]);yc[y]=(yc[y]||0)+1}
  for(let i=from;i<to;i++){const s=arr[i],y=yOf(s);
    if(y!==last){out+='<div class="ygroup"><b>'+esc(y)+'</b><i class="yl"></i><span class="yn">'+yc[y]+' 首</span></div>';last=y}
    out+=songHTML(s)}
  return out;
}
function songHTML(s){
  const b=BMAP[s.b]||{ja:s.b,color:"#999"};const k=s.k||"orig";const K=keyOf(s);
  const acts=[];
  if(s.sid){
    acts.push('<button class="act play" data-k="'+esc(K)+'" aria-pressed="'+(playingKey===K)+'">'+'▶ 页面内试听'+'</button>');
    acts.push('<a class="act go" href="https://music.163.com/song?id='+s.sid+'" target="_blank" rel="noopener">去听 ↗</a>');
  }
  if(s.bv)acts.push('<a class="act mv" href="https://www.bilibili.com/video/'+esc(s.bv)+'" target="_blank" rel="noopener">官方 MV ↗</a>');
  if(s.off)acts.push('<a class="act off" href="'+esc(s.off)+'" target="_blank" rel="noopener">官网条目 ↗</a>');
  return '<article class="song" style="--bc:'+b.color+'">'+
    '<div class="top"><div class="smain">'+
      '<div class="stitle">'+hl(s.t,st.q)+'</div>'+
      '<div class="smeta">'+
        '<span class="bsm"><i></i>'+esc(b.ja)+'</span>'+
        '<span>'+fmt(s.d)+'</span>'+
        '<span class="kind" data-k="'+k+'">'+(KIND[k]?KIND[k][0]:k)+'</span>'+
        (s.pre?'<span class="kind" data-k="pre">未发售</span>':'')+
      '</div>'+
      (s.al?'<div class="salb"><b>专辑</b> '+esc(s.al)+'</div>':'')+
      (s.tie?'<div class="stie">★ '+esc(s.tie)+'</div>':'')+
    '</div>'+
    '<div class="favs">'+
      '<button class="fav" data-f="want" data-k="'+esc(K)+'" aria-pressed="'+(isWant(s)?"true":"false")+'" aria-label="'+esc(s.t)+' 想听" title="想听">♥</button>'+
      '<button class="fav" data-f="heard" data-k="'+esc(K)+'" aria-pressed="'+(isHeard(s)?"true":"false")+'" aria-label="'+esc(s.t)+' 已听" title="已听">✓</button>'+
    '</div></div>'+
    (acts.length?'<div class="sacts">'+acts.join("")+'</div>':'')+
  '</article>';
}
function render(){
  rows=filtered();
  const n=Math.min(st.shown,rows.length);
  $("list").innerHTML=songRows(rows,0,n,"");
  $("moreBtn").hidden=n>=rows.length;
  $("moreBtn").textContent="加载更多（还有 "+(rows.length-n)+" 首）";
  $("cntTxt").innerHTML=(rows.length===SONGS.length&&activeCount()===0&&!st.q)?"共 <b>"+rows.length+"</b> 首曲目":"筛出 <b>"+rows.length+"</b> / "+SONGS.length+" 首";
  renderAct();
  const e=$("empty");
  if(!rows.length){e.hidden=false;
    e.innerHTML='没有符合条件的曲目。<br>试试放宽筛选或换个关键词。<br><button id="clr2">清空全部筛选</button>';
    $("clr2").onclick=()=>{st.q="";st.bands=[];st.kinds=[];st.tie=false;st.fav="";st.shown=BATCH;$("q").value="";buildChips();apply(true)};
  }else e.hidden=true;
}
function apply(scrollTop){render();if(scrollTop)window.scrollTo({top:0,behavior:"auto"});saveView()}

document.addEventListener("click",e=>{
  const f=e.target.closest(".fav");
  if(f){
    const s=KEYMAP.get(f.dataset.k);if(!s)return;
    const K=keyOf(s);
    if(f.dataset.f==="want"){if(wantK.has(K))wantK.delete(K);else wantK.add(K)}
    else{if(heardK.has(K))heardK.delete(K);else heardK.add(K)}
    save(LS_WANT,Array.from(wantK));save(LS_HEARD,Array.from(heardK));
    const on=f.getAttribute("aria-pressed")==="true";
    f.setAttribute("aria-pressed",on?"false":"true");
    buildChips();saveView();updateProg();
    tip(f.dataset.f==="want"?(isWant(s)?"已加入想听":"已取消想听"):(isHeard(s)?"已标记已听":"已取消已听"));
    return;
  }
  const p=e.target.closest(".play[data-k]");
  if(p){togglePlayKey(p.dataset.k);return}
});

/* ================= 播放 ================= */
const au=$("au");
let playingKey="",playTimer=null;
function audioUrl(sid){return "https://music.163.com/song/media/outer/url?id="+sid+".mp3"}
function playSong(s){
  if(!s){return}
  if(!s.sid){tip("这首没有公开音源，点「去听」跳网易云");return}
  const K=keyOf(s);
  if(playingKey===K&&!au.paused){au.pause();refreshPlayBtns();return}
  playingKey=K;
  au.src=audioUrl(s.sid);
  $("pname").innerHTML=esc(s.t)+'<span>'+esc((BMAP[s.b]||{}).ja||"")+' · 音源来自网易云公开接口</span>';
  $("player").classList.add("on");
  clearTimeout(playTimer);
  playTimer=setTimeout(()=>{if(playingKey===K&&(au.paused||au.currentTime===0)){playingKey="";$("player").classList.remove("on");refreshPlayBtns();tip("这个音源没响应，点「去听」跳网易云")}},8000);
  au.play().then(()=>{tip("开始播放");refreshPlayBtns()})
    .catch(()=>{clearTimeout(playTimer);playingKey="";$("player").classList.remove("on");refreshPlayBtns();tip("这个音源播不了（可能要会员），点「去听」跳转网易云")});
  refreshPlayBtns();
}
function togglePlayKey(k){playSong(KEYMAP.get(k))}
function togglePlay(i){playSong(rows[i])}
function refreshPlayBtns(){
  document.body.classList.toggle("hasplayer",$("player").classList.contains("on"));
  document.querySelectorAll("[data-play]").forEach(el=>{
    const on=el.dataset.play===playingKey&&!au.paused;
    el.setAttribute("aria-pressed",on?"true":"false");el.textContent=on?"❚❚ 暂停":"▶ 试听";});
  document.querySelectorAll(".play[data-k]").forEach(el=>{
    const on=el.dataset.k===playingKey&&!au.paused;
    el.setAttribute("aria-pressed",on?"true":"false");el.textContent=on?"❚❚ 暂停":"▶ 页面内试听";});
}
au.addEventListener("playing",()=>clearTimeout(playTimer));
au.addEventListener("pause",()=>clearTimeout(playTimer));
au.addEventListener("timeupdate",()=>{if(au.duration)$("pfill").style.width=(au.currentTime/au.duration*100)+"%"});
au.addEventListener("ended",()=>{
  const was=playingKey;playingKey="";refreshPlayBtns();
  if(seqOn){const idx=rows.findIndex(s=>keyOf(s)===was),nxt=idx>=0?rows[idx+1]:null;
    if(nxt&&nxt.sid){playSong(nxt);return}}
  $("player").classList.remove("on");
});
au.addEventListener("error",()=>{clearTimeout(playTimer);tip("音源加载失败，点「去听」去网易云听");playingKey="";$("player").classList.remove("on");refreshPlayBtns()});
$("ptoggle").onclick=()=>{if(au.paused)au.play().catch(()=>tip("播不了，点「去听」跳转"));else au.pause()};
$("pseq").onclick=()=>{seqOn=!seqOn;$("pseq").setAttribute("aria-pressed",String(seqOn));tip(seqOn?"连播已开：播完自动放下一首":"连播已关")};
$("pclose").onclick=()=>{au.pause();au.removeAttribute("src");playingKey="";$("player").classList.remove("on");refreshPlayBtns()};

/* ================= 乐队详情 ================= */
function openBand(id){
  const b=BMAP[id];if(!b)return;
  if(st.tab!=="band")st.prevTab=st.tab;st.openBand=id;
  const list=SONGS.filter(s=>s.b===id).sort((a,b2)=>(b2.d||"").localeCompare(a.d||""));
  const first=list.length?list[list.length-1].d:"";
  const covers=list.filter(s=>s.k==="cover").length;
  const h='<button class="bback" id="bb">← 返回</button>'+
   '<div class="bhero" style="--bc:'+b.color+'">'+
     '<div class="bheroimg">'+(imgOf(b)?'<img src="'+imgOf(b)+'" alt="'+esc(b.ja)+' 全员立绘" width="560" height="688" decoding="async">':'')+'</div>'+
     '<div class="bheroin" style="--bc:'+b.color+'">'+
       '<h2>'+esc(b.ja)+'</h2><p class="kana">'+esc(b.kana||"")+'</p>'+
       (b.story?'':'<p class="desc">'+esc(b.desc||'')+'</p>')+
       '<div class="bstat">'+
         '<div><b>'+list.length+'</b><span>收录曲目</span></div>'+
         '<div><b>'+(b.members.length||"—")+'</b><span>成员</span></div>'+
         '<div><b>'+(first?fmt(first):"—")+'</b><span>数据内最早发行</span></div>'+
         '<div><b>'+covers+'</b><span>翻唱曲</span></div>'+
       '</div>'+
       '<div class="links">'+
         (b.slug?'<a class="act off" href="https://bang-dream.com/artist/'+b.slug+'/" target="_blank" rel="noopener">官网乐队页 ↗</a>':'')+
         (b.id==="yumemita"?'<a class="act off" href="https://bang-dream.com/yumemita/" target="_blank" rel="noopener">官网特设页 ↗</a>':'')+
         '<button class="act play" id="bplay">只看这支乐队的歌</button>'+
       '</div>'+
     '</div>'+
   '</div>'+
   (b.story?'<div class="sec"><div class="sech"><h2>乐队故事</h2><p>译自官网乐队页</p></div>'+
     '<div class="story"><p class="cn">'+esc(b.story.cn)+'</p>'+
     '<details><summary>日文原文（官网）</summary><p>'+esc(b.story.ja)+'</p></details></div></div>':'')+
   (b.members.length?'<div class="sec"><div class="sech"><h2>成员</h2><p>顺序同官网 · 介绍译自官网成员页</p></div><div class="mlist">'+
     b.members.map(m=>'<div class="mcard" style="--bc:'+b.color+'">'+
       '<div class="mtop"><span class="mrole">'+esc(m.r)+'</span><span class="mname">'+esc(m.n)+'</span>'+
       (m.cv?'<span class="mcv">CV. '+esc(m.cv)+'</span>':'')+(BD[m.n]?'<span class="mbd" title="生日">🎂 '+BD[m.n]+'</span>':'')+'</div>'+
       (m.cn?'<p class="mdesc">'+esc(m.cn)+'</p>':'')+'</div>').join("")+
   '</div></div>':'')+
   '<div class="sec"><div class="sech"><h2>曲目</h2><p id="bsub">'+list.length+' 首 · 点「去听」跳网易云</p></div>'+
   '<div class="bsearch"><input id="bq" type="search" inputmode="search" autocomplete="off" placeholder="在这支乐队里搜曲名 / 专辑…" aria-label="乐队内搜索"><span class="bres" id="bres"></span><button id="bqc" aria-label="清空">清空</button></div>'+
   '<div class="list" id="blist"></div></div>';
  $("v-band").innerHTML=h;
  document.body.classList.add("themed");
  document.body.style.setProperty("--bc",b.color);
  const tm=$("thememeta");if(tm)tm.setAttribute("content",b.color);
  const bl=$("blist");
  const first60=list.slice(0,40);
  bl.innerHTML=songRows(list,0,first60.length,"");
  if(list.length>40){const m=document.createElement("button");m.className="more";m.id="bmore";
    m.textContent="显示这支乐队的全部 "+list.length+" 首";bl.after(m);
    m.onclick=()=>{bl.innerHTML=songRows(list,0,list.length,"");m.remove();};}
  rows=list;window.__brows=list;
  $("bb").onclick=()=>switchTab(st.prevTab||"bands");
  $("bplay").onclick=()=>{st.bands=[id];st.shown=BATCH;buildChips();switchTab("songs");apply(false)};
  let bt=null;
  const renderB=(q)=>{
    const fl=q?list.filter(s=>match(s,q)):list;
    $("bsub").textContent=fl.length+' / '+list.length+' 首 · 点「去听」跳网易云';
    bl.innerHTML=songRows(fl,0,fl.length,"");
    rows=fl;window.__brows=fl;
  };
  $("bq").oninput=e=>{clearTimeout(bt);bt=setTimeout(()=>renderB(e.target.value),140)};
  $("bqc").onclick=()=>{$("bq").value="";renderB("")};
  switchTab("band",true,true);setHash("band/"+id);
}

/* ================= 说明 ================= */
(function(){
  const newBands=["yumemita","millsage","ikkadumb"].map(i=>BMAP[i].ja).join("、");
  $("v-about").innerHTML=
  '<div class="doc">'+
  '<h2>这个页面是什么</h2>'+
  '<p>一份《BanG Dream!》（邦多利）的乐队名录 + 曲目索引。乐队与成员以官方 Artist 页为准，曲目以官方 Discography 与网易云专辑数据交叉整理，共 '+SONGS.length+' 首、'+BANDS.filter(b=>b.slug).length+' 支官网在册乐队。</p>'+
  '<h3>数据来源</h3><ul>'+
  '<li>乐队与成员名录：官方 <a href="https://bang-dream.com/artist/" target="_blank" rel="noopener">Artist 页</a>及各乐队页、各成员页（日文原名、担当、CV），抓取时间 '+CUT+'。</li>'+
  '<li>乐队故事与成员介绍：译自官网各乐队页 / 成员页的官方简介（中文为非官方翻译，日文原文可在乐队详情页展开对照）。</li>'+
  '<li>发行与曲目：官方 <a href="https://bang-dream.com/discographies" target="_blank" rel="noopener">Discography 页</a>，并按曲目名/发行日与网易云专辑页交叉核对。</li>'+
  '<li>试听链接：网易云音乐公开歌曲页；MV 链接为 B 站官方账号（48 首，官方频道的曲目）。</li>'+
  '<li>交叉核对站点：<a href="https://bdon.yatta.moe/" target="_blank" rel="noopener">bdon.yatta.moe</a>（粉丝数据库）。</li>'+
  '<li>成员生日与企划年表：成员生日以粉丝 wiki 收录的官方角色页生日为准（逐条核对，Ave Mujica 按真人名、RAISE A SUILEN 按艺名对应）；年表综合 Wikipedia 与官网 Anime 页整理。</li>'+
  '</ul>'+
  '<h3>这一版比上一版多了什么</h3><ul>'+
  '<li>补上官网在册但上一版没有的三支：《'+newBands+'》，其中夢限大みゅーたいぷ 按官网 Artist 页收录全部已发行曲目。</li>'+
  '<li>补上 12 支乐队的成员名录（日文原名 + 担当 + CV）与官方简介，全部取自官方 Artist 页。</li>'+
  '<li>补上 2026-11-11 以后的官网新条目（Roselia「MAdEaR MAdEaR (Cover)」、Poppin’Party × Roselia 分割单曲等），这些还没进网易云，直接给官网条目链接。</li>'+
  '<li>每支乐队换成官网 Artist 页的全员立绘，本版升级为 560px 宽高清编码（手机 3 倍屏上网格卡片不再发虚）；乐队页、搜索、筛选与收藏重做。</li>'+
  '<li>新增每支乐队的「乐队故事」和每位成员的介绍（担当 / CV / 官方简介中译），全部取自官网。</li>'+
  '</ul>'+
  '<h3>2026-11-17 这一轮又改了什么</h3><ul>'+
  '<li>歌曲列表按年份分组（2016 → 2026），翻某个年代的歌不用再滚长列表。</li>'+
  '<li>乐队详情页里可以直接搜曲名 / 专辑，不用退回总列表再筛。</li>'+
  '<li>首页新增「我的收藏」进度卡：想听 / 已听进度条，点 ♥ ✓ 实时更新，还能一键跳到想听清单。</li>'+
  '<li>播放条新增「🔂 连播」开关：一首播完自动接下一首（音源可播时）。</li>'+
  '<li>进乐队详情页，页面会染上这支乐队的应援色（手机状态栏也会跟着变）。</li>'+
  '<li>列表拉深了，右下角会出现「↑」回到顶部。</li>'+
  '</ul>'+
  '<h3>2026-11-17 乐队图全面换新</h3><ul>'+
  '<li>12 支乐队的图片<b>全部换掉重找</b>：换成更高分辨率的官方全员横幅合影（约 1122×992 起步的官方图源），重新编码为 540px 宽高清 WebP。</li>'+
  '<li>卡片不再用固定竖版比例：每支乐队按图片真实比例设置卡片比例，画面铺满、两侧不再留空边；乐队详情页大图同样铺满显示。</li>'+
  '</ul>'+
  '<h3>2026-11-17 内容扩充</h3><ul>'+
  '<li>每位成员卡片新增 🎂 生日（60 位，Glitter*Green 官方未公布生日，暂缺）。</li>'+
  '<li>首页新增「企划年表」：从 2015 年企划启动到 2027 年 1 月「MyGO!!!!! // Ave Mujica」定档。</li>'+
  '</ul>'+
  '<h3>2026-11-17 视觉重做</h3><ul>'+
  '<li>整页视觉重做：顶栏与播放条改为深色玻璃拟态，更像 Live 会场的灯牌氛围；统计面板改成深色数据条，数字带渐变高光。</li>'+
  '<li>卡片重排：乐队卡、歌曲卡、成员卡统一了圆角、留白与阴影层级；歌曲卡和成员卡左侧加了乐队应援色指示条，一眼分辨是哪支乐队的歌。</li>'+
  '<li>年份分组改成大号渐变年份数字 + 细分隔线；筛选、收藏、播放等按钮全部加了按压缩放反馈。</li>'+
  '<li>播放条改为悬浮圆角胶囊，弹出带动画；播放键换成渐变主按钮，连播开启时变绿。</li>'+
  '<li>页面背景加了三团很淡的应援色光晕，标题文字带渐变；搜索框聚焦、想听/已听点亮都有柔和过渡（系统开了「减少动态」会自动关掉全部动效）。</li>'+
  '</ul>'+
  '<h3>已知边界（说清楚，免得你踩坑）</h3><ul>'+
  '<li><b>页面内试听</b>靠网易云公开的外链接口，能不能播取决于那首歌在网易云是否免费开放，会随时变；播不了就用「去听」跳过去，或在网易云里登录听。上一版给每首标过「可听 / 试听 / 无源」，那套标记依赖测试当时的状态、不可靠，这版去掉了。</li>'+
  '<li>曲目标注的发行日以网易云专辑页为准，与官网个别条目会差 1 天（例如官方写 11-07、网易云写 11-06），属正常差异。</li>'+
  '<li>Glitter*Green 与 CRYCHIC 不在官网 Artist 页的 12 支之列，只作「特别团体」保留，信息来自粉丝 wiki，未逐条核过官方。</li>'+
  '<li>RAISE A SUILEN 官网按艺名（レイヤ、ロック…）列出成员，本页照官网写法；Ave Mujica 官网按舞台名标示角色，本页用真名列。</li>'+
  '<li>「官方 MV」只覆盖能确认到官方频道 BV 号的 48 首，其余曲目没有官方 MV 链接，不代表官方没发。</li>'+
  '</ul>'+
  '<h3>微信 / 离线怎么用</h3><ul>'+
  '<li>整个页面是一个 HTML 文件，<b>不联网也能打开</b>，乐队名录、曲目、筛选、收藏都在本地。</li>'+
  '<li>微信内置浏览器会拦外部音源和部分跳转：点右上角 <code>···</code> →「在浏览器打开」，或用系统浏览器直接打开这个文件。</li>'+
  '<li>收藏（♥ 想听 / ✓ 已听）与浏览状态分开存，重置只清浏览状态，不动收藏。</li>'+
  '</ul>'+
  '<button class="reset" id="resetBtn">重置浏览状态（保留收藏）</button>'+
  '</div>'+
  '<div class="doc"><h2>免责声明</h2><p>个人整理的非官方页面，与 Bushiroad 及 BanG Dream! Project 无关联。作品名、角色名、乐队名的著作权归各自权利人所有。页面内的立绘来自官方站点，仅作个人资料整理展示之用，请勿二次分发或商用。</p></div>';
  $("resetBtn").onclick=()=>{
    st=Object.assign({},DEF);st.tab="bands";$("q").value="";
    $("sortBtn").textContent="排序："+SORTNAME[st.sort];buildChips();
    saveView();render();switchTab("bands",false,true);
    tip("已重置浏览状态（收藏保留）");
  };
})();

/* ================= Tab ================= */
const tabY={home:0,songs:0,bands:0,albums:0,playlists:0,about:0};
function switchTab(t,keepScroll,force){
  if(!force&&t===st.tab)return;
  if(t!=="band"){document.body.classList.remove("themed");document.body.style.removeProperty("--bc");
    const tm2=$("thememeta");if(tm2)tm2.setAttribute("content","#12131a")}
  if(tabY[st.tab]!==undefined)tabY[st.tab]=window.scrollY;
  st.tab=t;
  document.querySelectorAll(".tabs button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.tab===t)));
  ["home","songs","bands","band","albums","playlists","about"].forEach(v=>{const el=$("v-"+v);if(el)el.hidden=(v!==t)});
  window.scrollTo({top:(t==="band")?0:(tabY[t]||0),behavior:"auto"});
  setHash(t==="band"?"":t);
  if(t==="home")renderHome();
  else if(t==="albums")renderAlbums();
  else if(t==="playlists")renderPlaylists();
  saveView();
  updateTotop();
}
$("tabs").addEventListener("click",e=>{const b=e.target.closest("button[data-tab]");if(b)switchTab(b.dataset.tab)});
/* ================= 交互 ================= */
let qt=null;
$("q").oninput=e=>{st.q=e.target.value;st.shown=BATCH;clearTimeout(qt);qt=setTimeout(()=>apply(false),140)};
$("qc").onclick=()=>{st.q="";$("q").value="";st.shown=BATCH;apply(false)};
$("sortBtn").onclick=()=>{const o=["dateDesc","dateAsc","titleAsc"];st.sort=o[(o.indexOf(st.sort)+1)%o.length];
  $("sortBtn").textContent="排序："+SORTNAME[st.sort];apply(false)};
$("randBtn").onclick=()=>{
  const r=filtered();if(!r.length)return;
  const s=r[Math.floor(Math.random()*r.length)];
  if(st.tab!=="songs")switchTab("songs");
  const i=rows.indexOf(s);if(i<0||i>=st.shown){st.shown=Math.min(Math.max(i+5,st.shown),rows.length);render()}
  const el=document.querySelectorAll("#list .song")[i];
  if(el){el.scrollIntoView({block:"center",behavior:"smooth"});el.style.transition="box-shadow .3s";
    el.style.boxShadow="0 0 0 3px var(--acc)";setTimeout(()=>el.style.boxShadow="",1500)}
  tip("随机到了："+s.t);
};
$("moreBtn").onclick=()=>{
  const from=st.shown;st.shown=Math.min(st.shown+BATCH,rows.length);
  $("list").insertAdjacentHTML("beforeend",songRows(rows,from,st.shown,from>0?yOf(rows[from-1]):""));
  $("moreBtn").hidden=st.shown>=rows.length;
  $("moreBtn").textContent="加载更多（还有 "+(rows.length-st.shown)+" 首）";
  saveView();
};

/* ================= 回顶部 ================= */
const ttop=$("totop");
function updateTotop(){if(ttop)ttop.classList.toggle("on",window.scrollY>700)}
window.addEventListener("scroll",updateTotop,{passive:true});
if(ttop)ttop.onclick=()=>window.scrollTo({top:0,behavior:"smooth"});

/* ================= 状态持久化 ================= */
function saveView(){
  st.scrollY=window.scrollY;
  save(LS_VIEW,st);
}
let vt=null;
window.addEventListener("scroll",()=>{clearTimeout(vt);vt=setTimeout(saveView,250)},{passive:true});
window.addEventListener("pagehide",saveView);
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="hidden")saveView()});

/* ================= 启动（见网站版 bootApp） ================= */

/* ================= 提示 ================= */
let tt=null;
function tip(m){const el=$("toast");el.textContent=m;el.classList.add("on");clearTimeout(tt);tt=setTimeout(()=>el.classList.remove("on"),1800)}

  /* ================= 数据状态 / 自动更新 ================= */
  const LAST_SYNC = META.syncedAt ? new Date(META.syncedAt) : null;
  function timeAgo(d) {
    if (!d || isNaN(d)) return "未知";
    const s = Math.max(1, Math.round((Date.now() - d.getTime()) / 1000));
    if (s < 60) return s + " 秒前";
    if (s < 3600) return Math.round(s / 60) + " 分钟前";
    if (s < 86400) return Math.round(s / 3600) + " 小时前";
    return Math.round(s / 86400) + " 天前";
  }
  function renderSync() {
    const el = $("synctxt"); if (!el) return;
    const txt = "数据 " + timeAgo(LAST_SYNC);
    el.textContent = txt;
    const chip = $("syncchip");
    if (chip) chip.classList.toggle("stale", LAST_SYNC && Date.now() - LAST_SYNC.getTime() > 14 * 864e5);
    const f = $("foot");
    if (f) f.innerHTML = '非官方粉丝整理 · 乐队与成员以官方 <a href="https://bang-dream.com/artist/" target="_blank" rel="noopener">Artist</a> 页为准' +
      '<br>数据：' + SONGS.length + ' 首 / ' + BANDS.length + ' 组 · 同步于 ' + (LAST_SYNC ? LAST_SYNC.toLocaleString("zh-CN") : "—") +
      ' · <a href="#about">数据来源与更新说明</a>';
  }
  async function pollMeta() {
    try {
      const j = await fetch("data/meta.json", { cache: "no-store" }).then(r => r.json());
      if (j.version && META.version && j.version !== META.version) {
        const bar = $("syncbar"), t = $("syncbar-txt");
        if (bar) { bar.hidden = false; t.textContent = "官方数据有更新（" + (j.cut || "") + "），共 " + j.counts.songs + " 首"; }
      }
    } catch (e) { }
  }

  /* ================= 首页 ================= */
  let pickOffset = 0;
  function dayKey() { const d = new Date(); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate() }
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
  function dailySong() { return SONGS[(hashStr(dayKey()) + pickOffset) % SONGS.length] }
  function pickHTML(s) {
    const b = BMAP[s.b] || { ja: s.b, color: "#999" };
    const k = s.k || "orig";
    return '<div class="pt">' + esc(s.t) + '</div>' +
      '<div class="pm"><span><i style="background:' + b.color + '"></i>' + esc(b.ja) + '</span>' +
      (s.d ? '<span>' + fmt(s.d) + '</span>' : '') +
      '<span class="pk">' + (KIND[k] ? KIND[k][0] : k) + '</span>' +
      (s.al ? '<span>' + esc(s.al) + '</span>' : '') + '</div>' +
      '<div class="pick-acts">' +
      (s.sid ? '<button class="btn" data-play="' + esc(keyOf(s)) + '">▶ 试听</button>' : '') +
      (s.sid ? '<a class="btn" href="https://music.163.com/song?id=' + s.sid + '" target="_blank" rel="noopener">去听 ↗</a>' : '') +
      (s.bv ? '<a class="btn" href="https://www.bilibili.com/video/' + esc(s.bv) + '" target="_blank" rel="noopener">MV ↗</a>' : '') +
      '<button class="btn" data-fav="' + esc(keyOf(s)) + '" aria-pressed="' + (isWant(s) ? "true" : "false") + '">♥ 想听</button>' +
      '<button class="btn" data-heard="' + esc(keyOf(s)) + '" aria-pressed="' + (isHeard(s) ? "true" : "false") + '">✓ 已听</button>' +
      '</div>';
  }
  function renderPick() { const p = $("home-pick"); if (p) p.innerHTML = pickHTML(dailySong()) }

  function chartYears() {
    const box = $("chart-years"); if (!box) return;
    const m = new Map();
    SONGS.forEach(s => { const y = (s.d || "").slice(0, 4) || "未标注"; m.set(y, (m.get(y) || 0) + 1) });
    const rows = [...m.entries()].filter(([y]) => /^\d{4}$/.test(y)).sort((a, b) => a[0].localeCompare(b[0]));
    const max = Math.max(1, ...rows.map(r => r[1]));
    box.innerHTML = '<div class="years">' + rows.map(([y, n]) =>
      '<div class="ycol"><div class="ybar" style="height:' + Math.round(n / max * 100) + '%"><span>' + n + '</span></div><div class="ylab">' + y.slice(2) + '</div></div>'
    ).join("") + '</div>' +
      '<p style="font-size:11px;color:var(--tx3);margin-top:8px">横轴为年份后两位，柱高为当年曲目数。数据截至 ' + CUT + '。</p>';
  }
  function chartKinds() {
    const box = $("chart-kinds"); if (!box) return;
    const color = { orig: "#e8426e", cover: "#f2a03d", collab: "#12a37a", live: "#7b6cff" };
    const m = {}; SONGS.forEach(s => { const k = s.k || "orig"; m[k] = (m[k] || 0) + 1 });
    const order = ["orig", "cover", "collab", "live"].filter(k => m[k]);
    const total = SONGS.length;
    let acc = 0; const stops = [];
    order.forEach(k => { const from = acc / total * 100; acc += m[k]; const to = acc / total * 100; stops.push(color[k] + " " + from.toFixed(2) + "% " + to.toFixed(2) + "%") });
    const donut = '<div class="donut" style="background:conic-gradient(' + stops.join(",") + ')"><b>' + SONGS.length + '<em>首曲目</em></b></div>';
    const legend = '<div class="legend">' + order.map(k =>
      '<div class="lg"><i style="background:' + color[k] + '"></i>' + KIND[k][0] +
      '<span>' + m[k] + ' · ' + Math.round(m[k] / total * 100) + '%</span></div>').join("") + '</div>';
    box.innerHTML = '<div class="donutwrap">' + donut + legend + '</div>';
  }
  function chartBands() {
    const box = $("chart-bands"); if (!box) return;
    const m = {}; SONGS.forEach(s => { m[s.b] = (m[s.b] || 0) + 1 });
    const rows = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const max = rows[0] ? rows[0][1] : 1;
    box.innerHTML = '<div class="hbars">' + rows.map(([id, n]) => {
      const b = BMAP[id] || { ja: id, color: "#999" };
      return '<div class="hb"><span class="nm">' + esc(b.ja) + '</span>' +
        '<span class="tr"><i style="width:' + Math.round(n / max * 100) + '%;background:' + b.color + '"></i></span>' +
        '<span class="vv">' + n + '</span></div>';
    }).join("") + '</div>';
  }

  /* ================= 专辑 ================= */
  let ALBUMS = [], aYear = "all", aExpanded = false;
  function buildAlbums() {
    const m = new Map();
    SONGS.forEach(s => {
      if (!s.al) return;
      const key = s.al + "\u0001" + (s.d || "");
      let g = m.get(key);
      if (!g) { g = { al: s.al, d: s.d || "", songs: [], bands: new Map() }; m.set(key, g) }
      g.songs.push(s);
      g.bands.set(s.b, (g.bands.get(s.b) || 0) + 1);
    });
    ALBUMS = [...m.values()].map(g => ({
      al: g.al, d: g.d, songs: g.songs,
      bands: [...g.bands.entries()].sort((a, b) => b[1] - a[1]).map(x => x[0])
    })).sort((a, b) => b.d.localeCompare(a.d) || a.al.localeCompare(b.al, "ja"));
    ALBUMS.forEach((g, i) => g.id = i);
  }
  function fillTracks(card) {
    const box = card.querySelector(".atracks");
    if (!box || box.dataset.filled === "1") return;
    const g = ALBUMS[+card.dataset.ai];
    if (!g) return;
    box.innerHTML = g.songs.map((s, i) =>
      '<div class="atrep"><span class="no">' + (i + 1) + '</span><span class="tt">' + esc(s.t) + '</span>' +
      '<span class="kk">' + (KIND[s.k || "orig"] ? KIND[s.k || "orig"][0] : (s.k || "")) + '</span></div>').join("");
    box.dataset.filled = "1";
  }
  function albumCard(g) {
    const b = BMAP[g.bands[0]] || { ja: "", color: "#999" };
    const future = g.d && g.d > new Date().toISOString().slice(0, 10);
    return '<div class="acard" data-ai="' + g.id + '">' +
      '<button type="button" aria-expanded="false" style="--bc:' + b.color + '">' +
      '<span class="cov"></span>' +
      '<span class="am"><span class="at">' + esc(g.al) + '</span>' +
      '<span class="as">' + g.bands.map(id => esc((BMAP[id] || { ja: id }).ja)).join(" · ") +
      (future ? '<em class="pre">未发售</em>' : '') + '</span></span>' +
      '<span class="an">' + fmt(g.d) + '<b>' + g.songs.length + ' 首</b></span>' +
      '<span class="caret">▸</span></button>' +
      '<div class="atracks" data-filled="0"></div></div>';
  }
  function renderAlbums() {
    const listBox = $("albumlist"); if (!listBox) return;
    const q = norm($("aq").value || "");
    const list = ALBUMS.filter(g => (aYear === "all" || g.d.slice(0, 4) === aYear) &&
      (!q || norm(g.al + " " + g.bands.map(id => (BMAP[id] || {}).ja || "").join(" ")).includes(q)));
    listBox.innerHTML = list.length ? list.slice(0, 120).map(albumCard).join("") :
      '<div class="empty">没有符合条件的专辑</div>';
    if (list.length > 120) listBox.insertAdjacentHTML("beforeend", '<div class="cnt"><span>先显示前 120 张，用搜索缩小范围</span></div>');
    const cnt = $("acnt");
    if (cnt) cnt.innerHTML = '共 <b>' + list.length + '</b> 张作品 · ' + list.reduce((n, g) => n + g.songs.length, 0) + ' 首';
    if (aExpanded) listBox.querySelectorAll(".acard").forEach(c => { c.classList.add("open"); c.querySelector("button").setAttribute("aria-expanded", "true") });
  }
  function renderAlbumFilters() {
    const box = $("ayear"); if (!box) return;
    const years = [...new Set(ALBUMS.map(g => g.d.slice(0, 4)).filter(y => /^\d{4}$/.test(y)))].sort().reverse();
    box.innerHTML = '<span class="cl">年份</span>' +
      '<button class="chip ychip" data-y="all" aria-pressed="true">全部<span class="n">' + ALBUMS.length + '</span></button>' +
      years.map(y => '<button class="chip ychip" data-y="' + y + '" aria-pressed="false">' + y + '<span class="n">' + ALBUMS.filter(g => g.d.slice(0, 4) === y).length + '</span></button>').join("");
  }

  function renderLatest() {
    const box = $("home-latest");
    if (box) box.innerHTML = ALBUMS.slice(0, 6).map(albumCard).join("");
  }

  /* ================= 歌单 ================= */
  function resolvePlaylist(p) {
    const r = p.rule || p;
    if (r.titles && r.titles.length) {
      const out = r.titles.map(t => SONGS.find(s => s.t === t)).filter(Boolean);
      if (out.length) return out;
    }
    let arr = SONGS.slice();
    if (r.band) { const set = new Set([].concat(r.band)); arr = arr.filter(s => set.has(s.b)) }
    if (r.kind) { const set = new Set([].concat(r.kind)); arr = arr.filter(s => set.has(s.k || "orig")) }
    if (r.tie) arr = arr.filter(s => s.tie);
    arr.sort((a, b) => (r.sort === "dateAsc" ? (a.d || "").localeCompare(b.d || "") : (b.d || "").localeCompare(a.d || "")));
    return arr.slice(0, r.limit || 20);
  }
  function renderPlaylists() {
    const grid = $("plgrid"), detail = $("pldetail");
    if (!grid) return;
    grid.hidden = false; detail.hidden = true;
    grid.innerHTML = PLAYLISTS.map(p => {
      const n = resolvePlaylist(p).length;
      return '<button class="plcard" data-pl="' + esc(p.id) + '" style="--p1:' + (p.p1 || "#2a1b2e") + ';--p2:' + (p.p2 || "#15161e") + '">' +
        '<div><div class="pt">' + esc(p.title) + '</div><div class="ps">' + esc(p.sub || "") + '</div></div>' +
        '<div class="pc">' + n + ' 首 · ' + (p.rule ? "按规则自动生成" : "人工挑选") + '</div></button>';
    }).join("");
  }
  function openPlaylist(id) {
    const p = PLAYLISTS.find(x => x.id === id); if (!p) return;
    const songs = resolvePlaylist(p);
    const grid = $("plgrid"), detail = $("pldetail");
    grid.hidden = true; detail.hidden = false;
    const head = '<div class="plhead"><button class="back" id="plback">← 歌单</button>' +
      '<div><h2>' + esc(p.title) + '</h2><p>' + esc(p.sub || "") + ' · ' + songs.length + ' 首</p></div></div>';
    detail.innerHTML = head + '<div class="list">' + songs.map(s => songHTML(s)).join("") + '</div>';
    window.scrollTo({ top: 0, behavior: "auto" });
    $("plback").onclick = () => renderPlaylists();
  }

  /* ================= 路由 ================= */
  const VIEWS = ["home", "songs", "bands", "albums", "playlists", "about"];
  function setHash(h) {
    const t = h ? "#" + h : "";
    if (location.hash === t) return;
    try { history.replaceState(null, "", t || location.pathname + location.search) } catch (e) { }
  }
  function routeFromHash(force) {
    const h = location.hash || "";
    const m = /^#band\/(.+)$/.exec(h);
    if (m && BMAP[m[1]]) { openBand(m[1]); return }
    const v = h.replace(/^#\/?/, "");
    if (VIEWS.includes(v)) { switchTab(v, false, true); return }
    switchTab("home", false, true);
  }
  window.addEventListener("hashchange", () => routeFromHash(true));

  /* ================= 启动 ================= */
  function bootApp() {
    const v = load(LS_VIEW, null);
    if (v && typeof v === "object") {
      st = Object.assign({}, DEF, v);
      if (!["home", "songs", "bands", "about", "albums", "playlists"].includes(st.tab)) st.tab = "home";
      if (!["dateDesc", "dateAsc", "titleAsc"].includes(st.sort)) st.sort = "dateDesc";
    }
    wantK = new Set(load(LS_WANT, [])); heardK = new Set(load(LS_HEARD, []));
    $("q").value = st.q || "";
    $("sortBtn").textContent = "排序：" + (SORTNAME[st.sort] || SORTNAME.dateDesc);
    buildChips();
    buildAlbums();
    renderAlbumFilters();
    render();
    renderSync();
    updateProg();
    routeFromHash();
    measureHd(); setTimeout(measureHd, 60);
    const y = st.scrollY || 0;
    if (y > 20) {
      const go = () => { document.documentElement.style.scrollBehavior = "auto"; window.scrollTo(0, y) };
      requestAnimationFrame(go); setTimeout(go, 80); setTimeout(go, 300);
    }
    if (bootEl) { bootEl.classList.add("done"); setTimeout(() => bootEl.remove(), 400) }
    renderPick();
    renderHomeBadges();
    renderAboutExtras();
    pollMeta();
    if ("serviceWorker" in navigator && /^https?:/.test(location.protocol)) {
      navigator.serviceWorker.register("sw.js").catch(() => { });
    }
    setInterval(() => { if (document.visibilityState !== "hidden") { renderSync() } }, 60000);
    setInterval(pollMeta, 90000);
  }
  function renderHomeBadges() {
    const d = new Date();
    const el = $("home-date");
    if (el) el.textContent = d.getFullYear() + " 年 " + (d.getMonth() + 1) + " 月 " + d.getDate() + " 日 · " + "日一二三四五六"[d.getDay()] + "曜";
    const sub = $("home-sub");
    if (sub) sub.textContent = "收录 " + SONGS.length + " 首曲目 · " + BANDS.filter(b => b.slug).length + " 支官网乐队 · 数据同步于 " + (LAST_SYNC ? timeAgo(LAST_SYNC) : "—");
  }

  function renderAboutExtras() {
    const box = $("v-about");
    if (!box || box.dataset.extra === "1") return;
    box.dataset.extra = "1";
    const log = CHANGELOG.slice(0, 12).map(c =>
      '<div class="logrow"><time>' + esc(c.date) + '</time><div>' + esc(c.text) + '</div></div>').join("") ||
      '<div class="logrow"><time>—</time><div>还没有同步记录。</div></div>';
    box.insertAdjacentHTML("afterbegin",
      '<div class="doc"><h2>数据状态</h2>' +
      '<div class="kv">' +
      '<div><b>' + SONGS.length + '</b><span>收录曲目</span></div>' +
      '<div><b>' + ALBUMS.length + '</b><span>作品 / 专辑</span></div>' +
      '<div><b>' + BANDS.filter(b => b.slug).length + '</b><span>官网在册乐队</span></div>' +
      '<div><b>' + (LAST_SYNC ? timeAgo(LAST_SYNC) : "—") + '</b><span>上次同步</span></div>' +
      '</div>' +
      '<p class="note">曲目、乐队、专辑都存在 <code>data/*.json</code> 里，由 <code>sync/sync.mjs</code> 从官网 Discography 拉取后合并；页面打开期间每 90 秒检查一次 <code>data/meta.json</code>，有更新会在顶部提示刷新。' +
      '本站没有任何后台数据库，所有数据都是静态文件，可以直接托管在 GitHub Pages / Cloudflare Pages。</p>' +
      '<h3>更新日志</h3><div class="log">' + log + '</div>' +
      '</div>' +
      '<div class="doc"><h2>收藏与导出</h2>' +
      '<p>「想听 / 已听」只存在这台设备的浏览器里（localStorage），换设备或清站点数据会丢。想留档就导出成纯文本清单。</p>' +
      '<div class="linkrow">' +
      '<button class="btn" data-export="want">导出想听清单</button>' +
      '<button class="btn" data-export="heard">导出已听清单</button>' +
      '<button class="btn" id="clearFav">清空收藏</button>' +
      '</div>' +
      '<h3>快捷键</h3><p><code>/</code> 跳到搜索框；<code>Esc</code> 关闭筛选面板或清空搜索；点乐队卡片的年份分组可折叠专辑曲目。</p>' +
      '</div>' +
      '<div class="doc"><h2>这一版加了什么</h2><ul>' +
      '<li><b>数据与页面分离</b>：曲目、乐队、专辑、歌单都是独立 JSON，改数据不用重做页面；官网有新碟时跑一次同步脚本即可。</li>' +
      '<li><b>首页</b>：每日一曲、年份分布、类型构成、乐队曲目量、最近发行，配合收藏进度。</li>' +
      '<li><b>专辑视图</b>：344 张作品按发行日倒序，可按年份筛选、展开曲目。</li>' +
      '<li><b>歌单</b>：6 个主题（入门、动画关联、翻唱、LIVE、合唱、深夜系），人工挑选 + 规则生成各有标注。</li>' +
      '<li><b>可安装 / 离线</b>：加了 manifest 与 service worker，装到桌面后断网也能看已加载过的页面。</li>' +
      '</ul></div>');
  }

  document.addEventListener("keydown", e => {
    const tag = (document.activeElement || {}).tagName || "";
    const inField = /INPUT|TEXTAREA|SELECT/.test(tag);
    if (e.key === "/" && !inField) {
      e.preventDefault();
      if (st.tab !== "songs") switchTab("songs");
      const q = $("q"); if (q) { q.focus(); q.select() }
      return;
    }
    if (e.key === "Escape") {
      const panel = $("fpanel");
      if (panel && !panel.hidden) { panel.hidden = true; const b = $("fbtn"); if (b) b.setAttribute("aria-expanded", "false"); return }
      const q = $("q");
      if (document.activeElement === q && q.value) { q.value = ""; st.q = ""; st.shown = BATCH; apply(false) }
    }
  });

  function exportFav(which) {
    const set = which === "want" ? wantK : heardK;
    const list = SONGS.filter(s => set.has(keyOf(s)));
    if (!list.length) { tip("还没有曲目"); return }
    const label = which === "want" ? "想听" : "已听";
    const out = ["# 邦多利 " + label + "清单（" + list.length + " 首）", "导出时间：" + new Date().toLocaleString("zh-CN"), ""];
    list.forEach((s, i) => out.push((i + 1) + ". " + s.t + " — " + ((BMAP[s.b] || {}).ja || s.b) + " · " + (s.d || "") + (s.al ? " · 《" + s.al + "》" : "")));
    const blob = new Blob([out.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "邦多利-" + label + "-" + list.length + "首.txt";
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1500);
    tip("已导出 " + list.length + " 首");
  }

  function renderHome(){
    renderPick();
    renderHomeBadges();
    chartYears();chartKinds();chartBands();
    renderLatest();
  }

  /* ================= 新增交互 ================= */
  document.addEventListener("click", e => {
    const play = e.target.closest("[data-play]");
    if (play) { togglePlayKey(play.dataset.play); return }
    const fav = e.target.closest("[data-fav]");
    if (fav) {
      const s = KEYMAP.get(fav.dataset.fav); if (!s) return;
      const K = keyOf(s);
      if (wantK.has(K)) wantK.delete(K); else wantK.add(K);
      save(LS_WANT, [...wantK]);
      fav.setAttribute("aria-pressed", wantK.has(K) ? "true" : "false");
      buildChips(); updateProg(); syncChipsState(); tip(wantK.has(K) ? "已加入想听" : "已取消想听");
      return;
    }
    const heard = e.target.closest("[data-heard]");
    if (heard) {
      const s = KEYMAP.get(heard.dataset.heard); if (!s) return;
      const K = keyOf(s);
      if (heardK.has(K)) heardK.delete(K); else heardK.add(K);
      save(LS_HEARD, [...heardK]);
      heard.setAttribute("aria-pressed", heardK.has(K) ? "true" : "false");
      updateProg(); tip(heardK.has(K) ? "已标记已听" : "已取消已听");
      return;
    }
    const yc = e.target.closest(".ychip");
    if (yc) {
      aYear = yc.dataset.y;
      document.querySelectorAll(".ychip").forEach(c => c.setAttribute("aria-pressed", String(c === yc)));
      renderAlbums(); return;
    }
    const ac = e.target.closest(".acard > button");
    if (ac) {
      const card = ac.parentElement;
      const on = !card.classList.contains("open");
      card.classList.toggle("open", on);
      ac.setAttribute("aria-expanded", String(on));
      if (on) fillTracks(card);
      return;
    }
    const pl = e.target.closest("[data-pl]");
    if (pl) { openPlaylist(pl.dataset.pl); return }
    if (e.target.closest("#hero-random")) {
      const s = SONGS[Math.floor(Math.random() * SONGS.length)];
      pickOffset = SONGS.indexOf(s);
      $("home-pick").innerHTML = pickHTML(s);
      tip("今晚听：" + s.t);
      return;
    }
    if (e.target.closest("#hero-today")) { pickOffset = (pickOffset + 1) % SONGS.length; renderPick(); return }
    if (e.target.closest("#syncbar-bt")) { location.reload(); return }
    const ex = e.target.closest("[data-export]");
    if (ex) { exportFav(ex.dataset.export); return }
    if (e.target.closest("#clearFav")) {
      if (confirm("清空全部「想听 / 已听」收藏？不可撤销。")) {
        wantK = new Set(); heardK = new Set();
        save(LS_WANT, []); save(LS_HEARD, []);
        buildChips(); updateProg(); render(); tip("收藏已清空");
      }
      return;
    }
    if (e.target.closest("#aexpand")) {
      aExpanded = !aExpanded;
      document.querySelectorAll("#albumlist .acard").forEach(c => {
        c.classList.toggle("open", aExpanded);
        const b = c.querySelector("button"); if (b) b.setAttribute("aria-expanded", String(aExpanded));
        if (aExpanded) fillTracks(c);
      });
    }
  });
  let aqT = null;
  document.addEventListener("input", e => {
    if (e.target.id === "aq") { clearTimeout(aqT); aqT = setTimeout(renderAlbums, 120) }
  });
  document.addEventListener("click", e => { if (e.target.closest("#aqc")) { $("aq").value = ""; renderAlbums() } });

  try { bootApp(); } catch (err) { bootFail(err); console.error(err); }
})();
