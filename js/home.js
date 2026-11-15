/**
 * PRELAN — HOMEPAGE HERO SLIDER
 *
 * The slides come ONLY from Admin > Homepage Slides (Firestore collection `slides`).
 * There are no built-in/hard-coded slides any more: if the admin has no active slide,
 * the hero section is simply hidden.
 *
 * Speed notes
 *  - Slides are read with Firestore's plain REST API (a few KB of JavaScript) instead of
 *    downloading the whole Firebase SDK. The SDK is only used as an automatic fallback.
 *  - Text/ordering is fetched first, then the FIRST image, so the hero shows as soon as
 *    slide 1 has arrived; the other images fill in behind it.
 *  - Slides are cached in the visitor's browser, so repeat visits paint instantly.
 */
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const SLIDE_DELAY_MS = 3800;   // how long each slide stays on screen before moving on (1.8 s)
const TRANSITION_MS = 750;    // how long the sliding animation itself takes
const META_KEY = "prelan.slides.meta.v2";
const IMG_KEY = "prelan.slides.img.";

const root = document.getElementById("hero-slider");

/* ---------- tiny helpers ---------- */
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function safeUrl(u) { return /^(\/|https:\/\/|#)/.test(u || "") ? u : "#"; }
function safeImg(u) { return /^(data:image\/|https:\/\/|\/)/.test(u || "") ? u : ""; }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage full or blocked: ignore */ } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) { } }

/* ---------- Firestore over REST ---------- */
const API = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;
const KEY = `key=${encodeURIComponent(firebaseConfig.apiKey)}`;

function plain(v) {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  return null;
}
async function getJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
/** Slide text/order/visibility only (no image data), sorted by the admin's order. */
async function fetchMetaRest() {
  const fields = ["order", "active", "title", "text", "kicker", "ctaLabel", "ctaUrl", "alt"];
  const mask = fields.map(f => "mask.fieldPaths=" + f).join("&");
  const j = await getJson(`${API}/slides?orderBy=order&pageSize=30&${mask}&${KEY}`);
  return (j.documents || []).map(d => {
    const o = {};
    for (const k in (d.fields || {})) o[k] = plain(d.fields[k]);
    o.id = d.name.split("/").pop();
    o.v = d.updateTime || "";
    return o;
  }).filter(s => s.active !== false);
}
async function fetchImageRest(id) {
  const j = await getJson(`${API}/slides/${id}?mask.fieldPaths=imageUrl&${KEY}`);
  return safeImg(plain((j.fields || {}).imageUrl));
}
/** Fallback if REST is blocked: the normal Firebase SDK (loaded only when needed). */
async function fetchViaSdk() {
  const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
  const { getFirestore, collection, getDocs, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const app = getApps()[0] || initializeApp(firebaseConfig);
  const snap = await getDocs(query(collection(getFirestore(app), "slides"), orderBy("order", "asc")));
  return snap.docs.map(d => ({ id: d.id, v: "sdk", ...d.data(), imageUrl: safeImg(d.data().imageUrl) }))
    .filter(s => s.active !== false && s.imageUrl);
}

/* ---------- cache ---------- */
function readMeta() { try { return JSON.parse(lsGet(META_KEY) || "[]"); } catch (e) { return []; } }
function writeMeta(list) { lsSet(META_KEY, JSON.stringify(list.map(({ imageUrl, _imgs, ...m }) => m))); }
function cachedImage(s) { return s.v && s.v !== "sdk" ? (lsGet(IMG_KEY + s.id + "." + s.v) || "") : ""; }
function pruneImages(list) {
  const keep = new Set(list.map(s => IMG_KEY + s.id + "." + s.v));
  try { for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith(IMG_KEY) && !keep.has(k)) lsDel(k); } } catch (e) { }
}
async function ensureImage(s) {
  if (s.imageUrl) return s.imageUrl;
  s.imageUrl = cachedImage(s);
  if (s.imageUrl) return s.imageUrl;
  s.imageUrl = await fetchImageRest(s.id);
  if (s.imageUrl && s.v) lsSet(IMG_KEY + s.id + "." + s.v, s.imageUrl);
  return s.imageUrl;
}

