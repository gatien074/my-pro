import { describe, expect, it } from 'vitest';
import { imageAfficheeProduit, genererImageProduit } from './productImage';

describe('genererImageProduit', () => {
  it('génère une image SVG locale déterministe', () => {
    const a = genererImageProduit({ nom: 'Sardines 125 g', categorie: 'Alimentation' });
    const b = genererImageProduit({ nom: 'Sardines 125 g', categorie: 'Alimentation' });

    expect(a).toBe(b);
    expect(a.startsWith('data:image/svg+xml;utf8,')).toBe(true);
  });

  it('n’affiche jamais une image vide', () => {
    const image = imageAfficheeProduit({ nom: 'Riz 25 kg', imageUrl: '' });
    expect(image).toContain('data:image/svg+xml');
  });

  it('conserve une image déjà enregistrée', () => {
    const image = imageAfficheeProduit({ nom: 'Riz 25 kg', imageUrl: 'https://exemple.test/riz.png' });
    expect(image).toBe('https://exemple.test/riz.png');
  });
});
