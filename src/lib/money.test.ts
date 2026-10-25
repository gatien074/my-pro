import { describe, expect, it } from 'vitest';
import { formatFCFA, formatNombre, versMontant } from './money';

describe('formatNombre', () => {
  it('sépare les milliers avec une espace', () => {
    expect(formatNombre(12500)).toBe('12 500');
    expect(formatNombre(1000000)).toBe('1 000 000');
    expect(formatNombre(850)).toBe('850');
    expect(formatNombre(0)).toBe('0');
  });

  it('arrondit les montants (pas de centimes en FCFA)', () => {
    expect(formatNombre(1250.6)).toBe('1 251');
  });
});

describe('formatFCFA', () => {
  it('ajoute l’unité', () => {
    expect(formatFCFA(4000)).toBe('4 000 FCFA');
  });
});

describe('versMontant', () => {
  it('lit les saisies avec ou sans espaces', () => {
    expect(versMontant('12 500')).toBe(12500);
    expect(versMontant('')).toBe(0);
    expect(versMontant('abc')).toBe(0);
    expect(versMontant(2000.9)).toBe(2001);
  });
});
