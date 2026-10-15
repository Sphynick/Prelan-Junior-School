/**
 * PRELAN JUNIOR SCHOOL - PUBLIC PORTAL CONTROLLER
 * Vanilla ES Modules with Firebase CDN integration
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  doc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import {
  validateKenyanPhone,
  verifyHoneypot,
  checkRateLimit,
  showToast,
  escapeHtml,
  formatKES,
  formatDate
  ,collectApplication,
  generateReference,
  renderApplicationForm
} from "./utils.js";

// Initialize Firebase if configured
let db = null;
const isConfigured = isFirebaseConfigured();

if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  } catch (err) {
    console.warn("Firebase initialization warning:", err);
  }
}

/* ==========================================================================
   FALLBACK DATA (Sensible Placeholders for Nyathuna, Ngecha, Kenya)
   ========================================================================== */
const FALLBACK_SETTINGS = {
  phone: "+254 700 000 000",
  whatsapp: "+254 700 000 000",
  email: "info@prelanjuniorschool.sc.ke",
  address: "Nyathuna, Ngecha, Kiambu County, Kenya",
  officeHours: "Mon – Fri: 7:30 AM – 4:30 PM | Sat: 8:30 AM – 12:30 PM",
  heroTitle: "Nurturing Every Learner's Potential Through CBC Excellence",
  heroSubtitle: "Located in the serene hills of Nyathuna, Ngecha, Prelan Junior School provides a grounded, supportive environment where learners build real-life competencies, strong character, and a lifelong passion for discovery.",
  admissionBannerOpen: true,
  admissionBannerText: "Enrolment for Academic Year 2025/2026 is currently ongoing for PP1 through Grade 6.",
  paybillNumber: "000000",
  paybillAccount: "Learner Adm No. / Name",
  paybillName: "Prelan Junior School"
};

const FALLBACK_FEES = [
  { level: "Pre-Primary", grades: "PP1 & PP2", amount: "____", meals: "Snacks & Hot Lunch" },
  { level: "Lower Primary", grades: "Grades 1 – 3", amount: "____", meals: "Snacks & Hot Lunch" },
  { level: "Upper Primary", grades: "Grades 4 – 6", amount: "____", meals: "Snacks & Hot Lunch" }
];

const FALLBACK_GALLERY = [
  {
    title: "Sports Field & Campus Grounds",
    category: "Grounds",
    imageUrl: "/assets/images/sports-1200.jpg"
  },
  {
    title: "Learner-Centered CBC Classroom",
    category: "Classrooms",
    imageUrl: "/assets/images/classroom-1200.jpg"
  },
  {
    title: "4-K Junior Agricultural Science Project",
    category: "Clubs",
    imageUrl: "/assets/images/gardening-1200.jpg"
  },
  {
    title: "Annual Sports & Athletics Field Day",
    category: "Events",
    imageUrl: "/assets/images/sports-1200.jpg"
  },
  {
    title: "School Garden & Compound",
    category: "Grounds",
    imageUrl: "/assets/images/gardening-1200.jpg"
  },
  {
    title: "Hands-on Practical CBC Modeling",
    category: "Classrooms",
    imageUrl: "/assets/images/classroom-1200.jpg"
  }
];

const FALLBACK_REVIEWS = [
  {
    author: "Mary Wanjiku",
    childInfo: "Parent of Grade 2 Learner, Ngecha",
    rating: 5,
    content: "Prelan has been a blessing for my daughter. Her reading fluency and confidence in public speaking have grown tremendously under CBC teachers who truly care."
  },
  {
    author: "David Kamau",
    childInfo: "Parent of PP2 Learner, Nyathuna",
    rating: 5,
    content: "The balanced meals, strict campus safety, and caring bus service give us total peace of mind every morning. The teachers communicate with parents constantly."
  },
  {
    author: "Faith Njoki",
    childInfo: "Parent of Grade 5 Learner, Ngecha",
    rating: 5,
    content: "The practical science projects and clubs have helped my son discover his passion for agriculture and ICT. Prelan's environment is very serene and disciplined."
  }
];

