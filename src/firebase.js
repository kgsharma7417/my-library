// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCuRcqzlD7NvqX_CxSU3bIPVv7iZ9KurGA",
  authDomain: "library-b1ed1.firebaseapp.com",
  projectId: "library-b1ed1",
  storageBucket: "library-b1ed1.firebasestorage.app",
  messagingSenderId: "135844108680",
  appId: "1:135844108680:web:5afdc7c05c83734b8b423d",
};

// 1. Default App — sirf ek baar initialize hoga
const app =
  getApps().find((a) => a.name === "[DEFAULT]") ??
  initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// 2. Google Provider — select_account prompt force karta hai
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

// 3. Secondary App — admin panel mein naye student banate waqt
//    current admin ka session logout na ho isliye alag instance
const SECONDARY_NAME = "SecondaryApp";
const secondaryApp =
  getApps().find((a) => a.name === SECONDARY_NAME) ??
  initializeApp(firebaseConfig, SECONDARY_NAME);

export const secondaryAuth = getAuth(secondaryApp);
