/**
 * PRELAN — ADMIN EXTRAS
 * Adds to the existing dashboard: Homepage Slides, Learners (Parent Portal),
 * Parent Review moderation and Site Settings.  Security is enforced by firestore.rules
 * (only documents in `admins/{uid}` can write these collections).
 */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { showToast, escapeHtml as esc, compressImageToBase64 } from "./utils.js";

if (isFirebaseConfigured()) {
  const app = getApps().find(a => a.name === "[DEFAULT]") || initializeApp(firebaseConfig);
  const auth = getAuth(app), db = getFirestore(app);
  let started = false;
  onAuthStateChanged(auth, async (user) => {
    if (!user || started) return;
    const adm = await getDoc(doc(db, "admins", user.uid)).catch(() => null);
    if (!adm || !adm.exists()) return;
    started = true; initSlides(); initLearners(); initReviews(); initSettings();
  });

  const $ = (id) => document.getElementById(id);
  const open = (id) => $(id).classList.add("active");
  const close = (id) => $(id).classList.remove("active");
  const btn = (label, cls, fn) => { const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-sm " + cls; b.textContent = label; b.onclick = fn; return b; };

  /* ================= SLIDES ================= */
  let slides = [];
  async function loadSlides() {
    const snap = await getDocs(query(collection(db, "slides"), orderBy("order", "asc")));
    slides = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const box = $("slides-list"); box.innerHTML = "";
    if (!slides.length) box.innerHTML = '<p class="form-hint">No slides yet. The homepage is showing the built-in default slides. Click “+ Add Slide” to create your own.</p>';
    slides.forEach((s, i) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:14px;align-items:center;padding:12px 0;border-bottom:1px solid #eee;flex-wrap:wrap";
      row.innerHTML = '<img src="' + esc(s.imageUrl) + '" alt="" style="width:120px;height:68px;object-fit:cover;border-radius:8px">' +
        '<div style="flex:1;min-width:180px"><strong>' + esc(s.title || s.alt || "Image slide") + '</strong><br><small>' + esc(s.kicker || "") + '</small><br><small>' + (s.active === false ? "Hidden" : "Visible") + '</small></div>';
      const act = document.createElement("div"); act.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
      act.append(
        btn("▲", "btn-outline", () => move(i, -1)), btn("▼", "btn-outline", () => move(i, 1)),
        btn(s.active === false ? "Show" : "Hide", "btn-outline", async () => { await updateDoc(doc(db, "slides", s.id), { active: s.active === false }); loadSlides(); }),
        btn("Edit", "btn-primary", () => editSlide(s)),
        btn("Delete", "btn-outline", async () => { if (confirm("Delete this slide?")) { await deleteDoc(doc(db, "slides", s.id)); loadSlides(); } })
      );
      row.appendChild(act); box.appendChild(row);
    });
  }
  async function move(i, dir) {
    const j = i + dir; if (j < 0 || j >= slides.length) return;
    const a = slides[i], b = slides[j];
    await Promise.all([updateDoc(doc(db, "slides", a.id), { order: j }), updateDoc(doc(db, "slides", b.id), { order: i })]);
    loadSlides();
  }
  function editSlide(s) {
    const f = $("slide-form"); f.reset();
    $("slide-modal-title").textContent = s ? "Edit slide" : "New slide";
    f.elements.id.value = s?.id || "";
    ["kicker", "title", "text", "ctaLabel", "ctaUrl", "alt"].forEach(k => f.elements[k].value = s?.[k] || "");
    f.elements.imageUrl.value = s?.imageUrl && !s.imageUrl.startsWith("data:") ? s.imageUrl : "";
    f.elements.active.checked = s ? s.active !== false : true;
    f.dataset.existingImage = s?.imageUrl || "";
    open("modal-slide");
  }
  function initSlides() {
    $("new-slide-btn").onclick = () => editSlide(null);
    $("slide-form").onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target, b = $("slide-save-btn"); b.disabled = true; b.textContent = "Saving…";
      try {
        let img = f.elements.imageUrl.value.trim() || f.dataset.existingImage;
        const file = f.elements.file.files[0];
        if (file) img = await compressImageToBase64(file, 1600, 900, 0.72);
        if (!img) { showToast("Please add an image.", "error"); return; }
        const cta = f.elements.ctaUrl.value.trim();
        if (cta && !/^(\/|https:\/\/|#)/.test(cta)) { showToast("Button link must start with / or https://", "error"); return; }
        const data = {
          kicker: f.elements.kicker.value.trim(), title: f.elements.title.value.trim(), text: f.elements.text.value.trim(),
          ctaLabel: f.elements.ctaLabel.value.trim(), ctaUrl: cta, alt: f.elements.alt.value.trim(),
          imageUrl: img, active: f.elements.active.checked, updatedAt: serverTimestamp()
        };
        const id = f.elements.id.value;
        if (id) await updateDoc(doc(db, "slides", id), data);
        else await addDoc(collection(db, "slides"), { ...data, order: slides.length, createdAt: serverTimestamp() });
        close("modal-slide"); showToast("Slide saved. It is now live on the homepage.", "success"); loadSlides();
      } catch (err) { console.error(err); showToast("Could not save the slide (image may be too large).", "error"); }
      finally { b.disabled = false; b.textContent = "Save slide"; }
    };
    loadSlides();
  }

  /* ================= LEARNERS ================= */
  async function loadLearners() {
    const snap = await getDocs(collection(db, "children"));
    const box = $("learners-list"); box.innerHTML = "";
    if (snap.empty) { box.innerHTML = '<p class="form-hint">No learners added yet.</p>'; return; }
    snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || "").localeCompare(b.name || "")).forEach(c => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:12px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;flex-wrap:wrap";
      row.innerHTML = '<div><strong>' + esc(c.name) + '</strong> · ' + esc(c.className) + '<br><small>' + esc(c.parentEmail) + '</small></div>';
      const act = document.createElement("div"); act.style.cssText = "display:flex;gap:6px";
      act.append(btn("Edit", "btn-primary", () => editLearner(c)), btn("Delete", "btn-outline", async () => { if (confirm("Delete this learner record?")) { await deleteDoc(doc(db, "children", c.id)); loadLearners(); } }));
      row.appendChild(act); box.appendChild(row);
    });
  }
  function editLearner(c) {
    const f = $("learner-form"); f.reset();
    $("learner-modal-title").textContent = c ? "Edit learner" : "New learner";
    f.elements.id.value = c?.id || "";
    ["parentEmail", "name", "className", "admissionNo", "classTeacher", "transport", "notes"].forEach(k => { if (c?.[k] != null) f.elements[k].value = c[k]; });
    open("modal-learner");
  }
  function initLearners() {
    $("new-learner-btn").onclick = () => editLearner(null);
    $("learner-form").onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      const data = { updatedAt: serverTimestamp() };
      ["name", "className", "admissionNo", "classTeacher", "transport", "notes"].forEach(k => data[k] = f.elements[k].value.trim());
      data.parentEmail = f.elements.parentEmail.value.trim().toLowerCase();
      try {
        const id = f.elements.id.value;
        if (id) await updateDoc(doc(db, "children", id), data); else await addDoc(collection(db, "children"), { ...data, createdAt: serverTimestamp() });
        close("modal-learner"); showToast("Learner saved.", "success"); loadLearners();
      } catch (err) { showToast("Could not save learner.", "error"); }
    };
    loadLearners();
  }

  /* ================= REVIEWS ================= */
  async function loadReviews() {
    const snap = await getDocs(collection(db, "reviews"));
    const box = $("reviews-list"); box.innerHTML = "";
    if (snap.empty) { box.innerHTML = '<p class="form-hint">No reviews yet.</p>'; return; }
    snap.docs.forEach(d => {
      const r = d.data(), row = document.createElement("div");
      row.style.cssText = "padding:12px 0;border-bottom:1px solid #eee";
      row.innerHTML = '<div>' + "★".repeat(r.rating || 0) + ' <strong>' + esc(r.author) + '</strong> <small>' + esc(r.childInfo || "") + '</small> <span class="status-pill ' + (r.approved ? "ok" : "") + '">' + (r.approved ? "Published" : "Pending") + '</span></div><p style="margin:.4em 0">' + esc(r.content) + '</p>';
      const act = document.createElement("div"); act.style.cssText = "display:flex;gap:6px";
      act.append(btn(r.approved ? "Unpublish" : "Approve & publish", "btn-primary", async () => { await updateDoc(doc(db, "reviews", d.id), { approved: !r.approved }); loadReviews(); }),
        btn("Delete", "btn-outline", async () => { if (confirm("Delete this review?")) { await deleteDoc(doc(db, "reviews", d.id)); loadReviews(); } }));
      row.appendChild(act); box.appendChild(row);
    });
  }
  function initReviews() { loadReviews(); }

  /* ================= SETTINGS ================= */
  async function initSettings() {
    const f = $("extras-settings-form"); const keys = ["phone", "whatsapp", "email", "address", "officeHours"];
    try {
      const snap = await getDoc(doc(db, "settings", "general")); const d = snap.exists() ? snap.data() : {};
      keys.forEach(k => f.elements[k].value = d[k] || "");
    } catch (e) { /* first run */ }
    f.onsubmit = async (e) => {
      e.preventDefault(); const data = { updatedAt: serverTimestamp() };
      keys.forEach(k => { const v = f.elements[k].value.trim(); if (v) data[k] = v; });
      try { await setDoc(doc(db, "settings", "general"), data, { merge: true }); showToast("Settings saved.", "success"); }
      catch (err) { showToast("Could not save settings.", "error"); }
    };
  }
}


/* ================= RESPONSIVE SIDEBAR BACKDROP ================= */
(() => {
  const sb = document.getElementById("dashboard-sidebar"); if (!sb) return;
  const bd = document.createElement("div"); bd.className = "admin-backdrop"; document.body.appendChild(bd);
  const sync = () => { const o = sb.classList.contains("open"); bd.classList.toggle("show", o); document.body.classList.toggle("admin-nav-open", o); };
  new MutationObserver(sync).observe(sb, { attributes: true, attributeFilter: ["class"] });
  bd.addEventListener("click", () => sb.classList.remove("open"));
  document.addEventListener("keydown", e => { if (e.key === "Escape") sb.classList.remove("open"); });
  window.addEventListener("resize", () => { if (window.innerWidth >= 992) sb.classList.remove("open"); });
})();
