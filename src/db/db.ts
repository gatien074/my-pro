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
    this.version(2)
      .stores({
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
      })
      .upgrade((tx) => {
        // Migration vide si nécessaire
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
  // Tentative de réinitialisation si erreur de schéma
  if (err.name === 'UpgradeError' || err.name === 'SchemaError' || err.name === 'VersionError') {
    console.warn('Tentative de suppression et recréation de la base...');
    db.delete()
      .then(() => db.open())
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
] as const;
