import { db } from '../db/db';
import type { SyncRecord } from './types';
import { UUID } from './supabase';

/** Ajoute (ou remplace l'élément correspondant) une entrée dans la file SyncQueue, de manière atomique. */
export async function mettreEnFile(
  tableName: string,
  recordData: Record<string, unknown>,
  boutiqueId: string,
  userId?: number,
  action: SyncRecord['action'] = 'insert',
): Promise<void> {
  const syncId = (recordData.syncId as string | undefined) ?? (recordData.sync_id as string | undefined) ?? UUID();

  await db.transaction('rw', db.syncQueue, async () => {
    const existants = await db.syncQueue
      .where('[tableName+syncId]')
      .equals([tableName, syncId])
      .toArray();

    if (existants.length) {
      const dernier = existants[existants.length - 1];
      // insert (création) doit rester prioritaire ; un update ne doit pas « rétrograder » un insert.
      const nouvelAction = action === 'insert' ? 'insert' : dernier.action === 'insert' ? 'insert' : action;
      await db.syncQueue.update(dernier.id!, {
        recordData,
        boutiqueId,
        action: nouvelAction,
        timestamp: Date.now(),
        syncId,
        retries: 0,
        error: undefined,
      });
      return;
    }

    const rec: SyncRecord = {
      tableName,
      recordData,
      boutiqueId,
      userId,
      action,
      timestamp: Date.now(),
      status: 'pending',
      syncId,
      retries: 0,
    };
    await db.syncQueue.add(rec);
  });
}

/** Indique qu’une entrée est en synchronisation. */
export async function marquerSyncing(id: number): Promise<void> {
  await db.syncQueue.update(id, { status: 'syncing' });
}

/** Marque une entrée comme synchronisée et la supprime du queue. */
export async function supprimerSyncRecord(id: number): Promise<void> {
  await db.syncQueue.delete(id);
}

/** Marque une entrée comme échouée avec retry. */
export async function marquerEchec(id: number, erreur: string, retries: number): Promise<void> {
  await db.syncQueue.update(id, { status: 'failed', error: erreur, retries });
}

/** Retourne les entrées en attente (pending, failed, syncing expiré). */
export async function obtenirEnAttente(limite = 50): Promise<SyncRecord[]> {
  const rows: SyncRecord[] = [];
  // .limit() est appliqué directement dans Dexie pour éviter de charger toute la table.
  const pending = await db.syncQueue.where('status').equals('pending').limit(limite).toArray();
  rows.push(...pending);

  if (rows.length < limite) {
    // Failed jamais récupérés : reprendre après un certain délai
    const failed = await db.syncQueue.where('status').equals('failed').limit(limite - rows.length).toArray();
    rows.push(...failed);
  }

  if (rows.length < limite) {
    const syncingExpire = Date.now() - 60_000;
    const syncing = await db.syncQueue
      .where('status')
      .equals('syncing')
      .and((r) => r.timestamp < syncingExpire)
      .limit(limite - rows.length)
      .toArray();
    rows.push(...syncing);
  }

  return rows.sort((a, b) => a.timestamp - b.timestamp).slice(0, limite);
}

/** Compte les entrées en attente. */
export async function compteurEnAttente(): Promise<number> {
  const pending = await db.syncQueue.where('status').equals('pending').count();
  const failed = await db.syncQueue.where('status').equals('failed').count();
  return pending + failed;
}

/** Nettoie les anciennes entrées synchronisées (garder 7 jours). */
export async function nettoyerAnciennes(): Promise<void> {
  const septJours = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await db.syncQueue.where('status').equals('synced').and((r) => r.timestamp < septJours).delete();
}

/** Remet en pending toutes les entrées « syncing » bloquées (crash, fermeture). */
export async function reinitialiserSyncingBloque(): Promise<number> {
  const syncing = await db.syncQueue.where('status').equals('syncing').toArray();
  for (const r of syncing) {
    await db.syncQueue.update(r.id!, { status: 'pending', retries: (r.retries ?? 0) + 1 });
  }
  return syncing.length;
}
