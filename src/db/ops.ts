import { db, TOUTES_TABLES } from './db';
import type {
  Category,
  Client,
  ClotureCaisse,
  Dette,
  ModePaiement,
  MouvementStock,
  Settings,
  TypeMouvement,
  User,
} from './types';
import { calculeTotaux } from '../lib/calc';
import { debutAnnee, debutDeJour, finDeJour } from '../lib/dates';
import { hacherPin } from '../lib/pin';

/* ---------------------------------- Settings --------------------------------- */

export async function lireSettings(): Promise<Settings | undefined> {
  return db.settings.get('app');
}

export async function majSettings(modifs: Partial<Omit<Settings, 'id' | 'creeLe'>>): Promise<void> {
  await db.settings.update('app', modifs);
}

export interface DonneesCreationBoutique {
  nomBoutique: string;
  nomGerant: string;
  pin: string;
}

/** Crée la configuration et le compte gérant (première utilisation). */
export async function creerBoutique(d: DonneesCreationBoutique): Promise<number> {
  const pinHash = await hacherPin(d.pin);
  const settings: Settings = {
    id: 'app',
    nomBoutique: d.nomBoutique,
    devise: 'FCFA',
    tvaTaux: 0,
    piedTicket: 'Merci de votre visite !',
    seuilAlerteDefaut: 5,
    autoriserStockNegatif: false,
    modeDemo: false,
    creeLe: Date.now(),
  };
  const user: User = { nom: d.nomGerant.trim(), role: 'gerant', pinHash, actif: true };
  const id = await db.users.add(user);
  await db.settings.put(settings);
  return id;
}

/* ---------------------------------- Produits --------------------------------- */

export interface InputProduit {
  nom: string;
  codeBarres?: string;
  categoryId?: number;
  unite: string;
  prixAchat: number;
  prixVente: number;
  stock?: number;
  seuilAlerte: number;
}

export async function enregistrerProduit(input: InputProduit, id?: number, userId?: number): Promise<number> {
  const nom = input.nom.trim();
  if (!nom) throw new Error('Le nom du produit est obligatoire.');
  if (input.prixAchat < 0 || input.prixVente < 0) throw new Error('Les prix ne peuvent pas être négatifs.');
  if (input.seuilAlerte < 0) throw new Error('Le seuil d’alerte ne peut pas être négatif.');
  const cb = input.codeBarres?.trim() || undefined;
  if (cb) {
    const q = await db.products.where('codeBarres').equals(cb).filter((x) => x.id !== id).count();
    if (q > 0) throw new Error('Ce code-barres est déjà utilisé par un autre produit.');
  }
  return db.transaction('rw', [db.products, db.stockMovements], async () => {
    if (id) {
      const existant = await db.products.get(id);
      if (!existant) throw new Error('Produit introuvable.');
      await db.products.update(id, { nom, codeBarres: cb, categoryId: input.categoryId, unite: input.unite, prixAchat: input.prixAchat, prixVente: input.prixVente, seuilAlerte: input.seuilAlerte });

      // Une correction du stock depuis la fiche crée un mouvement d'inventaire tracé.
      if (input.stock != null) {
        const nouveauStock = Math.max(0, Math.round(input.stock));
        if (nouveauStock !== existant.stock) {
          await db.products.update(id, { stock: nouveauStock });
          await db.stockMovements.add({
            produitId: id,
            type: 'ajustement',
            quantite: nouveauStock - existant.stock,
            motif: 'Correction depuis la fiche produit',
            date: Date.now(),
            userId,
          });
        }
      }
      return id;
    }

    const stockInitial = Math.max(0, Math.round(input.stock ?? 0));
    const idCree = await db.products.add({
      nom,
      codeBarres: cb,
      categoryId: input.categoryId,
      unite: input.unite,
      prixAchat: input.prixAchat,
      prixVente: input.prixVente,
      stock: stockInitial,
      seuilAlerte: Math.round(input.seuilAlerte),
      actif: true,
      creeLe: Date.now(),
    });
    if (stockInitial > 0) {
      await db.stockMovements.add({
        produitId: idCree,
        type: 'entree',
        quantite: stockInitial,
        motif: 'Stock initial',
        date: Date.now(),
        userId,
      });
    }
    return idCree;
  });
}

