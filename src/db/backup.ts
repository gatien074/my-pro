import { db, TOUTES_TABLES } from './db';
import { telechargerFichier } from '../lib/helpers';

const TABLES_SAUVEGARDEES = [
  'settings',
  'users',
  'categories',
  'products',
  'sales',
  'stockMovements',
  'customers',
  'debts',
  'debtPayments',
] as const;

/** Tables ajoutées après la v1 : absentes des anciennes sauvegardes, tolérées à l'import. */
const TABLES_OPTIONNELLES = ['cashClosures'] as const;

export interface DonneesSauvegarde {
  version: number;
  application: 'caisse-stock-gabon';
  dateSauvegarde: number;
  tables: {
    settings: unknown[];
    users: unknown[];
    categories: unknown[];
    products: unknown[];
    sales: unknown[];
    stockMovements: unknown[];
    customers: unknown[];
    debts: unknown[];
    debtPayments: unknown[];
    cashClosures: unknown[];
  };
}

/** Exporte toutes les données de l'application sous forme de JSON. */
export async function exporterDonnees(): Promise<string> {
  const tables: DonneesSauvegarde['tables'] = {
    settings: await db.settings.toArray(),
    users: await db.users.toArray(),
    categories: await db.categories.toArray(),
    products: await db.products.toArray(),
    sales: await db.sales.toArray(),
    stockMovements: await db.stockMovements.toArray(),
    customers: await db.customers.toArray(),
    debts: await db.debts.toArray(),
    debtPayments: await db.debtPayments.toArray(),
    cashClosures: await db.cashClosures.toArray(),
  };
  const donnees: DonneesSauvegarde = {
    version: 2,
    application: 'caisse-stock-gabon',
    dateSauvegarde: Date.now(),
    tables,
  };
  return JSON.stringify(donnees, null, 2);
}

/** Télécharge la sauvegarde au format .json. */
export async function telechargerSauvegarde(): Promise<void> {
  const contenu = await exporterDonnees();
  const d = new Date();
  const prefixe = `sauvegarde-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  telechargerFichier(`${prefixe}.json`, contenu, 'application/json');
}

/** Récupère un objet File en texte (champ d'import). */
export function lireFichierTexte(file: File): Promise<string> {
  return new Promise((resoudre, rejeter) => {
    const fr = new FileReader();
    fr.onload = () => resoudre(String(fr.result));
    fr.onerror = () => rejeter(fr.error);
    fr.readAsText(file);
  });
}

/** Analyse et valide une sauvegarde. */
export function analyserSauvegarde(texte: string): DonneesSauvegarde {
  let data: unknown;
  try {
    data = JSON.parse(texte);
  } catch {
    throw new Error('Fichier illisible : ce n’est pas un JSON valide.');
  }
  if (typeof data !== 'object' || data === null) throw new Error('Sauvegarde invalide.');
  const d = data as Record<string, unknown>;
  if (d.application !== 'caisse-stock-gabon' || typeof d.tables !== 'object' || d.tables === null) {
    throw new Error('Ce fichier n’est pas une sauvegarde de cette application.');
  }
  const tables = d.tables as Record<string, unknown>;
  for (const t of TABLES_SAUVEGARDEES) {
    if (!Array.isArray(tables[t])) throw new Error(`Sauvegarde incomplète (table « ${t} »).`);
  }
  return d as unknown as DonneesSauvegarde;
}

/** Remplace toutes les données actuelles par le contenu de la sauvegarde. */
export async function restaurerDonnees(sauvegarde: DonneesSauvegarde): Promise<void> {
  await db.transaction('rw', [...TOUTES_TABLES], async () => {
    for (const t of [...TABLES_SAUVEGARDEES, ...TABLES_OPTIONNELLES]) {
      const table = db.table(t);
      await table.clear();
      const lignes = (sauvegarde.tables as Record<string, unknown[] | undefined>)[t] ?? [];
      await table.bulkAdd(lignes as never[]);
    }
  });
}

/** Réinitialise l'application : retour à l'assistant de première utilisation. */
export async function toutEffacer(): Promise<void> {
  await Promise.all(TOUTES_TABLES.map((t) => t.clear()));
}