/* ---------- main flow ---------- */
const sig = list => list.map(s => s.id + "@" + s.v).join("|");

async function start() {
  if (!isFirebaseConfigured()) { hideHero(); return; }
  let shown = "";

  // 1) Repeat visit: paint straight from the browser cache.
  const cachedMeta = readMeta();
  if (cachedMeta.length) {
    const full = cachedMeta.map(m => ({ ...m, imageUrl: cachedImage(m) }));
    if (full.every(s => s.imageUrl)) { render(full); shown = sig(cachedMeta); }
  }

  // 2) Ask Firestore what the admin has set up right now.
  let meta;
  try { meta = await fetchMetaRest(); }
  catch (e) {
    try { meta = await fetchViaSdk(); }
    catch (e2) { console.log("Slides unavailable:", e2.message); if (!shown) hideHero(); return; }
  }
  if (!meta.length) { writeMeta([]); pruneImages([]); hideHero(); return; }
  if (sig(meta) === shown) return;             // cached version is already correct

  // 3) Show as soon as the FIRST image is in; the rest fill in behind it.
  const jobs = meta.map(s => ensureImage(s).catch(() => ""));
  await jobs[0];
  if (!meta[0].imageUrl) { if (!shown) hideHero(); return; }
  render(meta, Promise.allSettled(jobs));
  jobs.forEach((p, i) => p.then(url => { if (i > 0) fillImage(meta[i], url); }));
  Promise.allSettled(jobs).then(() => { if (meta[0].v !== "sdk") { writeMeta(meta); pruneImages(meta); } });
}

function hideHero() { root.hidden = true; root.style.display = "none"; }
function fillImage(s, url) { (s._imgs || []).forEach(im => { if (url && !im.getAttribute("src")) im.src = url; }); }

/* ---------- slider ---------- */
let ctl = null;   // lets a re-render cleanly replace the previous slider's listeners/timers

