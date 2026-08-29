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

const PLAY = '<span class="play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>';

const VIDEOS = videos.map(v => {
  const id = ytid(v);
  return `
<article class="card">
  <button class="thumb" data-id="${e(id)}" aria-label="Play">
    <img src="https://i.ytimg.com/vi/${e(id)}/maxresdefault.jpg" alt="" loading="lazy" decoding="async"
      onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${e(id)}/hqdefault.jpg'">${PLAY}</button>
  <div class="card-body">
    <span class="tag"><span class="ar">${e(v.kAr)}</span><span class="en">${e(v.kEn)}</span></span>
    <h3><span class="ar">${e(v.ar)}</span><span class="en">${e(v.en)}</span></h3>
    <p class="cmeta">${[v.y, v.d].filter(Boolean).map(e).join(" · ")}</p>
  </div>
</article>`;
}).join("");

const WRITING = writing.map(w => `
<a class="item" href="${e(w.u)}" target="_blank" rel="noopener">
  <span class="iyear">${e(w.y)}</span>
  <span style="flex:1">
    <span class="ititle" style="display:block"><span class="ar">${e(w.ar)}</span><span class="en">${e(w.en)}</span></span>
    <span class="ikind" style="display:block"><span class="ar">${e(w.kAr)}</span><span class="en">${e(w.kEn)}</span></span>
  </span>
  <span class="arrow">↗</span>
</a>`).join("");

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

const slots = {
  NAME_AR: e(site.nameAr), NAME_EN: e(site.nameEn),
  ROLE_AR: e(site.roleAr), ROLE_EN: e(site.roleEn),
  BIO_AR:  e(site.bioAr),  BIO_EN:  e(site.bioEn),
  VNOTE_AR: e(site.videoNoteAr), VNOTE_EN: e(site.videoNoteEn),
  EMAIL: e(site.email), AUTHOR_URL: e(site.authorUrl),
  CV_URL: e(site.cvUrl), YEAR: e(site.year),
  META, VIDEOS, WRITING, ARCHIVE,
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
