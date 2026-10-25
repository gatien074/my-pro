import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Produit } from '../db/types';

export interface LignePanier {
  produitId: number;
  nom: string;
  unite: string;
  prixAchat: number;
  prixUnitaire: number;
  quantite: number;
}

interface EtatPanier {
  lignes: LignePanier[];
  remise: number;
  ajouter: (p: Produit) => void;
  decrementer: (produitId: number) => void;
  definirQuantite: (produitId: number, q: number) => void;
  retirer: (produitId: number) => void;
  definirRemise: (v: number) => void;
  vider: () => void;
}

export const usePanier = create<EtatPanier>()(
  persist(
    (set) => ({
      lignes: [],
      remise: 0,
      ajouter: (p) =>
        set((etat) => {
          const existante = etat.lignes.find((l) => l.produitId === p.id);
          const lignes = existante
            ? etat.lignes.map((l) => (l.produitId === p.id ? { ...l, quantite: l.quantite + 1 } : l))
            : [
                ...etat.lignes,
                {
                  produitId: p.id!,
                  nom: p.nom,
                  unite: p.unite,
                  prixAchat: p.prixAchat,
                  prixUnitaire: p.prixVente,
                  quantite: 1,
                },
              ];
          return { ...etat, lignes };
        }),
      decrementer: (produitId) =>
        set((etat) => {
          const lignes = etat.lignes
            .map((l) => (l.produitId === produitId ? { ...l, quantite: l.quantite - 1 } : l))
            .filter((l) => l.quantite > 0);
          return { ...etat, lignes };
        }),
      definirQuantite: (produitId, q) =>
        set((etat) => {
          const lignes = q <= 0
            ? etat.lignes.filter((l) => l.produitId !== produitId)
            : etat.lignes.map((l) => (l.produitId === produitId ? { ...l, quantite: q } : l));
          return { ...etat, lignes };
        }),
      retirer: (produitId) =>
        set((etat) => ({ ...etat, lignes: etat.lignes.filter((l) => l.produitId !== produitId) })),
      definirRemise: (v) => set((etat) => ({ ...etat, remise: Math.max(0, Math.round(v) || 0) })),
      vider: () => set((etat) => ({ ...etat, lignes: [] })),
    }),
    { name: 'panier-caisse-stock', storage: createJSONStorage(() => sessionStorage) },
  ),
);
