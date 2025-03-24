// Import the functions you need from the SDKs you need
import { initializeApp, getApp, getApps } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyB9YYySoE9WxQseqSXbRSrC4-i4jlP6_QM",
    authDomain: "prepyou-bd684.firebaseapp.com",
    projectId: "prepyou-bd684",
    storageBucket: "prepyou-bd684.firebasestorage.app",
    messagingSenderId: "498386667804",
    appId: "1:498386667804:web:aae2d9725020221cf892d9",
    measurementId: "G-454KJV2JB4"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
// const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);