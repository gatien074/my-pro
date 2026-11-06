import { db, TOUTES_TABLES } from './db';
import type {
  Category,
  Client,
  Dette,
  ModePaiement,
  MouvementStock,
  PaiementDette,
  Produit,
  Settings,
  TypeMouvement,
  User,
} from './types';
import { calculeTotaux } from '../lib/calc';
import { debutAnnee, finDeJour } from '../lib/dates';
import { hacherPin, pinValide } from '../lib/pin';
import { UUID } from '../sync/supabase';

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
  caissier?: { nom: string; pin: string };
}

/** Catégories par défaut pour qu'une boutique créée manuellement ait déjà une liste exploitable. */
const CATEGORIES_PAR_DEFAUT: Array<{ nom: string; couleur?: string }> = [
  { nom: 'Alimentation', couleur: '#1e6b47' },
  { nom: 'Boissons', couleur: '#276fba' },
  { nom: 'Hygiène', couleur: '#d3940f' },
  { nom: 'Maison & électricité', couleur: '#8b5a09' },
  { nom: 'Divers', couleur: '#717d74' },
];

/** Crée la configuration et le compte gérant (première utilisation). */
export async function creerBoutique(d: DonneesCreationBoutique): Promise<number> {
  const pinHash = await hacherPin(d.pin);
  const boutiqueId = UUID();
  const settings: Settings = {
    id: 'app',
    nomBoutique: d.nomBoutique,
    devise: 'FCFA',
    tvaTaux: 0,
    piedTicket: 'Merci de votre visite !',
    seuilAlerteDefaut: 5,
    autoriserStockNegatif: false,
    verrouillageAuto: true,
    creeLe: Date.now(),
    syncId: boutiqueId,
    boutiqueId,
    updatedAt: Date.now(),
  };
  let id = 0;
  await db.transaction('rw', [db.users, db.settings, db.categories], async () => {
    const user: User = {
      nom: d.nomGerant.trim(),
      role: 'gerant',
      pinHash,
      actif: true,
      boutiqueId,
      syncId: UUID(),
      updatedAt: Date.now(),
    };
    id = await db.users.add(user);
    await db.settings.put(settings);

    if ((await db.categories.count()) === 0) {
      await db.categories.bulkAdd(
        CATEGORIES_PAR_DEFAUT.map((c) => ({
          ...c,
          boutiqueId,
          syncId: UUID(),
          updatedAt: Date.now(),
        })),
      );
    }

    // Caissier créé en même temps que la boutique (facultatif, modifiable ensuite dans Paramètres).
    const nomCaissier = d.caissier?.nom.trim() ?? '';
    if (nomCaissier) {
      if (!pinValide(d.caissier!.pin)) throw new Error('Le PIN du caissier doit contenir 4 chiffres.');
      const pinCaissier = await hacherPin(d.caissier!.pin);
      await db.users.add({
        nom: nomCaissier,
        role: 'caissier',
        pinHash: pinCaissier,
        actif: true,
        boutiqueId,
        gerantId: id,
        syncId: UUID(),
        updatedAt: Date.now(),
      });
    }
  });

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
  imageUrl?: string;
}

