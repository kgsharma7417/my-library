// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCuRcqzlD7NvqX_CxSU3bIPVv7iZ9KurGA",
  authDomain: "library-b1ed1.firebaseapp.com",
  projectId: "library-b1ed1",
  storageBucket: "library-b1ed1.firebasestorage.app",
  messagingSenderId: "135844108680",
  appId: "1:135844108680:web:5afdc7c05c83734b8b423d",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