export async function basculerProduitActif(id: number, actif: boolean): Promise<void> {
  await db.products.update(id, { actif });
}

/* ------------------------------- Mouvements de stock ------------------------------- */

export interface InputMouvement {
  action: 'entree' | 'perte' | 'ajustement';
  produitId: number;
  quantite?: number;
  stockReel?: number;
  motif?: string;
  userId?: number;
}

/** Entrée de stock, perte ou ajustement d'inventaire. */
export async function enregistrerMouvementStock(input: InputMouvement): Promise<void> {
  await db.transaction('rw', [db.products, db.stockMovements], async () => {
    const p = await db.products.get(input.produitId);
    if (!p) throw new Error('Produit introuvable.');
    let delta = 0;
    let motif = input.motif?.trim() || undefined;
    if (input.action === 'entree') {
      const q = Math.round(input.quantite ?? 0);
      if (q <= 0) throw new Error('La quantité doit être supérieure à zéro.');
      delta = q;
      motif = motif || 'Réapprovisionnement';
    } else if (input.action === 'perte') {
      const q = Math.round(input.quantite ?? 0);
      if (q <= 0) throw new Error('La quantité doit être supérieure à zéro.');
      if (q > p.stock) throw new Error('Quantité supérieure au stock actuel.');
      if (!motif) throw new Error('Un motif est obligatoire pour une perte.');
      delta = -q;
    } else {
      const stockReel = Math.round(input.stockReel ?? 0);
      delta = stockReel - p.stock;
      if (!motif) motif = 'Inventaire';
      if (delta === 0) throw new Error('Aucun écart : le stock enregistré correspond déjà.');
    }
    await db.products.update(input.produitId, { stock: p.stock + delta });
    const mv: MouvementStock = {
      produitId: input.produitId,
      type: input.action,
      quantite: delta,
      motif,
      date: Date.now(),
      userId: input.userId,
    };
    await db.stockMovements.add(mv);
  });
}

/* ------------------------------------ Clients ----------------------------------- */

export async function enregistrerClient(input: { nom: string; telephone?: string; note?: string }): Promise<number> {
  const nom = input.nom.trim();
  if (!nom) throw new Error('Le nom du client est obligatoire.');
  const client: Client = { nom, telephone: input.telephone?.trim() || undefined, note: input.note?.trim() || undefined, creeLe: Date.now() };
  return db.customers.add(client);
}

/* ------------------------------------- Ventes ------------------------------------ */

export interface LigneSaisie {
  produitId: number;
  quantite: number;
  prixUnitaire: number;
}

export interface EntreeVente {
  lignes: LigneSaisie[];
  remise?: number;
  mode: ModePaiement;
  montantRecu?: number;
  clientId?: number;
  acompte?: number;
  echeance?: number;
  date?: number;
  vendeurId?: number;
}

