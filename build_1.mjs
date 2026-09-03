// بناء الموقع: يدمج ملفات المحتوى مع القالب وينتج dist/ الجاهز للنشر.
// بلا أي اعتماديات — يكفي Node.
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";

const at = p => new URL(p, import.meta.url);

const read = (p, what) => {
  try {
    return JSON.parse(readFileSync(at(p), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") throw new Error(`ملف ${what} غير موجود: ${p} — تأكد أنه مرفوع في جذر المستودع.`);
    throw new Error(`خطأ في قراءة ${p} (${what}): ${err.message}\nغالبًا فاصلة أو قوس ناقص. تراجَع عن آخر تعديل في GitHub.`);
  }
};

const site    = read("./site.json",    "نصوص الصفحة");
const videos  = read("./videos.json",  "الأعمال المرئية");
const writing = read("./writing.json", "المواد المكتوبة");
const archive = read("./archive.json", "الأرشيف");

// تهريب الحروف الخاصة حتى لا يكسر عنوانٌ فيه < أو & بنية الصفحة
const e = s => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// استخراج معرّف يوتيوب من رابط كامل أو من المعرّف وحده
const ytid = v => {
  const raw = String(v.id || v.url || "").trim();
  const m = raw.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : raw;
};

// مسار الصورة كما تكتبه لوحة التحرير، مهما كان شكله
const img = v => {
  const raw = String(v ?? "").trim();
  if (!raw) return "";
  if (/^https?:\/\//.test(raw) || raw.startsWith("/")) return raw;
  return "/" + raw.replace(/^\.?\//, "");
};

const PLAY = '<span class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>';

const VIDEOS = videos.map(v => {
  const id = ytid(v);
  const cover = img(v.cover);
  const pic = cover
    ? `<img src="${e(cover)}" alt="" loading="lazy" decoding="async">`
    : `<img src="https://i.ytimg.com/vi/${e(id)}/maxresdefault.jpg" alt="" loading="lazy" decoding="async"
      onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${e(id)}/hqdefault.jpg'">`;
  return `
<article class="card">
  <button class="thumb" data-id="${e(id)}" aria-label="Play">${pic}${PLAY}</button>
  <div class="card-body">
    <span class="tag"><span class="ar">${e(v.kAr)}</span><span class="en">${e(v.kEn)}</span></span>
    <h3><span class="ar">${e(v.ar)}</span><span class="en">${e(v.en)}</span></h3>
    <p class="cmeta">${[v.y, v.d].filter(Boolean).map(e).join(" · ")}</p>
  </div>
</article>`;
}).join("");

const WRITING = writing.map(w => {
  const t = img(w.image);
  return `
<a class="item" href="${e(w.u)}" target="_blank" rel="noopener">
  <span class="iyear">${e(w.y)}</span>
  ${t ? `<img class="item-thumb" src="${e(t)}" alt="" loading="lazy" decoding="async">` : ""}
  <span style="flex:1">
    <span class="ititle" style="display:block"><span class="ar">${e(w.ar)}</span><span class="en">${e(w.en)}</span></span>
    <span class="ikind" style="display:block"><span class="ar">${e(w.kAr)}</span><span class="en">${e(w.kEn)}</span></span>
  </span>
  <span class="arrow">↗</span>
</a>`;
}).join("");

const ARCHIVE = archive.map(g => `
<details>
  <summary><span><span class="ar">${e(g.ar)}</span><span class="en">${e(g.en)}</span> <span style="color:var(--muted);font-weight:400">(${g.items.length})</span></span></summary>
  <div class="arch">${g.items.map(i => `
    <a href="${e(i.u)}" target="_blank" rel="noopener"><span class="y">${e(i.y)}</span>
    <span><span class="ar">${e(i.ar)}</span><span class="en">${e(i.en)}</span></span></a>`).join("")}</div>
</details>`).join("");

const META = (site.metaAr || []).map((t, i) =>
  `<span><i class="dot"></i><span class="ar">${e(t)}</span><span class="en">${e((site.metaEn || [])[i] || t)}</span></span>`
).join("");

/* ───────── نظام التصميم ─────────
   القيم تأتي من site.json ← design. أي قيمة غير معروفة تعود إلى الافتراضي،
   فلا يمكن لخطأ في الكتابة أن يكسر الموقع. */

const PALETTES = {
  "طيني":          { a:"#A8482A", s:"#F2E9E4", da:"#E0764F", ds:"#2A211D" },
  "أزرق ليلي":     { a:"#2B4C7E", s:"#E6EBF2", da:"#7FA5DA", ds:"#1A2233" },
  "أخضر زيتوني":   { a:"#4A6141", s:"#E9EDE6", da:"#96B489", ds:"#1E241B" },
  "نبيذي":         { a:"#7A2E3F", s:"#F2E7EA", da:"#D2798D", ds:"#2A1B1F" },
  "رمادي فحمي":    { a:"#33383B", s:"#E8EAEA", da:"#B9C2C6", ds:"#212527" },
  "برتقالي محروق": { a:"#C1571B", s:"#F7E9DE", da:"#F0904F", ds:"#2E2018" },
};

const FONTS = {
  "IBM Plex Sans Arabic": "IBM+Plex+Sans+Arabic:wght@300;400;500;600;700",
  "Noto Kufi Arabic":     "Noto+Kufi+Arabic:wght@300;400;500;600;700",
  "Cairo":                "Cairo:wght@300;400;500;600;700",
  "Tajawal":              "Tajawal:wght@300;400;500;700",
};

const DARK_TOKENS = "--bg:#141414;--surface:#1C1C1D;--ink:#EDEBE7;--muted:#9A9691;--line:#2E2E30";

const d = site.design || {};
const pal  = PALETTES[d.accent] || PALETTES["طيني"];
const fontName = FONTS[d.font] ? d.font : "IBM Plex Sans Arabic";
const theme = ["فاتح", "داكن"].includes(d.theme) ? d.theme : "حسب جهاز الزائر";

const FONT_LINK = `<link href="https://fonts.googleapis.com/css2?family=${FONTS[fontName]}&display=swap" rel="stylesheet">`;
const FONT_FAMILY = `"${fontName}",-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;

const darkVars = `${DARK_TOKENS};--accent:${pal.da};--accent-soft:${pal.ds}`;
const THEME_BLOCK =
  theme === "داكن" ? `:root{${darkVars}}`
: theme === "فاتح" ? ""
: `@media (prefers-color-scheme:dark){\n  :root{${darkVars}}\n}`;

const GRID_CLASS = d.cardStyle === "بلا إطار" ? " bare" : "";

// ───────── الترويسة ─────────
const heroInner = `
  <h1><span class="ar">${e(site.nameAr)}</span><span class="en">${e(site.nameEn)}</span></h1>
  <p class="role">
    <span class="ar">${e(site.roleAr)}</span>
    <span class="en">${e(site.roleEn)}</span>
  </p>
  <p class="bio">
    <span class="ar">${e(site.bioAr)}</span>
    <span class="en">${e(site.bioEn)}</span>
  </p>
  <div class="meta-row">${META}</div>`;

const portrait = img(site.portrait);
const banner   = img(site.heroImage);
const style = d.heroStyle;

let HERO;
if (style === "اسم وصورة شخصية" && portrait) {
  HERO = `<div class="wrap hero">
  <div class="hero-split">
    <img class="portrait" src="${e(portrait)}" alt="${e(site.nameAr)}" width="132" height="132">
    <div class="hero-text">${heroInner}</div>
  </div>
</div>`;
} else if (style === "صورة عريضة" && banner) {
  HERO = `<div class="wrap hero">
  <img class="banner" src="${e(banner)}" alt="" loading="eager" decoding="async">
  ${heroInner}
</div>`;
} else {
  HERO = `<div class="wrap hero">${heroInner}</div>`;
}

const slots = {
  NAME_AR: e(site.nameAr), NAME_EN: e(site.nameEn),
  VNOTE_AR: e(site.videoNoteAr), VNOTE_EN: e(site.videoNoteEn),
  EMAIL: e(site.email), AUTHOR_URL: e(site.authorUrl),
  CV_URL: e(site.cvUrl), YEAR: e(site.year),
  ACCENT: pal.a, ACCENT_SOFT: pal.s, ACCENT_HEX: pal.a.replace("#", ""),
  FONT_LINK, FONT_FAMILY, THEME_BLOCK, GRID_CLASS, HERO,
  VIDEOS, WRITING, ARCHIVE,
};

if (!existsSync(at("./template.html"))) throw new Error("القالب template.html غير موجود في جذر المستودع.");
let html = readFileSync(at("./template.html"), "utf8");
html = html.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => {
  if (!(k in slots)) throw new Error(`خانة غير معرّفة في القالب: ${m}`);
  return slots[k];
});
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error("بقيت خانات غير مستبدلة في الناتج");

const out = at("./dist/");
mkdirSync(out, { recursive: true });
writeFileSync(new URL("./index.html", out), html);

// ملفات تُنسخ كما هي
for (const f of ["robots.txt", "sitemap.xml", "_headers", "cv.pdf"])
  if (existsSync(at("./" + f))) cpSync(at("./" + f), new URL("./" + f, out));

// مجلد الوسائط الذي تنشئه لوحة التحرير عند رفع أول ملف
if (existsSync(at("./media/")))
  cpSync(at("./media/"), new URL("./media/", out), { recursive: true });

console.log(`✓ dist/index.html — ${videos.length} فيديو، ${writing.length} مادة مكتوبة، ${archive.reduce((a,g)=>a+g.items.length,0)} في الأرشيف`);
