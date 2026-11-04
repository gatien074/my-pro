/**
 * Téléchargement d'images produit pertinentes sans dépendre d'une API payante.
 *
 * Priorité :
 * 1. Recherche Wikimedia Commons (images libres, pertinentes, avec CORS).
 * 2. LoremFlickr, qui renvoie une photo correspondant aux mots-clés.
 *
 * Si rien ne fonctionne, l'appelant utilise un placeholder SVG local.
 */

export async function telechargerImageProduit(
  nom: string,
  categorie?: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return null;

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), 8000);
  const signalEffectif = signal ?? controleur.signal;

  const motsCles = [nom, categorie]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (!motsCles) {
    clearTimeout(minuteur);
    return null;
  }

  try {
    // 1) Wikimedia Commons : recherche d'image libre.
  try {
    const urlRecherche =
      'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' +
      encodeURIComponent(motsCles) +
      '&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=480&format=json&origin=*';
    const reponse = await fetch(urlRecherche, { signal: signalEffectif });
    const donnees = (await reponse.json()) as {
      query?: { pages?: Record<string, { imageinfo?: Array<{ thumburl?: string; url?: string }> }> };
    };
    const pages = donnees.query?.pages;
    const premiere = pages ? Object.values(pages)[0] : undefined;
    const imageUrl = premiere?.imageinfo?.[0]?.thumburl ?? premiere?.imageinfo?.[0]?.url;

    if (imageUrl) {
      const image = await fetch(imageUrl, { signal: signalEffectif });
      if (image.ok) {
        const blob = await image.blob();
        return blobVersDataUrl(blob);
      }
    }
  } catch {
    // On passe au fournisseur suivant.
  }

  // 2) LoremFlickr : photo correspondant aux tags.
  try {
    const tags = motsCles.replace(/\s+/g, ',');
    const image = await fetch(`https://loremflickr.com/480/360/${encodeURIComponent(tags)}`, { signal: signalEffectif });
    if (image.ok) {
      const blob = await image.blob();
      return blobVersDataUrl(blob);
    }
  } catch {
    // Aucune image en ligne disponible : l'appelant utilisera le placeholder local.
  }

  return null;
  } finally {
    clearTimeout(minuteur);
  }
}

function blobVersDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resolve(String(lecteur.result));
    lecteur.onerror = () => reject(lecteur.error);
    lecteur.readAsDataURL(blob);
  });
}
