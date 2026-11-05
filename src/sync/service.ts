import { db } from '../db/db';
import { configurationSupabaseValide, obtenirSupabase, tableDistante, UUID } from './supabase';
import { depuisSupabase, versSupabase, type MappingSync } from './mapper';
import { marquerEchec, mettreEnFile, obtenirEnAttente, supprimerSyncRecord, marquerSyncing, nettoyerAnciennes, reinitialiserSyncingBloque } from './queue';
import type { SyncRecord } from './types';
import type { RealtimeChannel } from '@supabase/supabase-js';

let intervalSync: number | undefined;
let enCours = false;
let tirerEnCours = false;
let channelRealtime: RealtimeChannel | null = null;
let generationSync = 0;
let dernierTirRealtime = 0;

export function boutiqueIdActif(): string {
  // Fallback si la configuration n’a pas encore été chargée.
  return 'boutique-1';
}

async function obtenirBoutiqueId(): Promise<string> {
  try {
    const settings = await db.settings.get('app');
    return settings?.boutiqueId ?? settings?.syncId ?? 'boutique-1';
  } catch {
    return 'boutique-1';
  }
}

async function obtenirUtilisateurId(): Promise<number | undefined> {
  try {
    const fromStorage = sessionStorage.getItem('session-caisse-stock');
    if (fromStorage) {
      const parsed = JSON.parse(fromStorage) as { state?: { utilisateur?: { id?: number } } };
      return parsed.state?.utilisateur?.id;
    }
  } catch {
    // ignore
  }
  return undefined;
}

/** Enfile les modifications faites localement. */
export async function enfiler(
  table: string,
  ligne: Record<string, unknown>,
  action: SyncRecord['action'] = 'insert',
): Promise<void> {
  if (!configurationSupabaseValide()) return;
  const boutiqueId = await obtenirBoutiqueId();
  const userId = await obtenirUtilisateurId();
  conformeSyncId(ligne);
  await mettreEnFile(table, versSupabase(table, ligne, boutiqueId), boutiqueId, userId, action);
}

function conformeSyncId(ligne: Record<string, unknown>): void {
  if (!ligne.syncId) ligne.syncId = UUID();
  if (!ligne.updatedAt) ligne.updatedAt = Date.now();
}

/** Synchronise les entrées de la file vers Supabase. */
export async function synchroniser(): Promise<{ traitees: number; echecs: number }> {
  if (!configurationSupabaseValide()) return { traitees: 0, echecs: 0 };
  if (!navigator.onLine) return { traitees: 0, echecs: 0 };
  if (enCours) return { traitees: 0, echecs: 0 };

  enCours = true;
  try {
    await reinitialiserSyncingBloque();
    const supabase = obtenirSupabase();
    const entrées = await obtenirEnAttente(50);
    let traitees = 0;
    let echecs = 0;

    for (const entree of entrées) {
      if (!navigator.onLine) break;
      try {
        await marquerSyncing(entree.id!);
        const tableDistance = tableDistante(entree.tableName);
        const data = entree.recordData;

        if (entree.action === 'delete') {
          if (data.syncId) {
            const { error } = await supabase.from(tableDistance).delete().eq('sync_id', data.syncId);
            if (error) throw error;
          }
        } else if (entree.action === 'update') {
          const { error } = await supabase.from(tableDistance).update(data).eq('sync_id', data.syncId);
          if (error) throw error;
        } else {
          // idempotent : upsert sur sync_id
          const { error } = await supabase.from(tableDistance).upsert(data, { onConflict: 'sync_id' });
          if (error) throw error;
        }

        await supprimerSyncRecord(entree.id!);
        traitees++;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await marquerEchec(entree.id!, message, (entree.retries ?? 0) + 1);
        echecs++;
      }
    }

    await nettoyerAnciennes();
    return { traitees, echecs };
  } finally {
    enCours = false;
  }
}

/** Tire les données distantes vers Dexie. */
export async function tirer(boutiqueId?: string): Promise<number> {
  if (!configurationSupabaseValide()) return 0;
  if (!navigator.onLine) return 0;
  if (tirerEnCours) return 0;

  tirerEnCours = true;
  try {
    const supabase = obtenirSupabase();
    const boutique = boutiqueId ?? (await obtenirBoutiqueId());
    const mapping: MappingSync = new Map();

    // Charger les mappings existants
    await chargerMappings(mapping);

    const tables = ['categories', 'customers', 'users', 'products', 'sales', 'stockMovements', 'debts', 'debtPayments', 'cashClosures'];
    let total = 0;

    for (const table of tables) {
      try {
        const tableDistance = tableDistante(table);
        const { data, error } = await supabase
          .from(tableDistance)
          .select('*')
          .eq('boutique_id', boutique)
          .order('updated_at', { ascending: true })
          .limit(1000);
        if (error) continue;
        if (!data?.length) continue;

        for (const ligneDistante of data) {
          const { objetLocal } = depuisSupabase(table, ligneDistante, mapping);
          const syncId = (ligneDistante.sync_id ?? ligneDistante.syncId) as string | undefined;
          if (!syncId) continue;

          // Si elle existe déjà localement, mettre à jour quand la version distante est plus récente.
          const existe = await tableExistant(table, syncId);
          let localId: number | null | string = null;

          if (existe) {
            localId = existe.id;
            if (typeof existe.id === 'number') {
              await majLigne(table, existe.id, objetLocal);
            }
          } else {
            localId = await insererLigne(table, objetLocal, syncId);
          }

          if (localId != null) {
            mapping.set(`${table}:${syncId}`, typeof localId === 'number' ? localId : Number(localId) || 0);
            total++;
          }
        }
      } catch {
        // ignoré, on continue avec les autres tables
      }
    }

    return total;
  } finally {
    tirerEnCours = false;
  }
}

