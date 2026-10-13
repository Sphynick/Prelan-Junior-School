/**
 * PRELAN JUNIOR SCHOOL - ADMIN AUTHENTICATION
 * Verifies email/password and enforces admins/{uid} document existence
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { showToast } from "./utils.js";

let auth = null;
let db = null;
const isConfigured = isFirebaseConfigured();

if (isConfigured) {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    setPersistence(auth, browserLocalPersistence).catch(console.warn);
  } catch (err) {
    console.warn("Firebase init error in admin-login:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("admin-login-form");
  const alertBox = document.getElementById("login-alert");
  const loginBtn = document.getElementById("login-btn");
  const forgotLink = document.getElementById("forgot-password-link");
  const forgotModal = document.getElementById("forgot-modal");
  const forgotClose = document.getElementById("forgot-modal-close");
  const forgotForm = document.getElementById("forgot-password-form");

  // Check if already logged in
  if (auth && db) {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const adminDoc = await getDoc(doc(db, "admins", user.uid));
          if (adminDoc.exists()) {
            window.location.href = "/admin/dashboard.html";
          }
        } catch (e) {
          console.log("Session verification check:", e.message);
        }
      }
    });
  }

  // Handle Login Submission
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      const email = form.elements["email"].value.trim();
      const password = form.elements["password"].value;

      if (!email || !password) {
        showAlert("Please provide both email and password.", "error");
        return;
      }

      setLoading(true);

      // Never allow a login unless Firebase is really connected
      if (!isConfigured || !auth || !db) {
        setLoading(false);
        showAlert("Login is currently unavailable. Please contact the site administrator.", "error");
        return;
      }

      try {
        // 1. Authenticate with Firebase Auth
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const user = cred.user;

        // 2. CRITICAL CHECK: Verify admins/{uid} document exists in Firestore
        const adminSnap = await getDoc(doc(db, "admins", user.uid));

        if (!adminSnap.exists()) {
          // User is authenticated in Auth, but is NOT an authorized admin in Firestore
          await signOut(auth);
          showAlert(
            "Access denied: Your account is not authorized as an administrator of Prelan Junior School. Contact the school owner.",
            "error"
          );
          setLoading(false);
          return;
        }

        const adminData = adminSnap.data();
        sessionStorage.setItem("admin_last_activity", String(Date.now()));
        sessionStorage.setItem("admin_role", adminData.role || "admin");

        showToast("Login successful. Opening dashboard...", "success");
        setTimeout(() => {
          window.location.href = "/admin/dashboard.html";
        }, 400);

      } catch (err) {
        console.error("Admin login error:", err);
        let msg = "Invalid email or password.";
        if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          msg = "Invalid email or password. Please verify your credentials.";
        } else if (err.code === "auth/too-many-requests") {
          msg = "Account access temporarily locked due to many failed attempts. Try again later or reset password.";
        }
        showAlert(msg, "error");
        setLoading(false);
      }
    });
  }

  // Forgot Password Flow
  if (forgotLink && forgotModal) {
    forgotLink.addEventListener("click", () => {
      forgotModal.classList.add("active");
    });

    if (forgotClose) {
      forgotClose.addEventListener("click", () => {
        forgotModal.classList.remove("active");
      });
    }

    forgotModal.addEventListener("click", (e) => {
      if (e.target === forgotModal) forgotModal.classList.remove("active");
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const resetEmail = document.getElementById("reset-email").value.trim();
      const submitBtn = document.getElementById("reset-submit-btn");

      if (!resetEmail) {
        showToast("Please enter your admin email.", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Sending Link...";

      if (!isConfigured || !auth) {
        showToast("Password reset is currently unavailable.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Reset Link";
        return;
      }

      try {
        await sendPasswordResetEmail(auth, resetEmail);
        showToast("Password reset email sent! Check your inbox.", "success");
        forgotModal.classList.remove("active");
        forgotForm.reset();
      } catch (err) {
        console.error("Reset password error:", err);
        showToast("Error sending reset email: " + err.message, "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Reset Link";
      }
    });
  }

  function showAlert(msg, type = "error") {
    if (!alertBox) return;
    alertBox.style.display = "block";
    alertBox.innerHTML = msg;
    if (type === "error") {
      alertBox.style.backgroundColor = "var(--color-danger-light)";
      alertBox.style.color = "var(--color-danger)";
      alertBox.style.border = "1px solid #fecaca";
    } else {
      alertBox.style.backgroundColor = "var(--color-info-light, #e0f2fe)";
      alertBox.style.color = "var(--color-info)";
      alertBox.style.border = "1px solid #bae6fd";
    }
  }

  function clearAlert() {
    if (alertBox) alertBox.style.display = "none";
  }

  function setLoading(loading) {
    if (!loginBtn) return;
    loginBtn.disabled = loading;
    loginBtn.innerHTML = loading
      ? `<span>Signing in...</span>`
      : `<span>Sign In to Dashboard</span>`;
  }
});
