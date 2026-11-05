import { UUID } from './supabase';

/** Tableau de correspondance localId ↔ syncId pour résoudre les relations. */
export type MappingSync = Map<string, number>; // "table:syncId" -> localId

function camelToSnake(nom: string): string {
  return nom.replace(/[A-Z]/g, (lettre) => `_${lettre.toLowerCase()}`);
}

function snakeToCamel(nom: string): string {
  return nom.replace(/_([a-z])/g, (_, lettre: string) => lettre.toUpperCase());
}

function convertirChamps(objet: Record<string, unknown>, transformer: (nom: string) => string): Record<string, unknown> {
  const sortie: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(objet)) {
    sortie[transformer(cle)] = valeur;
  }
  return sortie;
}

/** Prépare les données locales d’une table pour l’envoi vers Supabase (snake_case). */
export function versSupabase(
  _table: string,
  ligne: Record<string, unknown>,
  boutiqueId: string,
): Record<string, unknown> {
  const { id: _id, ...reste } = ligne;
  const data: Record<string, unknown> = { ...reste, boutiqueId };

  if (!data.syncId) data.syncId = UUID();
  if (!data.updatedAt) data.updatedAt = Date.now();

  const conversion = convertirChamps(data, camelToSnake);
  return { ...conversion, boutique_id: boutiqueId };
}

/** Prépare les données Supabase pour l’insertion locale Dexie (camelCase). */
export function depuisSupabase(
  table: string,
  ligneSnake: Record<string, unknown>,
  mapping: MappingSync,
): { objetLocal: Record<string, unknown>; mappingUpdates: Array<[string, number]> } {
  const mappingUpdates: Array<[string, number]> = [];
  const ligne = convertirChamps(ligneSnake, snakeToCamel);
  const objetLocal: Record<string, unknown> = { ...ligne };

  // Supprimer les champs distants qui n'existent pas localement
  delete objetLocal.id;
  delete objetLocal.boutique_id;

  // Résoudre les références d'autres tables via mapping
  if (table === 'products' && objetLocal.categorySyncId) {
    const cle = `categories:${objetLocal.categorySyncId}`;
    const localId = mapping.get(cle);
    if (localId) objetLocal.categoryId = localId;
  }

  if (table === 'sales') {
    if (ligne.clientSyncId) {
      const localId = mapping.get(`customers:${ligne.clientSyncId}`);
      if (localId) objetLocal.clientId = localId;
    }
    if (Array.isArray(ligne.lignes)) {
      objetLocal.lignes = (ligne.lignes as Array<Record<string, unknown>>).map((l) => {
        const brut = convertirChamps(l, snakeToCamel);
        const produitSyncId = (brut.produitSyncId ?? l.produit_sync_id) as string | undefined;
        if (produitSyncId) {
          const localId = mapping.get(`products:${produitSyncId}`);
          if (localId) return { ...brut, produitId: localId };
        }
        return brut;
      });
    }
  }

  if (table === 'stockMovements') {
    if (ligne.produitSyncId) {
      const localId = mapping.get(`products:${ligne.produitSyncId}`);
      if (localId) objetLocal.produitId = localId;
    }
    if (ligne.venteSyncId) {
      const localId = mapping.get(`sales:${ligne.venteSyncId}`);
      if (localId) objetLocal.venteId = localId;
    }
  }

  if (table === 'debts') {
    if (ligne.clientSyncId) {
      const localId = mapping.get(`customers:${ligne.clientSyncId}`);
      if (localId) objetLocal.clientId = localId;
    }
    if (ligne.venteSyncId) {
      const localId = mapping.get(`sales:${ligne.venteSyncId}`);
      if (localId) objetLocal.venteId = localId;
    }
  }

  if (table === 'debtPayments') {
    if (ligne.detteSyncId) {
      const localId = mapping.get(`debts:${ligne.detteSyncId}`);
      if (localId) objetLocal.detteId = localId;
    }
  }

  return { objetLocal, mappingUpdates };
}

export function UUIDV2(): string {
  return UUID();
}
