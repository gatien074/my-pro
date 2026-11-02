import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from './db';
import type { Settings } from './types';

/**
 * Renvoie la configuration de la boutique.
 * `enChargement` permet de distinguer le chargement initial de l'absence de configuration.
 * Utilise liveQuery pour rester réactif aux modifications (création onboarding, paramètres).
 */
export function useSettings(): { settings: Settings | undefined; enChargement: boolean } {
  const [settings, setSettings] = useState<Settings | undefined>(undefined);
  const [enChargement, setEnChargement] = useState(true);
  useEffect(() => {
    let actif = true;
    const subscription = liveQuery(() => db.settings.get('app')).subscribe({
      next: (s) => {
        if (!actif) return;
        setSettings(s ?? undefined);
        setEnChargement(false);
      },
      error: () => {
        if (!actif) return;
        setEnChargement(false);
      },
    });
    return () => {
      actif = false;
      subscription.unsubscribe();
    };
  }, []);
  return { settings, enChargement };
}
