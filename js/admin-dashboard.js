/**
 * PRELAN JUNIOR SCHOOL - ADMIN DASHBOARD CONTROLLER
 * Full management system with Secondary Firebase App account provisioning,
 * 30-min inactivity auto-logout, CSV exports, Base64 image compression, and Firestore sync.
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig, isFirebaseConfigured, USE_STORAGE } from "./firebase-config.js";
import {
  formatDate,
  formatKES,
  showToast,
  escapeHtml,
  compressImageToBase64,
  exportToCSV
} from "./utils.js";

// Main Firebase instances
let primaryApp = null;
let auth = null;
let db = null;
let currentUser = null;
let currentAdminRole = "admin"; // 'admin' or 'owner'

const isConfigured = isFirebaseConfigured();

if (isConfigured) {
  try {
    primaryApp = initializeApp(firebaseConfig);
    auth = getAuth(primaryApp);
    db = getFirestore(primaryApp);
  } catch (err) {
    console.warn("Primary Firebase initialization warning:", err);
  }
}

/**
 * Secondary Firebase App instance for creating users without logging out the Admin
 */
function getSecondaryAuth() {
  const existing = getApps().find(app => app.name === "secondaryApp");
  const secondaryApp = existing || initializeApp(firebaseConfig, "secondaryApp");
  return getAuth(secondaryApp);
}

async function createSecondaryAccount(email, password) {
  const secAuth = getSecondaryAuth();
  const cred = await createUserWithEmailAndPassword(secAuth, email, password);
  const uid = cred.user.uid;
  // Sign out from secondary auth immediately so it remains pristine
  await signOut(secAuth);
  return uid;
}

/* ==========================================================================
   INITIALIZATION & AUTH STATE
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initInactivityTimer();
  initTabNavigation();
  initModals();
  checkAuthAndLoad();
});

async function checkAuthAndLoad() {
  // No demo mode: without a working Firebase connection, nobody gets in
  localStorage.removeItem("prelan_admin_session");
  if (!isConfigured || !auth || !db) {
    window.location.href = "/admin/login.html";
    return;
  }

  // Live Firebase Auth
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/admin/login.html";
      return;
    }

    try {
      // Enforce admins/{uid} document existence
      const adminDoc = await getDoc(doc(db, "admins", user.uid));
      if (!adminDoc.exists()) {
        await signOut(auth);
        alert("Access denied: Account is not authorized as an administrator.");
        window.location.href = "/admin/login.html";
        return;
      }

      currentUser = user;
      const data = adminDoc.data();
      currentAdminRole = data.role === "owner" ? "owner" : "admin";

      updateAdminUI(user.email, currentAdminRole);
      loadAllDashboardData();
    } catch (err) {
      console.error("Auth check error:", err);
      window.location.href = "/admin/login.html";
    }
  });

  // Logout button
  const logoutBtn = document.getElementById("admin-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (confirm("Are you sure you want to log out of the admin dashboard?")) {
        localStorage.removeItem("prelan_admin_session");
        if (auth) await signOut(auth);
        window.location.href = "/admin/login.html";
      }
    });
  }
}

function updateAdminUI(email, role) {
  const emailEl = document.getElementById("admin-user-email");
  const roleEl = document.getElementById("admin-user-role");
  const ownerTabBtn = document.getElementById("tab-btn-admins");

  if (emailEl) emailEl.textContent = email;
  if (roleEl) roleEl.textContent = role.toUpperCase();

  // Show owner tab ONLY if role === 'owner'
  if (ownerTabBtn) {
    ownerTabBtn.style.display = role === "owner" ? "flex" : "none";
  }

  const storageBanner = document.getElementById("storage-mode-text");
  if (storageBanner) {
    storageBanner.textContent = USE_STORAGE
      ? "Blaze Plan (Cloud Storage Bucket enabled)"
      : "Spark Free Tier (Base64 compressed photos <200KB in Firestore)";
  }
}

/* ==========================================================================
   INACTIVITY AUTO-LOGOUT (30 MINUTES)
   ========================================================================== */
let inactivityTimeout = null;
let countdownInterval = null;
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
let lastActivityTime = Date.now();

function initInactivityTimer() {
  const timerDisplay = document.getElementById("inactivity-timer");

  function resetActivity() {
    lastActivityTime = Date.now();
  }

  window.addEventListener("mousemove", resetActivity, { passive: true });
  window.addEventListener("keydown", resetActivity, { passive: true });
  window.addEventListener("click", resetActivity, { passive: true });
  window.addEventListener("scroll", resetActivity, { passive: true });

  countdownInterval = setInterval(() => {
    const elapsed = Date.now() - lastActivityTime;
    const remaining = Math.max(0, INACTIVITY_LIMIT_MS - elapsed);

    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);

    if (timerDisplay) {
      timerDisplay.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    if (remaining <= 0) {
      clearInterval(countdownInterval);
      alert("You have been logged out due to 30 minutes of inactivity.");
      localStorage.removeItem("prelan_admin_session");
      if (auth) signOut(auth);
      window.location.href = "/admin/login.html";
    }
  }, 1000);
}

/* ==========================================================================
   TAB NAVIGATION & MODALS
   ========================================================================== */
function initTabNavigation() {
  const tabButtons = document.querySelectorAll(".sidebar-tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");
  const pageTitle = document.getElementById("dashboard-page-title");
  const sidebar = document.getElementById("dashboard-sidebar");
  const toggleBtn = document.getElementById("sidebar-toggle-btn");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.getAttribute("data-tab");
      if (!targetId) return;

      tabButtons.forEach(b => b.classList.remove("active"));
      tabPanels.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add("active");

      // Update page title
      const span = btn.querySelector("span:last-child");
      if (pageTitle && span) pageTitle.textContent = span.textContent;

      // Close mobile sidebar
      if (sidebar && sidebar.classList.contains("open")) {
        sidebar.classList.remove("open");
      }
    });
  });

  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener("click", () => {
      sidebar.classList.toggle("open");
    });
  }
}

function initModals() {
  document.querySelectorAll("[data-close-modal]").forEach(btn => {
    btn.addEventListener("click", () => {
      const modal = btn.closest(".modal-overlay");
      if (modal) modal.classList.remove("active");
    });
  });

  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("active");
    });
  });
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add("active");
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove("active");
}

/* ==========================================================================
   LOAD ALL DATA
   ========================================================================== */
function loadAllDashboardData() {
  loadVisits();
  loadNews();
  loadGallery();
  loadFeesAndPaybill();
  loadFAQsAndReviews();
  loadSettings();
  loadSubscribers();
  loadParentsAndLearners();
  loadPayments();
  if (currentAdminRole === "owner") {
    loadAdmins();
  }
}

