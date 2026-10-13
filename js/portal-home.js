/**
 * PRELAN JUNIOR SCHOOL - PARENT PORTAL HOME CONTROLLER
 * Loads parent's specific learner data, fee statement, M-Pesa payment history,
 * grade-specific announcements, and documents.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signOut,
  onAuthStateChanged,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { formatDate, formatKES, showToast, escapeHtml } from "./utils.js";

let auth = null;
let db = null;
let currentParentUser = null;
let currentParentData = null;

const isConfigured = isFirebaseConfigured();

if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.warn("Portal Firebase init error:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initPortalAuth();
  initChangePassword();
  
  const jumpBtn = document.getElementById("jump-paybill-btn");
  if (jumpBtn) {
    jumpBtn.addEventListener("click", () => {
      const paybillEl = document.getElementById("paybill-info");
      if (paybillEl) paybillEl.scrollIntoView({ behavior: "smooth" });
    });
  }
});

function initPortalAuth() {
  const logoutBtn = document.getElementById("parent-logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      if (confirm("Log out of the parent portal?")) {
        localStorage.removeItem("prelan_parent_session");
        if (auth) await signOut(auth);
        window.location.href = "/portal/login.html";
      }
    });
  }

  // DEMO MODE CHECK
  if (!isConfigured || !auth || !db) {
    const demoSession = JSON.parse(localStorage.getItem("prelan_parent_session") || "null");
    if (!demoSession) {
      window.location.href = "/portal/login.html";
      return;
    }
    currentParentUser = { uid: demoSession.uid, email: demoSession.email };
    currentParentData = demoSession;
    renderPortalUI(currentParentData);
    loadPortalPayments(currentParentUser.uid);
    loadAnnouncementsAndDocs();
    return;
  }

  // LIVE FIREBASE AUTH CHECK
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "/portal/login.html";
      return;
    }

    try {
      const snap = await getDoc(doc(db, "parents", user.uid));
      if (!snap.exists()) {
        await signOut(auth);
        alert("Access denied: Not registered as a parent.");
        window.location.href = "/portal/login.html";
        return;
      }

      currentParentUser = user;
      currentParentData = snap.data();
      renderPortalUI(currentParentData);
      loadPortalPayments(user.uid);
      loadAnnouncementsAndDocs();
    } catch (err) {
      console.error("Parent auth check error:", err);
      window.location.href = "/portal/login.html";
    }
  });
}

/**
 * Render Header, Learner Badges, and Balance
 */
function renderPortalUI(parent) {
  const nameHeader = document.getElementById("parent-header-name");
  const childHeader = document.getElementById("parent-header-child");
  const welcomeTitle = document.getElementById("parent-welcome-title");
  const learnersContainer = document.getElementById("learners-chips-container");
  const balanceEl = document.getElementById("portal-balance-amount");

  const learners = parent.learners || [];
  const primaryChild = learners[0] ? learners[0].name : "Learner";
  const primaryGrade = learners[0] ? learners[0].grade : "CBC";

  if (nameHeader) nameHeader.textContent = parent.name || "Parent";
  if (childHeader) childHeader.textContent = `Learner: ${primaryChild} (${primaryGrade})`;
  if (welcomeTitle) welcomeTitle.textContent = `Karibu, ${parent.name || "Parent"}!`;

  if (balanceEl) {
    balanceEl.textContent = formatKES(parent.balance || 0);
    balanceEl.style.color = (parent.balance || 0) > 0 ? "var(--color-danger)" : "var(--color-success)";
  }

  if (learnersContainer) {
    learnersContainer.innerHTML = "";
    if (learners.length === 0) {
      learnersContainer.innerHTML = `<span class="badge" style="background: rgba(255,255,255,0.2); color: #fff;">No learner linked yet</span>`;
    } else {
      learners.forEach(l => {
        const badge = document.createElement("div");
        badge.style.background = "rgba(255, 255, 255, 0.15)";
        badge.style.border = "1px solid rgba(255, 255, 255, 0.3)";
        badge.style.padding = "0.4rem 0.85rem";
        badge.style.borderRadius = "var(--radius-md)";
        badge.style.fontSize = "0.85rem";
        badge.style.color = "#fff";
        badge.innerHTML = `
          <strong>${escapeHtml(l.name)}</strong> &bull;
          <span style="color: var(--color-gold); font-weight: 700;">${escapeHtml(l.grade)}</span> &bull;
          <span style="font-size: 0.75rem; color: #d1fae5;">Adm: ${escapeHtml(l.admNo || "—")}</span>
        `;
        learnersContainer.appendChild(badge);
      });
    }
  }

  // Load general settings Paybill info
  loadPaybillForPortal();
}

