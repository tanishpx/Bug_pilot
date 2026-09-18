import { initializeApp } from "firebase/app";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
} from "firebase/auth";
import type { Auth, User, UserCredential } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth: Auth | null = app ? getAuth(app) : null;

function requireAuth(): Auth {
  if (!auth) {
    throw new Error("Firebase is not configured. Add the VITE_FIREBASE_* values to .env.");
  }
  return auth;
}

export const signup = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  return await createUserWithEmailAndPassword(
    requireAuth(),
    email,
    password
  );
};

export const login = async (
  email: string,
  password: string
): Promise<UserCredential> => {
  return await signInWithEmailAndPassword(
    requireAuth(),
    email,
    password
  );
};

export const logout = async () => {
  return await signOut(requireAuth());
};

export const resetPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(requireAuth(), email);
};

export const getSession = (): User | null => auth?.currentUser || null;

export const isAdmin = (user: User | null = getSession()): boolean => {
  return Boolean(user);
};

export const loginWithGoogle = async (): Promise<UserCredential> => {
  return await signInWithPopup(requireAuth(), new GoogleAuthProvider());
};