async function chargerMappings(mapping: MappingSync): Promise<void> {
  const tables = ['categories', 'products', 'sales', 'customers', 'debts', 'stockMovements', 'debtPayments', 'cashClosures'] as const;

  for (const table of tables) {
    try {
      const lignes: Array<{ id?: number; syncId?: string }> = await (db[table] as { toArray: () => Promise<Array<{ id?: number; syncId?: string }>> }).toArray();
      for (const l of lignes) {
        if (l.syncId && l.id != null) {
          mapping.set(`${table}:${l.syncId}`, l.id);
        }
      }
    } catch {
      // ignore
    }
  }
}

async function tableExistant(table: string, syncId: string): Promise<{ id: number } | null> {
  try {
    const tableDb = (db as unknown as Record<string, { where: (champ: string) => { equals: (val: string) => { first: () => Promise<{ id?: number } | undefined> } } }>)[table];
    if (!tableDb) return null;
    const ligne = await tableDb.where('syncId').equals(syncId).first();
    return ligne?.id != null ? { id: ligne.id } : null;
  } catch {
    return null;
  }
}

async function insererLigne(table: string, objetLocal: Record<string, unknown>, syncId: string): Promise<number | null> {
  try {
    const tableDb = (db as unknown as Record<string, { add: (obj: Record<string, unknown>) => Promise<number>; put: (obj: Record<string, unknown>) => Promise<number> }>)[table];
    if (!tableDb) return null;

    // settings utilise une clé string 'app'
    const ligne = { ...objetLocal, syncId, updatedAt: Date.now() };
    // For tables with auto-increment PK, `add` generates the id.
    // For settings, `put` with id:'app' is needed.
    if (table === 'settings') {
      const { id: _x, ...r } = ligne as Record<string, unknown>;
      await tableDb.put({ ...r, id: 'app' });
      return 1;
    }
    const id = await tableDb.add(ligne);
    return id;
  } catch {
    return null;
  }
}

async function majLigne(
  table: string,
  localId: number,
  objetLocal: Record<string, unknown>,
): Promise<void> {
  try {
    const tableDb = (db as unknown as Record<string, { update: (id: number, obj: Record<string, unknown>) => Promise<number> }>)[table];
    if (!tableDb) return;
    const { id: _ignore, ...reste } = objetLocal as Record<string, unknown>;
    if (table === 'settings') return;
    await tableDb.update(localId, reste);
  } catch {
    // ignore
  }
}
// majLigne est conservée pour une future mise à jour sélective.
void majLigne;

/** Abonnement temps réel Supabase pour recevoir les modifications. */
export function demarrerTempsReel(boutiqueId?: string): void {
  if (!configurationSupabaseValide()) return;
  if (channelRealtime) return;

  const supabase = obtenirSupabase();
  const generation = ++generationSync;
  void (async () => {
    const boutique = boutiqueId ?? (await obtenirBoutiqueId());
    if (generation !== generationSync) return;
    channelRealtime = supabase
      .channel(`caisse-${boutique}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', filter: `boutique_id=eq.${boutique}` },
        async () => {
          const maintenant = Date.now();
          if (maintenant - dernierTirRealtime < 3000) return;
          dernierTirRealtime = maintenant;
          // Quand une ligne change distant, on tire à nouveau
          await tirer(boutique).catch(() => undefined);
        },
      )
      .subscribe();
  })();
}

export function arreterTempsReel(): void {
  generationSync++;
  if (channelRealtime) {
    void channelRealtime.unsubscribe();
    channelRealtime = null;
  }
}

function handleOnline(): void {
  synchroniser().catch(() => undefined);
  tirer().catch(() => undefined);
}

export function demarrerSynchronisationAuto(): void {
  demarrerTempsReel();
  synchroniser().catch(() => undefined);

  // Synchronisation périodique en cas d'absence de temps réel ou de ratage
  if (intervalSync == null) {
    intervalSync = window.setInterval(() => {
      synchroniser().catch(() => undefined);
    }, 30_000);
  }

  // Quand le navigateur repasse en ligne
  window.removeEventListener('online', handleOnline);
  window.addEventListener('online', handleOnline);
}

export function arreterSynchronisationAuto(): void {
  arreterTempsReel();
  if (intervalSync != null) {
    window.clearInterval(intervalSync);
    intervalSync = undefined;
  }
  window.removeEventListener('online', handleOnline);
}

/** Construit les acquisitions produitSyncId pour les lignes de vente. */
export function resolverProduitSyncId(
  produitSyncId: string,
  produits: Array<{ id?: number; syncId?: string }>,
): number | undefined {
  const p = produits.find((x) => x.syncId === produitSyncId);
  return p?.id;
}

export async function bootstrapSynchronisation(): Promise<void> {
  if (!configurationSupabaseValide()) return;
  await connecterSessionSupabase();
  demarrerSynchronisationAuto();
}

async function connecterSessionSupabase(): Promise<void> {
  // On utilise une clé anon et pas d’authentification utilisateur pour l’instant.
  // Les politiques RLS autorisera en lecture/écriture pour les clés anon avec boutique_id.
  // Quand l’authentification sera active, on récupérera sessionStorage ici.
  return Promise.resolve();
}
