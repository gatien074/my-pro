/**
 * Authentification Google côté client (Google Identity Services).
 *
 * ⚠️ IMPORTANT : cette application est 100 % hors ligne et n'a pas de backend.
 * Le token ID reçu de Google est décodé côté client pour en extraire le profil,
 * mais sa signature n'est PAS vérifiée cryptographiquement. Toute personne capable
 * de fabriquer un JWT pourrait se faire passer pour un compte Google.
 * Pour un usage sérieux, il faut ajouter un backend qui valide le token auprès de
 * https://oauth2.googleapis.com/tokeninfo.
 */

export interface GoogleProfile {
  googleId: string;
  email: string;
  nom: string;
  imageUrl?: string;
}

/** Identifiant client Google (Google Cloud Console). À configurer via .env. */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/** Charge le SDK Google Identity Services depuis le CDN. */
export function loadGoogleSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    const g = (window as unknown as { google?: { accounts?: { id?: unknown } } }).google;
    if (g?.accounts?.id) return resolve();

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Impossible de charger le SDK Google.'));
    document.head.appendChild(script);
  });
}

/** Décode le payload d'un JWT (ID Token) sans vérifier la signature. */
function decodeJwtPayload(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  if (!payload) throw new Error('Token Google invalide.');
  let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad) base64 += '='.repeat(4 - pad);
  const decoded = atob(base64);
  return JSON.parse(
    decoded
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join(''),
  );
}

/** Extrait le profil Google depuis un ID Token. */
export function extraireProfilGoogle(credential: string): GoogleProfile {
  const payload = decodeJwtPayload(credential);
  const googleId = String(payload['sub'] ?? '');
  const email = String(payload['email'] ?? '');
  const nom = String(payload['name'] ?? payload['email'] ?? 'Utilisateur Google');
  const imageUrl = payload['picture'] ? String(payload['picture']) : undefined;
  if (!googleId || !email) throw new Error('Profil Google incomplet.');
  return { googleId, email, nom, imageUrl };
}

/** Vérifie que le SDK est prêt et qu'un Client ID est configuré. */
export function googleEstConfigurable(): boolean {
  return Boolean(CLIENT_ID);
}

export { CLIENT_ID };
