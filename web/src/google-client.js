import { initializeApp, getApps } from "@firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  setPersistence,
  signInWithPopup,
  signOut,
} from "@firebase/auth";

export async function googleIdentity(config) {
  const app =
    getApps().find((a) => a.name === "mapora-google") ||
    initializeApp(config, "mapora-google");
  const auth = getAuth(app);
  await setPersistence(auth, inMemoryPersistence);
  auth.languageCode = "es";
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const result = await signInWithPopup(auth, provider);
    return await result.user.getIdToken();
  } finally {
    // Mapora keeps its own HttpOnly session; do not persist Google credentials.
    await signOut(auth).catch(() => {});
  }
}
