import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { syncWhileVisible } from '../../../src/components/ui/syncWhileVisible';

// Same Firebase project as Mise, but a separately *named* app instance.
// Firebase keeps one signed-in user per origin and app name, and both apps
// live on rossmclachlan.github.io: with the default instance, signing in here
// as Ross or Emily would sign Mise out of its shared account.
const app = initializeApp(
  {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  },
  'priorities',
);

export const auth = getAuth(app);
// Keeps a copy of the data on the phone, so the app opens and takes changes
// offline; changes sync once it's back online, even after the app was closed.
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
syncWhileVisible(db);
