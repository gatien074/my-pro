/** Types de données de l'application. */

export type Role = 'gerant' | 'caissier';

/**
 * Identifiant universel pour la synchronisation multi-appareils.
 * - `undefined`/`null` : ligne uniquement locale (ancienne donnée).
 * - `string` : UUID stable partagé entre appareils.
 */
export type SyncId = string;

export type ModePaiement = 'especes' | 'airtel' | 'moov' | 'credit';

export type StatutVente = 'vendue' | 'annulee';

export type StatutDette = 'en_cours' | 'soldee' | 'annulee';

export type TypeMouvement = 'vente' | 'annulation' | 'entree' | 'perte' | 'ajustement';

export interface Settings {
  id: 'app';
  nomBoutique: string;
  adresse?: string;
  telephone?: string;
  devise: string;
  tvaTaux: number;
  piedTicket: string;
  seuilAlerteDefaut: number;
  autoriserStockNegatif: boolean;
  verrouillageAuto?: boolean;
  creeLe: number;
  /** Identifiant de synchronisation pour Supabase / temps réel. */
  syncId?: SyncId;
  /** Identifiant stable de la boutique partagé entre appareils. */
  boutiqueId?: string;
  /** Dernière mise à jour locale (ms), utilisée pour résoudre les conflits. */
  updatedAt?: number;
}

export interface User {
  id?: number;
  nom: string;
  role: Role;
  pinHash: string;
  actif: boolean;
  /** Identifiant de la boutique ('app' par défaut, une boutique par installation). */
  boutiqueId?: string;
  /** Pour un caissier : gérant auquel ce compte est rattaché. */
  gerantId?: number;
  syncId?: SyncId;
  updatedAt?: number;
}

export interface Category {
  id?: number;
  nom: string;
  couleur?: string;
  syncId?: SyncId;
  boutiqueId?: string;
  updatedAt?: number;
}

export interface Produit {
  id?: number;
  nom: string;
  codeBarres?: string;
  categoryId?: number;
  unite: string;
  prixAchat: number;
  prixVente: number;
  stock: number;
  seuilAlerte: number;
  actif: boolean;
  imageUrl?: string;
  creeLe: number;
  syncId?: SyncId;
  boutiqueId?: string;
  categorySyncId?: SyncId;
  updatedAt?: number;
}

export interface LigneVente {
  produitId: number;
  produitSyncId?: SyncId;
  nom: string;
  unite: string;
  /** Prix d'achat figé au moment de la vente, pour un bénéfice exact. */
  prixAchat: number;
  prixUnitaire: number;
  quantite: number;
}

export interface Vente {
  id?: number;
  numero: string;
  date: number;
  lignes: LigneVente[];
  sousTotal: number;
  remise: number;
  total: number;
  mode: ModePaiement;
  /** Montant encaissé à la vente (montant reçu ou acompte en cas de crédit). */
  montantPaye: number;
  clientId?: number;
  clientSyncId?: SyncId;
  sellerId?: number;
  statut: StatutVente;
  syncId?: SyncId;
  boutiqueId?: string;
  updatedAt?: number;
}

export interface MouvementStock {
  id?: number;
  produitId: number;
  produitSyncId?: SyncId;
  type: TypeMouvement;
  /** Variation appliquée au stock (signée : négative = sortie). */
  quantite: number;
  motif?: string;
  date: number;
  venteId?: number;
  venteSyncId?: SyncId;
  userId?: number;
  syncId?: SyncId;
  boutiqueId?: string;
  updatedAt?: number;
}

export interface Client {
  id?: number;
  nom: string;
  telephone?: string;
  note?: string;
  creeLe: number;
  syncId?: SyncId;
  boutiqueId?: string;
  updatedAt?: number;
}

export interface Dette {
  id?: number;
  clientId: number;
  clientSyncId?: SyncId;
  venteId?: number;
  venteSyncId?: SyncId;
  date: number;
  echeance?: number;
  montant: number;
  montantPaye: number;
  statut: StatutDette;
  motif?: string;
  syncId?: SyncId;
  boutiqueId?: string;
  updatedAt?: number;
}

export interface PaiementDette {
  id?: number;
  detteId: number;
  detteSyncId?: SyncId;
  date: number;
  montant: number;
  mode: Exclude<ModePaiement, 'credit'>;
  note?: string;
  userId?: number;
  /** Acompte versé à la vente à crédit (et non un remboursement ultérieur). */
  aLaVente?: boolean;
  syncId?: SyncId;
  boutiqueId?: string;
  updatedAt?: number;
}

/** Clôture de caisse d'une journée : fond de caisse, espèces attendues et écart. */
export interface ClotureCaisse {
  id?: number;
  /** Début de la journée clôturée (timestamp). */
  date: number;
  fondInitial: number;
  especesAttendues: number;
  fondCompte: number;
  /** Espèces comptées − espèces attendues (positif = excédent). */
  ecart: number;
  fermeLe: number;
  userId?: number;
  syncId?: SyncId;
  boutiqueId?: string;
  updatedAt?: number;
}