function render(slides, ready) {
  if (ctl) ctl.abort();
  ctl = new AbortController();
  const sg = { signal: ctl.signal };
  root.hidden = false; root.style.display = "";
  const track = root.querySelector(".slider-track");
  const dots = root.querySelector(".slider-dots");
  track.innerHTML = ""; dots.innerHTML = "";
  root.querySelectorAll(".slider-pause").forEach(n => n.remove());
  const strip = el("div", "slider-strip"); track.appendChild(strip);
  slides.forEach(s => { s._imgs = []; });

  const build = (s, i, clone) => {
    const slide = el("div", "slide" + ((s.title || s.text) ? " has-caption" : ""));
    if (clone) slide.setAttribute("aria-hidden", "true");
    else { slide.setAttribute("role", "group"); slide.setAttribute("aria-label", `Slide ${i + 1} of ${slides.length}`); }
    const img = document.createElement("img");
    if (s.imageUrl) img.src = s.imageUrl;
    img.alt = clone ? "" : (s.alt || ""); img.decoding = "async"; img.draggable = false;
    if (i === 0 && !clone) img.fetchPriority = "high"; else img.loading = "eager";
    s._imgs.push(img);
    slide.appendChild(img);
    if (s.title || s.text) {
      const cap = el("div", "slide-caption");
      const wrap = el("div", "container"); const box = el("div");
      if (s.kicker) box.appendChild(el("span", "slide-kicker", s.kicker));
      box.appendChild(el(i === 0 && !clone ? "h1" : "h2", "", s.title || ""));
      if (s.text) box.appendChild(el("p", "", s.text));
      if (s.ctaLabel && s.ctaUrl) { const a = el("a", "btn btn-accent", s.ctaLabel); a.href = safeUrl(s.ctaUrl); if (clone) a.tabIndex = -1; box.appendChild(a); }
      wrap.appendChild(box); cap.appendChild(wrap); slide.appendChild(cap);
    }
    return slide;
  };
  slides.forEach((s, i) => {
    strip.appendChild(build(s, i, false));
    const d = el("button"); d.type = "button"; d.setAttribute("aria-label", `Go to slide ${i + 1}`);
    d.addEventListener("click", () => { go(i); restart(); });
    dots.appendChild(d);
  });
  const N = slides.length;
  if (N > 1) strip.appendChild(build(slides[0], 0, true));   // clone of slide 1 → seamless loop

  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cur = 0, timer = null, busy = false, paused = reduce, canAuto = !ready;
  const setPos = (n, animate) => {
    strip.style.setProperty("--dur", animate ? TRANSITION_MS + "ms" : "0ms");
    strip.style.transform = `translate3d(${-n * 100}%,0,0)`;
  };
  const mark = (n) => {
    const real = ((n % N) + N) % N;
    [...strip.children].forEach((s, i) => s.classList.toggle("is-active", i === real || (n === N && i === N)));
    [...dots.children].forEach((d, i) => d.setAttribute("aria-current", i === real ? "true" : "false"));
  };
  function go(n) {
    if (busy && N > 1) return;
    if (n < 0) { setPos(N, false); strip.getBoundingClientRect(); n = N - 1; }   // jump to clone, then slide back
    cur = n; busy = true; setPos(cur, true); mark(cur);
    setTimeout(() => { if (cur >= N) { cur = 0; setPos(0, false); mark(0); } busy = false; }, TRANSITION_MS + 50);
  }
  const next = () => go(cur + 1), prev = () => go(cur - 1);
  // The next slide starts moving every SLIDE_DELAY_MS after the previous one has finished sliding in.
  function restart() {
    clearInterval(timer);
    if (!paused && canAuto && N > 1 && !document.hidden) timer = setInterval(next, SLIDE_DELAY_MS + TRANSITION_MS);
  }
  if (ready) ready.then(() => { canAuto = true; restart(); });

  // Pause / play control (accessibility): visitors can stop the motion if they wish.
  const pb = el("button", "slider-pause"); pb.type = "button";
  const setPb = () => { pb.textContent = paused ? "▶" : "❚❚"; pb.setAttribute("aria-label", paused ? "Play slideshow" : "Pause slideshow"); };
  setPb();
  pb.onclick = () => { paused = !paused; setPb(); restart(); };
  if (N > 1) root.appendChild(pb);

  root.querySelector(".prev").onclick = () => { prev(); restart(); };
  root.querySelector(".next").onclick = () => { next(); restart(); };
  root.addEventListener("mouseenter", () => clearInterval(timer), sg);
  root.addEventListener("mouseleave", restart, sg);
  root.addEventListener("focusin", () => clearInterval(timer), sg);
  root.addEventListener("focusout", restart, sg);
  document.addEventListener("visibilitychange", restart, sg);
  root.addEventListener("keydown", e => { if (e.key === "ArrowLeft") { prev(); restart(); } if (e.key === "ArrowRight") { next(); restart(); } }, sg);

  let x0 = null;
  root.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; clearInterval(timer); }, { passive: true, signal: ctl.signal });
  root.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) (dx < 0 ? next : prev)(); x0 = null; restart(); }, sg);

  root.querySelectorAll(".slider-btn, .slider-dots").forEach(n => { n.style.display = N < 2 ? "none" : ""; });
  setPos(0, false); mark(0); restart();
}


// Start only after everything above is defined (avoids temporal-dead-zone errors).
if (root) start();


/* "Why Prelan" video: loads and plays inside its panel when the play button is pressed. */
const why = document.getElementById("why-video");
if (why) {
  why.querySelector(".play-btn").addEventListener("click", () => {
    const v = document.createElement("video");
    v.src = "/assets/videos/why-prelan.mp4"; v.controls = true; v.autoplay = true; v.playsInline = true;
    v.setAttribute("aria-label", "Why choose Prelan");
    why.innerHTML = ""; why.classList.add("is-playing"); why.appendChild(v); v.play().catch(() => { });
  });
}