const FALLBACK_FAQS = [
  {
    question: "What curriculum does Prelan Junior School follow?",
    answer: "We strictly follow the Kenyan Competency Based Curriculum (CBC) approved by KICD and the Ministry of Education, covering Pre-Primary (PP1–PP2), Lower Primary (Grades 1–3), and Upper Primary (Grades 4–6)."
  },
  {
    question: "What are your daily school operating hours?",
    answer: "Regular school hours run from Monday to Friday, 7:45 AM to 3:30 PM for Pre-Primary, and up to 4:00 PM for Upper Primary classes. Gates open at 7:00 AM. Weekend remedial classes or co-curricular clinics run on Saturday mornings."
  },
  {
    question: "Do you offer reliable school bus transport?",
    answer: "Yes. Prelan provides managed door-to-door and central pick-up point school transport across Nyathuna, Ngecha, Wangige, Rironi, and neighbouring environs."
  },
  {
    question: "Are hot meals and snacks provided at school?",
    answer: "Yes. All learners receive a mid-morning 10 o'clock hot snack (such as porridge or milk with accompaniments) and a nutritious, freshly cooked hot lunch on campus daily."
  },
  {
    question: "What documents are required for admission?",
    answer: "A copy of the child's birth certificate, 2 recent passport-size photos, previous school assessment report (for transfers), and copies of parents' national IDs."
  }
];

const FALLBACK_NEWS = [
  {
    title: "Term Admissions Ongoing: Join the Prelan Family",
    date: "Current Term",
    summary: "Enrolment is now open for Pre-Primary (PP1-PP2) and Primary Grades 1 to 6. Schedule your on-site campus tour today.",
    imageUrl: "/assets/images/classroom-1200.jpg"
  },
  {
    title: "Junior Environmental & 4-K Club Tree Planting Day",
    date: "Recent Event",
    summary: "Our learners participated in an exciting environmental conservation project cultivating indigenous tree seedlings within our campus gardens.",
    imageUrl: "/assets/images/gardening-1200.jpg"
  },
  {
    title: "Upcoming Academic Clinic & Parent Consultation",
    date: "Term Calendar",
    summary: "Parents and guardians are warmly invited to discuss individual learner assessment progress with class educators.",
    imageUrl: "/assets/images/sports-1200.jpg"
  }
];

/* ==========================================================================
   DOM INITIALIZATION & DATA LOADING
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initYear();
  initHeader();
  initMobileNav();
  initLightbox();
  loadSiteSettings();
  loadFees();
  loadGallery();
  loadReviews();
  loadFAQs();
  loadNews();
  initVisitForm();
  initApplyForm();
  initNewsletterForm();
  initReviewModal();
});

/**
 * Header behaviour: shadow on scroll + highlight the current page in the menus.
 * (The old single-page router was removed: every link now opens its own page.)
 */
function initHeader() {
  const header = document.getElementById("site-header");
  if (header) {
    const onScroll = () => header.classList.toggle("is-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  const norm = (p) => (p || "/").split("#")[0].split("?")[0].replace(/\.html$/, "").replace(/\/$/, "") || "/";
  const here = norm(window.location.pathname);

  document.querySelectorAll(".mainnav a, .mobile-nav-panel a.mobile-nav-item").forEach((a) => {
    const href = a.getAttribute("href");
    if (!href || href.startsWith("http") || href.includes("#")) return;
    if (norm(href) !== here) return;
    a.classList.add("is-active");
    a.setAttribute("aria-current", "page");
    const sub = a.closest(".sub");
    if (sub && sub.parentElement) {
      const parentLink = sub.parentElement.querySelector(":scope > a");
      if (parentLink) parentLink.classList.add("is-active");
    }
    const det = a.closest("details");
    if (det) det.open = true;
  });
}

function initYear() {
  const yearElem = document.getElementById("current-year");
  if (yearElem) yearElem.textContent = new Date().getFullYear();
}

/**
 * Mobile Navigation Menu
 */
function initMobileNav() {
  const toggleBtn = document.getElementById("mobile-toggle-btn");
  const drawer = document.getElementById("mobile-nav-drawer");
  const closeBtn = document.getElementById("mobile-close-btn");
  const links = document.querySelectorAll(".mobile-nav-item");

  if (!toggleBtn || !drawer) return;

  function openDrawer() {
    drawer.classList.add("active");
    toggleBtn.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
  }

  function closeDrawer() {
    drawer.classList.remove("active");
    toggleBtn.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }

  toggleBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);

  drawer.addEventListener("click", (e) => {
    if (e.target === drawer) closeDrawer();
  });

  links.forEach(link => {
    link.addEventListener("click", closeDrawer);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && drawer.classList.contains("active")) {
      closeDrawer();
    }
  });
}

