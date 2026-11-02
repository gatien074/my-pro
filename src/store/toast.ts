import { create } from 'zustand';

export type TypeToast = 'info' | 'alerte' | 'erreur' | 'succes';

export interface MessageToast {
  id: number;
  type: TypeToast;
  titre: string;
  texte?: string;
}

interface EtatToast {
  messages: MessageToast[];
  afficher: (m: Omit<MessageToast, 'id'>) => void;
  retirer: (id: number) => void;
}

let compteur = 0;

export const useToasts = create<EtatToast>((set, get) => ({
  messages: [],
  retirer: (id) => set((etat) => ({ messages: etat.messages.filter((m) => m.id !== id) })),
  afficher: (m) => {
    const id = Date.now() + compteur++;
    set((etat) => ({ messages: [...etat.messages, { ...m, id }].slice(-4) }));
    window.setTimeout(() => get().retirer(id), m.type === 'erreur' ? 8000 : 6000);
  },
}));

export const toast = {
  info: (titre: string, texte?: string) => useToasts.getState().afficher({ type: 'info', titre, texte }),
  alerter: (titre: string, texte?: string) => useToasts.getState().afficher({ type: 'alerte', titre, texte }),
  erreur: (titre: string, texte?: string) => useToasts.getState().afficher({ type: 'erreur', titre, texte }),
  succes: (titre: string, texte?: string) => useToasts.getState().afficher({ type: 'succes', titre, texte }),
  retirer: (id: number) => useToasts.getState().retirer(id),
};