export async function enregistrerProduit(input: InputProduit, id?: number, userId?: number): Promise<number> {
  await db.open(); // S'assurer que Dexie et tous les stores sont ouverts
  const nom = input.nom.trim();
  if (!nom) throw new Error('Le nom du produit est obligatoire.');
  if (input.prixAchat < 0 || input.prixVente < 0) throw new Error('Les prix ne peuvent pas être négatifs.');
  if (input.seuilAlerte < 0) throw new Error('Le seuil d’alerte ne peut pas être négatif.');
  const cb = input.codeBarres?.trim() || undefined;
  if (cb) {
    const q = await db.products.where('codeBarres').equals(cb).filter((x) => x.id !== id).count();
    if (q > 0) throw new Error('Ce code-barres est déjà utilisé par un autre produit.');
  }
  const settings = (await lireSettings()) ?? undefined;
  const boutiqueId = settings?.boutiqueId ?? settings?.syncId ?? UUID();

  let idCree: number;
  if (id) {
    const existant = await db.products.get(id);
    if (!existant) throw new Error('Produit introuvable.');
    const imageUrl = input.imageUrl?.trim();
    const patch: Partial<import('./types').Produit> = {
      nom,
      codeBarres: cb,
      categoryId: input.categoryId,
      unite: input.unite,
      prixAchat: input.prixAchat,
      prixVente: input.prixVente,
      seuilAlerte: input.seuilAlerte,
      boutiqueId: existant.boutiqueId ?? boutiqueId,
      updatedAt: Date.now(),
      syncId: existant.syncId ?? UUID(),
    };
    if (imageUrl) patch.imageUrl = imageUrl;
    await db.products.update(id, patch);

    // Une correction du stock depuis la fiche crée un mouvement d'inventaire tracé.
    if (input.stock != null) {
      const nouveauStock = Math.max(0, Math.round(input.stock));
      if (nouveauStock !== existant.stock) {
        await db.products.update(id, { stock: nouveauStock, updatedAt: Date.now() });
        await db.stockMovements.add({
          produitId: id,
          type: 'ajustement',
          quantite: nouveauStock - existant.stock,
          motif: 'Correction depuis la fiche produit',
          date: Date.now(),
          userId,
          boutiqueId,
          updatedAt: Date.now(),
        });
      }
    }
    idCree = id;
  } else {
    const stockInitial = Math.max(0, Math.round(input.stock ?? 0));
    idCree = await db.products.add({
      nom,
      codeBarres: cb,
      categoryId: input.categoryId,
      unite: input.unite,
      prixAchat: input.prixAchat,
      prixVente: input.prixVente,
      stock: stockInitial,
      seuilAlerte: Math.round(input.seuilAlerte),
      actif: true,
      imageUrl: input.imageUrl,
      creeLe: Date.now(),
      boutiqueId,
      updatedAt: Date.now(),
    });
    if (stockInitial > 0) {
      await db.stockMovements.add({
        produitId: idCree,
        type: 'entree',
        quantite: stockInitial,
        motif: 'Stock initial',
        date: Date.now(),
        userId,
        boutiqueId,
        updatedAt: Date.now(),
      });
    }
  }

  // Enfile en arrière-plan pour synchronisation (ne bloque jamais l'UI).
  void import('../sync/service')
    .then(({ enfiler }) => enfiler('products', { id: idCree, ...input, boutiqueId, updatedAt: Date.now() }, id ? 'update' : 'insert'))
    .catch(() => undefined);

  return idCree;
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
  await db.open(); // S'assurer que Dexie et tous les stores sont ouverts
  const settings = await lireSettings();
  const boutiqueId = settings?.boutiqueId ?? settings?.syncId ?? UUID();
  const resultat = await db.transaction('rw', [db.products, db.stockMovements], async () => {
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
    await db.products.update(input.produitId, { stock: p.stock + delta, updatedAt: Date.now() });
    const mv: MouvementStock = {
      produitId: input.produitId,
      produitSyncId: p.syncId,
      type: input.action,
      quantite: delta,
      motif,
      date: Date.now(),
      userId: input.userId,
      syncId: UUID(),
      boutiqueId,
      updatedAt: Date.now(),
    };
    const idMouvement = await db.stockMovements.add(mv);
    const produitMaj = await db.products.get(input.produitId);
    return { idMouvement, produit: produitMaj, mouvement: (await db.stockMovements.get(idMouvement)) ?? mv };
  });

  void import('../sync/service').then(({ enfiler }) => {
    if (resultat.produit) void enfiler('products', resultat.produit as unknown as Record<string, unknown>, 'update');
    if (resultat.mouvement) void enfiler('stockMovements', resultat.mouvement as unknown as Record<string, unknown>, 'insert');
  });
}

/* ------------------------------------ Clients ----------------------------------- */

