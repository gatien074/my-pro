/** Hachage du code PIN. Protection d'accès volontairement simple (pas de chiffrement des données). */

const SALT = 'caisse-stock-gabon-v1';

export function pinValide(valeur: string): boolean {
  return /^\d{4}$/.test(valeur);
}

export async function hacherPin(pin: string): Promise<string> {
  const texte = `${SALT}::${pin}::${SALT}`;
  try {
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
      const octets = new TextEncoder().encode(texte);
      const hachage = await globalThis.crypto.subtle.digest('SHA-256', octets);
      return Array.from(new Uint8Array(hachage))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // environnement non sécurisé (HTTP local) : fallback
  }
  let h = 5381;
  for (const c of texte) {
    h = (h * 33) ^ (c.codePointAt(0) ?? 0);
  }
  return `djb2_${(h >>> 0).toString(16)}`;
}
