import { db, TOUTES_TABLES } from './db';
import type { Dette, MouvementStock, Vente } from './types';
import { JOUR_MS, debutDeJour } from '../lib/dates';
import { hacherPin } from '../lib/pin';
import type { ModePaiement } from './types';

/** Générateur pseudo-aléatoire déterministe (données de démo reproductibles). */
function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DefProduit {
  nom: string;
  ci: number; // index catégorie
  unite: string;
  achat: number;
  vente: number;
  stock0: number;
  seuil: number;
  vendable: boolean;
}

const CATEGORIES: Array<[string, string]> = [
  ['Boissons', '#0284c7'],
  ['Alimentation', '#16a34a'],
  ['Épicerie', '#d97706'],
  ['Hygiène & Beauté', '#9333ea'],
  ['Divers', '#64748b'],
];

const PRODUITS: DefProduit[] = [
  { nom: 'Eau minérale 1,5 L', ci: 0, unite: 'bouteille', achat: 250, vente: 500, stock0: 96, seuil: 12, vendable: true },
  { nom: 'Soda cola 33 cL', ci: 0, unite: 'bouteille', achat: 300, vente: 500, stock0: 72, seuil: 15, vendable: true },
  { nom: 'Bière blonde 65 cL', ci: 0, unite: 'bouteille', achat: 700, vente: 1000, stock0: 54, seuil: 12, vendable: true },
  { nom: "Jus d'ananas 1 L", ci: 0, unite: 'brique', achat: 800, vente: 1200, stock0: 30, seuil: 8, vendable: true },
  { nom: 'Thé glacé 33 cL', ci: 0, unite: 'bouteille', achat: 350, vente: 600, stock0: 0, seuil: 6, vendable: false },
  { nom: 'Riz (bol)', ci: 1, unite: 'bol', achat: 300, vente: 400, stock0: 120, seuil: 20, vendable: true },
  { nom: 'Pain', ci: 1, unite: 'pièce', achat: 100, vente: 150, stock0: 60, seuil: 15, vendable: true },
  { nom: 'Huile végétale 1 L', ci: 1, unite: 'bouteille', achat: 1400, vente: 1800, stock0: 40, seuil: 8, vendable: true },
  { nom: 'Sardines 125 g', ci: 2, unite: 'boîte', achat: 350, vente: 500, stock0: 80, seuil: 15, vendable: true },
  { nom: 'Concentré de tomate 70 g', ci: 2, unite: 'boîte', achat: 150, vente: 250, stock0: 96, seuil: 20, vendable: true },
  { nom: 'Sucre en poudre (kg)', ci: 2, unite: 'kg', achat: 600, vente: 750, stock0: 50, seuil: 10, vendable: true },
  { nom: 'Farine de blé (kg)', ci: 2, unite: 'kg', achat: 450, vente: 600, stock0: 42, seuil: 10, vendable: true },
  { nom: 'Lait en poudre 400 g', ci: 2, unite: 'boîte', achat: 2200, vente: 2800, stock0: 24, seuil: 5, vendable: true },
  { nom: 'Pâtes alimentaires 500 g', ci: 2, unite: 'paquet', achat: 300, vente: 450, stock0: 16, seuil: 10, vendable: true },
  { nom: 'Haricots blancs (kg)', ci: 2, unite: 'kg', achat: 900, vente: 1150, stock0: 25, seuil: 6, vendable: true },
  { nom: 'Biscuits (paquet)', ci: 2, unite: 'paquet', achat: 300, vente: 500, stock0: 30, seuil: 8, vendable: true },
  { nom: 'Savon de Marseille 200 g', ci: 3, unite: 'pièce', achat: 200, vente: 350, stock0: 44, seuil: 10, vendable: true },
  { nom: 'Dentifrice', ci: 3, unite: 'tube', achat: 600, vente: 850, stock0: 18, seuil: 5, vendable: true },
  { nom: 'Crème hydratante', ci: 3, unite: 'pot', achat: 1500, vente: 2000, stock0: 3, seuil: 5, vendable: false },
  { nom: 'Shampooing', ci: 3, unite: 'bouteille', achat: 1200, vente: 1600, stock0: 0, seuil: 4, vendable: false },
  { nom: 'Papier hygiénique 4 rouleaux', ci: 3, unite: 'paquet', achat: 480, vente: 650, stock0: 28, seuil: 8, vendable: true },
  { nom: 'Bougies', ci: 4, unite: 'pièce', achat: 150, vente: 300, stock0: 2, seuil: 5, vendable: false },
  { nom: 'Allumettes', ci: 4, unite: 'boîte', achat: 100, vente: 200, stock0: 50, seuil: 10, vendable: true },
  { nom: 'Ampoule LED', ci: 4, unite: 'pièce', achat: 700, vente: 1000, stock0: 12, seuil: 4, vendable: true },
];

