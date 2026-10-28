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
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { showToast, validateKenyanPhone } from "./utils.js";

let auth = null;
let db = null;
let busy = false; // true while an explicit sign-in is in progress
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

  const googleBtn = document.getElementById("portal-google-btn");
  const requestPanel = document.getElementById("portal-request-panel");
  const requestFormWrap = document.getElementById("portal-request-form-wrap");
  const requestPending = document.getElementById("portal-request-pending");
  const requestForm = document.getElementById("portal-request-form");

  // Send a signed-in user to the portal, or to the access-request step if the
  // school has not linked their account to a learner yet.
  async function routeUser(user) {
    const parentDoc = await getDoc(doc(db, "parents", user.uid));
    if (parentDoc.exists()) {
      showToast("Welcome! Loading your parent portal...", "success");
      setTimeout(() => { window.location.href = "/portal/home.html"; }, 400);
      return;
    }
    await showRequestStep(user);
  }

  async function showRequestStep(user) {
    if (form) form.style.display = "none";
    clearAlert();
    requestPanel.style.display = "block";
    const nameSpan = document.getElementById("portal-request-name");
    if (nameSpan) nameSpan.textContent = user.displayName ? ", " + user.displayName.split(" ")[0] : "";

    let alreadyRequested = false;
    try {
      const reqSnap = await getDoc(doc(db, "parentRequests", user.uid));
      alreadyRequested = reqSnap.exists();
    } catch (e) {
      console.log("Request check:", e.message);
    }
    requestFormWrap.style.display = alreadyRequested ? "none" : "block";
    requestPending.style.display = alreadyRequested ? "block" : "none";
  }

  // Check existing session
  if (auth && db) {
    onAuthStateChanged(auth, async (user) => {
      if (user && !busy) {
        try {
          await routeUser(user);
        } catch (e) {
          console.log("Portal session check:", e.message);
        }
      }
    });
  }

  // Continue with Google (sign in or sign up)
  if (googleBtn) {
    googleBtn.addEventListener("click", async () => {
      clearAlert();
      if (!isConfigured || !auth || !db) {
        showAlert("Login is currently unavailable. Please contact the school office.", "error");
        return;
      }
      setLoading(true);
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: "select_account" });
        const cred = await signInWithPopup(auth, provider);
        await routeUser(cred.user);
      } catch (err) {
        console.error("Google sign-in error:", err);
        const quiet = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];
        if (!quiet.includes(err.code)) {
          let msg = "Google sign-in failed. Please try again.";
          if (err.code === "auth/popup-blocked") msg = "Your browser blocked the Google sign-in window. Allow pop-ups for this site and try again.";
          else if (err.code === "auth/unauthorized-domain") msg = "This website address is not yet authorised for Google sign-in. Please contact the school office.";
          else if (err.code === "auth/operation-not-allowed") msg = "Google sign-in is not switched on yet. Please contact the school office.";
          else if (err.code === "auth/network-request-failed") msg = "Network problem. Check your connection and try again.";
          else if (err.code === "auth/account-exists-with-different-credential") msg = "This email already has a password account. Sign in with your password, or use the Forgot Password link.";
          msg += " If you opened this page inside WhatsApp or Facebook, open it in Chrome or Safari instead.";
          showAlert(msg, "error");
        }
      } finally {
        setLoading(false);
      }
    });
  }

  // Access request (Google sign-ups not yet linked to a learner)
  if (requestForm) {
    requestForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = auth && auth.currentUser;
      if (!user) { showToast("Please sign in with Google again.", "error"); return; }

      const phoneVal = validateKenyanPhone(document.getElementById("req-phone").value.trim());
      if (!phoneVal.valid) {
        showToast(phoneVal.message || "Please enter a valid Kenyan phone number.", "error");
        return;
      }
      const btn = document.getElementById("portal-request-btn");
      btn.disabled = true;
      btn.textContent = "Sending...";
      try {
        await setDoc(doc(db, "parentRequests", user.uid), {
          name: (user.displayName || "").slice(0, 100),
          email: user.email || "",
          phone: phoneVal.formatted,
          childName: document.getElementById("req-child").value.trim().slice(0, 100),
          admNo: document.getElementById("req-adm").value.trim().slice(0, 40),
          status: "pending",
          createdAt: serverTimestamp()
        });
        requestFormWrap.style.display = "none";
        requestPending.style.display = "block";
      } catch (err) {
        console.error("Access request error:", err);
        if (err.code === "permission-denied") {
          showToast("The school's database is not yet set up to accept sign-up requests. Please call the school office.", "error");
          console.warn("permission-denied: publish the latest firestore.rules (parentRequests) in the Firebase Console.");
        } else {
          showToast("Could not send your request. Please try again or call the school office.", "error");
        }
      } finally {
        btn.disabled = false;
        btn.textContent = "Send Access Request";
      }
    });
  }

  const requestSignout = document.getElementById("portal-request-signout");
  if (requestSignout) {
    requestSignout.addEventListener("click", async () => {
      try { await signOut(auth); } catch (e) { /* ignore */ }
      window.location.reload();
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
    busy = loading;
    if (googleBtn) googleBtn.disabled = loading;
    if (!loginBtn) return;
    loginBtn.disabled = loading;
    loginBtn.innerHTML = loading
      ? `<span>Signing in...</span>`
      : `<span>Sign In to Parent Portal</span>`;
  }
});
