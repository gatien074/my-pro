import type { Dette, Vente } from '../db/types';
import { finDeJour } from './dates';

export interface TotauxVente {
  sousTotal: number;
  total: number;
}

/** Sous-total et total d'une vente après remise (bornée à zéro). */
export function calculeTotaux(
  lignes: Array<{ prixUnitaire: number; quantite: number }>,
  remise = 0,
): TotauxVente {
  const sousTotal = lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0);
  const remiseEffective = Math.max(0, Math.round(remise));
  const total = Math.max(0, Math.round(sousTotal - remiseEffective));
  return { sousTotal: Math.round(sousTotal), total };
}

/** Marge brute d'une ligne : profit figé au moment de la vente. */
export function beneficeLigne(l: { prixUnitaire: number; prixAchat: number; quantite: number }): number {
  return (l.prixUnitaire - l.prixAchat) * l.quantite;
}

/** Bénéfice d'une vente : marges des lignes moins la remise. Les ventes annulées comptent pour zéro. */
export function beneficeVente(v: Vente): number {
  if (v.statut !== 'vendue') return 0;
  const brut = v.lignes.reduce((s, l) => s + beneficeLigne(l), 0);
  return brut - v.remise;
}

/** Reste à payer sur une dette. */
export function resteDette(d: Dette): number {
  if (d.statut === 'soldee' || d.statut === 'annulee') return 0;
  return Math.max(0, d.montant - d.montantPaye);
}

/** Statut affiché : distingue « en retard » via l'échéance. */
export function statutVisible(d: Dette): 'en_cours' | 'en_retard' | 'soldee' | 'annulee' {
  if (d.statut === 'soldee' || d.statut === 'annulee') return d.statut;
  if (d.echeance && d.echeance < finDeJour() && resteDette(d) > 0) return 'en_retard';
  return 'en_cours';
}

/** Marge en % entre prix d'achat et prix de vente (null si prix d'achat nul). */
export function margePourcent(prixAchat: number, prixVente: number): number | null {
  if (prixAchat <= 0) return null;
  return Math.round(((prixVente - prixAchat) / prixAchat) * 100);
}
