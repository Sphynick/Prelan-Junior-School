/**
 * PRELAN JUNIOR SCHOOL - FIREBASE CONFIGURATION
 * 
 * Replace the placeholder values below with your actual Firebase project settings
 * found in the Firebase Console (Project Settings > General > Your apps > Web app).
 */

export // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyA58iCL_vLqzn9QUU3IhvGU9QFTI9j0Ez4",
    authDomain: "prelan-junior-school.firebaseapp.com",
    projectId: "prelan-junior-school",
    storageBucket: "prelan-junior-school.firebasestorage.app",
    messagingSenderId: "8651719805",
    appId: "1:8651719805:web:0b4c9243f1dd9888ab9d14",
    measurementId: "G-F1L6QD719H"
  };

/**
 * STORAGE MODE FLAG:
 * - true:  Use Firebase Cloud Storage (Requires Firebase Blaze Pay-As-You-Go plan).
 * - false: Free Spark plan mode. Images are compressed in the browser to < 200KB
 *          and stored as Base64 in Cloud Firestore. PDF circulars/report documents
 *          are hosted externally (e.g. Google Drive link or direct URL).
 */
export const USE_STORAGE = false;

/**
 * Helper to detect if user has provided real Firebase credentials
 */
export function isFirebaseConfigured() {
  return (
    firebaseConfig.apiKey &&
    firebaseConfig.apiKey !== "AIzaSyA58iCL_vLqzn9QUU3IhvGU9QFTI9j0Ez4" &&
    firebaseConfig.projectId &&
    firebaseConfig.projectId !== "prelan-junior-school"
  );
}
