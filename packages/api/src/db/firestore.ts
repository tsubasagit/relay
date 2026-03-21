import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (getApps().length === 0) {
  initializeApp(); // Cloud Run は Application Default Credentials を自動使用
}

export const firestore = getFirestore();
