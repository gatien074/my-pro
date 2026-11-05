import { describe, expect, it } from 'vitest';
import { versSupabase, depuisSupabase } from './mapper';

describe('versSupabase', () => {
  it('convertit camelCase vers snake_case et conserve boutique_id', () => {
    const sortie = versSupabase('products', { syncId: 'abc', boutiqueId: 'boutique-1', nom: 'Riz', categorySyncId: 'cat-1' }, 'boutique-1');

    expect(sortie.sync_id).toBe('abc');
    expect(sortie.boutique_id).toBe('boutique-1');
    expect(sortie.category_sync_id).toBe('cat-1');
    expect(sortie.id).toBeUndefined();
  });
});

describe('depuisSupabase', () => {
  it('convertit snake_case vers camelCase', () => {
    const { objetLocal } = depuisSupabase('products', { sync_id: 'abc', boutique_id: 'boutique-1', category_sync_id: 'cat-1', nom: 'Riz' }, new Map());

    expect(objetLocal.syncId).toBe('abc');
    expect(objetLocal.categorySyncId).toBe('cat-1');
    expect(objetLocal.nom).toBe('Riz');
    expect(objetLocal.boutique_id).toBeUndefined();
  });

  it('résout categorySyncId en categoryId via le mapping', () => {
    const mapping = new Map([['categories:cat-1', 7]]);
    const { objetLocal } = depuisSupabase('products', { sync_id: 'abc', boutique_id: 'boutique-1', category_sync_id: 'cat-1' }, mapping);

    expect(objetLocal.categoryId).toBe(7);
  });

  it('résout les lignes de vente produitSyncId', () => {
    const mapping = new Map([['products:prod-1', 42]]);
    const { objetLocal } = depuisSupabase(
      'sales',
      { sync_id: 'vente-1', boutique_id: 'boutique-1', lignes: [{ produit_sync_id: 'prod-1', produitId: 999 }] },
      mapping,
    );

    const lignes = objetLocal.lignes as Array<{ produitId: number }>;
    expect(lignes[0].produitId).toBe(42);
  });
});
