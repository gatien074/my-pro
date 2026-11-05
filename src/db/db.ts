import Dexie, { type Table } from 'dexie';
import type {
  Category,
  Client,
  ClotureCaisse,
  Dette,
  MouvementStock,
  PaiementDette,
  Produit,
  Settings,
  User,
  Vente,
} from './types';
import type { SyncRecord } from '../sync/types';

export class BdCaisse extends Dexie {
  settings!: Table<Settings, string>;
  users!: Table<User, number>;
  categories!: Table<Category, number>;
  products!: Table<Produit, number>;
  sales!: Table<Vente, number>;
  stockMovements!: Table<MouvementStock, number>;
  customers!: Table<Client, number>;
  debts!: Table<Dette, number>;
  debtPayments!: Table<PaiementDette, number>;
  cashClosures!: Table<ClotureCaisse, number>;
  syncQueue!: Table<SyncRecord, number>;

  constructor() {
    super('caisse-stock-gabon');
    this.version(1).stores({
      settings: 'id',
      users: '++id, nom, role',
      categories: '++id, nom',
      products: '++id, nom, categoryId, codeBarres',
      sales: '++id, numero, date, clientId, statut',
      stockMovements: '++id, produitId, type, date',
      customers: '++id, nom, telephone',
      debts: '++id, clientId, statut, echeance, venteId',
      debtPayments: '++id, detteId, date',
    });
    // v2 : clôtures de caisse
    this.version(2).stores({
      settings: 'id',
      users: '++id, nom, role',
      categories: '++id, nom',
      products: '++id, nom, categoryId, codeBarres',
      sales: '++id, numero, date, clientId, statut',
      stockMovements: '++id, produitId, type, date',
      customers: '++id, nom, telephone',
      debts: '++id, clientId, statut, echeance, venteId',
      debtPayments: '++id, detteId, date',
      cashClosures: '++id, date',
    });
    // v3 : synchronisation
    this.version(3).stores({
      settings: 'id, syncId, boutiqueId',
      users: '++id, syncId, nom, role',
      categories: '++id, syncId, boutiqueId, nom',
      products: '++id, syncId, boutiqueId, nom, categoryId, codeBarres',
      sales: '++id, syncId, boutiqueId, numero, date, clientId, statut',
      stockMovements: '++id, syncId, boutiqueId, produitId, type, date',
      customers: '++id, syncId, boutiqueId, nom, telephone',
      debts: '++id, syncId, boutiqueId, clientId, statut, echeance, venteId',
      debtPayments: '++id, syncId, boutiqueId, detteId, date',
      cashClosures: '++id, syncId, boutiqueId, date',
      syncQueue: '++id, [tableName+syncId+status], status, timestamp',
    });
    // v4 : backfill des anciens enregistrements sans syncId / boutiqueId
    this.version(4).stores({
      settings: 'id, syncId, boutiqueId',
      users: '++id, syncId, nom, role',
      categories: '++id, syncId, boutiqueId, nom',
      products: '++id, syncId, boutiqueId, nom, categoryId, codeBarres',
      sales: '++id, syncId, boutiqueId, numero, date, clientId, statut',
      stockMovements: '++id, syncId, boutiqueId, produitId, type, date',
      customers: '++id, syncId, boutiqueId, nom, telephone',
      debts: '++id, syncId, boutiqueId, clientId, statut, echeance, venteId',
      debtPayments: '++id, syncId, boutiqueId, detteId, date',
      cashClosures: '++id, syncId, boutiqueId, date',
      syncQueue: '++id, [tableName+syncId+status], status, timestamp',
    }).upgrade(async (tx) => {
      const boutiqueId = `boutique-${Date.now()}`;
      const maintenant = Date.now();
      const tables: Array<{ nom: string; table: { each: (fn: (ligne: Record<string, unknown>) => void | Promise<void>) => Promise<void>; put: (ligne: Record<string, unknown>) => Promise<unknown> } }> = [
        { nom: 'settings', table: tx.table('settings') as never },
        { nom: 'users', table: tx.table('users') as never },
        { nom: 'categories', table: tx.table('categories') as never },
        { nom: 'products', table: tx.table('products') as never },
        { nom: 'sales', table: tx.table('sales') as never },
        { nom: 'stockMovements', table: tx.table('stockMovements') as never },
        { nom: 'customers', table: tx.table('customers') as never },
        { nom: 'debts', table: tx.table('debts') as never },
        { nom: 'debtPayments', table: tx.table('debtPayments') as never },
        { nom: 'cashClosures', table: tx.table('cashClosures') as never },
      ];

      for (const { table } of tables) {
        await table.each(async (ligne) => {
          const patch: Record<string, unknown> = {};
          if (!ligne.syncId) patch.syncId = (globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(16).slice(2)}-${Date.now()}`);
          if (ligne.boutiqueId === undefined) patch.boutiqueId = boutiqueId;
          if (!ligne.updatedAt) patch.updatedAt = maintenant;
          if (Object.keys(patch).length) {
            await table.put({ ...ligne, ...patch });
          }
        });
      }

      // Le settings doit conserver un boutiqueId propre et cohérent.
      try {
        const settings = await tx.table('settings').get('app');
        if (settings) {
          await tx.table('settings').put({
            ...settings,
            syncId: settings.syncId ?? boutiqueId,
            boutiqueId: settings.boutiqueId ?? boutiqueId,
            updatedAt: settings.updatedAt ?? maintenant,
          });
        }
      } catch {
        // Base sans settings : OK
      }
    });
  }
}

export const db = new BdCaisse();

// Gérer les erreurs de schéma/DB en mode dev
db.on('blocked', () => {
  console.warn('Base de données bloquée par une autre fenêtre');
});

db.open().catch((err) => {
  console.error('Erreur ouverture DB:', err);
  // Ne recréer la base que pour une vraie erreur de schéma/version, jamais pour une erreur transitoire.
  if (err.name === 'UpgradeError' || err.name === 'SchemaError' || err.name === 'VersionError') {
    console.warn('Tentative de suppression et recréation de la base...');
    db.delete()
      .then(() => {
        window.location.reload();
      })
      .catch((e) => console.error('Échec recréation DB:', e));
  }
});

/** Tables core de l'application (utilisées pour les transactions globales). */
export const TOUTES_TABLES = [
  db.settings,
  db.users,
  db.categories,
  db.products,
  db.sales,
  db.stockMovements,
  db.customers,
  db.debts,
  db.debtPayments,
  db.cashClosures,
  db.syncQueue,
] as const;
