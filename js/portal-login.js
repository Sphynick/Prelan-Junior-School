/**
 * PRELAN JUNIOR SCHOOL - PARENT PORTAL LOGIN
 * Authenticates parents and validates parents/{uid} document existence
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
    console.warn("Firebase init error in portal-login:", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("portal-login-form");
  const alertBox = document.getElementById("portal-login-alert");
  const loginBtn = document.getElementById("portal-login-btn");
  const forgotLink = document.getElementById("portal-forgot-password-link");
  const forgotModal = document.getElementById("portal-forgot-modal");
  const forgotClose = document.getElementById("portal-forgot-close");
  const forgotForm = document.getElementById("portal-forgot-form");

  // Check existing session
  if (auth && db) {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const parentDoc = await getDoc(doc(db, "parents", user.uid));
          if (parentDoc.exists()) {
            window.location.href = "/portal/home.html";
          }
        } catch (e) {
          console.log("Portal session check:", e.message);
        }
      }
    });
  }

  // Handle Login
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAlert();

      const email = form.elements["email"].value.trim();
      const password = form.elements["password"].value;

      if (!email || !password) {
        showAlert("Please provide your email and password.", "error");
        return;
      }

      setLoading(true);

      // Never allow a login unless Firebase is really connected
      if (!isConfigured || !auth || !db) {
        setLoading(false);
        showAlert("Login is currently unavailable. Please contact the school office.", "error");
        return;
      }

      try {
        // 1. Sign in with Firebase Auth
        const cred = await signInWithEmailAndPassword(auth, email, password);
        const user = cred.user;

        // 2. CRITICAL CHECK: Verify parents/{uid} document exists in Firestore
        const parentSnap = await getDoc(doc(db, "parents", user.uid));

        if (!parentSnap.exists()) {
          // User is in Auth, but not in parents collection
          await signOut(auth);
          showAlert(
            "Access denied: This account is not registered as a parent of Prelan Junior School. Please contact the school admissions office.",
            "error"
          );
          setLoading(false);
          return;
        }

        showToast("Welcome back! Loading your parent portal...", "success");
        setTimeout(() => {
          window.location.href = "/portal/home.html";
        }, 400);

      } catch (err) {
        console.error("Portal login error:", err);
        let msg = "Invalid email or password.";
        if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          msg = "Invalid email or password. Please check your credentials or reset your password.";
        }
        showAlert(msg, "error");
        setLoading(false);
      }
    });
  }

  // Forgot password
  if (forgotLink && forgotModal) {
    forgotLink.addEventListener("click", () => forgotModal.classList.add("active"));
    if (forgotClose) forgotClose.addEventListener("click", () => forgotModal.classList.remove("active"));
    forgotModal.addEventListener("click", (e) => {
      if (e.target === forgotModal) forgotModal.classList.remove("active");
    });
  }

  if (forgotForm) {
    forgotForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("portal-reset-email").value.trim();
      const submitBtn = document.getElementById("portal-reset-submit-btn");

      if (!email) {
        showToast("Please enter your registered email.", "error");
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = "Sending...";

      if (!isConfigured || !auth) {
        showToast("Password reset is currently unavailable.", "error");
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Password Reset Link";
        return;
      }

      try {
        await sendPasswordResetEmail(auth, email);
        showToast("Password reset email sent! Check your inbox.", "success");
        forgotModal.classList.remove("active");
        forgotForm.reset();
      } catch (err) {
        showToast("Error: " + err.message, "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Send Password Reset Link";
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
      : `<span>Sign In to Parent Portal</span>`;
  }
});
