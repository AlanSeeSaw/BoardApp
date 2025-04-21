import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
// Replace with your actual Firebase config from the Firebase console
const firebaseConfig = {
    apiKey: "AIzaSyClKNv6XPepYKyhyvcGnadHoQfRu9Q68VE",
    authDomain: "kanban-board-7c95d.firebaseapp.com",
    projectId: "kanban-board-7c95d",
    storageBucket: "kanban-board-7c95d.firebasestorage.app",
    messagingSenderId: "372804506730",
    appId: "1:372804506730:web:7a1c1ccd4b992ac0106613",
    measurementId: "G-WL2QFFS6RW"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth }; 