export async function enregistrerClient(input: { nom: string; telephone?: string; note?: string }): Promise<number> {
  await db.open();
  const nom = input.nom.trim();
  if (!nom) throw new Error('Le nom du client est obligatoire.');
  const settings = await lireSettings();
  const boutiqueId = settings?.boutiqueId ?? settings?.syncId ?? UUID();
  const client: Client = {
    nom,
    telephone: input.telephone?.trim() || undefined,
    note: input.note?.trim() || undefined,
    creeLe: Date.now(),
    syncId: UUID(),
    boutiqueId,
    updatedAt: Date.now(),
  };
  const id = await db.customers.add(client);
  void import('../sync/service').then(({ enfiler }) => {
    void enfiler('customers', { ...client, id } as unknown as Record<string, unknown>, 'insert');
  });
  return id;
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

  const boutiqueId = settings.boutiqueId ?? settings.syncId ?? UUID();
  const resultat = await db.transaction('rw', [...TOUTES_TABLES], async () => {
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
    const nb = await db.sales.where('date').between(periode[0], periode[1]).and((v) => v.statut === 'vendue').count();
    const numero = `V-${annee}-${String(nb + 1).padStart(4, '0')}`;

    const lignesFinales = [];
    const mouvementsCrees: MouvementStock[] = [];
    const produitsMaj: Produit[] = [];
    for (const l of e.lignes) {
      const p = await db.products.get(l.produitId);
      if (!p) throw new Error('Produit introuvable dans le panier.');
      lignesFinales.push({
        produitId: l.produitId,
        produitSyncId: p.syncId ?? UUID(),
        nom: p.nom,
        unite: p.unite,
        prixAchat: p.prixAchat,
        prixUnitaire: l.prixUnitaire,
        quantite: l.quantite,
      });
      await db.products.update(l.produitId, { stock: p.stock - l.quantite, updatedAt: Date.now() });
      const produitMaj = await db.products.get(l.produitId);
      if (produitMaj) produitsMaj.push(produitMaj);
      const mv: MouvementStock = {
        produitId: l.produitId,
        produitSyncId: p.syncId ?? UUID(),
        type: 'vente',
        quantite: -l.quantite,
        motif: undefined,
        date,
        userId: e.vendeurId,
        syncId: UUID(),
        boutiqueId,
        updatedAt: Date.now(),
      };
      const idMv = await db.stockMovements.add(mv);
      mouvementsCrees.push({ ...mv, id: idMv });
    }

    const syncIdVente = UUID();
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
      syncId: syncIdVente,
      boutiqueId,
      updatedAt: Date.now(),
    });

    const venteCree = await db.sales.get(venteId);
    let detteCree: Dette | undefined;
    let paiementCree: PaiementDette | undefined;

    if (e.mode === 'credit') {
      const client = e.clientId ? await db.customers.get(e.clientId) : undefined;
      const dette: Dette = {
        clientId: e.clientId!,
        clientSyncId: client?.syncId,
        venteId,
        venteSyncId: syncIdVente,
        date,
        echeance: e.echeance,
        montant: total,
        montantPaye,
        statut: montantPaye >= total ? 'soldee' : 'en_cours',
        syncId: UUID(),
        boutiqueId,
        updatedAt: Date.now(),
      };
      const detteId = await db.debts.add(dette);
      detteCree = (await db.debts.get(detteId)) ?? dette;
      // L'acompte versé à la vente est consigné comme paiement (traçabilité de la dette).
      if (montantPaye > 0) {
        const paiement: PaiementDette = {
          detteId,
          detteSyncId: dette.syncId,
          date,
          montant: montantPaye,
          mode: 'especes',
          note: 'Acompte versé à la vente',
          userId: e.vendeurId,
          aLaVente: true,
          syncId: UUID(),
          boutiqueId,
          updatedAt: Date.now(),
        };
        const idPaiement = await db.debtPayments.add(paiement);
        paiementCree = (await db.debtPayments.get(idPaiement)) ?? paiement;
      }
    }

    return { venteId, vente: venteCree, produits: produitsMaj, mouvements: mouvementsCrees, dette: detteCree, paiement: paiementCree };
  });

  void import('../sync/service').then(({ enfiler }) => {
    if (resultat.vente) void enfiler('sales', resultat.vente as unknown as Record<string, unknown>, 'insert');
    for (const p of resultat.produits) void enfiler('products', p as unknown as Record<string, unknown>, 'update');
    for (const m of resultat.mouvements) void enfiler('stockMovements', m as unknown as Record<string, unknown>, 'insert');
    if (resultat.dette) void enfiler('debts', resultat.dette as unknown as Record<string, unknown>, 'insert');
    if (resultat.paiement) void enfiler('debtPayments', resultat.paiement as unknown as Record<string, unknown>, 'insert');
  });

  return resultat.venteId;
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
  await db.open();
  const montant = Math.round(input.montant);
  if (montant <= 0) throw new Error('Le montant doit être supérieur à zéro.');
  const settings = await lireSettings();
  const boutiqueId = settings?.boutiqueId ?? settings?.syncId ?? UUID();
  const client = await db.customers.get(input.clientId);
  const dette: Dette = {
    clientId: input.clientId,
    clientSyncId: client?.syncId,
    date: input.date ?? Date.now(),
    echeance: input.echeance,
    montant,
    montantPaye: 0,
    statut: 'en_cours',
    motif: input.motif?.trim() || 'Dette existante',
    syncId: UUID(),
    boutiqueId,
    updatedAt: Date.now(),
  };
  const idDette = await db.debts.add(dette);
  const cree = (await db.debts.get(idDette)) ?? dette;
  void import('../sync/service').then(({ enfiler }) => {
    void enfiler('debts', cree as unknown as Record<string, unknown>, 'insert');
  });
}

