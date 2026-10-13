# Prelan Junior School — Website & Portals Deployment Guide

A complete, production-ready website, Admin Dashboard, and Parent Portal for **PRELAN JUNIOR SCHOOL**, located in Nyathuna, Ngecha, Kiambu County, Kenya, teaching the Kenyan Competency Based Curriculum (CBC: PP1 to Grade 6).

Built with plain HTML5, CSS3, and vanilla JavaScript (ES modules) using Firebase CDN (v10.12.2). **No Node.js build step or server required.**

---

## 1. Directory Structure

```text
├── index.html              # Main public website (CIS Edu inspired layout)
├── 404.html                # Custom 404 Not Found page
├── admin/
│   ├── login.html          # Staff administrator login with password reset
│   └── dashboard.html      # 10-tab administrative management system
├── portal/
│   ├── login.html          # Parent portal login (No public registration)
│   └── home.html           # Parent portal: Learner profile, fees, M-Pesa receipts
├── css/
│   └── styles.css          # Full design system (Deep green, Gold, Soft mint)
├── js/
│   ├── firebase-config.js  # Centralized Firebase configuration & storage flag
│   ├── utils.js            # Kenyan phone validation, Base64 compression, CSV export
│   ├── main.js             # Public website interactivity & live Firestore loader
│   ├── admin-login.js      # Admin authentication & admins/{uid} document validator
│   ├── admin-dashboard.js  # Admin controller (Secondary auth, 30m auto-logout)
│   ├── portal-login.js     # Parent authentication & parents/{uid} document validator
│   └── portal-home.js      # Parent dashboard controller
├── firestore.rules         # Cloud Firestore security rules
├── storage.rules           # Cloud Storage security rules (if Blaze plan used)
├── firebase.json           # Firebase CLI deployment configuration
└── README.md               # This deployment guide
```

---

## 2. Step 1: Create Your Firebase Project

