import type { ModePaiement, StatutDette, TypeMouvement, StatutVente } from '../db/types';

export const LIBELLES_MODES: Record<ModePaiement, string> = {
  especes: 'Espèces',
  airtel: 'Airtel Money',
  moov: 'Moov Money',
  credit: 'Crédit client',
};

export const LIBELLES_MOUVEMENTS: Record<TypeMouvement, string> = {
  vente: 'Vente',
  annulation: 'Annulation',
  entree: 'Entrée',
  perte: 'Perte',
  ajustement: 'Ajustement',
};

/** Normalise un numéro de téléphone gabonais pour WhatsApp / appel. */
export function normaliserTelephone(tel: string | undefined): string | null {
  if (!tel) return null;
  let chiffres = tel.replace(/\D/g, '');
  if (!chiffres || chiffres.length < 6) return null;
  if (chiffres.startsWith('00')) chiffres = chiffres.slice(2);
  if (chiffres.length <= 9) chiffres = '241' + chiffres;
  return chiffres;
}

export function lienWhatsApp(tel: string | undefined, message: string): string | null {
  const n = normaliserTelephone(tel);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : null;
}

export function lienAppel(tel: string | undefined): string | null {
  const n = normaliserTelephone(tel);
  return n ? `tel:+${n}` : null;
}

export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).slice(0, 2);
  return mots.map((m) => (m[0] ?? '').toUpperCase()).join('') || '?';
}

export const LIBELLES_STATUTS_VENTE: Record<StatutVente, string> = {
  vendue: 'Vendue',
  annulee: 'Annulée',
};

export const LIBELLES_STATUTS_DETTE: Record<StatutDette | 'en_retard', string> = {
  en_cours: 'En cours',
  en_retard: 'En retard',
  soldee: 'Soldée',
  annulee: 'Annulée',
};

/** Télécharge un fichier généré côté navigateur. */
export function telechargerFichier(nomFichier: string, contenu: string, mime: string): void {
  const blob = new Blob([contenu], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomFichier;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}
