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
    let resolu = false;
    const appliquer = (s: Settings | undefined) => {
      if (!actif) return;
      setSettings(s ?? undefined);
      setEnChargement(false);
    };

    // Réactivité normale (onboarding, paramètres).
    const subscription = liveQuery(() => db.settings.get('app')).subscribe({
      next: (s) => {
        resolu = true;
        appliquer(s ?? undefined);
      },
      error: () => {
        if (actif) setEnChargement(false);
      },
    });

    // Filet de sécurité : si liveQuery n'émet pas, une lecture directe débloque l'affichage.
    void db.settings
      .get('app')
      .then((s) => {
        if (!resolu) appliquer(s ?? undefined);
      })
      .catch(() => {
        if (actif) setEnChargement(false);
      });

    return () => {
      actif = false;
      subscription.unsubscribe();
    };
  }, []);
  return { settings, enChargement };
}
