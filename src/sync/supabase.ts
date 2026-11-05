import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function configurationSupabaseValide(): boolean {
  return Boolean(url && anonKey && url.startsWith('https://'));
}

let clientSupabase: SupabaseClient | null = null;

export function obtenirSupabase(): SupabaseClient {
  if (!configurationSupabaseValide()) {
    throw new Error('Supabase non configuré : VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants');
  }

  if (!clientSupabase) {
    clientSupabase = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return clientSupabase;
}

/** Nom de table distant pour une table locale Dexie. */
export function tableDistante(table: string): string {
  const mapping: Record<string, string> = {
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
  };
  return mapping[table] ?? table;
}

export function UUID(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