/* ==========================================================================
   1. VISITS & APPLICATIONS
   ========================================================================== */
let allVisits = [];

async function loadVisits() {
  const tbody = document.getElementById("visits-table-body");
  if (!tbody) return;

  if (db) {
    try {
      const q = query(collection(db, "visits"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      allVisits = [];
      snap.forEach(docSnap => {
        allVisits.push({ id: docSnap.id, ...docSnap.data() });
      });
    } catch (e) {
      console.warn("Visits fetch error:", e.message);
      allVisits = JSON.parse(localStorage.getItem("prelan_visits_local") || "[]");
    }
  } else {
    allVisits = JSON.parse(localStorage.getItem("prelan_visits_local") || "[]");
  }

  updateVisitsMetrics();
  renderVisitsTable(allVisits);
  initVisitsFilters();
}

function updateVisitsMetrics() {
  const total = allVisits.length;
  const newCount = allVisits.filter(v => (v.status || "New") === "New").length;
  const contacted = allVisits.filter(v => v.status === "Contacted").length;
  const enrolled = allVisits.filter(v => v.status === "Enrolled").length;

  const totalEl = document.getElementById("metric-visits-total");
  const newEl = document.getElementById("metric-visits-new");
  const contEl = document.getElementById("metric-visits-contacted");
  const enrEl = document.getElementById("metric-visits-enrolled");

  if (totalEl) totalEl.textContent = total;
  if (newEl) newEl.textContent = newCount;
  if (contEl) contEl.textContent = contacted;
  if (enrEl) enrEl.textContent = enrolled;
}

function renderVisitsTable(items) {
  const tbody = document.getElementById("visits-table-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--color-slate-500); padding: 2rem;">No submissions found.</td></tr>`;
    return;
  }

  items.forEach(visit => {
    const tr = document.createElement("tr");

    const badgeClass = {
      New: "badge-new",
      Contacted: "badge-contacted",
      Visited: "badge-visited",
      Enrolled: "badge-enrolled"
    }[visit.status || "New"] || "badge-new";

    tr.innerHTML = `
      <td>${formatDate(visit.createdAt)}</td>
      <td><strong>${escapeHtml(visit.parent)}</strong></td>
      <td><a href="tel:${escapeHtml(visit.phone)}" style="color: var(--color-primary); font-weight: 600;">${escapeHtml(visit.phone)}</a></td>
      <td>${escapeHtml(visit.child)}</td>
      <td><span class="badge" style="background: var(--color-mint); color: var(--color-primary);">${escapeHtml(visit.grade)}</span></td>
      <td><span class="badge ${badgeClass}">${escapeHtml(visit.status || "New")}</span></td>
      <td style="max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--color-slate-500);">
        ${escapeHtml(visit.notes || "—")}
      </td>
      <td>
        <button type="button" class="btn btn-sm btn-outline view-visit-btn" data-id="${visit.id}">Review</button>
      </td>
    `;

    tr.querySelector(".view-visit-btn").addEventListener("click", () => openVisitDetail(visit));
    tbody.appendChild(tr);
  });
}

function initVisitsFilters() {
  const searchInput = document.getElementById("visits-search-input");
  const statusFilter = document.getElementById("visits-status-filter");
  const exportBtn = document.getElementById("export-visits-csv-btn");

  function applyFilter() {
    const search = (searchInput?.value || "").toLowerCase();
    const status = statusFilter?.value || "all";

    const filtered = allVisits.filter(v => {
      const matchSearch =
        (v.parent || "").toLowerCase().includes(search) ||
        (v.child || "").toLowerCase().includes(search) ||
        (v.phone || "").toLowerCase().includes(search);
      const matchStatus = status === "all" || (v.status || "New") === status;
      return matchSearch && matchStatus;
    });

    renderVisitsTable(filtered);
  }

  if (searchInput) searchInput.addEventListener("input", applyFilter);
  if (statusFilter) statusFilter.addEventListener("change", applyFilter);

  if (exportBtn) {
    exportBtn.addEventListener("click", () => {
      exportToCSV("prelan_visit_applications", allVisits, [
        { key: "createdAt", label: "Date" },
        { key: "parent", label: "Parent Name" },
        { key: "phone", label: "Phone" },
        { key: "email", label: "Email" },
        { key: "child", label: "Learner Name" },
        { key: "grade", label: "Grade" },
        { key: "status", label: "Status" },
        { key: "notes", label: "Staff Notes" },
        { key: "message", label: "Inquiry Message" }
      ]);
    });
  }
}

function openVisitDetail(visit) {
  const modal = document.getElementById("modal-visit-details");
  const content = document.getElementById("visit-detail-content");
  const statusSelect = document.getElementById("visit-detail-status");
  const notesText = document.getElementById("visit-detail-notes");
  const idInput = document.getElementById("visit-detail-id");
  const deleteBtn = document.getElementById("delete-visit-btn");
  const form = document.getElementById("visit-status-form");

  if (!modal || !content) return;

  idInput.value = visit.id;
  statusSelect.value = visit.status || "New";
  notesText.value = visit.notes || "";

  content.innerHTML = `
    <div style="background: var(--color-mint-subtle); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; border: 1px solid var(--color-mint-border);">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
        <div><strong>Parent:</strong> ${escapeHtml(visit.parent)}</div>
        <div><strong>Phone:</strong> <a href="tel:${escapeHtml(visit.phone)}">${escapeHtml(visit.phone)}</a></div>
        <div><strong>Email:</strong> ${escapeHtml(visit.email || "—")}</div>
        <div><strong>Preferred Date:</strong> ${escapeHtml(visit.preferredDate || "Not specified")}</div>
        <div><strong>Learner:</strong> ${escapeHtml(visit.child)}</div>
        <div><strong>Grade:</strong> ${escapeHtml(visit.grade)}</div>
      </div>
      <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--color-mint-border);">
        <strong>Message / Inquiries:</strong>
        <p style="margin-top: 0.25rem; color: var(--color-slate-700);">${escapeHtml(visit.message || "None provided.")}</p>
      </div>
    </div>
  `;

  form.onsubmit = async (e) => {
    e.preventDefault();
    const newStatus = statusSelect.value;
    const newNotes = notesText.value.trim();

    try {
      if (db) {
        await updateDoc(doc(db, "visits", visit.id), {
          status: newStatus,
          notes: newNotes,
          updatedAt: serverTimestamp()
        });
      } else {
        visit.status = newStatus;
        visit.notes = newNotes;
        localStorage.setItem("prelan_visits_local", JSON.stringify(allVisits));
      }
      showToast("Visit status and notes saved.", "success");
      closeModal("modal-visit-details");
      loadVisits();
    } catch (err) {
      console.error(err);
      showToast("Error updating status.", "error");
    }
  };

  deleteBtn.onclick = async () => {
    if (confirm(`Are you sure you want to delete submission for ${visit.child}?`)) {
      try {
        if (db) {
          await deleteDoc(doc(db, "visits", visit.id));
        } else {
          allVisits = allVisits.filter(v => v.id !== visit.id);
          localStorage.setItem("prelan_visits_local", JSON.stringify(allVisits));
        }
        showToast("Submission deleted.", "info");
        closeModal("modal-visit-details");
        loadVisits();
      } catch (err) {
        showToast("Error deleting submission.", "error");
      }
    }
  };

  openModal("modal-visit-details");
}

/* ==========================================================================
   2. NEWS & POSTS
   ========================================================================== */
let allNews = [];

async function loadNews() {
  const tbody = document.getElementById("news-table-body");
  if (!tbody) return;

  if (db) {
    try {
      const q = query(collection(db, "news"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      allNews = [];
      snap.forEach(docSnap => allNews.push({ id: docSnap.id, ...docSnap.data() }));
    } catch (e) {
      console.warn("News fetch fallback:", e.message);
      allNews = JSON.parse(localStorage.getItem("prelan_news_local") || "[]");
    }
  } else {
    allNews = JSON.parse(localStorage.getItem("prelan_news_local") || "[]");
  }

  tbody.innerHTML = "";
  if (allNews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No posts yet. Click "+ Add New Post" above.</td></tr>`;
    return;
  }

  allNews.forEach(post => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <img src="${post.imageUrl || 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=150&q=80'}"
             alt="Post Image" style="width: 50px; height: 35px; object-fit: cover; border-radius: 4px;">
      </td>
      <td><strong>${escapeHtml(post.title)}</strong></td>
      <td>${escapeHtml(post.date || "—")}</td>
      <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(post.summary)}</td>
      <td>
        <span class="badge ${post.published ? 'badge-enrolled' : 'badge-pending'}">
          ${post.published ? 'Published' : 'Draft'}
        </span>
      </td>
      <td>
        <button type="button" class="btn btn-sm btn-outline edit-news-btn" style="margin-right: 0.25rem;">Edit</button>
        <button type="button" class="btn btn-sm btn-outline delete-news-btn" style="border-color: var(--color-danger); color: var(--color-danger);">Delete</button>
      </td>
    `;

    tr.querySelector(".edit-news-btn").addEventListener("click", () => openEditNews(post));
    tr.querySelector(".delete-news-btn").addEventListener("click", () => deleteNews(post.id));
    tbody.appendChild(tr);
  });

  initNewsForm();
}

function initNewsForm() {
  const addBtn = document.getElementById("open-new-post-btn");
  const form = document.getElementById("news-form");
  const titleInput = document.getElementById("news-title-input");
  const dateInput = document.getElementById("news-date-input");
  const pubSelect = document.getElementById("news-published-input");
  const summaryInput = document.getElementById("news-summary-input");
  const bodyInput = document.getElementById("news-body-input");
  const imageFile = document.getElementById("news-image-file");
  const imageUrl = document.getElementById("news-image-url");
  const editIdInput = document.getElementById("news-edit-id");
  const modalTitle = document.getElementById("news-modal-title");
  const submitBtn = document.getElementById("save-news-submit-btn");

  if (addBtn) {
    addBtn.onclick = () => {
      form.reset();
      editIdInput.value = "";
      modalTitle.textContent = "Add News Post";
      openModal("modal-news");
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";

      let finalImg = imageUrl.value.trim();

      // Check if file uploaded
      if (imageFile.files && imageFile.files[0]) {
        try {
          finalImg = await compressImageToBase64(imageFile.files[0], 800, 800, 0.7);
        } catch (err) {
          console.error("Image compression error:", err);
        }
      }

      if (!finalImg) {
        finalImg = "https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=800&q=80";
      }

      const postData = {
        title: titleInput.value.trim(),
        date: dateInput.value.trim() || formatDate(new Date()),
        published: pubSelect.value === "true",
        summary: summaryInput.value.trim(),
        body: bodyInput.value.trim(),
        imageUrl: finalImg,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date()
      };

      const editId = editIdInput.value;

      try {
        if (db) {
          if (editId) {
            await updateDoc(doc(db, "news", editId), postData);
          } else {
            postData.createdAt = serverTimestamp ? serverTimestamp() : new Date();
            await addDoc(collection(db, "news"), postData);
          }
        } else {
          // Local fallback
          if (editId) {
            const idx = allNews.findIndex(n => n.id === editId);
            if (idx >= 0) allNews[idx] = { ...allNews[idx], ...postData };
          } else {
            allNews.push({ id: "local_" + Date.now(), ...postData, createdAt: new Date().toISOString() });
          }
          localStorage.setItem("prelan_news_local", JSON.stringify(allNews));
        }

        showToast("News post saved successfully.", "success");
        closeModal("modal-news");
        loadNews();
      } catch (err) {
        console.error(err);
        showToast("Error saving news post.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save News Post";
      }
    };
  }
}

function openEditNews(post) {
  const form = document.getElementById("news-form");
  const modalTitle = document.getElementById("news-modal-title");
  if (!form) return;

  form.reset();
  document.getElementById("news-edit-id").value = post.id;
  document.getElementById("news-title-input").value = post.title || "";
  document.getElementById("news-date-input").value = post.date || "";
  document.getElementById("news-published-input").value = post.published ? "true" : "false";
  document.getElementById("news-summary-input").value = post.summary || "";
  document.getElementById("news-body-input").value = post.body || "";
  document.getElementById("news-image-url").value = (post.imageUrl && !post.imageUrl.startsWith("data:")) ? post.imageUrl : "";

  if (modalTitle) modalTitle.textContent = "Edit News Post";
  openModal("modal-news");
}

async function deleteNews(id) {
  if (confirm("Are you sure you want to delete this post?")) {
    try {
      if (db) {
        await deleteDoc(doc(db, "news", id));
      } else {
        allNews = allNews.filter(n => n.id !== id);
        localStorage.setItem("prelan_news_local", JSON.stringify(allNews));
      }
      showToast("Post deleted.", "info");
      loadNews();
    } catch (err) {
      showToast("Error deleting post.", "error");
    }
  }
}

/* ==========================================================================
   3. GALLERY PHOTOS
   ========================================================================== */
let allGallery = [];

async function loadGallery() {
  const grid = document.getElementById("admin-gallery-grid");
  if (!grid) return;

  if (db) {
    try {
      const q = query(collection(db, "gallery"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      allGallery = [];
      snap.forEach(docSnap => allGallery.push({ id: docSnap.id, ...docSnap.data() }));
    } catch (e) {
      allGallery = JSON.parse(localStorage.getItem("prelan_gallery_local") || "[]");
    }
  } else {
    allGallery = JSON.parse(localStorage.getItem("prelan_gallery_local") || "[]");
  }

  grid.innerHTML = "";
  if (allGallery.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--color-slate-500); padding: 2rem;">No gallery photos yet. Click "+ Upload / Add Photo" above.</div>`;
    return;
  }

  allGallery.forEach(item => {
    const card = document.createElement("div");
    card.className = "gallery-card";
    card.innerHTML = `
      <img src="${item.imageUrl}" alt="${escapeHtml(item.title)}">
      <div class="gallery-card-overlay">
        <span class="gallery-tag">${escapeHtml(item.category)}</span>
        <div class="gallery-title">${escapeHtml(item.title)}</div>
        <button type="button" class="btn btn-sm btn-outline delete-gal-btn" style="border-color: #f87171; color: #fff; background: rgba(220, 38, 38, 0.7); margin-top: 0.5rem; align-self: flex-start;">Delete</button>
      </div>
    `;

    card.querySelector(".delete-gal-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteGalleryPhoto(item.id);
    });

    grid.appendChild(card);
  });

  initGalleryForm();
}