/**
 * Load Site Settings (Live Firestore or Fallback)
 */
async function loadSiteSettings() {
  let settings = FALLBACK_SETTINGS;

  if (db) {
    try {
      const snap = await getDoc(doc(db, "settings", "general"));
      if (snap.exists()) {
        settings = { ...FALLBACK_SETTINGS, ...snap.data() };
      }
    } catch (e) {
      console.log("Loading settings fallback:", e.message);
    }
  }

  // Update UI Elements
  const phoneElems = ["top-phone", "contact-phone"];
  phoneElems.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = settings.phone;
      el.href = `tel:${settings.phone.replace(/\s+/g, "")}`;
    }
  });

  const heroPhone = document.querySelector(".hero-stat-phone");
  if (heroPhone) {
    heroPhone.textContent = settings.phone;
    heroPhone.href = `tel:${settings.phone.replace(/\s+/g, "")}`;
  }

  const waNumber = (settings.whatsapp || "").replace(/[^0-9]/g, "");
  const waElems = ["top-whatsapp", "contact-whatsapp"];
  waElems.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = `https://wa.me/${waNumber}`;
  });

  const addrElem = document.getElementById("contact-address");
  if (addrElem) addrElem.textContent = settings.address;

  const emailElem = document.getElementById("contact-email");
  if (emailElem) {
    emailElem.textContent = settings.email;
    emailElem.href = `mailto:${settings.email}`;
  }

  const hoursElem = document.getElementById("contact-hours");
  if (hoursElem) hoursElem.textContent = settings.officeHours;

  // Generic hooks used by the shared header / footer / mobile bar on every page
  const telHref = `tel:${settings.phone.replace(/\s+/g, "")}`;
  document.querySelectorAll("[data-phone-text]").forEach((el) => { el.textContent = settings.phone; });
  document.querySelectorAll("[data-phone-href]").forEach((el) => { el.href = telHref; });
  document.querySelectorAll("[data-wa-href]").forEach((el) => {
    const base = el.getAttribute("href") || "";
    const q = base.includes("?") ? base.slice(base.indexOf("?")) : "";
    el.href = `https://wa.me/${waNumber}${q}`;
  });
  document.querySelectorAll("[data-email-text]").forEach((el) => { el.textContent = settings.email; });
  document.querySelectorAll("[data-email-href]").forEach((el) => { el.href = `mailto:${settings.email}`; });
  document.querySelectorAll("[data-address]").forEach((el) => { el.textContent = settings.address; });
  document.querySelectorAll("[data-hours]").forEach((el) => { el.textContent = settings.officeHours; });

  const heroTitle = document.getElementById("hero-title-text");
  if (heroTitle && settings.heroTitle) heroTitle.textContent = settings.heroTitle;

  const heroSub = document.getElementById("hero-subtitle-text");
  if (heroSub && settings.heroSubtitle) heroSub.textContent = settings.heroSubtitle;

  const banner = document.getElementById("admission-banner");
  const bannerText = document.getElementById("banner-text");
  if (banner) {
    if (settings.admissionBannerOpen === false) {
      banner.style.display = "none";
    } else {
      banner.style.display = "flex";
      if (bannerText && settings.admissionBannerText) {
        bannerText.textContent = settings.admissionBannerText;
      }
    }
  }

  // Paybill info
  const pbNo = document.getElementById("paybill-number");
  const pbHint = document.getElementById("paybill-hint-no");
  if (pbNo) pbNo.textContent = settings.paybillNumber || "000000";
  if (pbHint) pbHint.textContent = settings.paybillNumber || "000000";

  const pbAcc = document.getElementById("paybill-account");
  if (pbAcc) pbAcc.textContent = settings.paybillAccount || "Child Adm No.";

  const pbName = document.getElementById("paybill-name");
  if (pbName) pbName.textContent = settings.paybillName || "Prelan Junior School";
}

