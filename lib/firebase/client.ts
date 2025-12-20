import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, GoogleAuthProvider, getAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

export type FirebaseClient = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  provider: GoogleAuthProvider;
};

let cachedClient: FirebaseClient | null = null;

export function getFirebaseClient(): FirebaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const missingKeys = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missingKeys.length) {
    throw new Error(
      `Firebase 환경 변수가 필요합니다: ${missingKeys
        .map((key) => key.replace("NEXT_PUBLIC_", ""))
        .join(", ")}`
    );
  }

  const app = getApps().length ? getApp() : initializeApp(config);

  cachedClient = {
    app,
    auth: getAuth(app),
    db: getFirestore(app),
    provider: (() => {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return provider;
    })(),
  };

  return cachedClient;
}
