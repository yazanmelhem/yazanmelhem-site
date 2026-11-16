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
const services = existsSync(at("./services.json")) ? read("./services.json", "الخدمات") : [];

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

const kindOf = v => /شرح|explain/i.test(`${v.kAr} ${v.kEn}`) ? "explainer" : "doc";
const VIDEOS = videos.map((v, idx) => {
  const id = ytid(v);
  const cover = img(v.cover);
  const pic = cover
    ? `<img src="${e(cover)}" alt="" loading="lazy" decoding="async">`
    : `<img src="https://i.ytimg.com/vi/${e(id)}/maxresdefault.jpg" alt="" loading="lazy" decoding="async"
      onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${e(id)}/hqdefault.jpg'">`;
  return `
<article class="card${idx === 0 ? " featured" : ""}${idx > 6 ? " extra" : ""}" data-kind="${kindOf(v)}">
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

const nDoc = videos.filter(v => kindOf(v) === "doc").length;
const nExp = videos.length - nDoc;
const VFILTER = nDoc && nExp ? `<div class="vfilter" role="group">
  <button type="button" data-f="all" aria-pressed="true"><span class="ar">الكل</span><span class="en">All</span> <i>${videos.length}</i></button>
  <button type="button" data-f="doc" aria-pressed="false"><span class="ar">أفلام وثائقية</span><span class="en">Documentaries</span> <i>${nDoc}</i></button>
  <button type="button" data-f="explainer" aria-pressed="false"><span class="ar">فيديوهات شرح</span><span class="en">Explainers</span> <i>${nExp}</i></button>
</div>` : "";

// ───────── روابط التواصل الإضافية (تظهر حين تُملأ) ─────────
const LINKS = [
  ["linkedin", "LinkedIn", "LinkedIn"],
  ["whatsapp", "واتساب", "WhatsApp"],
].filter(([k]) => String(site[k] || "").trim()).map(([k, ar, en]) => {
  let u = String(site[k]).trim();
  if (k === "whatsapp" && !/^https?:/.test(u)) u = "https://wa.me/" + u.replace(/\D/g, "");
  return `<div class="cbox"><p class="clabel"><span class="ar">${ar}</span><span class="en">${en}</span></p>
      <a href="${e(u)}" target="_blank" rel="noopener">${k === "whatsapp" ? `<span dir="ltr">${e(site[k])}</span>` : e(en)}</a></div>`;
}).join("");

// ───────── الخدمات ─────────
const SERVICES = services.map((s, i) => `
<article class="svc">
  <span class="svc-n">${String(i + 1).padStart(2, "0")}</span>
  <div class="svc-body">
    <h3><span class="ar">${e(s.ar)}</span><span class="en">${e(s.en)}</span></h3>
    <p><span class="ar">${e(s.bodyAr)}</span><span class="en">${e(s.bodyEn)}</span></p>
    ${(s.credits || []).length ? `<ul class="credits">${s.credits.map(c =>
      `<li><span class="ar">${e(c.ar)}</span><span class="en">${e(c.en)}</span></li>`).join("")}</ul>` : ""}
  </div>
</article>`).join("");

// ───────── جهات عمل معها ─────────
const cAr = site.clientsAr || [], cEn = site.clientsEn || [];
const CLIENTS = cAr.length ? `
  <div class="clients">
    <span class="clabel2"><span class="ar">عمل مع</span><span class="en">Worked with</span></span>
    <ul>${cAr.map((c, i) => `<li><span class="ar">${e(c)}</span><span class="en">${e(cEn[i] || c)}</span></li>`).join("")}</ul>
  </div>` : "";

// ───────── مشروع قيد الإنتاج (يظهر فقط حين يُملأ عنوانه) ─────────
const pr = site.project || {};
let PROJECT = "";
if (String(pr.titleAr || "").trim()) {
  const tid = ytid({ id: pr.trailer });
  const pimg = img(pr.image);
  const media = tid
    ? `<button class="thumb" data-id="${e(tid)}" aria-label="Play trailer">${
        pimg ? `<img src="${e(pimg)}" alt="" loading="lazy" decoding="async">`
             : `<img src="https://i.ytimg.com/vi/${e(tid)}/hqdefault.jpg" alt="" loading="lazy" decoding="async">`}${PLAY}</button>`
    : pimg ? `<div class="thumb"><img src="${e(pimg)}" alt="" loading="lazy" decoding="async"></div>` : "";
  PROJECT = `
<section id="project"><div class="wrap">
  <div class="sec-head">
    <h2><span class="ar">قيد الإنتاج</span><span class="en">In Production</span></h2>
  </div>
  <div class="project">
    ${media ? `<div class="pmedia">${media}</div>` : ""}
    <div class="ptext">
      ${pr.statusAr ? `<span class="tag"><span class="ar">${e(pr.statusAr)}</span><span class="en">${e(pr.statusEn)}</span></span>` : ""}
      <h3><span class="ar">${e(pr.titleAr)}</span><span class="en">${e(pr.titleEn)}</span></h3>
      <p><span class="ar">${e(pr.textAr)}</span><span class="en">${e(pr.textEn)}</span></p>
    </div>
  </div>
</div></section>`;
}

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
  <div class="meta-row">${META}</div>
  <div class="cta-row">
    <a class="btn" href="#contact"><span class="ar">${e(site.ctaAr || "تواصل معي")}</span><span class="en">${e(site.ctaEn || "Get in touch")}</span></a>
    <a class="btn ghost" href="#services"><span class="ar">الخدمات</span><span class="en">Services</span></a>
  </div>${CLIENTS}`;

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
  VIDEOS, WRITING, ARCHIVE, SERVICES, PROJECT, VFILTER, LINKS,
  VMORE: videos.length > 7 ? `<div class="vmore"><button type="button" class="btn ghost" id="vmore"><span class="ar">كل الأعمال المرئية (${videos.length})</span><span class="en">All video work (${videos.length})</span></button></div>` : "",
  OG_IMAGE: e(site.ogImage || "/media/og.png"),
  CTA_AR: e(site.ctaAr || "تواصل معي"), CTA_EN: e(site.ctaEn || "Get in touch"),
  CONTACT_AR: e(site.contactAr), CONTACT_EN: e(site.contactEn),
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

console.log(`✓ dist/index.html — ${services.length} خدمات، ${videos.length} فيديو، ${writing.length} مادة مكتوبة، ${archive.reduce((a,g)=>a+g.items.length,0)} في الأرشيف`);