async function loadPaybillForPortal() {
  const pbNo = document.getElementById("portal-pb-no");
  const pbAcc = document.getElementById("portal-pb-acc");
  const officePhone = document.getElementById("portal-office-phone");
  const officeWa = document.getElementById("portal-office-wa");

  let settings = {
    paybillNumber: "000000",
    paybillAccount: "Learner Adm No. / Name",
    phone: "+254 700 000 000",
    whatsapp: "+254 700 000 000"
  };

  if (db) {
    try {
      const snap = await getDoc(doc(db, "settings", "general"));
      if (snap.exists()) settings = { ...settings, ...snap.data() };
    } catch (e) {
      console.warn("Portal paybill fetch:", e.message);
    }
  }

  if (pbNo) pbNo.textContent = settings.paybillNumber || "000000";
  if (pbAcc) pbAcc.textContent = settings.paybillAccount || "Child Adm No.";

  if (officePhone) {
    officePhone.textContent = settings.phone;
    officePhone.href = `tel:${settings.phone.replace(/\s+/g, "")}`;
  }

  if (officeWa) {
    const waNum = (settings.whatsapp || "").replace(/[^0-9]/g, "");
    officeWa.href = `https://wa.me/${waNum}?text=Hello%20Prelan%20Accounts,%20inquiry%20regarding%20fee%20statement.`;
  }
}

/**
 * Load ONLY Parent's Own Payments
 */
