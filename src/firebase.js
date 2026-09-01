import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAFU1Dicvso2qqyP20V91dvZ0EK9btvTKA",
  authDomain: "hanh-trinh-hsk.firebaseapp.com",
  projectId: "hanh-trinh-hsk",
  storageBucket: "hanh-trinh-hsk.firebasestorage.app",
  messagingSenderId: "857880152849",
  appId: "1:857880152849:web:aa982de16e0337b38b5ab0",
  measurementId: "G-L5L27GF82M"
};

// Khởi tạo Firebase (Đảm bảo Next.js không bị khởi tạo lặp lại nhiều lần)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Khởi tạo và xuất Firestore Database ra để các trang khác sử dụng
export const db = getFirestore(app);