function initGalleryForm() {
  const addBtn = document.getElementById("open-new-photo-btn");
  const form = document.getElementById("gallery-form");
  const titleInput = document.getElementById("gal-title");
  const catInput = document.getElementById("gal-cat");
  const fileInput = document.getElementById("gal-file");
  const urlInput = document.getElementById("gal-url");
  const submitBtn = document.getElementById("save-gallery-submit-btn");

  if (addBtn) {
    addBtn.onclick = () => {
      form.reset();
      openModal("modal-gallery");
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = "Uploading & Compressing...";

      let finalImg = urlInput.value.trim();

      if (fileInput.files && fileInput.files[0]) {
        try {
          finalImg = await compressImageToBase64(fileInput.files[0], 800, 800, 0.7);
        } catch (err) {
          console.error("Compression failed:", err);
        }
      }

      if (!finalImg) {
        showToast("Please choose an image file or provide an image URL.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Add to Gallery";
        return;
      }

      const photoData = {
        title: titleInput.value.trim(),
        category: catInput.value,
        imageUrl: finalImg,
        createdAt: serverTimestamp ? serverTimestamp() : new Date()
      };

      try {
        if (db) {
          await addDoc(collection(db, "gallery"), photoData);
        } else {
          allGallery.unshift({ id: "local_" + Date.now(), ...photoData, createdAt: new Date().toISOString() });
          localStorage.setItem("prelan_gallery_local", JSON.stringify(allGallery));
        }

        showToast("Photo added to gallery.", "success");
        closeModal("modal-gallery");
        loadGallery();
      } catch (err) {
        console.error(err);
        showToast("Error saving gallery photo.", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Add to Gallery";
      }
    };
  }
}

async function deleteGalleryPhoto(id) {
  if (confirm("Delete this gallery image?")) {
    try {
      if (db) {
        await deleteDoc(doc(db, "gallery", id));
      } else {
        allGallery = allGallery.filter(g => g.id !== id);
        localStorage.setItem("prelan_gallery_local", JSON.stringify(allGallery));
      }
      showToast("Photo removed.", "info");
      loadGallery();
    } catch (err) {
      showToast("Error deleting photo.", "error");
    }
  }
}

/* ==========================================================================
   4. FEES & PAYBILL
   ========================================================================== */
const DEFAULT_FEES_ROWS = [
  { level: "Pre-Primary", grades: "PP1 & PP2", amount: "____", meals: "Snacks & Hot Lunch" },
  { level: "Lower Primary", grades: "Grades 1 – 3", amount: "____", meals: "Snacks & Hot Lunch" },
  { level: "Upper Primary", grades: "Grades 4 – 6", amount: "____", meals: "Snacks & Hot Lunch" }
];

async function loadFeesAndPaybill() {
  const tbody = document.getElementById("admin-fees-tbody");
  const pbNo = document.getElementById("admin-pb-number");
  const pbAcc = document.getElementById("admin-pb-account");
  const pbName = document.getElementById("admin-pb-name");
  const saveFeesBtn = document.getElementById("save-fees-table-btn");
  const savePbBtn = document.getElementById("save-paybill-btn");

  let feeItems = DEFAULT_FEES_ROWS;

  if (db) {
    try {
      const snap = await getDoc(doc(db, "fees", "general"));
      if (snap.exists() && snap.data().items) {
        feeItems = snap.data().items;
      }
      const settSnap = await getDoc(doc(db, "settings", "general"));
      if (settSnap.exists()) {
        const d = settSnap.data();
        if (pbNo) pbNo.value = d.paybillNumber || "000000";
        if (pbAcc) pbAcc.value = d.paybillAccount || "Learner Adm No. / Name";
        if (pbName) pbName.value = d.paybillName || "Prelan Junior School";
      }
    } catch (e) {
      console.warn("Fees fetch error:", e.message);
    }
  }

  if (tbody) {
    tbody.innerHTML = "";
    feeItems.forEach((row, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="text" class="form-control fee-level-input" value="${escapeHtml(row.level)}"></td>
        <td><input type="text" class="form-control fee-grades-input" value="${escapeHtml(row.grades)}"></td>
        <td><input type="text" class="form-control fee-amount-input" value="${escapeHtml(row.amount)}"></td>
        <td><input type="text" class="form-control fee-meals-input" value="${escapeHtml(row.meals || 'Snacks & Hot Lunch')}"></td>
      `;
      tbody.appendChild(tr);
    });
  }

  if (saveFeesBtn) {
    saveFeesBtn.onclick = async () => {
      const rows = tbody.querySelectorAll("tr");
      const updated = [];
      rows.forEach(tr => {
        updated.push({
          level: tr.querySelector(".fee-level-input").value.trim(),
          grades: tr.querySelector(".fee-grades-input").value.trim(),
          amount: tr.querySelector(".fee-amount-input").value.trim(),
          meals: tr.querySelector(".fee-meals-input").value.trim()
        });
      });

      try {
        if (db) {
          await setDoc(doc(db, "fees", "general"), { items: updated, updatedAt: serverTimestamp() }, { merge: true });
        }
        showToast("Fees structure saved.", "success");
      } catch (err) {
        showToast("Error saving fees.", "error");
      }
    };
  }

  if (savePbBtn) {
    savePbBtn.onclick = async () => {
      const paybillNumber = pbNo.value.trim();
      const paybillAccount = pbAcc.value.trim();
      const paybillName = pbName.value.trim();

      try {
        if (db) {
          await setDoc(doc(db, "settings", "general"), {
            paybillNumber,
            paybillAccount,
            paybillName,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
        showToast("Paybill details saved.", "success");
      } catch (err) {
        showToast("Error saving Paybill details.", "error");
      }
    };
  }
}

/* ==========================================================================
   5. FAQS & REVIEWS
   ========================================================================== */
let allFaqs = [];
let allReviews = [];

async function loadFAQsAndReviews() {
  loadFAQsTable();
  loadReviewsTable();
}

async function loadFAQsTable() {
  const tbody = document.getElementById("faqs-table-body");
  if (!tbody) return;

  if (db) {
    try {
      const q = query(collection(db, "faq"), orderBy("order", "asc"));
      const snap = await getDocs(q);
      allFaqs = [];
      snap.forEach(d => allFaqs.push({ id: d.id, ...d.data() }));
    } catch (e) {
      allFaqs = JSON.parse(localStorage.getItem("prelan_faqs_local") || "[]");
    }
  } else {
    allFaqs = JSON.parse(localStorage.getItem("prelan_faqs_local") || "[]");
  }

  tbody.innerHTML = "";
  if (allFaqs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 1.5rem;">No FAQs configured.</td></tr>`;
    return;
  }

  allFaqs.forEach(faq => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${faq.order || 1}</td>
      <td><strong>${escapeHtml(faq.question)}</strong></td>
      <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(faq.answer)}</td>
      <td>
        <button type="button" class="btn btn-sm btn-outline edit-faq-btn">Edit</button>
        <button type="button" class="btn btn-sm btn-outline delete-faq-btn" style="border-color: var(--color-danger); color: var(--color-danger);">Delete</button>
      </td>
    `;

    tr.querySelector(".edit-faq-btn").onclick = () => openEditFaq(faq);
    tr.querySelector(".delete-faq-btn").onclick = () => deleteFaq(faq.id);
    tbody.appendChild(tr);
  });

  initFaqForm();
}

function initFaqForm() {
  const addBtn = document.getElementById("open-new-faq-btn");
  const form = document.getElementById("faq-form");
  const qInput = document.getElementById("faq-question-input");
  const aInput = document.getElementById("faq-answer-input");
  const ordInput = document.getElementById("faq-order-input");
  const editId = document.getElementById("faq-edit-id");

  if (addBtn) {
    addBtn.onclick = () => {
      form.reset();
      editId.value = "";
      document.getElementById("faq-modal-title").textContent = "Add FAQ Item";
      openModal("modal-faq");
    };
  }

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const faqData = {
        question: qInput.value.trim(),
        answer: aInput.value.trim(),
        order: Number(ordInput.value) || 1,
        updatedAt: serverTimestamp ? serverTimestamp() : new Date()
      };

      try {
        if (db) {
          if (editId.value) {
            await updateDoc(doc(db, "faq", editId.value), faqData);
          } else {
            await addDoc(collection(db, "faq"), faqData);
          }
        } else {
          if (editId.value) {
            const idx = allFaqs.findIndex(f => f.id === editId.value);
            if (idx >= 0) allFaqs[idx] = { ...allFaqs[idx], ...faqData };
          } else {
            allFaqs.push({ id: "local_" + Date.now(), ...faqData });
          }
          localStorage.setItem("prelan_faqs_local", JSON.stringify(allFaqs));
        }

        showToast("FAQ saved.", "success");
        closeModal("modal-faq");
        loadFAQsTable();
      } catch (err) {
        showToast("Error saving FAQ.", "error");
      }
    };
  }
}

function openEditFaq(faq) {
  const form = document.getElementById("faq-form");
  if (!form) return;
  form.reset();
  document.getElementById("faq-edit-id").value = faq.id;
  document.getElementById("faq-question-input").value = faq.question || "";
  document.getElementById("faq-answer-input").value = faq.answer || "";
  document.getElementById("faq-order-input").value = faq.order || 1;
  document.getElementById("faq-modal-title").textContent = "Edit FAQ Item";
  openModal("modal-faq");
}

async function deleteFaq(id) {
  if (confirm("Delete this FAQ item?")) {
    try {
      if (db) await deleteDoc(doc(db, "faq", id));
      showToast("FAQ deleted.", "info");
      loadFAQsTable();
    } catch (err) {
      showToast("Error deleting FAQ.", "error");
    }
  }
}

async function loadReviewsTable() {
  const tbody = document.getElementById("reviews-table-body");
  if (!tbody) return;

  if (db) {
    try {
      const q = query(collection(db, "reviews"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      allReviews = [];
      snap.forEach(d => allReviews.push({ id: d.id, ...d.data() }));
    } catch (e) {
      allReviews = JSON.parse(localStorage.getItem("prelan_reviews_local") || "[]");
    }
  } else {
    allReviews = JSON.parse(localStorage.getItem("prelan_reviews_local") || "[]");
  }

  tbody.innerHTML = "";
  if (allReviews.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1.5rem;">No reviews submitted yet.</td></tr>`;
    return;
  }

  allReviews.forEach(rev => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(rev.createdAt)}</td>
      <td><strong>${escapeHtml(rev.author)}</strong></td>
      <td>${escapeHtml(rev.childInfo || "—")}</td>
      <td>${"★".repeat(rev.rating || 5)}</td>
      <td style="max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(rev.content)}</td>
      <td>
        <button type="button" class="btn btn-sm ${rev.approved ? 'btn-gold' : 'btn-outline'} toggle-rev-btn">
          ${rev.approved ? '✓ Approved' : 'Hidden (Pending)'}
        </button>
      </td>
      <td>
        <button type="button" class="btn btn-sm btn-outline delete-rev-btn" style="border-color: var(--color-danger); color: var(--color-danger);">Delete</button>
      </td>
    `;

    tr.querySelector(".toggle-rev-btn").onclick = () => toggleReviewApproval(rev);
    tr.querySelector(".delete-rev-btn").onclick = () => deleteReview(rev.id);
    tbody.appendChild(tr);
  });
}

async function toggleReviewApproval(rev) {
  const newApproved = !rev.approved;
  try {
    if (db) {
      await updateDoc(doc(db, "reviews", rev.id), { approved: newApproved });
    } else {
      rev.approved = newApproved;
      localStorage.setItem("prelan_reviews_local", JSON.stringify(allReviews));
    }
    showToast(newApproved ? "Review published live!" : "Review hidden from public site.", "success");
    loadReviewsTable();
  } catch (err) {
    showToast("Error updating review.", "error");
  }
}

async function deleteReview(id) {
  if (confirm("Delete this review?")) {
    try {
      if (db) await deleteDoc(doc(db, "reviews", id));
      showToast("Review deleted.", "info");
      loadReviewsTable();
    } catch (err) {
      showToast("Error deleting review.", "error");
    }
  }
}

/* ==========================================================================
   6. SITE SETTINGS
   ========================================================================== */
async function loadSettings() {
  const form = document.getElementById("site-settings-form");
  const saveBtn = document.getElementById("save-settings-btn");
  if (!form) return;

  if (db) {
    try {
      const snap = await getDoc(doc(db, "settings", "general"));
      if (snap.exists()) {
        const d = snap.data();
        if (form.elements["phone"]) form.elements["phone"].value = d.phone || "";
        if (form.elements["whatsapp"]) form.elements["whatsapp"].value = d.whatsapp || "";
        if (form.elements["email"]) form.elements["email"].value = d.email || "";
        if (form.elements["address"]) form.elements["address"].value = d.address || "";
        if (form.elements["officeHours"]) form.elements["officeHours"].value = d.officeHours || "";
        if (form.elements["heroTitle"]) form.elements["heroTitle"].value = d.heroTitle || "";
        if (form.elements["heroSubtitle"]) form.elements["heroSubtitle"].value = d.heroSubtitle || "";
        if (form.elements["admissionBannerOpen"]) form.elements["admissionBannerOpen"].checked = d.admissionBannerOpen !== false;
        if (form.elements["admissionBannerText"]) form.elements["admissionBannerText"].value = d.admissionBannerText || "";
      }
    } catch (e) {
      console.warn("Settings error:", e.message);
    }
  }

  if (saveBtn) {
    saveBtn.onclick = async () => {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      const settingsData = {
        phone: form.elements["phone"].value.trim(),
        whatsapp: form.elements["whatsapp"].value.trim(),
        email: form.elements["email"].value.trim(),
        address: form.elements["address"].value.trim(),
        officeHours: form.elements["officeHours"].value.trim(),
        heroTitle: form.elements["heroTitle"].value.trim(),
        heroSubtitle: form.elements["heroSubtitle"].value.trim(),
        admissionBannerOpen: form.elements["admissionBannerOpen"].checked,
        admissionBannerText: form.elements["admissionBannerText"].value.trim(),
        updatedAt: serverTimestamp ? serverTimestamp() : new Date()
      };

      try {
        if (db) {
          await setDoc(doc(db, "settings", "general"), settingsData, { merge: true });
        }
        showToast("Settings updated successfully.", "success");
      } catch (err) {
        showToast("Error updating settings.", "error");
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = "Save Settings";
      }
    };
  }
}

/* ==========================================================================
   7. NEWSLETTER SUBSCRIBERS
   ========================================================================== */
let allSubscribers = [];

async function loadSubscribers() {
  const tbody = document.getElementById("subscribers-table-body");
  const exportBtn = document.getElementById("export-subs-csv-btn");
  if (!tbody) return;

  if (db) {
    try {
      const q = query(collection(db, "subscribers"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      allSubscribers = [];
      snap.forEach(d => allSubscribers.push({ id: d.id, ...d.data() }));
    } catch (e) {
      allSubscribers = JSON.parse(localStorage.getItem("prelan_subscribers_local") || "[]");
    }
  } else {
    allSubscribers = JSON.parse(localStorage.getItem("prelan_subscribers_local") || "[]");
  }

  tbody.innerHTML = "";
  if (allSubscribers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 1.5rem;">No subscribers yet.</td></tr>`;
    return;
  }

  allSubscribers.forEach(sub => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(sub.createdAt)}</td>
      <td><strong>${escapeHtml(sub.email)}</strong></td>
      <td>
        <button type="button" class="btn btn-sm btn-outline delete-sub-btn" style="border-color: var(--color-danger); color: var(--color-danger);">Remove</button>
      </td>
    `;

    tr.querySelector(".delete-sub-btn").onclick = async () => {
      if (confirm(`Remove ${sub.email} from subscribers list?`)) {
        try {
          if (db) await deleteDoc(doc(db, "subscribers", sub.id));
          showToast("Subscriber removed.", "info");
          loadSubscribers();
        } catch (e) {
          showToast("Error removing subscriber.", "error");
        }
      }
    };

    tbody.appendChild(tr);
  });

  if (exportBtn) {
    exportBtn.onclick = () => {
      exportToCSV("prelan_newsletter_subscribers", allSubscribers, [
        { key: "createdAt", label: "Date" },
        { key: "email", label: "Email Address" }
      ]);
    };
  }
}

/* ==========================================================================
   8. PARENTS & LEARNERS (Section 4B & 4D)
   ========================================================================== */
let allParents = [];

async function loadParentsAndLearners() {
  const tbody = document.getElementById("parents-table-body");
  const addBtn = document.getElementById("open-new-parent-btn");
  const paySelect = document.getElementById("pay-parent-select");
  if (!tbody) return;

  if (db) {
    try {
      const q = query(collection(db, "parents"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      allParents = [];
      snap.forEach(d => allParents.push({ id: d.id, ...d.data() }));
    } catch (e) {
      allParents = JSON.parse(localStorage.getItem("prelan_parents_local") || "[]");
    }
  } else {
    allParents = JSON.parse(localStorage.getItem("prelan_parents_local") || "[]");
  }

  tbody.innerHTML = "";

  // Populate payment select dropdown
  if (paySelect) {
    paySelect.innerHTML = `<option value="" disabled selected>Select Parent / Learner</option>`;
  }

  if (allParents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem;">No parent accounts created yet. Click "+ Create Parent Account" above.</td></tr>`;
    return;
  }

  allParents.forEach(parent => {
    const learnersText = (parent.learners || []).map(l => `${l.name} (${l.grade || '—'}, ${l.admNo || '—'})`).join(", ") || "None linked";

    if (paySelect) {
      const opt = document.createElement("option");
      opt.value = parent.id;
      opt.textContent = `${parent.name} — ${learnersText} (Bal: ${formatKES(parent.balance || 0)})`;
      paySelect.appendChild(opt);
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${escapeHtml(parent.name)}</strong></td>
      <td>${escapeHtml(parent.email)}</td>
      <td>${escapeHtml(parent.phone)}</td>
      <td>${escapeHtml(learnersText)}</td>
      <td class="fee-amount" style="color: ${(parent.balance || 0) > 0 ? 'var(--color-danger)' : 'var(--color-success)'}">
        ${formatKES(parent.balance || 0)}
      </td>
      <td>
        <button type="button" class="btn btn-sm btn-outline reset-pass-btn" title="Send password reset link">Reset Link</button>
        <button type="button" class="btn btn-sm btn-outline delete-parent-btn" style="border-color: var(--color-danger); color: var(--color-danger);">Delete</button>
      </td>
    `;

    tr.querySelector(".reset-pass-btn").onclick = async () => {
      try {
        if (auth && isConfigured) {
          await sendPasswordResetEmail(auth, parent.email);
          showToast(`Password reset email sent to ${parent.email}`, "success");
        } else {
          showToast(`Demo: Reset email sent to ${parent.email}`, "info");
        }
      } catch (err) {
        showToast("Error sending reset email: " + err.message, "error");
      }
    };

    tr.querySelector(".delete-parent-btn").onclick = async () => {
      if (confirm(`Delete parent account for ${parent.name}?`)) {
        try {
          if (db) await deleteDoc(doc(db, "parents", parent.id));
          allParents = allParents.filter(p => p.id !== parent.id);
          localStorage.setItem("prelan_parents_local", JSON.stringify(allParents));
          showToast("Parent record removed.", "info");
          loadParentsAndLearners();
        } catch (err) {
          showToast("Error deleting parent.", "error");
        }
      }
    };

    tbody.appendChild(tr);
  });

  if (addBtn) {
    addBtn.onclick = () => {
      document.getElementById("create-parent-form").reset();
      openModal("modal-parent");
    };
  }

  initCreateParentForm();
}

function initCreateParentForm() {
  const form = document.getElementById("create-parent-form");
  const submitBtn = document.getElementById("create-parent-submit-btn");
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating Account (Admin Session Preserved)...";

    const name = form.elements["parent-name"].value.trim();
    const phone = form.elements["parent-phone"].value.trim();
    const email = form.elements["parent-email"].value.trim();
    const tempPassword = form.elements["parent-temp-pass"].value.trim();
    const learnerName = form.elements["learner-name"].value.trim();
    const learnerAdm = form.elements["learner-adm"].value.trim();
    const learnerGrade = form.elements["learner-grade"].value;
    const initialBalance = Number(form.elements["initial-balance"].value) || 0;

    if (!email || !tempPassword || tempPassword.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Parent Account";
      return;
    }

    try {
      let uid = "demo_parent_" + Date.now();

      if (isConfigured) {
        // SECONDARY APP INSTANCE PROVISIONING: Admin stays signed in!
        uid = await createSecondaryAccount(email, tempPassword);
      }

      const parentData = {
        name,
        phone,
        email,
        balance: initialBalance,
        learners: [
          {
            name: learnerName,
            admNo: learnerAdm,
            grade: learnerGrade
          }
        ],
        createdAt: serverTimestamp ? serverTimestamp() : new Date()
      };

      if (db) {
        // Write parents/{uid} from active admin session
        await setDoc(doc(db, "parents", uid), parentData);
      } else {
        allParents.push({ id: uid, ...parentData, createdAt: new Date().toISOString() });
        localStorage.setItem("prelan_parents_local", JSON.stringify(allParents));
      }

      showToast(`Parent account created for ${name}! Admin remains signed in.`, "success");
      closeModal("modal-parent");
      form.reset();
      loadParentsAndLearners();
    } catch (err) {
      console.error("Create parent account error:", err);
      let msg = err.message;
      if (err.code === "auth/email-already-in-use") {
        msg = "A user account with this email already exists.";
      }
      showToast(`Error: ${msg}`, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Parent Account";
    }
  };
}

/* ==========================================================================
   9. FEE PAYMENTS (M-PESA)
   ========================================================================== */
let allPayments = [];

async function loadPayments() {
  const tbody = document.getElementById("payments-table-body");
  const recordBtn = document.getElementById("open-record-payment-btn");
  const exportBtn = document.getElementById("export-payments-csv-btn");
  if (!tbody) return;

  if (db) {
    try {
      const q = query(collection(db, "payments"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      allPayments = [];
      snap.forEach(d => allPayments.push({ id: d.id, ...d.data() }));
    } catch (e) {
      allPayments = JSON.parse(localStorage.getItem("prelan_payments_local") || "[]");
    }
  } else {
    allPayments = JSON.parse(localStorage.getItem("prelan_payments_local") || "[]");
  }

  tbody.innerHTML = "";
  if (allPayments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;">No payment records entered. Click "+ Record Payment" above.</td></tr>`;
    return;
  }

  allPayments.forEach(pay => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(pay.date || pay.createdAt)}</td>
      <td><strong style="color: var(--color-primary); font-family: monospace;">${escapeHtml(pay.mpesaRef)}</strong></td>
      <td>${escapeHtml(pay.parentName || "—")}</td>
      <td><span class="badge" style="background: var(--color-mint); color: var(--color-primary);">${escapeHtml(pay.term || "Term 1")}</span></td>
      <td class="fee-amount">${formatKES(pay.amount)}</td>
      <td>${escapeHtml(pay.notes || "—")}</td>
      <td>
        <button type="button" class="btn btn-sm btn-outline delete-pay-btn" style="border-color: var(--color-danger); color: var(--color-danger);">Delete</button>
      </td>
    `;

    tr.querySelector(".delete-pay-btn").onclick = async () => {
      if (confirm(`Delete payment of ${formatKES(pay.amount)} (${pay.mpesaRef})?`)) {
        try {
          if (db) await deleteDoc(doc(db, "payments", pay.id));
          allPayments = allPayments.filter(p => p.id !== pay.id);
          localStorage.setItem("prelan_payments_local", JSON.stringify(allPayments));
          showToast("Payment record deleted.", "info");
          loadPayments();
        } catch (err) {
          showToast("Error deleting payment.", "error");
        }
      }
    };

    tbody.appendChild(tr);
  });

  if (recordBtn) {
    recordBtn.onclick = () => {
      const form = document.getElementById("record-payment-form");
      form.reset();
      document.getElementById("pay-date").valueAsDate = new Date();
      openModal("modal-payment");
    };
  }

  if (exportBtn) {
    exportBtn.onclick = () => {
      exportToCSV("prelan_fee_payments", allPayments, [
        { key: "date", label: "Date" },
        { key: "mpesaRef", label: "M-Pesa Reference" },
        { key: "parentName", label: "Parent Name" },
        { key: "term", label: "Term" },
        { key: "amount", label: "Amount (KES)" },
        { key: "notes", label: "Notes" }
      ]);
    };
  }

  initRecordPaymentForm();
}

function initRecordPaymentForm() {
  const form = document.getElementById("record-payment-form");
  const submitBtn = document.getElementById("save-payment-submit-btn");
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = "Saving Payment...";

    const parentId = form.elements["pay-parent-select"].value;
    const amount = Number(form.elements["pay-amount"].value);
    const mpesaRef = form.elements["pay-mpesa-ref"].value.trim().toUpperCase();
    const date = form.elements["pay-date"].value;
    const term = form.elements["pay-term"].value;
    const notes = form.elements["pay-notes"].value.trim();

    if (!parentId || !amount || !mpesaRef) {
      showToast("Please fill in parent, amount and M-Pesa reference.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Record Payment & Update Balance";
      return;
    }

    const parentObj = allParents.find(p => p.id === parentId);
    const parentName = parentObj ? parentObj.name : "Parent";

    const paymentData = {
      parentUid: parentId,
      parentName: parentName,
      amount: amount,
      mpesaRef: mpesaRef,
      date: date,
      term: term,
      notes: notes,
      createdAt: serverTimestamp ? serverTimestamp() : new Date()
    };

    try {
      if (db) {
        await addDoc(collection(db, "payments"), paymentData);

        // Auto-update parent balance: balance - amount
        if (parentObj) {
          const currentBal = Number(parentObj.balance) || 0;
          const newBal = Math.max(0, currentBal - amount);
          await updateDoc(doc(db, "parents", parentId), { balance: newBal });
        }
      } else {
        allPayments.unshift({ id: "local_" + Date.now(), ...paymentData, createdAt: new Date().toISOString() });
        localStorage.setItem("prelan_payments_local", JSON.stringify(allPayments));

        if (parentObj) {
          parentObj.balance = Math.max(0, (parentObj.balance || 0) - amount);
          localStorage.setItem("prelan_parents_local", JSON.stringify(allParents));
        }
      }

      showToast(`Payment of ${formatKES(amount)} recorded! Balance updated.`, "success");
      closeModal("modal-payment");
      loadPayments();
      loadParentsAndLearners();
    } catch (err) {
      console.error(err);
      showToast("Error recording payment.", "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Record Payment & Update Balance";
    }
  };
}

/* ==========================================================================
   10. ADMIN USERS (OWNER ONLY)
   ========================================================================== */
let allAdmins = [];

async function loadAdmins() {
  const tbody = document.getElementById("admins-table-body");
  const addBtn = document.getElementById("open-new-admin-btn");
  if (!tbody || currentAdminRole !== "owner") return;

  if (db) {
    try {
      const q = query(collection(db, "admins"));
      const snap = await getDocs(q);
      allAdmins = [];
      snap.forEach(d => allAdmins.push({ id: d.id, ...d.data() }));
    } catch (e) {
      allAdmins = [
        { id: currentUser.uid, name: "School Owner", email: currentUser.email, role: "owner" }
      ];
    }
  } else {
    allAdmins = [
      { id: currentUser.uid, name: "School Owner", email: currentUser.email, role: "owner" }
    ];
  }

  tbody.innerHTML = "";
  allAdmins.forEach(adm => {
    const tr = document.createElement("tr");
    const isSelf = adm.id === (currentUser ? currentUser.uid : "");

    tr.innerHTML = `
      <td><strong>${escapeHtml(adm.name || "Administrator")}</strong></td>
      <td>${escapeHtml(adm.email)}</td>
      <td>
        <span class="badge ${adm.role === 'owner' ? 'badge-visited' : 'badge-new'}" style="text-transform: uppercase;">
          ${escapeHtml(adm.role || 'admin')}
        </span>
      </td>
      <td>${formatDate(adm.createdAt)}</td>
      <td>
        ${
          isSelf
            ? `<span style="font-size: 0.8rem; color: var(--color-slate-400);">(Current Account)</span>`
            : `<button type="button" class="btn btn-sm btn-outline delete-adm-btn" style="border-color: var(--color-danger); color: var(--color-danger);">Remove</button>`
        }
      </td>
    `;

    if (!isSelf) {
      tr.querySelector(".delete-adm-btn").onclick = async () => {
        if (confirm(`Remove administrator ${adm.name} (${adm.email})?`)) {
          try {
            if (db) await deleteDoc(doc(db, "admins", adm.id));
            allAdmins = allAdmins.filter(a => a.id !== adm.id);
            showToast("Admin removed.", "info");
            loadAdmins();
          } catch (err) {
            showToast("Error removing admin: " + err.message, "error");
          }
        }
      };
    }

    tbody.appendChild(tr);
  });

  if (addBtn) {
    addBtn.onclick = () => {
      document.getElementById("create-admin-form").reset();
      openModal("modal-admin");
    };
  }

  initCreateAdminForm();
}

function initCreateAdminForm() {
  const form = document.getElementById("create-admin-form");
  const submitBtn = document.getElementById("create-admin-submit-btn");
  if (!form) return;

  form.onsubmit = async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = "Creating Admin Account...";

    const name = form.elements["new-admin-name"].value.trim();
    const email = form.elements["new-admin-email"].value.trim();
    const tempPassword = form.elements["new-admin-pass"].value.trim();
    const role = form.elements["new-admin-role"].value;

    if (!email || !tempPassword || tempPassword.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Admin Account";
      return;
    }

    try {
      let uid = "demo_admin_" + Date.now();

      if (isConfigured) {
        // SECONDARY APP PROVISIONING: Admin stays signed in!
        uid = await createSecondaryAccount(email, tempPassword);
      }

      const adminData = {
        name,
        email,
        role, // 'admin' or 'owner'
        createdAt: serverTimestamp ? serverTimestamp() : new Date()
      };

      if (db) {
        await setDoc(doc(db, "admins", uid), adminData);
      } else {
        allAdmins.push({ id: uid, ...adminData, createdAt: new Date().toISOString() });
      }

      showToast(`Admin account created for ${name}! Owner remains signed in.`, "success");
      closeModal("modal-admin");
      form.reset();
      loadAdmins();
    } catch (err) {
      console.error("Create admin error:", err);
      showToast("Error creating admin: " + err.message, "error");
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Create Admin Account";
    }
  };
}