const NOM_CAISSIERE = 'Reine Mbeng';

/**
 * Remplit la base avec des données de démonstration réalistes :
 * catalogue, 30 jours de ventes, clients endettés, dettes de l'ancien cahier.
 */
export async function semerDonneesDemo(): Promise<void> {
  const settings = await db.settings.get('app');
  if (!settings) throw new Error('Configurez d’abord la boutique.');

  const users = await db.users.toArray();
  const gerant = users.find((u) => u.role === 'gerant' && u.actif);
  if (!gerant?.id) throw new Error('Aucun gérant actif.');
  const gerantId = gerant.id;
  let reineId: number | undefined = users.find((u) => u.nom === NOM_CAISSIERE)?.id;
  const pinReine = await hacherPin('4321');

  await db.transaction('rw', [...TOUTES_TABLES], async () => {
    if (!reineId) {
      reineId = await db.users.add({ nom: NOM_CAISSIERE, role: 'caissier', pinHash: pinReine, actif: true });
    }

    await db.categories.clear();
    await db.products.clear();
    await db.sales.clear();
    await db.stockMovements.clear();
    await db.customers.clear();
    await db.debts.clear();
    await db.debtPayments.clear();

    const catIds = await db.categories.bulkAdd(
      CATEGORIES.map(([nom, couleur]) => ({ nom, couleur })),
      { allKeys: true },
    ) as number[];

    const produitIds = await db.products.bulkAdd(
      PRODUITS.map((p) => ({
        nom: p.nom,
        categoryId: catIds[p.ci],
        unite: p.unite,
        prixAchat: p.achat,
        prixVente: p.vente,
        stock: p.stock0,
        seuilAlerte: p.seuil,
        actif: true,
        creeLe: Date.now(),
      })),
      { allKeys: true },
    ) as number[];

    const base = debutDeJour();
    const stockInitial = base - 31 * JOUR_MS + 9 * 3_600_000; // 31 jours avant, à 9 h

    // Mouvements d'entrée initiaux (historique réaliste)
    const entrees: MouvementStock[] = PRODUITS.map((p, i) => ({
      produitId: produitIds[i],
      type: 'entree',
      quantite: p.stock0,
      motif: 'Stock initial',
      date: stockInitial,
      userId: gerantId,
    }));
    await db.stockMovements.bulkAdd(entrees);

    const stocks: number[] = [...PRODUITS.map((p) => p.stock0)];
    const rng = mulberry32(202401);
    const poolVendables = PRODUITS.map((p, i) => (p.vendable ? i : -1)).filter((i) => i >= 0);
    let numeroIndex = 0;

    /** Insère une vente complète (lignes figées, stock, mouvements). */
    async function insererVente(
      date: number,
      picks: Array<[number, number]>,
      remise: number,
      mode: ModePaiement,
      montantPaye: number,
      sellerId: number,
      clientId?: number,
      echeance?: number,
    ): Promise<number> {
      const lignes = picks.map(([idx, q]) => ({
        produitId: produitIds[idx],
        nom: PRODUITS[idx].nom,
        unite: PRODUITS[idx].unite,
        prixAchat: PRODUITS[idx].achat,
        prixUnitaire: PRODUITS[idx].vente,
        quantite: q,
      }));
      const sousTotal = lignes.reduce((s, l) => s + l.prixUnitaire * l.quantite, 0);
      const total = sousTotal - remise;
      numeroIndex += 1;
      const vente: Vente = {
        numero: `V-${new Date(date).getFullYear()}-${String(numeroIndex).padStart(4, '0')}`,
        date,
        lignes,
        sousTotal,
        remise,
        total,
        mode,
        montantPaye,
        clientId,
        sellerId,
        statut: 'vendue',
      };
      const venteId = await db.sales.add(vente);
      for (const [idx, q] of picks) {
        stocks[idx] -= q;
        await db.products.update(produitIds[idx], { stock: stocks[idx] });
        await db.stockMovements.add({
          produitId: produitIds[idx],
          type: 'vente',
          quantite: -q,
          date,
          userId: sellerId,
          venteId,
        });
      }
      if (mode === 'credit' && clientId) {
        const dette: Dette = {
          clientId,
          venteId,
          date,
          echeance,
          montant: total,
          montantPaye,
          statut: montantPaye >= total ? 'soldee' : 'en_cours',
        };
        await db.debts.add(dette);
      }
      return venteId;
    }

    // --- Clients de démonstration ---
    const clientIds = await db.customers.bulkAdd(
      [
        { nom: 'Mme Ndong Béatrice', telephone: '+241 06 12 34 56', creeLe: base - 30 * JOUR_MS },
        { nom: 'M. Obame Pascal', telephone: '+241 07 11 22 33', creeLe: base - 12 * JOUR_MS },
        { nom: 'M. Ondo Michel', telephone: '+241 07 55 66 77', creeLe: base - 45 * JOUR_MS },
        { nom: 'Mme Meka Solange', telephone: '+241 06 88 99 00', creeLe: base - 8 * JOUR_MS },
      ],
      { allKeys: true },
    ) as number[];

    // --- Ventes des 30 derniers jours ---
    for (let dAgo = 29; dAgo >= 0; dAgo -= 1) {
      const jourDepart = base - dAgo * JOUR_MS;
      const nbVentes = 2 + Math.floor(rng() * 4);
      for (let k = 0; k < nbVentes; k += 1) {
        const heure = 8 + Math.floor(rng() * 11);
        const date = jourDepart + heure * 3_600_000 + Math.floor(rng() * 3_600_000);
        const nbLignes = 1 + Math.floor(rng() * 4);
        const dispo = [...poolVendables];
        const picks: Array<[number, number]> = [];
        for (let l = 0; l < nbLignes && dispo.length > 0; l += 1) {
          const pos = Math.floor(rng() * dispo.length);
          const idx = dispo.splice(pos, 1)[0];
          let q = rng() < 0.6 ? 1 : rng() < 0.75 ? 2 : 3;
          if (stocks[idx] <= 0) continue;
          if (stocks[idx] < q) q = stocks[idx];
          picks.push([idx, q]);
        }
        if (picks.length === 0) continue;
        const sousTotalCalc = picks.reduce((s, [idx, q]) => s + PRODUITS[idx].vente * q, 0);
        let remise = 0;
        if (rng() < 0.08) {
          remise = [100, 200, 500][Math.floor(rng() * 3)];
          if (remise >= sousTotalCalc) remise = 0;
        }
        const r = rng();
        const roll = r < 0.55 ? 'especes' : r < 0.75 ? 'airtel' : r < 0.9 ? 'moov' : 'especes';
        const total = sousTotalCalc - remise;
        const sellerId = rng() < 0.5 ? gerantId : reineId!;
        await insererVente(
          date,
          picks as Array<[number, number]>,
          remise,
          roll,
          total,
          sellerId,
        );
      }

      // Vente à crédit de démonstration (19 jours avant aujourd'hui)
      if (dAgo === 19) {
        const dateCredit = jourDepart + 9 * 3_600_000;
        const picks: Array<[number, number]> = [];
        const idxHuile = PRODUITS.findIndex((p) => p.nom === 'Huile végétale 1 L');
        const idxLait = PRODUITS.findIndex((p) => p.nom === 'Lait en poudre 400 g');
        const qHuile = Math.min(2, stocks[idxHuile]);
        const qLait = Math.min(4, stocks[idxLait]);
        if (qHuile > 0) picks.push([idxHuile, qHuile]);
        if (qLait > 0) picks.push([idxLait, qLait]);
        if (picks.length > 0) {
          await insererVente(dateCredit, picks, 0, 'credit', 2300, gerantId, clientIds[0], base - 2 * JOUR_MS);
        }
      }
    }

    // Ajustement d'inventaire de démo : les pâtes tombent en dessous du seuil
    const idxPates = PRODUITS.findIndex((p) => p.nom === 'Pâtes alimentaires 500 g');
    const patesId = produitIds[idxPates];
    const stockReelPates = 4;
    await db.products.update(patesId, { stock: stockReelPates });
    await db.stockMovements.add({
      produitId: patesId,
      type: 'ajustement',
      quantite: stockReelPates - stocks[idxPates],
      motif: 'Inventaire surprise — paquets trouvés ouverts',
      date: base - 1 * JOUR_MS + 18 * 3_600_000,
      userId: gerantId,
    });

    // --- Dettes de l'ancien cahier ---
    await db.debts.add({
      clientId: clientIds[2], // M. Ondo Michel
      date: base - 45 * JOUR_MS,
      echeance: base - 5 * JOUR_MS,
      montant: 3800,
      montantPaye: 800,
      statut: 'en_cours',
      motif: 'Dette notée à la main sur le cahier',
    });
    const detteOndo = await db.debts.where('clientId').equals(clientIds[2]).last();
    if (detteOndo?.id) {
      await db.debtPayments.add({
        detteId: detteOndo.id,
        date: base - 20 * JOUR_MS,
        montant: 800,
        mode: 'especes',
        note: 'Remboursement au comptoir',
        userId: reineId,
      });
    }

    await db.debts.add({
      clientId: clientIds[1], // M. Obame Pascal
      date: base - 12 * JOUR_MS,
      echeance: base + 10 * JOUR_MS,
      montant: 5000,
      montantPaye: 0,
      statut: 'en_cours',
      motif: 'Dette du cahier — 2 sacs de riz reportés',
    });

    await db.settings.update('app', { modeDemo: true });
  });
}
