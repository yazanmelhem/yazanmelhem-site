// بناء الموقع: يدمج ملفات المحتوى مع القالب وينتج dist/ الجاهز للنشر.
// بلا أي اعتماديات — يكفي Node.
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from "node:fs";

const at = p => new URL(p, import.meta.url);

const read = (p, what, fallback) => {
  if (fallback !== undefined && !existsSync(at(p))) return fallback;
  try {
    return JSON.parse(readFileSync(at(p), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") throw new Error(`ملف ${what} غير موجود: ${p} — تأكد أنه مرفوع في جذر المستودع.`);
    throw new Error(`خطأ في قراءة ${p} (${what}): ${err.message}\nغالبًا فاصلة أو قوس ناقص. تراجَع عن آخر تعديل في GitHub.`);
  }
};

const site     = read("./site.json",     "نصوص الصفحة");
const videos   = read("./videos.json",   "الأعمال المرئية");
const writing  = read("./writing.json",  "المواد المكتوبة");
const archive  = read("./archive.json",  "الأرشيف");
const services = read("./services.json", "الخدمات", []);
const others   = read("./others.json",   "أعمال لجهات أخرى", []);
const field    = read("./field.json",    "صور من الميدان", []);

// تهريب الحروف الخاصة حتى لا يكسر عنوانٌ فيه < أو & بنية الصفحة
const e = s => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// نص ثنائي اللغة
const bi = (ar, en) => `<span class="ar">${e(ar)}</span><span class="en">${e(en || ar)}</span>`;

// معرّف يوتيوب من رابط كامل أو من المعرّف وحده
const ytid = raw => {
  raw = String(raw || "").trim();
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

const PLAY = '<span class="play" aria-hidden="true"></span>';

// معرّف ملف Google Drive إن كان الرابط منه
const driveId = raw => {
  const m = String(raw || "").match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([A-Za-z0-9_-]{20,})/);
  return m ? m[1] : "";
};

// ───────── غلاف فيلم قابل للتشغيل ─────────
const cover = (v, big) => {
  const did = driveId(v.id || v.url);
  if (did) {
    const c = img(v.cover);
    const pic = `<img src="${e(c || `https://drive.google.com/thumbnail?id=${did}&sz=w1600`)}" alt="" loading="lazy" decoding="async" onerror="this.remove()">`;
    return `<button class="cover" type="button" data-src="https://drive.google.com/file/d/${e(did)}/preview" data-title="${e(v.ar)}">${pic}${PLAY}${v.d ? `<span class="dur">${e(v.d)}</span>` : ""}<span class="sr">${bi("تشغيل: " + v.ar, "Play: " + (v.en || v.ar))}</span></button>`;
  }
  const id = ytid(v.id || v.url);
  const c = img(v.cover);
  const pic = c
    ? `<img src="${e(c)}" alt="" loading="lazy" decoding="async">`
    : `<img src="https://i.ytimg.com/vi/${e(id)}/${big ? "maxresdefault" : "hqdefault"}.jpg" alt="" loading="lazy" decoding="async"${big ? ` onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${e(id)}/hqdefault.jpg'"` : ""}>`;
  return `<button class="cover" type="button" data-id="${e(id)}" data-title="${e(v.ar)}">${pic}${PLAY}${v.d ? `<span class="dur">${e(v.d)}</span>` : ""}<span class="sr">${bi("تشغيل: " + v.ar, "Play: " + (v.en || v.ar))}</span></button>`;
};

const meta = v => `${bi(v.kAr, v.kEn)} · ${bi("حبر", "7iber")}${v.y ? ` · ${e(v.y)}` : ""}`;

// ───────── الأفلام: الأول بارز، ثم شبكة ─────────
const [first, ...rest] = videos;
const FEATURED = first ? `
<div class="feat">
  ${cover(first, true)}
  <div class="feat-text">
    <p class="kind">${meta(first)}</p>
    <h4>${bi(first.ar, first.en)}</h4>
    ${first.noteAr ? `<p class="note">${bi(first.noteAr, first.noteEn)}</p>` : ""}
  </div>
</div>` : "";

const SHOWN = 6;
const FILMS = rest.map((v, i) => `
<article class="film${i >= SHOWN ? " extra" : ""}">
  ${cover(v)}
  <h4>${bi(v.ar, v.en)}</h4>
  <p class="meta">${meta(v)}</p>
</article>`).join("");

const FILMS_MORE = rest.length > SHOWN
  ? `<div class="more"><button type="button" class="btn ghost" id="filmsmore">${bi(`كل الأعمال المرئية (${videos.length})`, `All video work (${videos.length})`)}</button></div>` : "";

// ───────── الصحافة المكتوبة ─────────
const WRITING = writing.map(w => {
  const t = img(w.image);
  return `
<a class="witem" href="${e(w.u)}" target="_blank" rel="noopener">
  ${t ? `<img src="${e(t)}" alt="" loading="lazy" decoding="async">` : `<span class="ph"></span>`}
  <span class="wtext">
    <span class="wtitle">${bi(w.ar, w.en)}</span>
    <span class="wsrc"><b>${bi(w.srcAr || "حبر", w.srcEn || "7iber")}</b> · ${bi(w.kAr, w.kEn)}</span>
  </span>
  <span class="wy">${e(w.y)} <span aria-hidden="true">↗</span></span>
</a>`;
}).join("");

// ───────── بودكاست وتلفزيون ─────────
const OTHERS = others.map(o => `
<article class="ocard">
  <p class="out">${bi(o.outAr, o.outEn)} · ${e(o.y)}</p>
  <h4>${bi(o.ar, o.en)}</h4>
  <p>${bi(o.bodyAr, o.bodyEn)}</p>
  ${String(o.u || "").trim() ? `<a href="${e(o.u)}" target="_blank" rel="noopener">${bi(o.linkAr || "رابط", o.linkEn || "Link")} <span aria-hidden="true">↗</span></a>` : ""}
</article>`).join("");

// ───────── الأرشيف: بحث وتصفية ─────────
const total = archive.reduce((a, g) => a + g.items.length, 0);
const ARCH_FILTERS = `<button type="button" data-g="all" aria-pressed="true">${bi("الكل", "All")} <i>${total}</i></button>` +
  archive.map((g, gi) => `<button type="button" data-g="${gi}" aria-pressed="false">${bi(g.ar, g.en)} <i>${g.items.length}</i></button>`).join("");
const ARCH_ITEMS = archive.flatMap((g, gi) => g.items.map(i => ({ ...i, gi })))
  .sort((a, b) => (b.y || 0) - (a.y || 0))
  .map(i => `<a href="${e(i.u)}" target="_blank" rel="noopener" data-g="${i.gi}" data-q="${e((i.ar + " " + i.en).toLowerCase())}"><span class="y">${e(i.y)}</span><span>${bi(i.ar, i.en)}</span></a>`).join("");

// ───────── الخدمات ─────────
const SERVICES = services.map(s => `
<article class="svc">
  <h3>${bi(s.ar, s.en)}</h3>
  <p>${bi(s.bodyAr, s.bodyEn)}</p>
  ${(s.credits || []).map(c => `<p class="proof">${bi(c.ar, c.en)}</p>`).join("")}
</article>`).join("");

// ───────── من الميدان ─────────
const FIELD = field.filter(f => img(f.image)).map(f => `
<figure><img src="${e(img(f.image))}" alt="${e(f.ar)}" loading="lazy" decoding="async"><figcaption>${bi(f.ar, f.en)}</figcaption></figure>`).join("");
const FIELD_SECTION = FIELD ? `
<section id="field" class="field"><div class="wrap">
  <h2>${bi("من الميدان", "From the field")}</h2>
  <div class="strip">${FIELD}</div>
</div></section>` : "";

// ───────── جهات عمل معها ─────────
const cAr = site.clientsAr || [], cEn = site.clientsEn || [];
const CLIENTS = cAr.length ? `<div class="clients"><span>${bi("عمل مع", "Worked with")}</span>${cAr.map((c, i) => `<b>${bi(c, cEn[i])}</b>`).join("")}</div>` : "";

// ───────── مشروع قيد الإنتاج (يظهر فقط حين يُملأ عنوانه) ─────────
const pr = site.project || {};
let PROJECT = "";
if (String(pr.titleAr || "").trim()) {
  const tid = String(pr.trailer || "").trim() ? (driveId(pr.trailer) ? pr.trailer : ytid(pr.trailer)) : "";
  const pimg = img(pr.image);
  const media = tid ? cover({ id: tid, ar: pr.titleAr, en: pr.titleEn, cover: pr.image }, true)
    : pimg ? `<div class="cover"><img src="${e(pimg)}" alt="" loading="lazy" decoding="async"></div>` : "";
  PROJECT = `
<section id="project" class="project"><div class="wrap">
  <h2>${bi("قيد الإنتاج", "In production")}</h2>
  <div class="feat${media ? "" : " solo"}">
    ${media}
    <div class="feat-text">
      ${pr.statusAr ? `<p class="kind">${bi(pr.statusAr, pr.statusEn)}</p>` : ""}
      <h4>${bi(pr.titleAr, pr.titleEn)}</h4>
      ${pr.creditsAr ? `<p class="pcred">${bi(pr.creditsAr, pr.creditsEn)}</p>` : ""}
      <p class="note">${bi(pr.textAr, pr.textEn)}</p>
      ${pr.grantAr ? `<p class="pgrant">${bi(pr.grantAr, pr.grantEn)}</p>` : ""}
    </div>
  </div>
</div></section>`;
}

// ───────── روابط التواصل الإضافية (تظهر حين تُملأ) ─────────
const LINKS = [
  ["linkedin", "LinkedIn", "LinkedIn"],
  ["whatsapp", "واتساب", "WhatsApp"],
].filter(([k]) => String(site[k] || "").trim()).map(([k, ar, en]) => {
  let u = String(site[k]).trim();
  if (k === "whatsapp" && !/^https?:/.test(u)) u = "https://wa.me/" + u.replace(/\D/g, "");
  return `<a href="${e(u)}" target="_blank" rel="noopener">${bi(ar, en)} <span aria-hidden="true">↗</span></a>`;
}).join("");

// ───────── الخط ─────────
const FONTS = {
  "IBM Plex Sans Arabic": "IBM+Plex+Sans+Arabic:wght@400;500;600;700",
  "Noto Kufi Arabic":     "Noto+Kufi+Arabic:wght@400;500;600;700",
  "Cairo":                "Cairo:wght@400;500;600;700",
  "Tajawal":              "Tajawal:wght@400;500;700",
};
const fontName = FONTS[(site.design || {}).font] ? site.design.font : "IBM Plex Sans Arabic";

const hero = img(site.heroImage);
const portrait = img(site.portrait);

const slots = {
  NAME_AR: e(site.nameAr), NAME_EN: e(site.nameEn),
  NAME: bi(site.nameAr, site.nameEn),
  ROLE: bi(site.roleAr, site.roleEn), ROLE2: bi(site.role2Ar, site.role2En),
  BIO: bi(site.bioAr, site.bioEn),
  CTA: bi(site.ctaAr || "تواصل معي", site.ctaEn || "Get in touch"),
  CONTACT: bi(site.contactAr, site.contactEn),
  VNOTE: bi(site.videoNoteAr, site.videoNoteEn),
  HERO_STYLE: hero ? ` style="background-image:url('${e(hero)}')"` : "",
  HERO_CLASS: hero ? "" : " noimg",
  HERO_CAPTION: site.heroCaptionAr ? `<p class="cap">${bi(site.heroCaptionAr, site.heroCaptionEn)}</p>` : "",
  PORTRAIT: portrait ? `<img class="portrait" src="${e(portrait)}" alt="${e(site.nameAr)}" loading="lazy" decoding="async">` : "",
  EMAIL: e(site.email), AUTHOR_URL: e(site.authorUrl), CV_URL: e(site.cvUrl), YEAR: e(site.year),
  OG_IMAGE: e(site.ogImage || "/media/og.png"),
  FONT_LINK: `<link href="https://fonts.googleapis.com/css2?family=${FONTS[fontName]}&display=swap" rel="stylesheet">`,
  FONT_FAMILY: `"${fontName}",-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,sans-serif`,
  CLIENTS, SERVICES, PROJECT, FEATURED, FILMS, FILMS_MORE, WRITING, OTHERS, FIELD_SECTION, LINKS,
  ARCH_FILTERS, ARCH_ITEMS,
  N_FILMS: videos.length, N_WRITING: writing.length, N_OTHERS: others.length, N_ARCH: total,
};

if (!existsSync(at("./template.html"))) throw new Error("القالب template.html غير موجود في جذر المستودع.");
let html = readFileSync(at("./template.html"), "utf8");
html = html.replace(/\{\{([A-Z_0-9]+)\}\}/g, (m, k) => {
  if (!(k in slots)) throw new Error(`خانة غير معرّفة في القالب: ${m}`);
  return slots[k];
});

const out = at("./dist/");
mkdirSync(out, { recursive: true });
writeFileSync(new URL("./index.html", out), html);

for (const f of ["robots.txt", "sitemap.xml", "_headers"])
  if (existsSync(at("./" + f))) cpSync(at("./" + f), new URL("./" + f, out));
if (existsSync(at("./media/")))
  cpSync(at("./media/"), new URL("./media/", out), { recursive: true });

console.log(`✓ dist/index.html — ${services.length} خدمات، ${videos.length} فيديو، ${writing.length} مادة مكتوبة، ${others.length} أعمال أخرى، ${total} في الأرشيف، ${field.length} صور`);
