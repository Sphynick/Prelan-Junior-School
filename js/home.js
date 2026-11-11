/**
 * PRELAN — HOMEPAGE HERO SLIDER
 * Slides live in Firestore collection `slides` (editable in Admin > Homepage Slides).
 * If Firestore is unreachable or empty, the built-in default slides below are shown,
 * so the homepage is never blank.
 */
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const DEFAULT_SLIDES = [
  { imageUrl: "/assets/slides/01-family-fun-day.jpg", alt: "Prelan families and learners enjoying a fun day on the school lawn" },
  { imageUrl: "/assets/slides/02-career-day-hospital.jpg", alt: "Learners role-playing in the Prelan Hospital career clinic" },
  { imageUrl: "/assets/slides/03-science-laboratory.jpg", alt: "Learners doing experiments in the Prelan science laboratory" },
  { imageUrl: "/assets/slides/04-classroom-courtyard.jpg", alt: "The colourful Prelan classroom courtyard" },
  { imageUrl: "/assets/slides/05-graduation-stage.jpg", alt: "Prelan Junior School Class of 2026 graduation ceremony" },
  { imageUrl: "/assets/slides/06-laboratory-benches.jpg", alt: "The fitted science laboratory benches and equipment" },
  { imageUrl: "/assets/slides/07-swimming-lesson.jpg", alt: "Prelan learners enjoying a swimming lesson in the school pool" },
  { imageUrl: "/assets/slides/08-school-compound.jpg", alt: "The Prelan school compound and classrooms" },
  { imageUrl: "/assets/slides/09-kindergarten-graduates.jpg", alt: "Prelan Kindergarten Class of 2026 graduates in gowns and sashes" },
  { imageUrl: "/assets/gallery/computer-lab-coding.jpg", alt: "Prelan learners coding in the computer lab" },
  { imageUrl: "/assets/images/sports-1200.jpg", alt: "Learners racing on the Prelan playing field" },
  { imageUrl: "/assets/images/tastemasters-1200.jpg", alt: "Prelan learners beside the yellow Prelan school bus" },
  { imageUrl: "/assets/images/cooking-1200.jpg", alt: "Learners enjoying a meal prepared in the Prelan school kitchen" }
];

const root = document.getElementById("hero-slider");
if (root) start();

async function start() {
  let slides = [];
  if (isFirebaseConfigured()) {
    try {
      // Loaded lazily so the slider still works (with default slides) if Firebase can't be reached.
      const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js");
      const { getFirestore, collection, getDocs, query, orderBy } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
      const app = getApps()[0] || initializeApp(firebaseConfig);
      const snap = await getDocs(query(collection(getFirestore(app), "slides"), orderBy("order", "asc")));
      slides = snap.docs.map(d => d.data()).filter(s => s.active !== false && s.imageUrl);
    } catch (e) { console.log("Slides: using defaults.", e.message); }
  }
  if (!slides.length) slides = DEFAULT_SLIDES;
  render(slides);
}

function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

function safeUrl(u) { return /^(\/|https:\/\/|#)/.test(u || "") ? u : "#"; }

function render(slides) {
  const track = root.querySelector(".slider-track");
  const dots = root.querySelector(".slider-dots");
  track.innerHTML = ""; dots.innerHTML = "";
  const strip = el("div", "slider-strip"); track.appendChild(strip);

  const build = (s, i, clone) => {
    const slide = el("div", "slide" + ((s.title || s.text) ? " has-caption" : ""));
    if (clone) slide.setAttribute("aria-hidden", "true");
    else { slide.setAttribute("role", "group"); slide.setAttribute("aria-label", `Slide ${i + 1} of ${slides.length}`); }
    const img = document.createElement("img");
    img.src = s.imageUrl; img.alt = clone ? "" : (s.alt || ""); img.decoding = "async"; img.draggable = false;
    if (i === 0 && !clone) img.fetchPriority = "high";
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

  let cur = 0, timer = null, busy = false;
  const setPos = (n, animate) => {
    strip.style.setProperty("--dur", animate ? "1s" : "0s");
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
    setTimeout(() => { if (cur >= N) { cur = 0; setPos(0, false); mark(0); } busy = false; }, 1050);
  }
  const next = () => go(cur + 1), prev = () => go(cur - 1);
  let paused = false;
  function restart() { clearInterval(timer); if (!paused && N > 1 && !document.hidden) timer = setInterval(next, 5500); }
  // Pause / play control (accessibility): visitors can stop the motion if they wish.
  const pb = el("button", "slider-pause"); pb.type = "button"; pb.setAttribute("aria-label", "Pause slideshow"); pb.textContent = "❚❚";
  pb.onclick = () => { paused = !paused; pb.textContent = paused ? "▶" : "❚❚"; pb.setAttribute("aria-label", paused ? "Play slideshow" : "Pause slideshow"); restart(); };
  if (N > 1) root.appendChild(pb);

  root.querySelector(".prev").onclick = () => { prev(); restart(); };
  root.querySelector(".next").onclick = () => { next(); restart(); };
  root.addEventListener("mouseenter", () => clearInterval(timer));
  root.addEventListener("mouseleave", restart);
  root.addEventListener("focusin", () => clearInterval(timer));
  root.addEventListener("focusout", restart);
  document.addEventListener("visibilitychange", restart);
  root.addEventListener("keydown", e => { if (e.key === "ArrowLeft") { prev(); restart(); } if (e.key === "ArrowRight") { next(); restart(); } });

  let x0 = null;
  root.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; clearInterval(timer); }, { passive: true });
  root.addEventListener("touchend", e => { if (x0 == null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) (dx < 0 ? next : prev)(); x0 = null; restart(); });

  if (N < 2) root.querySelectorAll(".slider-btn, .slider-dots").forEach(n => n.style.display = "none");
  setPos(0, false); mark(0); restart();
}


/* "Why Prelan" video: loads and plays inside its panel when the play button is pressed. */
const why = document.getElementById("why-video");
if (why) {
  why.querySelector(".play-btn").addEventListener("click", () => {
    const v = document.createElement("video");
    v.src = "/assets/videos/why-prelan.mp4"; v.controls = true; v.autoplay = true; v.playsInline = true;
    v.setAttribute("aria-label", "Why choose Prelan");
    why.innerHTML = ""; why.classList.add("is-playing"); why.appendChild(v); v.play().catch(() => {});
  });
}