/** Enregistre une vente : lignes figées, stock décrémenté, mouvements et éventuelle dette. */
export async function creerVente(e: EntreeVente): Promise<number> {
  if (e.lignes.length === 0) throw new Error('Le panier est vide.');
  const settings = await lireSettings();
  if (!settings) throw new Error('Application non configurée.');

  const { sousTotal, total } = calculeTotaux(e.lignes, e.remise ?? 0);
  if (total <= 0) throw new Error('Le montant de la vente doit être supérieur à zéro.');

  let montantPaye = total;
  if (e.mode === 'credit') {
    if (!e.clientId) throw new Error('Un client est obligatoire pour une vente à crédit.');
    const acompte = Math.max(0, Math.round(e.acompte ?? 0));
    if (acompte > total) throw new Error('L’acompte ne peut pas dépasser le total.');
    montantPaye = acompte;
  } else if (e.mode === 'especes') {
    const recu = Math.round(e.montantRecu ?? 0);
    if (recu < total) throw new Error('Le montant reçu est insuffisant.');
    montantPaye = total;
  }

  // Cumul des quantités par produit (le panier ne devrait pas dupliquer, on est prudent).
  const quantites = new Map<number, number>();
  for (const l of e.lignes) {
    quantites.set(l.produitId, (quantites.get(l.produitId) ?? 0) + l.quantite);
  }

  const date = e.date ?? Date.now();
  const annee = new Date(date).getFullYear();
  const periode = [debutAnnee(date), finDeJour(new Date(annee, 11, 31).getTime())] as const;

  return db.transaction('rw', [...TOUTES_TABLES], async () => {
    // Validation du stock
    if (!settings.autoriserStockNegatif) {
      const produits = await db.products.bulkGet([...quantites.keys()]);
      for (const p of produits) {
        if (!p) continue;
        const besoin = quantites.get(p.id!)!;
        if (p.stock < besoin) {
          throw new Error(`Stock insuffisant : ${p.nom} (disponible : ${p.stock}).`);
        }
      }
    }

    // Numérotation annuelle
    const nb = await db.sales.where('date').between(periode[0], periode[1]).count();
    const numero = `V-${annee}-${String(nb + 1).padStart(4, '0')}`;

    const lignesFinales = [];
    for (const l of e.lignes) {
      const p = await db.products.get(l.produitId);
      if (!p) throw new Error('Produit introuvable dans le panier.');
      lignesFinales.push({
        produitId: l.produitId,
        nom: p.nom,
        unite: p.unite,
        prixAchat: p.prixAchat,
        prixUnitaire: l.prixUnitaire,
        quantite: l.quantite,
      });
      await db.products.update(l.produitId, { stock: p.stock - l.quantite });
      await db.stockMovements.add({
        produitId: l.produitId,
        type: 'vente',
        quantite: -l.quantite,
        motif: undefined,
        date,
        userId: e.vendeurId,
      });
    }

    const venteId = await db.sales.add({
      numero,
      date,
      lignes: lignesFinales,
      sousTotal,
      remise: Math.max(0, Math.round(e.remise ?? 0)),
      total,
      mode: e.mode,
      montantPaye,
      clientId: e.clientId,
      sellerId: e.vendeurId,
      statut: 'vendue',
    });

    if (e.mode === 'credit') {
      const dette: Dette = {
        clientId: e.clientId!,
        venteId,
        date,
        echeance: e.echeance,
        montant: total,
        montantPaye,
        statut: montantPaye >= total ? 'soldee' : 'en_cours',
      };
      const detteId = await db.debts.add(dette);
      // L'acompte versé à la vente est consigné comme paiement (traçabilité de la dette).
      if (montantPaye > 0) {
        await db.debtPayments.add({
          detteId,
          date,
          montant: montantPaye,
          mode: 'especes',
          note: 'Acompte versé à la vente',
          userId: e.vendeurId,
          aLaVente: true,
        });
      }
    }

    return venteId;
  });
}

/**
 * Annule une vente (traçable) : statut passé à « annulée », stock restitué,
 * dette liée annulée. `userId` permet de savoir qui a annulé.
 */
export async function annulerVente(venteId: number, userId?: number): Promise<void> {
  await db.transaction('rw', [...TOUTES_TABLES], async () => {
    const v = await db.sales.get(venteId);
    if (!v) throw new Error('Vente introuvable.');
    if (v.statut === 'annulee') throw new Error('Cette vente est déjà annulée.');

    if (v.clientId) {
      const dette = await db.debts.where('venteId').equals(venteId).first();
      if (dette && dette.statut !== 'annulee') {
        const paiements = await db.debtPayments.where('detteId').equals(dette.id!).count();
        if (paiements > 0) {
          throw new Error('Impossible d’annuler : des remboursements ont déjà été encaissés sur la dette liée. Remboursez le client d’abord.');
        }
        await db.debts.update(dette.id!, { statut: 'annulee' });
      }
    }

    const date = Date.now();
    for (const l of v.lignes) {
      const p = await db.products.get(l.produitId);
      if (!p) continue;
      await db.products.update(l.produitId, { stock: p.stock + l.quantite });
      await db.stockMovements.add({
        produitId: l.produitId,
        type: 'annulation',
        quantite: l.quantite,
        motif: `Annulation vente ${v.numero}`,
        date,
        userId,
      });
    }
    await db.sales.update(venteId, { statut: 'annulee' });
  });
}

