import { describe, expect, it } from 'vitest';
import { beneficeLigne, beneficeVente, calculeTotaux, resteDette, statutVisible } from './calc';
import type { Dette, Vente } from '../db/types';
import { debutDeJour, JOUR_MS } from './dates';

describe('calculeTotaux', () => {
  it('calcule le sous-total', () => {
    const t = calculeTotaux(
      [
        { prixUnitaire: 500, quantite: 3 },
        { prixUnitaire: 1200, quantite: 1 },
      ],
      0,
    );
    expect(t.sousTotal).toBe(2700);
    expect(t.total).toBe(2700);
  });

  it('soustrait la remise sans aller sous zéro', () => {
    const t = calculeTotaux([{ prixUnitaire: 500, quantite: 1 }], 800);
    expect(t.total).toBe(0);
  });

  it('accepte des remises négatives sans effet', () => {
    const t = calculeTotaux([{ prixUnitaire: 500, quantite: 1 }], -100);
    expect(t.total).toBe(500);
  });
});

describe('benefice', () => {
  it('calcule la marge figée d’une ligne', () => {
    expect(beneficeLigne({ prixUnitaire: 750, prixAchat: 500, quantite: 3 })).toBe(750);
  });

  it('lève la remise sur le bénéfice de la vente', () => {
    const vente = {
      statut: 'vendue',
      remise: 200,
      lignes: [
        { prixUnitaire: 750, prixAchat: 500, quantite: 3 },
        { prixUnitaire: 1500, prixAchat: 1400, quantite: 1 },
      ],
    } as unknown as Vente;
    expect(beneficeVente(vente)).toBe(750 + 100 - 200);
  });

  it('une vente annulée ne rapporte rien', () => {
    const vente = { statut: 'annulee', remise: 0, lignes: [{ prixUnitaire: 1000, prixAchat: 100, quantite: 10 }] } as unknown as Vente;
    expect(beneficeVente(vente)).toBe(0);
  });
});

describe('dettes', () => {
  it('calcule le reste à payer', () => {
    const d = { montant: 14800, montantPaye: 2300, statut: 'en_cours' } as unknown as Dette;
    expect(resteDette(d)).toBe(12500);
  });

  it('dette soldée : reste zéro', () => {
    const d = { montant: 5000, montantPaye: 6000, statut: 'soldee' } as unknown as Dette;
    expect(resteDette(d)).toBe(0);
  });

  it('signale le retard à partir de l’échéance', () => {
    const hier = debutDeJour(Date.now() - JOUR_MS);
    const demain = debutDeJour(Date.now() + JOUR_MS);
    const enRetard = { montant: 3800, montantPaye: 800, statut: 'en_cours', echeance: hier } as unknown as Dette;
    const aTemps = { montant: 5000, montantPaye: 0, statut: 'en_cours', echeance: demain } as unknown as Dette;
    expect(statutVisible(enRetard)).toBe('en_retard');
    expect(statutVisible(aTemps)).toBe('en_cours');
  });

  it('soldée ne devient jamais en retard', () => {
    const d = { montant: 1000, montantPaye: 1000, statut: 'soldee', echeance: debutDeJour(Date.now() - 10 * JOUR_MS) } as unknown as Dette;
    expect(statutVisible(d)).toBe('soldee');
  });
});
