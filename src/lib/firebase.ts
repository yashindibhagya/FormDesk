import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAnalytics, type Analytics } from 'firebase/analytics'
import { getFirestore, type Firestore } from 'firebase/firestore'

type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId?: string
}

function readConfig(): FirebaseWebConfig | null {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY?.trim() ?? ''
  const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() ?? ''
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim() ?? ''
  const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ?? ''
  const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ?? ''
  const appId = import.meta.env.VITE_FIREBASE_APP_ID?.trim() ?? ''
  const measurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim()

  if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
    return null
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
    ...(measurementId ? { measurementId } : {}),
  }
}

const config = readConfig()

let firebaseApp: FirebaseApp | undefined
let firebaseDb: Firestore | undefined
let firebaseAnalytics: Analytics | undefined

if (config) {
  firebaseApp = getApps().length > 0 ? getApps()[0]! : initializeApp(config)
  firebaseDb = getFirestore(firebaseApp)
  if (typeof window !== 'undefined' && config.measurementId) {
    firebaseAnalytics = getAnalytics(firebaseApp)
  }
} else if (import.meta.env.DEV) {
  console.warn(
    '[firebase] Set VITE_FIREBASE_* in .env.local (see .env.example). Firestore and Analytics are disabled until then.',
  )
}

export { firebaseApp, firebaseDb, firebaseAnalytics }