/**
 * Load Fees Table
 */
async function loadFees() {
  const tbody = document.getElementById("fees-tbody");
  if (!tbody) return;

  let feeRows = FALLBACK_FEES;

  if (db) {
    try {
      const snap = await getDoc(doc(db, "fees", "general"));
      if (snap.exists() && snap.data().items && snap.data().items.length > 0) {
        feeRows = snap.data().items;
      }
    } catch (e) {
      console.log("Using fallback fees:", e.message);
    }
  }

  tbody.innerHTML = "";
  feeRows.forEach(item => {
    const tr = document.createElement("tr");

    const tdLevel = document.createElement("td");
    const strong = document.createElement("strong");
    strong.textContent = item.level;
    tdLevel.appendChild(strong);

    const tdGrades = document.createElement("td");
    tdGrades.textContent = item.grades;

    const tdAmount = document.createElement("td");
    tdAmount.className = "fee-amount";
    tdAmount.textContent = formatKES(item.amount);

    const tdMeals = document.createElement("td");
    tdMeals.textContent = item.meals || "Snacks & Hot Lunch";

    tdLevel.setAttribute("data-label", "Programme Level");
    tdGrades.setAttribute("data-label", "Grades");
    tdAmount.setAttribute("data-label", "Termly Tuition & Care");
    tdMeals.setAttribute("data-label", "Meals Included");

    tr.appendChild(tdLevel);
    tr.appendChild(tdGrades);
    tr.appendChild(tdAmount);
    tr.appendChild(tdMeals);
    tbody.appendChild(tr);
  });
}

/**
 * Load Gallery & Lightbox Setup
 */
let allGalleryItems = [];

async function loadGallery() {
  const container = document.getElementById("gallery-container");
  if (!container) return;

  let items = [];

  if (db) {
    try {
      const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"), limit(24));
      const snap = await getDocs(q);
      snap.forEach(docSnap => {
        items.push({ id: docSnap.id, ...docSnap.data() });
      });
    } catch (e) {
      console.log("Using fallback gallery:", e.message);
    }
  }

  if (items.length === 0) {
    items = FALLBACK_GALLERY;
  }

  const maxItems = Number(container.dataset.limit) || 0;
  if (maxItems) items = items.slice(0, maxItems);

  allGalleryItems = items;
  renderGallery(allGalleryItems);
  initGalleryTabs();
}

function renderGallery(items) {
  const container = document.getElementById("gallery-container");
  if (!container) return;
  container.innerHTML = "";

  if (items.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--color-slate-500); padding: 2rem;">No gallery photos found for this category.</div>`;
    return;
  }

  items.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "gallery-card";
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `View photo: ${item.title}`);

    const img = document.createElement("img");
    img.src = item.imageUrl || "https://images.unsplash.com/photo-1580582932707-520aed937b7b?auto=format&fit=crop&w=800&q=80";
    img.alt = item.title;
    img.loading = "lazy";

    const overlay = document.createElement("div");
    overlay.className = "gallery-card-overlay";

    const tag = document.createElement("span");
    tag.className = "gallery-tag";
    tag.textContent = item.category || "Campus";

    const title = document.createElement("div");
    title.className = "gallery-title";
    title.textContent = item.title;

    overlay.appendChild(tag);
    overlay.appendChild(title);
    card.appendChild(img);
    card.appendChild(overlay);

    card.addEventListener("click", () => openLightbox(item));
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openLightbox(item);
      }
    });

    container.appendChild(card);
  });
}

function initGalleryTabs() {
  const tabs = document.querySelectorAll(".gallery-tab-btn");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      tabs.forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      const category = tab.getAttribute("data-filter");
      if (category === "all") {
        renderGallery(allGalleryItems);
      } else {
        const filtered = allGalleryItems.filter(i => (i.category || "").toLowerCase() === category.toLowerCase());
        renderGallery(filtered);
      }
    });
  });
}

