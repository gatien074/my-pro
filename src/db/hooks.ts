import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import type { Settings } from './types';

/**
 * Renvoie la configuration de la boutique.
 * `enChargement` permet de distinguer le chargement initial de l'absence de configuration.
 */
export function useSettings(): { settings: Settings | undefined; enChargement: boolean } {
  const settings = useLiveQuery<Settings | undefined, Settings | null>(
    () => db.settings.get('app'),
    [],
    null,
  );
  return { settings: settings ?? undefined, enChargement: settings === null };
}
