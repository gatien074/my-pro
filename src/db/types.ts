/** Types de données de l'application. */

export type Role = 'gerant' | 'caissier';

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
  modeDemo: boolean;
  creeLe: number;
}

export interface User {
  id?: number;
  nom: string;
  role: Role;
  pinHash: string;
  actif: boolean;
  /** Identifiant Google (sub) pour la connexion via Google Identity Services. */
  googleId?: string;
  /** Adresse e-mail du compte Google (si connecté via Google). */
  email?: string;
}

export interface Category {
  id?: number;
  nom: string;
  couleur?: string;
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
  creeLe: number;
}

export interface LigneVente {
  produitId: number;
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
  sellerId?: number;
  statut: StatutVente;
}

export interface MouvementStock {
  id?: number;
  produitId: number;
  type: TypeMouvement;
  /** Variation appliquée au stock (signée : négative = sortie). */
  quantite: number;
  motif?: string;
  date: number;
  venteId?: number;
  userId?: number;
}

export interface Client {
  id?: number;
  nom: string;
  telephone?: string;
  note?: string;
  creeLe: number;
}

export interface Dette {
  id?: number;
  clientId: number;
  venteId?: number;
  date: number;
  echeance?: number;
  montant: number;
  montantPaye: number;
  statut: StatutDette;
  motif?: string;
}

export interface PaiementDette {
  id?: number;
  detteId: number;
  date: number;
  montant: number;
  mode: Exclude<ModePaiement, 'credit'>;
  note?: string;
  userId?: number;
  /** Acompte versé à la vente à crédit (et non un remboursement ultérieur). */
  aLaVente?: boolean;
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
}
