import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User } from '../db/types';

export interface UtilisateurConnecte {
  id: number;
  nom: string;
  role: User['role'];
}

interface EtatSession {
  utilisateur: UtilisateurConnecte | null;
  connecter: (u: UtilisateurConnecte) => void;
  deconnecter: () => void;
}

export const useSession = create<EtatSession>()(
  persist(
    (set) => ({
      utilisateur: null,
      connecter: (utilisateur) => set({ utilisateur }),
      deconnecter: () => set({ utilisateur: null }),
    }),
    { name: 'session-caisse-stock', storage: createJSONStorage(() => sessionStorage) },
  ),
);