/* ------------------------------------- Dettes ------------------------------------ */

export async function encaisserDette(detteId: number, input: { montant: number; mode: Extract<ModePaiement, 'especes' | 'airtel' | 'moov'>; note?: string; userId?: number }): Promise<void> {
  await db.transaction('rw', [db.debts, db.debtPayments], async () => {
    const d = await db.debts.get(detteId);
    if (!d) throw new Error('Dette introuvable.');
    if (d.statut !== 'en_cours') throw new Error('Cette dette n’est plus active.');
    const montant = Math.round(input.montant);
    const reste = d.montant - d.montantPaye;
    if (montant <= 0) throw new Error('Le montant doit être supérieur à zéro.');
    if (montant > reste) throw new Error(`Montant supérieur au reste à payer (${reste} FCFA).`);
    await db.debtPayments.add({
      detteId,
      date: Date.now(),
      montant,
      mode: input.mode,
      note: input.note?.trim() || undefined,
      userId: input.userId,
    });
    const nouveauPaye = d.montantPaye + montant;
    await db.debts.update(detteId, {
      montantPaye: nouveauPaye,
      statut: nouveauPaye >= d.montant ? 'soldee' : 'en_cours',
    });
  });
}

/** Dette de l'ancien cahier (sans vente associée). */
export async function creerDetteManuelle(input: { clientId: number; montant: number; motif?: string; echeance?: number; date?: number }): Promise<void> {
  const montant = Math.round(input.montant);
  if (montant <= 0) throw new Error('Le montant doit être supérieur à zéro.');
  await db.debts.add({
    clientId: input.clientId,
    date: input.date ?? Date.now(),
    echeance: input.echeance,
    montant,
    montantPaye: 0,
    statut: 'en_cours',
    motif: input.motif?.trim() || 'Dette existante',
  });
}

/* ---------------------------------- Utilisateurs ---------------------------------- */

export async function creerUtilisateur(input: { nom: string; role: User['role']; pin: string }): Promise<number> {
  const nom = input.nom.trim();
  if (!nom) throw new Error('Le nom est obligatoire.');
  const pinHash = await hacherPin(input.pin);
  return db.users.add({ nom, role: input.role, pinHash, actif: true });
}

export async function redefinirPin(userId: number, pin: string): Promise<void> {
  const pinHash = await hacherPin(pin);
  await db.users.update(userId, { pinHash });
}

export async function majUtilisateur(userId: number, modifs: Partial<Omit<User, 'id' | 'pinHash'>>): Promise<void> {
  if (modifs.actif === false || (modifs.role && modifs.role !== 'gerant')) {
    const actifs = await db.users.where('role').equals('gerant').toArray();
    const cible = await db.users.get(userId);
    const autres = actifs.filter((u) => u.id !== userId && u.actif);
    if (cible?.role === 'gerant' && autres.length === 0 && (modifs.actif === false || modifs.role === 'caissier')) {
      throw new Error('Il doit rester au moins un gérant actif.');
    }
  }
  const { ...reste } = modifs;
  await db.users.update(userId, reste);
}

/* ------------------------------------ Catégories ------------------------------------ */

export async function ajouterCategorie(nom: string, couleur?: string): Promise<number> {
  const n = nom.trim();
  if (!n) throw new Error('Le nom de la catégorie est obligatoire.');
  const existe = await db.categories.where('nom').equals(n).count();
  if (existe > 0) throw new Error('Cette catégorie existe déjà.');
  const cat: Category = { nom: n, couleur };
  return db.categories.add(cat);
}

export async function supprimerCategorie(categoryId: number): Promise<void> {
  const nb = await db.products.where('categoryId').equals(categoryId).count();
  if (nb > 0) throw new Error('Impossible : des produits utilisent cette catégorie.');
  await db.categories.delete(categoryId);
}

/* -------------------------------- Accès en lecture -------------------------------- */

export function libelleMouvement(type: TypeMouvement): string {
  const map: Record<TypeMouvement, string> = {
    vente: 'Vente',
    annulation: 'Annulation',
    entree: 'Entrée',
    perte: 'Perte',
    ajustement: 'Ajustement',
  };
  return map[type];
}
