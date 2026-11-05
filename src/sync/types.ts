// Les types Dexie incluent déjà syncId/boutiqueId/updatedAt (voir db/types.ts).
// Ces alias existent pour documenter l’intention de synchronisation.
export type SettingsSync = import('../db/types').Settings;
export type UserSync = import('../db/types').User;
export type CategorySync = import('../db/types').Category;
export type ProduitSync = import('../db/types').Produit;
export type VenteSync = import('../db/types').Vente;
export type MouvementStockSync = import('../db/types').MouvementStock;
export type ClientSync = import('../db/types').Client;
export type DetteSync = import('../db/types').Dette;
export type PaiementDetteSync = import('../db/types').PaiementDette;
export type ClotureCaisseSync = import('../db/types').ClotureCaisse;

// Sync record stored in Dexie queue
export interface SyncRecord {
  id?: number;
  tableName: string;
  recordData: Record<string, unknown>;
  boutiqueId: string;
  userId?: number;
  action: 'insert' | 'update' | 'delete';
  timestamp: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  error?: string;
  syncId?: string;
  remoteId?: number;
  retries: number;
}

/** Tables dont les lignes sont automatiquement placées en file de synchronisation. */
export const TABLES_SYNC_AUTO = ['products', 'sales', 'stockMovements', 'customers', 'debts', 'debtPayments', 'categories', 'settings', 'cashClosures'] as const;

export type TableSync = (typeof TABLES_SYNC_AUTO)[number];

/** Identifiant de boutique obtenu dans Paramètres, ou généré à la création. */
export interface BoutiqueSyncConfig {
  boutiqueId: string;
  nomBoutique?: string;
}

// Supabase table names
export const SUPABASE_TABLES = {
  settings: 'caisse_settings',
  users: 'caisse_users',
  categories: 'caisse_categories',
  products: 'caisse_products',
  sales: 'caisse_sales',
  stockMovements: 'caisse_stock_movements',
  customers: 'caisse_customers',
  debts: 'caisse_debts',
  debtPayments: 'caisse_debt_payments',
  cashClosures: 'caisse_cash_closures',
} as const;