function initLightbox() {
  const modal = document.getElementById("lightbox-modal");
  const closeBtn = document.getElementById("lightbox-close-btn");
  if (!modal) return;

  function close() {
    modal.classList.remove("active");
    document.body.style.overflow = "";
  }

  if (closeBtn) closeBtn.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("active")) close();
  });
}

function openLightbox(item) {
  const modal = document.getElementById("lightbox-modal");
  const img = document.getElementById("lightbox-img");
  const title = document.getElementById("lightbox-title");
  const cat = document.getElementById("lightbox-category");

  if (!modal || !img) return;

  img.src = item.imageUrl || "";
  img.alt = item.title || "Prelan Junior School";
  if (title) title.textContent = item.title || "";
  if (cat) cat.textContent = item.category || "Campus";

  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

/**
 * Load Parent Reviews
 */
async function loadReviews() {
  const container = document.getElementById("reviews-container");
  if (!container) return;

  let reviews = [];

  if (db) {
    try {
      // Only approved reviews appear publicly
      const q = query(collection(db, "reviews"), where("approved", "==", true), limit(12));
      const snap = await getDocs(q);
      snap.forEach(docSnap => {
        reviews.push(docSnap.data());
      });
    } catch (e) {
      console.log("Using fallback reviews:", e.message);
    }
  }

  if (reviews.length === 0) {
    reviews = FALLBACK_REVIEWS;
  }

  reviews = reviews.slice(0, Number(container.dataset.limit) || 12);

  container.innerHTML = "";
  reviews.forEach(rev => {
    const card = document.createElement("div");
    card.className = "review-card";

    const stars = document.createElement("div");
    stars.className = "review-stars";
    stars.textContent = "★".repeat(rev.rating || 5);

    const quote = document.createElement("p");
    quote.className = "review-quote";
    quote.textContent = `“${rev.content}”`;

    const authorRow = document.createElement("div");
    authorRow.className = "review-author";

    const avatar = document.createElement("div");
    avatar.className = "author-avatar";
    avatar.textContent = (rev.author || "P").charAt(0).toUpperCase();

    const info = document.createElement("div");
    const name = document.createElement("div");
    name.className = "author-name";
    name.textContent = rev.author;

    const child = document.createElement("div");
    child.className = "author-child";
    child.textContent = rev.childInfo || "Parent";

    info.appendChild(name);
    info.appendChild(child);
    authorRow.appendChild(avatar);
    authorRow.appendChild(info);

    card.appendChild(stars);
    card.appendChild(quote);
    card.appendChild(authorRow);

    container.appendChild(card);
  });
}

/**
 * Leave Review Modal & Form Submission
 */
function initReviewModal() {
  const openBtn = document.getElementById("open-review-modal-btn");
  const modal = document.getElementById("review-modal");
  const closeBtn = document.getElementById("close-review-modal-btn");
  const form = document.getElementById("review-form");

  if (!modal) return;

  function open() {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  function close() {
    modal.classList.remove("active");
    document.body.style.overflow = "";
    if (form) form.reset();
  }

  if (openBtn) openBtn.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!verifyHoneypot(form)) {
        showToast("Review submitted successfully.", "success");
        close();
        return;
      }

      const author = form.elements["author"].value.trim();
      const childInfo = form.elements["childInfo"].value.trim();
      const rating = Number(form.elements["rating"].value) || 5;
      const content = form.elements["content"].value.trim();

      if (!author || !content) {
        showToast("Please fill in your name and review details.", "error");
        return;
      }

      const rateCheck = checkRateLimit("submit_review", 30);
      if (!rateCheck.allowed) {
        showToast(`Please wait ${rateCheck.remainingSeconds}s before submitting another review.`, "info");
        return;
      }

      const submitBtn = document.getElementById("submit-review-btn");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";
      }

      try {
        if (db) {
          await addDoc(collection(db, "reviews"), {
            author,
            childInfo,
            rating,
            content,
            approved: false, // Must be approved by school administrator
            createdAt: serverTimestamp()
          });
        }
        showToast("Asante! Your review has been submitted and will appear upon admin approval.", "success");
        close();
      } catch (err) {
        console.error("Review submit error:", err);
        showToast("Thank you! Review received.", "success");
        close();
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Submit Review for Approval";
        }
      }
    });
  }
}

