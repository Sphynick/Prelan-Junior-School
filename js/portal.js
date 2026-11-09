/**
 * PRELAN — PARENT PORTAL
 * - Sign in with Google (Firebase Auth)
 * - Parent sees ONLY the `children` documents whose parentEmail matches their verified Google email
 * - Parent has ONE review (document id = their uid): create, edit, delete. Admin approval required.
 */
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updateProfile, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";
import { showToast } from "./utils.js";

const $ = (id) => document.getElementById(id);
const show = (id, on) => { $(id).hidden = !on; };

if (!isFirebaseConfigured()) {
  show("portal-loading", false); show("portal-signed-out", true);
  $("portal-error").textContent = "The portal is not available right now. Please contact the school office.";
} else {
  const app = getApps()[0] || initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  let user = null;

  $("google-signin-btn").addEventListener("click", async () => {
    $("portal-error").textContent = "";
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) {
      if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
      $("portal-error").textContent = e.code === "auth/unauthorized-domain"
        ? "This website address has not been authorised for Google sign-in yet. Please tell the school office."
        : "Sign-in failed. Please try again.";
    }
  });

  /* ---------------- Email & password ---------------- */
  let mode = "login";
  const setMode = (m) => {
    mode = m;
    $("tab-login").classList.toggle("active", m === "login"); $("tab-signup").classList.toggle("active", m === "signup");
    $("tab-login").setAttribute("aria-selected", m === "login"); $("tab-signup").setAttribute("aria-selected", m === "signup");
    $("fg-name").hidden = m !== "signup"; $("pass-hint").hidden = m !== "signup";
    $("email-auth-btn").textContent = m === "signup" ? "Create account" : "Sign in";
    $("a-pass").autocomplete = m === "signup" ? "new-password" : "current-password";
    $("portal-error").textContent = ""; $("portal-info").textContent = "";
  };
  $("tab-login").onclick = () => setMode("login");
  $("tab-signup").onclick = () => setMode("signup");
  const authMsg = (code) => ({
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/missing-password": "Please enter your password.",
    "auth/weak-password": "Please choose a password of at least 8 characters.",
    "auth/email-already-in-use": "An account with this email already exists. Try signing in, or use “Forgot your password?”.",
    "auth/invalid-credential": "Incorrect email or password.", "auth/wrong-password": "Incorrect email or password.", "auth/user-not-found": "Incorrect email or password.",
    "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
    "auth/operation-not-allowed": "Email sign-in is not enabled yet. Please tell the school office.",
    "auth/network-request-failed": "No internet connection. Please try again."
  }[code] || "Something went wrong. Please try again.");

  $("email-auth-form").addEventListener("submit", async (e) => {
    e.preventDefault(); $("portal-error").textContent = ""; $("portal-info").textContent = "";
    const f = e.target, email = f.email.value.trim(), pass = f.password.value, name = f.name.value.trim();
    if (!email || !pass) { $("portal-error").textContent = "Please enter your email and password."; return; }
    if (mode === "signup" && (pass.length < 8 || !name)) { $("portal-error").textContent = !name ? "Please enter your name." : "Password must be at least 8 characters."; return; }
    const btn = $("email-auth-btn"); btn.disabled = true;
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(cred.user, { displayName: name });
        await sendEmailVerification(cred.user);
      } else { await signInWithEmailAndPassword(auth, email, pass); }
    } catch (err) { $("portal-error").textContent = authMsg(err.code); }
    finally { btn.disabled = false; }
  });

  $("forgot-btn").addEventListener("click", async () => {
    $("portal-error").textContent = ""; $("portal-info").textContent = "";
    const email = $("a-email").value.trim();
    if (!email) { $("portal-error").textContent = "Type your email above first, then press “Forgot your password?”."; return; }
    try { await sendPasswordResetEmail(auth, email); } catch (err) { if (err.code === "auth/invalid-email") { $("portal-error").textContent = authMsg(err.code); return; } }
    $("portal-info").textContent = "If an account exists for that email, a password reset link is on its way.";
  });

  $("verify-resend").addEventListener("click", async () => {
    try { await sendEmailVerification(user); showToast("Verification email sent.", "success"); } catch (e) { showToast("Please wait a moment before requesting another email.", "error"); }
  });
  $("verify-refresh").addEventListener("click", async () => {
    await user.reload(); await user.getIdToken(true); user = auth.currentUser;
    if (user.emailVerified) { applyState(); showToast("Email verified. Thank you!", "success"); } else showToast("Your email isn't verified yet. Open the link we sent you first.", "error");
  });

  $("signout-btn").addEventListener("click", () => signOut(auth));

  function applyState() {
    const verified = !!user.emailVerified;
    $("verify-banner").hidden = verified; $("verify-email").textContent = user.email || "";
    $("children-list").parentElement.hidden = !verified; $("review-form").closest(".portal-card").hidden = !verified;
    if (verified) { loadChildren(); loadReview(); }
  }

  onAuthStateChanged(auth, async (u) => {
    user = u; show("portal-loading", false);
    if (!u) { show("portal-signed-in", false); show("portal-signed-out", true); return; }
    show("portal-signed-out", false); show("portal-signed-in", true);
    $("p-name").textContent = u.displayName || (u.email || "Parent").split("@")[0];
    $("p-email").textContent = u.email || "";
    if (u.photoURL) { $("p-photo").src = u.photoURL; $("p-photo").style.display = ""; } else $("p-photo").style.display = "none";
    applyState();
  });

  /* ---------------- Children ---------------- */
  async function loadChildren() {
    const box = $("children-list"); box.textContent = "Loading…";
    try {
      const email = (user.email || "").toLowerCase();
      const snap = await getDocs(query(collection(db, "children"), where("parentEmail", "==", email)));
      box.innerHTML = "";
      if (snap.empty) {
        box.innerHTML = '<p class="note">We could not find a learner linked to this Google account (' + esc(email) + '). If you registered with a different email, please contact the school office so we can link your account.</p>';
        return;
      }
      snap.forEach(d => box.appendChild(childCard(d.data())));
    } catch (e) { console.error(e); box.textContent = "Could not load your children's details. Please try again later."; }
  }

  function childCard(c) {
    const div = document.createElement("div"); div.className = "child-card";
    const rows = [["Class", c.className], ["Admission no.", c.admissionNo], ["Date of birth", c.dob], ["Class teacher", c.classTeacher], ["Transport", c.transport], ["Notes from school", c.notes]]
      .filter(r => r[1]);
    div.innerHTML = '<h3>' + esc(c.name || "Learner") + '</h3><dl>' + rows.map(r => '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>').join("") + '</dl>';
    return div;
  }

  /* ---------------- Review ---------------- */
  const form = $("review-form");
  async function loadReview() {
    form.reset(); $("review-delete").hidden = true; $("review-status").innerHTML = "";
    try {
      const snap = await getDoc(doc(db, "reviews", user.uid));
      if (!snap.exists()) { $("review-save").textContent = "Submit review"; return; }
      const r = snap.data();
      form.elements.content.value = r.content || "";
      form.elements.childInfo.value = r.childInfo || "";
      const star = form.querySelector('input[name="rating"][value="' + (r.rating || 5) + '"]'); if (star) star.checked = true;
      $("review-save").textContent = "Update review"; $("review-delete").hidden = false;
      $("review-status").innerHTML = r.approved ? '<span class="status-pill ok">Published</span>' : '<span class="status-pill">Awaiting school approval</span>';
    } catch (e) { console.error(e); }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const content = form.elements.content.value.trim();
    const rating = Number(form.elements.rating.value);
    if (!rating) return showToast("Please choose a star rating.", "error");
    if (content.length < 10) return showToast("Please write at least a short sentence.", "error");
    const btn = $("review-save"); btn.disabled = true;
    try {
      const ref = doc(db, "reviews", user.uid);
      const exists = (await getDoc(ref)).exists();
      const data = {
        uid: user.uid, author: user.displayName || (user.email || "Parent").split("@")[0], childInfo: form.elements.childInfo.value.trim().slice(0, 80),
        rating, content: content.slice(0, 1000), approved: false, updatedAt: serverTimestamp()
      };
      if (!exists) data.createdAt = serverTimestamp();
      await setDoc(ref, data, { merge: true });
      showToast("Thank you! Your review is saved and will appear once the school approves it.", "success");
      loadReview();
    } catch (err) { console.error(err); showToast("Could not save your review. Please try again.", "error"); }
    finally { btn.disabled = false; }
  });

  $("review-delete").addEventListener("click", async () => {
    if (!confirm("Delete your review?")) return;
    try { await deleteDoc(doc(db, "reviews", user.uid)); showToast("Review deleted.", "success"); loadReview(); }
    catch (err) { showToast("Could not delete the review.", "error"); }
  });
}

function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
