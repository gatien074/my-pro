import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { toast } from '../store/toast';

/** Résume une liste de noms pour un message court et lisible. */
function resumeNoms(noms: string[]): string {
  if (noms.length === 0) return '';
  if (noms.length <= 3) return noms.join(', ');
  return `${noms.slice(0, 3).join(', ')} et ${noms.length - 3} autre(s)`;
}

/**
 * Surveille les produits épuisés et affiche un message push dès qu'une rupture
 * apparaît (ou à l'ouverture si des produits sont déjà épuisés).
 */
export function useAlerteRuptures(): void {
  const produits = useLiveQuery(() => db.products.toArray(), []);
  const vusRef = useRef<Set<number>>(new Set());
  const initialiseRef = useRef(false);

  useEffect(() => {
    if (produits === undefined) return;

    const epuises = produits.filter((p) => p.actif && p.stock <= 0 && p.id != null);
    const ids = epuises.map((p) => p.id!);
    const noms = epuises.map((p) => p.nom);

    if (!initialiseRef.current) {
      initialiseRef.current = true;
      if (epuises.length > 0) {
        toast.alerter(`${epuises.length} produit(s) épuisé(s)`, `À réapprovisionner : ${resumeNoms(noms)}.`);
      }
      vusRef.current = new Set(ids);
      return;
    }

    const nouveaux = epuises.filter((p) => !vusRef.current.has(p.id!));
    if (nouveaux.length > 0) {
      const nouveauxNoms = nouveaux.map((p) => p.nom);
      toast.alerter('Rupture de stock', `${nouveauxNoms.join(', ')} — stock épuisé.`);
    }

    vusRef.current = new Set(ids);
  }, [produits]);
}