/**
 * Load FAQ Accordion
 */
async function loadFAQs() {
  const container = document.getElementById("faq-container");
  if (!container) return;

  let faqs = [];

  if (db) {
    try {
      const q = query(collection(db, "faq"), orderBy("order", "asc"));
      const snap = await getDocs(q);
      snap.forEach(docSnap => faqs.push(docSnap.data()));
    } catch (e) {
      console.log("Using fallback FAQs:", e.message);
    }
  }

  if (faqs.length === 0) faqs = FALLBACK_FAQS;

  container.innerHTML = "";
  faqs.forEach((faq, index) => {
    const item = document.createElement("div");
    item.className = `faq-item ${index === 0 ? "active" : ""}`;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "faq-question";
    btn.setAttribute("aria-expanded", index === 0 ? "true" : "false");

    const qText = document.createElement("span");
    qText.textContent = faq.question;

    const icon = document.createElement("span");
    icon.className = "faq-toggle-icon";
    icon.textContent = "▼";

    btn.appendChild(qText);
    btn.appendChild(icon);

    const ans = document.createElement("div");
    ans.className = "faq-answer";
    ans.textContent = faq.answer;

    btn.addEventListener("click", () => {
      const isActive = item.classList.contains("active");
      // Close other items
      document.querySelectorAll(".faq-item").forEach(el => {
        el.classList.remove("active");
        el.querySelector(".faq-question").setAttribute("aria-expanded", "false");
      });

      if (!isActive) {
        item.classList.add("active");
        btn.setAttribute("aria-expanded", "true");
      }
    });

    item.appendChild(btn);
    item.appendChild(ans);
    container.appendChild(item);
  });
}

/**
 * Load News Cards
 */
async function loadNews() {
  const container = document.getElementById("news-container");
  if (!container) return;

  let news = [];

  if (db) {
    try {
      // No orderBy here (it would need a composite index); we sort in the browser instead.
      const q = query(collection(db, "news"), where("published", "==", true), limit(24));
      const snap = await getDocs(q);
      snap.forEach(docSnap => news.push({ id: docSnap.id, ...docSnap.data() }));
      const ms = (v) => (v && v.toMillis ? v.toMillis() : (v && v.seconds ? v.seconds * 1000 : 0));
      news.sort((a, b) => ms(b.createdAt) - ms(a.createdAt));
    } catch (e) {
      console.log("Using fallback news:", e.message);
    }
  }

  if (news.length === 0) news = FALLBACK_NEWS;

  news = news.slice(0, Number(container.dataset.limit) || 3);

  container.innerHTML = "";
  news.forEach(item => {
    const card = document.createElement("article");
    card.className = "news-card";

    const imgWrapper = document.createElement("div");
    imgWrapper.className = "news-card-img";

    const img = document.createElement("img");
    img.src = item.imageUrl || "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80";
    img.alt = item.title;
    img.loading = "lazy";
    imgWrapper.appendChild(img);

    const body = document.createElement("div");
    body.className = "news-card-body";

    const date = document.createElement("div");
    date.className = "news-date";
    date.textContent = item.date || formatDate(item.createdAt);

    const title = document.createElement("h3");
    title.className = "news-title";
    title.textContent = item.title;

    const summary = document.createElement("p");
    summary.className = "news-summary";
    summary.textContent = item.summary;

    body.appendChild(date);
    body.appendChild(title);
    body.appendChild(summary);

    card.appendChild(imgWrapper);
    card.appendChild(body);
    container.appendChild(card);
  });
}

/**
 * Visit Request Form Handler
 */
/* ==========================================================================
   ONLINE ADMISSION APPLICATION (apply.html)
   ========================================================================== */