/* ---------------------------------- Utilisateurs ---------------------------------- */

export async function creerUtilisateur(input: { nom: string; role: User['role']; pin: string; gerantId?: number; boutiqueId?: string }): Promise<number> {
  await db.open();
  const nom = input.nom.trim();
  if (!nom) throw new Error('Le nom est obligatoire.');
  const pinHash = await hacherPin(input.pin);
  const settings = await lireSettings();
  const boutiqueId = input.boutiqueId ?? settings?.boutiqueId ?? settings?.syncId ?? UUID();
  const user: User = {
    nom,
    role: input.role,
    pinHash,
    actif: true,
    boutiqueId,
    gerantId: input.gerantId,
    syncId: UUID(),
    updatedAt: Date.now(),
  };
  const id = await db.users.add(user);
  const cree = (await db.users.get(id)) ?? user;
  void import('../sync/service').then(({ enfiler }) => {
    void enfiler('users', cree as unknown as Record<string, unknown>, 'insert');
  });
  return id;
}

export async function redefinirPin(userId: number, pin: string): Promise<void> {
  await db.open();
  const pinHash = await hacherPin(pin);
  await db.users.update(userId, { pinHash, updatedAt: Date.now() });
  const user = await db.users.get(userId);
  if (user) {
    void import('../sync/service').then(({ enfiler }) => {
      void enfiler('users', user as unknown as Record<string, unknown>, 'update');
    });
  }
}

export async function supprimerUtilisateur(userId: number): Promise<void> {
  await db.open();
  const cible = await db.users.get(userId);
  if (!cible) throw new Error('Utilisateur introuvable.');
  if (cible.role === 'gerant' && cible.actif) {
    const actifs = await db.users.where('role').equals('gerant').toArray();
    const autres = actifs.filter((u) => u.id !== userId && u.actif);
    if (autres.length === 0) {
      throw new Error('Il doit rester au moins un gérant actif.');
    }
  }
  await db.users.delete(userId);
}

export async function majUtilisateur(userId: number, modifs: Partial<Omit<User, 'id' | 'pinHash'>>): Promise<void> {
  await db.open();
  if (modifs.actif === false || (modifs.role && modifs.role !== 'gerant')) {
    const actifs = await db.users.where('role').equals('gerant').toArray();
    const cible = await db.users.get(userId);
    const autres = actifs.filter((u) => u.id !== userId && u.actif);
    if (cible?.role === 'gerant' && autres.length === 0 && (modifs.actif === false || modifs.role === 'caissier')) {
      throw new Error('Il doit rester au moins un gérant actif.');
    }
  }
  const { ...reste } = modifs;
  await db.users.update(userId, { ...reste, updatedAt: Date.now() });
  const user = await db.users.get(userId);
  if (user) {
    void import('../sync/service').then(({ enfiler }) => {
      void enfiler('users', user as unknown as Record<string, unknown>, 'update');
    });
  }
}

/* ------------------------------------ Catégories ------------------------------------ */

/** Crée les catégories par défaut si elles n'existent pas encore. */
export async function creerCategoriesParDefaut(): Promise<number> {
  await db.open();
  const existantes = await db.categories.toArray();
  const nomsExistants = new Set(existantes.map((c) => c.nom.toLowerCase()));
  const aAjouter = CATEGORIES_PAR_DEFAUT.filter((c) => !nomsExistants.has(c.nom.toLowerCase()));
  if (aAjouter.length === 0) return 0;
  await db.categories.bulkAdd(aAjouter);
  return aAjouter.length;
}

export async function ajouterCategorie(nom: string, couleur?: string): Promise<number> {
  await db.open();
  const n = nom.trim();
  if (!n) throw new Error('Le nom de la catégorie est obligatoire.');
  const existe = await db.categories.where('nom').equals(n).count();
  if (existe > 0) throw new Error('Cette catégorie existe déjà.');
  const settings = await lireSettings();
  const boutiqueId = settings?.boutiqueId ?? settings?.syncId ?? UUID();
  const cat: Category = { nom: n, couleur, boutiqueId, syncId: UUID(), updatedAt: Date.now() };
  const id = await db.categories.add(cat);
  void import('../sync/service').then(({ enfiler }) => {
    void enfiler('categories', { ...cat, id } as unknown as Record<string, unknown>, 'insert');
  });
  return id;
}

export async function supprimerCategorie(categoryId: number): Promise<void> {
  await db.open();
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
