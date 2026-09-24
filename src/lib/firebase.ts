import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  type Auth, 
  type ConfirmationResult,
  type User
} from 'firebase/auth';
import type { UserRole, AuthUserProfile } from '../utils/authTypes';

// Firebase Client Web SDK Configuration (Public Credentials)
const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY || (typeof process !== 'undefined' ? process.env.PUBLIC_FIREBASE_API_KEY : ''),
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN || (typeof process !== 'undefined' ? process.env.PUBLIC_FIREBASE_AUTH_DOMAIN : 'bhusawal-connect.firebaseapp.com'),
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID || (typeof process !== 'undefined' ? process.env.PUBLIC_FIREBASE_PROJECT_ID : 'bhusawal-connect'),
  storageBucket: import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET || (typeof process !== 'undefined' ? process.env.PUBLIC_FIREBASE_STORAGE_BUCKET : 'bhusawal-connect.appspot.com'),
  messagingSenderId: import.meta.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID || (typeof process !== 'undefined' ? process.env.PUBLIC_FIREBASE_MESSAGING_SENDER_ID : ''),
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID || (typeof process !== 'undefined' ? process.env.PUBLIC_FIREBASE_APP_ID : '')
};

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (typeof window === 'undefined') {
    throw new Error('[Firebase] Firebase Client SDK should be initialized in browser context.');
  }
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    auth = getAuth(firebaseApp);
  }
  return auth;
}

/**
 * Initialize RecaptchaVerifier for Phone Authentication
 */
export function setupRecaptcha(containerId: string, buttonId?: string): RecaptchaVerifier | null {
  if (typeof window === 'undefined') return null;
  const authInstance = getFirebaseAuth();

  try {
    const verifier = new RecaptchaVerifier(authInstance, containerId, {
      size: 'invisible',
      callback: () => {
        console.log('[Firebase Auth] Recaptcha verified successfully.');
      },
      'expired-callback': () => {
        console.warn('[Firebase Auth] Recaptcha expired. Please retry.');
      }
    });

    return verifier;
  } catch (err) {
    console.error('[Firebase Auth] Failed to initialize RecaptchaVerifier:', err);
    return null;
  }
}

/**
 * Send SMS OTP via Firebase Phone Authentication
 * Supports real SMS OTP & Firebase Console test phone numbers
 */
export async function sendPhoneOtp(
  phoneNumber: string, 
  verifier: RecaptchaVerifier
): Promise<ConfirmationResult> {
  const authInstance = getFirebaseAuth();

  // Format phone number to E.164 standard (+91XXXXXXXXXX)
  let cleanPhone = phoneNumber.trim().replace(/[^\d+]/g, '');
  if (!cleanPhone.startsWith('+')) {
    if (cleanPhone.length === 10) cleanPhone = `+91${cleanPhone}`;
    else if (cleanPhone.startsWith('91') && cleanPhone.length === 12) cleanPhone = `+${cleanPhone}`;
  }

  try {
    const confirmationResult = await signInWithPhoneNumber(authInstance, cleanPhone, verifier);
    return confirmationResult;
  } catch (error: any) {
    console.error('[Firebase Auth] sendPhoneOtp Error:', error);
    throw error;
  }
}

/**
 * Verify 6-digit SMS OTP Code returned by user
 */
export async function verifyPhoneOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string
): Promise<User> {
  try {
    const userCredential = await confirmationResult.confirm(otpCode.trim());
    return userCredential.user;
  } catch (error: any) {
    console.error('[Firebase Auth] verifyPhoneOtp Error:', error);
    throw error;
  }
}

/**
 * Admin & Super Admin Email/Password Authentication
 */
export async function signInAdminEmail(email: string, pass: string): Promise<User> {
  const authInstance = getFirebaseAuth();
  try {
    const userCredential = await signInWithEmailAndPassword(authInstance, email.trim(), pass);
    return userCredential.user;
  } catch (error: any) {
    console.error('[Firebase Auth] signInAdminEmail Error:', error);
    throw error;
  }
}

/**
 * Sign Out Current User
 */
export async function signOutFirebaseUser(): Promise<void> {
  const authInstance = getFirebaseAuth();
  try {
    await signOut(authInstance);
  } catch (error: any) {
    console.error('[Firebase Auth] signOut Error:', error);
    throw error;
  }
}

/**
 * Subscribe to Auth State Changes
 */
export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const authInstance = getFirebaseAuth();
  return onAuthStateChanged(authInstance, callback);
}

/**
 * Build Normalized AuthUserProfile Object
 */
export function mapFirebaseUserToProfile(user: User, role: UserRole = 'CUSTOMER'): AuthUserProfile {
  return {
    uid: user.uid,
    role,
    phoneNumber: user.phoneNumber,
    email: user.email,
    displayName: user.displayName || `User (${user.phoneNumber || user.email || 'Member'})`,
    photoURL: user.photoURL,
    createdAt: user.metadata.creationTime || new Date().toISOString(),
    lastLoginAt: user.metadata.lastSignInTime || new Date().toISOString(),
    isPhoneVerified: !!user.phoneNumber,
    isEmailVerified: user.emailVerified
  };
}