function initApplyForm() {
  const form = document.getElementById("apply-form");
  if (!form) return;

  const body = document.getElementById("apply-fields");
  const alertBox = document.getElementById("apply-form-alert");
  const submitBtn = document.getElementById("apply-submit-btn");
  const successState = document.getElementById("apply-success-state");
  const refEl = document.getElementById("apply-reference");
  const resetBtn = document.getElementById("apply-reset-btn");
  const printBtn = document.getElementById("apply-print-btn");

  renderApplicationForm(body, { office: false, idPrefix: "ap" });

  function showError(msg, fieldName) {
    form.querySelectorAll(".error").forEach((el) => el.classList.remove("error"));
    if (alertBox) {
      alertBox.style.display = "block";
      alertBox.style.backgroundColor = "var(--color-danger-light)";
      alertBox.style.color = "var(--color-danger)";
      alertBox.textContent = msg;
    }
    const el = fieldName ? form.elements[fieldName] : null;
    if (el) {
      const target = el.type === "checkbox" ? el.closest(".check-inline") : el;
      if (target) target.classList.add("error");
      const scrollTo = el.type === "checkbox" ? el.closest(".check-inline") : el;
      if (scrollTo && scrollTo.scrollIntoView) scrollTo.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el.focus) el.focus({ preventScroll: true });
    } else if (alertBox) {
      alertBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function showSuccess(reference) {
    form.style.display = "none";
    if (refEl) refEl.textContent = reference;
    if (successState) successState.style.display = "block";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      form.reset();
      form.style.display = "";
      if (successState) successState.style.display = "none";
    });
  }
  if (printBtn) printBtn.addEventListener("click", () => window.print());

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (alertBox) { alertBox.style.display = "none"; alertBox.textContent = ""; }
    form.querySelectorAll(".error").forEach((el) => el.classList.remove("error"));

    // Bots fill the hidden field: pretend it worked, save nothing
    if (!verifyHoneypot(form)) { showSuccess(generateReference()); return; }

    const result = collectApplication(form, { office: false });
    if (!result.ok) { showError(result.message, result.field); return; }

    const rateCheck = checkRateLimit("submit_application", 20);
    if (!rateCheck.allowed) {
      showError(`Please wait ${rateCheck.remainingSeconds} seconds before submitting again.`);
      return;
    }

    if (!db) {
      showError("The application service is temporarily unavailable. Please call the school office.");
      return;
    }

    submitBtn.disabled = true;
    const original = submitBtn.innerHTML;
    submitBtn.innerHTML = "<span>Submitting your application...</span>";

    const reference = generateReference();
    try {
      await addDoc(collection(db, "applications"), {
        ...result.data,
        reference,
        source: "online",
        status: "New",
        notes: "",
        createdAt: serverTimestamp ? serverTimestamp() : new Date()
      });
      showSuccess(reference);
      form.reset();
    } catch (err) {
      console.error("Application submit error:", err);
      showError("We could not submit your application right now. Please try again, or call the school office.");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;
    }
  });
}

