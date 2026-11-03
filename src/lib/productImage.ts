/**
 * Images produit professionnelles et locales.
 *
 * L'application doit fonctionner hors ligne : au lieu de dépendre d'une API
 * externe, on génère une image SVG déterministe basée sur le nom et la
 * catégorie du produit. Le visuel reste cohérent et pertinent, mais il n'est
 * jamais aléatoire d'une session à l'autre.
 */

export interface SourceImageProduit {
  nom: string;
  categorie?: string;
}

function echapperHtml(valeur: string): string {
  return valeur
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Initiales stables utilisées comme pictogramme du produit. */
function initialesProduit(nom: string): string {
  const mots = nom
    .trim()
    .split(/[\s\-_/]+/)
    .filter(Boolean);
  if (mots.length === 0) return 'P';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return `${mots[0][0]}${mots[1][0]}`.toUpperCase();
}

function tronquer(valeur: string, max: number): string {
  return valeur.length > max ? `${valeur.slice(0, max - 1)}…` : valeur;
}

/** Teinte déterministe dérivée du nom et de la catégorie. */
function teinte(source: SourceImageProduit): number {
  const base = `${source.nom}|${source.categorie ?? ''}`;
  let hash = 0;
  for (let i = 0; i < base.length; i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) % 360;
  }
  return hash;
}

/** Génère une image SVG locale (data URL) représentant le produit. */
export function genererImageProduit(source: SourceImageProduit): string {
  const categorie = source.categorie?.trim() || 'Produit';
  const hue = teinte(source);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" role="img" aria-label="${echapperHtml(source.nom)}">
  <defs>
    <linearGradient id="fond" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hue}, 46%, 30%)" />
      <stop offset="100%" stop-color="hsl(${(hue + 38) % 360}, 42%, 22%)" />
    </linearGradient>
  </defs>
  <rect width="480" height="360" fill="url(#fond)" />
  <circle cx="404" cy="70" r="86" fill="rgba(255,255,255,0.07)" />
  <circle cx="76" cy="318" r="64" fill="rgba(255,255,255,0.05)" />
  <text x="50%" y="47%" text-anchor="middle" font-family="'Space Grotesk', system-ui, sans-serif" font-size="104" font-weight="700" fill="#ffffff">${echapperHtml(initialesProduit(source.nom))}</text>
  <text x="50%" y="63%" text-anchor="middle" font-family="'IBM Plex Sans', system-ui, sans-serif" font-size="26" font-weight="600" fill="rgba(255,255,255,0.88)">${echapperHtml(tronquer(source.nom, 24))}</text>
  <text x="50%" y="76%" text-anchor="middle" font-family="'IBM Plex Sans', system-ui, sans-serif" font-size="18" fill="rgba(255,255,255,0.62)">${echapperHtml(tronquer(categorie, 28))}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** Retourne l'image enregistrée, sinon une image de remplacement professionnelle. */
export function imageAfficheeProduit(produit: SourceImageProduit & { imageUrl?: string }): string {
  if (produit.imageUrl?.trim()) return produit.imageUrl;
  return genererImageProduit(produit);
}

/** Petit hash utilisé pour échelonner légèrement l'apparition des cartes. */
export function decalageAnimationProduit(nom: string, index: number): number {
  return Math.min(index * 45, 360) + (nom.length % 3) * 15;
}
