import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";
import firebaseConfig from '../../firebase-applet-config.json';

const config = (firebaseConfig as any).default || firebaseConfig;

const app = initializeApp(config);
export const db = getFirestore(app, config.firestoreDatabaseId);
export const auth = getAuth();

let genAI: GoogleGenerativeAI | null = null;
export function getGemini() {
  if (!genAI && typeof process !== 'undefined' && process.env && process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

export async function saveClonedVoice(userId: string, voiceId: string, name: string) {
  const clonedVoicesRef = collection(db, `users/${userId}/clonedVoices`);
  await addDoc(clonedVoicesRef, {
    voiceId,
    name,
    createdAt: serverTimestamp()
  });
}

export async function getUserClonedVoices(userId: string) {
  const clonedVoicesRef = collection(db, `users/${userId}/clonedVoices`);
  const q = query(clonedVoicesRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}