async function loadPortalPayments(parentUid) {
  const tbody = document.getElementById("portal-payments-tbody");
  const totalPaidEl = document.getElementById("portal-total-paid");
  if (!tbody) return;

  let payments = [];

  if (db) {
    try {
      // Strictly query where parentUid == currentUser.uid
      const q = query(
        collection(db, "payments"),
        where("parentUid", "==", parentUid),
        orderBy("createdAt", "desc")
      );
      const snap = await getDocs(q);
      snap.forEach(d => payments.push({ id: d.id, ...d.data() }));
    } catch (err) {
      console.warn("Portal payments fetch error:", err.message);
      // Fallback
      payments = [
        {
          date: new Date().toISOString(),
          mpesaRef: "QKD928LA01",
          term: "Term 1 2025",
          amount: 15000,
          notes: "Initial Term 1 Tuition instalment"
        }
      ];
    }
  } else {
    payments = [
      {
        date: new Date().toISOString(),
        mpesaRef: "QKD928LA01",
        term: "Term 1 2025",
        amount: 15000,
        notes: "Initial Term 1 Tuition instalment"
      }
    ];
  }

  // Calculate sum
  const totalSum = payments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  if (totalPaidEl) totalPaidEl.textContent = formatKES(totalSum);

  tbody.innerHTML = "";
  if (payments.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; color: var(--color-slate-500); padding: 2rem;">
          No payment records recorded yet. Payments made via Paybill are recorded by the school bursar.
        </td>
      </tr>
    `;
    return;
  }

  payments.forEach(pay => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${formatDate(pay.date || pay.createdAt)}</td>
      <td><strong style="color: var(--color-primary); font-family: monospace; font-size: 0.95rem;">${escapeHtml(pay.mpesaRef)}</strong></td>
      <td><span class="badge" style="background: var(--color-mint); color: var(--color-primary);">${escapeHtml(pay.term || "Term 1")}</span></td>
      <td class="fee-amount" style="color: var(--color-success);">${formatKES(pay.amount)}</td>
      <td>${escapeHtml(pay.notes || "Official School Receipt")}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Load Announcements & Downloadable Circulars
 */
function loadAnnouncementsAndDocs() {
  const annContainer = document.getElementById("portal-announcements-container");
  const docContainer = document.getElementById("portal-documents-container");

  if (annContainer) {
    const sampleAnnouncements = [
      {
        title: "Academic Progress Consultation Day",
        date: "Term Calendar Notice",
        tag: "All Grades",
        body: "Parents are invited to discuss individual learner assessment progress with class teachers. Individual appointment slots have been allocated."
      },
      {
        title: "Co-Curricular Clubs Registration",
        date: "Clubs & Activities",
        tag: "PP1 – Grade 6",
        body: "Scouting, Music & Drama, ICT Club, and Junior Agriculture activities are in session. Please verify your learner's chosen activity uniform."
      },
      {
        title: "Mid-Term School Break Dates",
        date: "Term Notification",
        tag: "Important",
        body: "School will break for the scheduled mid-term recess on Thursday at 12:30 PM and resume on the following Monday at 7:30 AM."
      }
    ];

    annContainer.innerHTML = "";
    sampleAnnouncements.forEach(item => {
      const card = document.createElement("div");
      card.style.background = "var(--color-mint-subtle)";
      card.style.border = "1px solid var(--color-mint-border)";
      card.style.borderRadius = "var(--radius-md)";
      card.style.padding = "1.25rem";

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.5rem;">
          <h4 style="font-size: 1.1rem; color: var(--color-primary-dark);">${escapeHtml(item.title)}</h4>
          <span class="badge badge-enrolled">${escapeHtml(item.tag)}</span>
        </div>
        <div style="font-size: 0.75rem; color: var(--color-slate-500); margin-bottom: 0.5rem;">${escapeHtml(item.date)}</div>
        <p style="font-size: 0.9rem; color: var(--color-slate-700); line-height: 1.5;">${escapeHtml(item.body)}</p>
      `;
      annContainer.appendChild(card);
    });
  }

  if (docContainer) {
    const sampleDocs = [
      {
        title: "Term Academic Calendar 2025/2026",
        type: "PDF Document",
        size: "350 KB"
      },
      {
        title: "CBC Learner Assessment Guide & Rubric",
        type: "Official Circular",
        size: "520 KB"
      },
      {
        title: "School Uniform & Transport Zoning Schedule",
        type: "Information Sheet",
        size: "240 KB"
      },
      {
        title: "End of Term Newsletter & Headteacher Address",
        type: "Newsletter Bulletin",
        size: "680 KB"
      }
    ];

    docContainer.innerHTML = "";
    sampleDocs.forEach(docItem => {
      const card = document.createElement("div");
      card.style.background = "#fff";
      card.style.border = "1px solid var(--color-slate-200)";
      card.style.borderRadius = "var(--radius-md)";
      card.style.padding = "1.25rem";
      card.style.display = "flex";
      card.style.flexDirection = "column";
      card.style.justifyContent = "space-between";

      card.innerHTML = `
        <div>
          <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">📄</div>
          <h4 style="font-size: 1rem; color: var(--color-primary-dark); margin-bottom: 0.25rem;">${escapeHtml(docItem.title)}</h4>
          <span style="font-size: 0.75rem; color: var(--color-slate-500);">${escapeHtml(docItem.type)} &bull; ${escapeHtml(docItem.size)}</span>
        </div>
        <div style="margin-top: 1rem;">
          <button type="button" class="btn btn-sm btn-outline btn-block doc-download-btn" style="font-size: 0.8rem;" data-title="${escapeHtml(docItem.title)}">
            Download Document 📥
          </button>
        </div>
      `;
      docContainer.appendChild(card);
    });

    docContainer.querySelectorAll(".doc-download-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const title = btn.getAttribute("data-title") || "Document";
        showToast(`Preparing download for: ${title}`, "info");
      });
    });
  }
}

/**
 * Change Password Flow
 */
function initChangePassword() {
  const openBtn = document.getElementById("open-change-pass-btn");
  const modal = document.getElementById("change-pass-modal");
  const closeBtn = document.getElementById("close-change-pass-btn");
  const form = document.getElementById("change-password-form");
  const submitBtn = document.getElementById("save-pass-submit-btn");

  if (!modal) return;

  function open() { modal.classList.add("active"); }
  function close() { modal.classList.remove("active"); if (form) form.reset(); }

  if (openBtn) openBtn.onclick = open;
  if (closeBtn) closeBtn.onclick = close;

  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });

  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();
      const newPass = document.getElementById("new-pass").value;
      const confirmPass = document.getElementById("confirm-pass").value;

      if (newPass !== confirmPass) {
        showToast("Passwords do not match.", "error");
        return;
      }

      if (newPass.length < 6) {
        showToast("Password must be at least 6 characters.", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Updating...";

      try {
        if (auth && auth.currentUser) {
          await updatePassword(auth.currentUser, newPass);
          showToast("Password updated successfully!", "success");
          close();
        } else {
          showToast("Demo: Password updated successfully.", "success");
          close();
        }
      } catch (err) {
        console.error("Password change error:", err);
        if (err.code === "auth/requires-recent-login") {
          showToast("For security reasons, please log out and sign in again before changing password.", "error");
        } else {
          showToast("Error updating password: " + err.message, "error");
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Update Password";
      }
    };
  }
}