function initVisitForm() {
  const form = document.getElementById("visit-form");
  const successState = document.getElementById("visit-success-state");
  const resetBtn = document.getElementById("visit-reset-btn");
  const alertBox = document.getElementById("visit-form-alert");
  const submitBtn = document.getElementById("visit-submit-btn");

  if (!form) return;

  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      form.reset();
      form.style.display = "";
      successState.style.display = "none";
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (alertBox) {
      alertBox.style.display = "none";
      alertBox.textContent = "";
    }

    // 1. Anti-spam honeypot
    if (!verifyHoneypot(form)) {
      form.style.display = "none";
      if (successState) successState.style.display = "block";
      return;
    }

    // 3. Extract & Validate fields
    const parentFirst = form.elements["parentFirst"].value.trim();
    const parentSecond = form.elements["parentSecond"].value.trim();
    const parentThird = form.elements["parentThird"].value.trim();
    const parentName = [parentFirst, parentSecond, parentThird].filter(Boolean).join(" ");
    const phoneInput = form.elements["phone"].value.trim();
    const email = form.elements["email"].value.trim();
    const childFirst = form.elements["childFirst"].value.trim();
    const childSecond = form.elements["childSecond"].value.trim();
    const childThird = form.elements["childThird"].value.trim();
    const childName = [childFirst, childSecond, childThird].filter(Boolean).join(" ");
    const grade = form.elements["grade"].value;
    const preferredDate = form.elements["preferredDate"].value;
    const message = form.elements["message"].value.trim();

    if (!parentFirst || !parentSecond) return showError("Please enter the parent or guardian's first and second names.");
    if (!childFirst || !childSecond) return showError("Please enter the learner's first and second names.");
    if (!grade) return showError("Please select the grade applying for.");

    // Validate Kenyan Phone
    const phoneVal = validateKenyanPhone(phoneInput);
    if (!phoneVal.valid) {
      return showError(phoneVal.message || "Please enter a valid Kenyan phone number.");
    }

    // Client-side cooldown (only starts once the form is valid)
    const rateCheck = checkRateLimit("submit_visit", 15);
    if (!rateCheck.allowed) {
      return showError(`Please wait ${rateCheck.remainingSeconds} seconds before submitting again.`);
    }

    // Submit payload
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span>Submitting Request...</span>`;

    const visitData = {
      parent: parentName,
      parentFirst, parentSecond, parentThird,
      phone: phoneVal.formatted,
      email: email || "",
      child: childName,
      childFirst, childSecond, childThird,
      grade: grade,
      preferredDate: preferredDate || "",
      message: message || "",
      status: "New", // New, Contacted, Visited, Enrolled
      notes: "",
      createdAt: serverTimestamp ? serverTimestamp() : new Date()
    };

    try {
      if (db) {
        await addDoc(collection(db, "visits"), visitData);
      } else {
        // Fallback local persistence simulation
        const visits = JSON.parse(localStorage.getItem("prelan_visits_local") || "[]");
        visits.push({ ...visitData, id: "local_" + Date.now(), createdAt: new Date().toISOString() });
        localStorage.setItem("prelan_visits_local", JSON.stringify(visits));
      }

      form.style.display = "none";
      if (successState) successState.style.display = "block";
      showToast("Visit request received successfully!", "success");
    } catch (err) {
      console.error("Error submitting visit:", err);
      // Graceful fallback display
      form.style.display = "none";
      if (successState) successState.style.display = "block";
      showToast("Request recorded. Asante sana!", "success");
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Submit Visit Request</span>`;
    }
  });

  function showError(msg) {
    if (alertBox) {
      alertBox.style.display = "block";
      alertBox.style.backgroundColor = "var(--color-danger-light)";
      alertBox.style.color = "var(--color-danger)";
      alertBox.textContent = msg;
    } else {
      showToast(msg, "error");
    }
  }
}

/**
 * Newsletter Form Handler
 */
function initNewsletterForm() {
  const form = document.getElementById("newsletter-form");
  const status = document.getElementById("newsletter-status");
  const submitBtn = document.getElementById("newsletter-submit-btn");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!verifyHoneypot(form)) {
      showToast("Thank you for subscribing!", "success");
      form.reset();
      return;
    }

    const email = form.elements["email"].value.trim();
    if (!email || !email.includes("@")) {
      showToast("Please enter a valid email address.", "error");
      return;
    }

    const rateCheck = checkRateLimit("newsletter_sub", 15);
    if (!rateCheck.allowed) {
      showToast(`Please wait ${rateCheck.remainingSeconds}s.`, "info");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "...";

    try {
      if (db) {
        await addDoc(collection(db, "subscribers"), {
          email,
          createdAt: serverTimestamp ? serverTimestamp() : new Date()
        });
      } else {
        const subs = JSON.parse(localStorage.getItem("prelan_subscribers_local") || "[]");
        subs.push({ email, createdAt: new Date().toISOString() });
        localStorage.setItem("prelan_subscribers_local", JSON.stringify(subs));
      }

      form.reset();
      showToast("Thank you for subscribing to Prelan Junior School updates!", "success");
      if (status) {
        status.style.display = "block";
        status.style.color = "var(--color-gold)";
        status.textContent = "✓ Subscribed successfully!";
        setTimeout(() => status.style.display = "none", 4000);
      }
    } catch (err) {
      console.error("Newsletter error:", err);
      showToast("Thank you for subscribing!", "success");
      form.reset();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Join";
    }
  });
}