1. Open your browser and navigate to the **[Firebase Console](https://console.firebase.google.com/)**.
2. Click **"Add project"** (or **"Create a project"**).
3. Name your project (e.g. `prelan-junior-school`).
4. You can enable or disable Google Analytics according to your preference, then click **"Create project"**.
5. Wait for the project to finish provisioning and click **"Continue"**.

---

## 3. Step 2: Enable Email/Password Authentication

1. In the left navigation menu of the Firebase Console, click **Build > Authentication**.
2. Click **"Get started"**.
3. Under the **"Sign-in method"** tab, click **"Email/Password"**.
4. Enable the first toggle: **"Email/Password"**. (Leave "Email link (passwordless sign-in)" disabled).
5. Click **"Save"**.

---

## 4. Step 3: Create Cloud Firestore Database

1. In the left sidebar, click **Build > Firestore Database**.
2. Click **"Create database"**.
3. Choose a location closest to Kenya:
   - `europe-west1` (Belgium) or `europe-west3` (Frankfurt) or `africa-south1` (Johannesburg, if available).
4. For security rules, select **"Start in production mode"** and click **"Create"**.

---

## 5. Step 4: Storage Option: Spark (Free) vs Blaze (Pay-As-You-Go)

Choose between the **Free Spark Plan** or **Paid Blaze Plan**:

### Option A: Spark Plan (100% Free Forever — Recommended for Start)
- **Cost:** KES 0 / month.
- **How it works:** Set `USE_STORAGE = false` in `js/firebase-config.js`.
- Photo uploads for the gallery and news are **automatically compressed in the browser to under 200 KB** using HTML5 Canvas and saved directly inside Firestore documents as lightweight Base64 text.
- Circulars, school calendars, and PDF documents can be hosted on Google Drive or Dropbox with a shareable link.
- **Best for:** Avoiding credit card requirements while enjoying unlimited free hosting.

### Option B: Blaze Plan (Pay-As-You-Go with Cloud Storage)
- **Cost:** Free within generous limits (~5 GB storage free), then a few cents per GB. Requires a debit/credit card on Google Cloud.
- **How it works:** Set `USE_STORAGE = true` in `js/firebase-config.js`.
- Files and PDFs are uploaded directly to a Google Cloud Storage bucket.

---

## 6. Step 5: Create Your First Admin User (Owner)

Because there is **no public admin sign-up**, the first administrator account must be provisioned manually in the Firebase Console:

### 1. Create the Authentication Login
1. In the Firebase Console, go to **Authentication > Users**.
2. Click **"Add user"**.
3. Enter your official admin email (e.g. `admin@prelanjuniorschool.sc.ke`) and a strong password.
4. Click **"Add user"**.
5. Once created, look at the table and **copy the "User UID"** string (e.g. `aB83kxL92pQ0...`).

### 2. Create the Firestore Authorization Document
1. In the Firebase Console, go to **Firestore Database > Data**.
2. Click **"Start collection"**.
3. Collection ID: Enter exactly `admins` (all lowercase) and click **Next**.
4. **Document ID:** **Paste the exact User UID** you copied from Authentication.
5. Add the following fields:
   - `name` (string): `School Owner`
   - `email` (string): `admin@prelanjuniorschool.sc.ke`
   - `role` (string): `owner` *(Must be strictly `owner` so you can manage other admins)*
   - `createdAt` (timestamp): Click the timestamp icon.
6. Click **"Save"**.

> **Important:** The system will deny login to anyone whose UID is not present in the `admins` collection with an authorized role.

---

## 7. Step 6: Paste Firebase Config into `js/firebase-config.js`

1. In the Firebase Console, click the gear icon ⚙️ next to **Project Overview** in the left sidebar and select **Project settings**.
2. Under the **"General"** tab, scroll down to the **"Your apps"** section.
3. Click the **Web icon `</>`** to register a web app.
4. Enter App nickname: `Prelan Web Portal`.
5. Check the box: *"Also set up Firebase Hosting for this app"*.
6. Click **"Register app"**.
7. Firebase will display your `firebaseConfig` object. Copy the values and open `js/firebase-config.js` in your text editor:

```javascript
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "prelan-junior-school.firebaseapp.com",
  projectId: "prelan-junior-school",
  storageBucket: "prelan-junior-school.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Set to true only if you enabled Cloud Storage on the Blaze plan:
export const USE_STORAGE = false;
```

---

## 8. Step 7: Deploy Security Rules

### Deploying Firestore Rules
1. In the Firebase Console, go to **Firestore Database > Rules**.
2. Delete whatever is currently in the editor.
3. Open the `firestore.rules` file from this project, copy its entire content, and paste it into the editor.
4. Click **"Publish"**.

### Deploying Storage Rules (If using Cloud Storage)
1. In the Firebase Console, go to **Storage > Rules**.
2. Copy the content from `storage.rules` and paste it into the editor.
3. Click **"Publish"**.

---

## 9. Step 8: Deploying to Firebase Hosting

### Method A: Using Firebase CLI (Recommended)

1. Ensure you have the Firebase CLI installed:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in to your Google Account:
   ```bash
   firebase login
   ```
3. In your project root directory, associate the project:
   ```bash
   firebase use --add
   # Select your Prelan Junior School Firebase project from the list
   ```
4. Deploy rules and hosting in one command:
   ```bash
   firebase deploy
   ```
5. Your website will be live immediately at `https://<your-project-id>.web.app` and `https://<your-project-id>.firebaseapp.com`!

### Method B: Connecting Custom Domain
To connect your Kenyan `.sc.ke` domain (e.g. `prelanjuniorschool.sc.ke`):
1. In Firebase Console, go to **Build > Hosting**.
2. Click **"Add custom domain"**.
3. Enter your domain name and follow the DNS verification steps (add the TXT and A records at your domain registrar like Kenya Website Experts, Safaricom, or Truehost). SSL certificates are issued automatically and free of charge.

---

## 10. Step 9: Enable Firebase App Check (Anti-Abuse Protection)

To protect the public visit form and newsletter signup from bots and automated spam:
1. In Firebase Console, go to **Build > App Check**.
2. Click **"Register"** for your web app.
3. Select **reCAPTCHA v3** or **reCAPTCHA Enterprise**.
4. Generate your site key from Google reCAPTCHA Console and paste it.
5. Once verified, enforce App Check on Cloud Firestore to block unauthorized automated API calls.

---

## 11. Testing & Verification Checklist

Before opening the site to parents, verify the following:

- [x] **Public Visit Submission:** Fill in the "Book a School Visit" form on the homepage with a Kenyan number (e.g. `0712 345 678`). Submit and verify the thank-you state and WhatsApp chat link appear. Check that the record appears in the admin dashboard under **Visits & Applications**.
- [x] **Rate Limiting & Honeypot:** Try submitting twice within 15 seconds; verify the cooldown timer activates. Verify spam bots filling hidden fields are safely ignored.
- [x] **Admin Login Security:** Try logging in with an email that is in Firebase Auth but NOT in the `admins` collection. Verify the system shows *"Access denied: Account is not authorized as an administrator"* and signs out.
- [x] **Admin Inactivity Auto-Logout:** Verify that after 30 minutes of inactivity, the dashboard auto-logs out to protect sensitive school data.
- [x] **Owner Account Isolation:** Verify the "Admin Users" tab is visible **only** to the owner (`role: "owner"`), not to standard administrators.
- [x] **Admin Stays Logged In During Parent Account Creation:** From the admin dashboard under **Parents & Learners**, create a parent account. Verify that the secondary Firebase app creates the parent credentials **without logging out the administrator**.
- [x] **Parent Privacy Isolation:** Log in to `/portal/login.html` with the newly created parent account. Verify that the parent can only see their own child, their own fee balance, and their own M-Pesa receipts. Verify that parents cannot access `/admin/dashboard.html` or other parents' data.
- [x] **Security Rules Enforced:** Verify that unauthenticated public visitors cannot read documents from `/visits`, `/subscribers`, `/parents`, or `/payments`.
