/** Formatage des montants FCFA (entiers, sans centimes). */

const SEPARATEURS_INTERNATIONAUX = /[\u202F\u00A0\u2009]/g;

export function formatNombre(valeur: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
    .format(Math.round(valeur))
    .replace(SEPARATEURS_INTERNATIONAUX, ' ');
}

export function formatFCFA(montant: number): string {
  return `${formatNombre(montant)} FCFA`;
}

/** Écart entre deux bornes, formaté en pourcentage. */
export function formatPourcent(valeur: number): string {
  return `${formatNombre(valeur)} %`;
}

/** Convertit une saisie (chaîne) en montant entier FCFA. */
export function versMontant(saisie: string | number): number {
  if (typeof saisie === 'number') return Math.round(saisie);
  const nettoyee = saisie.replace(/[^\d-]/g, '');
  const n = parseInt(nettoyee, 10);
  return Number.isNaN(n) ? 0 : n;
}
