import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
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
