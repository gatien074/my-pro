import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Minus, Plus, Search, ShoppingCart, Trash2 } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../db/hooks';
import type { Produit, Vente } from '../db/types';
import { calculeTotaux } from '../lib/calc';
import { formatFCFA, formatNombre, versMontant } from '../lib/money';
import { usePanier } from '../store/cart';
import { useSession } from '../store/session';
import { Alerte, Badge, Bouton, cn, EtatVide } from '../components/ui';
import PaymentDialog, { type BrouillonVente } from '../components/caisse/PaymentDialog';
import Ticket from '../components/caisse/Ticket';

function couleurStock(p: Produit): 'vert' | 'ambre' | 'rouge' {
  if (p.stock <= 0) return 'rouge';
  if (p.stock <= p.seuilAlerte) return 'ambre';
  return 'vert';
}

export default function Caisse() {
  const { settings } = useSettings();
  const utilisateur = useSession((s) => s.utilisateur);
  const produits = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const panier = usePanier();
  const lignes = panier.lignes;

  const [recherche, setRecherche] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [erreur, setErreur] = useState('');
  const [paiementOuvert, setPaiementOuvert] = useState(false);
  const [venteFaite, setVenteFaite] = useState<Vente | null>(null);

  const { sousTotal, total } = useMemo(() => calculeTotaux(lignes, panier.remise), [lignes, panier.remise]);

  const produitsAffiches = useMemo(() => {
    const actifs = (produits ?? []).filter((p) => p.actif);
    const q = recherche.trim().toLowerCase();
    return actifs.filter((p) => {
      if (categoryId != null && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return p.nom.toLowerCase().includes(q) || (p.codeBarres ?? '').includes(q);
    });
  }, [produits, recherche, categoryId]);

  // Détection code-barres exact (touche Entrée)
  function onRecherche(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const q = recherche.trim();
    if (!q) return;
    const exact = (produits ?? []).find((p) => p.actif && p.codeBarres === q);
    const cible = exact ?? produitsAffiches[0];
    if (cible) {
      panier.ajouter(cible);
      setRecherche('');
      setErreur('');
    } else {
      setErreur(`Aucun produit ne correspond à « ${q} ».`);
    }
  }

  const stockMap = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of produits ?? []) m.set(p.id!, p.stock);
    return m;
  }, [produits]);

  const lignesAlerte = lignes.filter((l) => (stockMap.get(l.produitId) ?? 0) < l.quantite);
  const lignesInvalides = lignes.filter((l) => {
    const p = (produits ?? []).find((x) => x.id === l.produitId);
    return !p || !p.actif;
  });
  const bloquerStock = !(settings?.autoriserStockNegatif ?? false);

  const brouillon: BrouillonVente | null = lignes.length > 0 ? { lignes, remise: panier.remise, sousTotal, total } : null;

  function surVenteTerminee(v: Vente) {
    panier.vider();
    panier.definirRemise(0);
    setPaiementOuvert(false);
    setVenteFaite(v);
  }

  function retirer(p: Produit) {
    panier.retirer(p.id!);
  }

  return (
    <div className="flex h-full flex-col lg:flex-row lg:gap-4 lg:p-4">
      {/* Colonne produits */}
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="p-3 lg:p-0 lg:pb-3">
          <h1 className="titre-page hidden lg:block">Caisse</h1>
          <div className="relative mt-2 lg:mt-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" />
            <input
              className="champ pl-10 text-base"
              placeholder="Nom du produit ou code-barres…"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              onKeyDown={onRecherche}
              autoFocus
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-3 pb-2 lg:px-0">
          <button
            type="button"
            onClick={() => setCategoryId(null)}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition',
              categoryId === null ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
            )}
          >
            Tout
          </button>
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id!)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition',
                categoryId === c.id ? 'bg-brand-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
              )}
            >
              {c.nom}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 lg:px-0">
          {produits === undefined ? (
            <p className="p-6 text-sm text-slate-400">Chargement du catalogue…</p>
          ) : produitsAffiches.length === 0 ? (
            <EtatVide titre="Aucun produit trouvé" texte="Modifiez la recherche, ou ajoutez vos produits dans l'onglet Produits." />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {produitsAffiches.map((p) => {
                const doitBloquer = bloquerStock && p.stock <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (doitBloquer) return;
                      panier.ajouter(p);
                      setErreur('');
                    }}
                    disabled={doitBloquer}
                    className="etiquette"
                  >
                    <span className="line-clamp-2 text-sm font-semibold text-slate-800">{p.nom}</span>
                    <span className="cellule-tabulaire text-base font-bold text-brand-700">{formatFCFA(p.prixVente)}</span>
                    <span className="mt-auto flex w-full items-center justify-between">
                      <span className="text-xs text-slate-400">/ {p.unite}</span>
                      <Badge couleur={couleurStock(p)}>
                        {p.stock <= 0 ? 'Épuisé' : `${formatNombre(p.stock)} en stock`}
                      </Badge>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Colonne panier */}
      <aside className="flex max-h-[45vh] min-h-0 shrink-0 flex-col border-t border-slate-200 bg-white lg:max-h-none lg:w-96 lg:rounded-xl lg:border">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <ShoppingCart className="size-4" />
            Panier ({lignes.reduce((s, l) => s + l.quantite, 0)})
          </h2>
          {lignes.length > 0 && (
            <button type="button" onClick={() => { panier.vider(); panier.definirRemise(0); }} className="text-xs font-medium text-red-600 hover:underline">
              Vider
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {lignes.length === 0 ? (
            <p className="flex h-full items-center justify-center px-6 py-8 text-center text-sm text-slate-400">
              Touchez un produit pour commencer une vente.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lignes.map((l) => (
                <li key={l.produitId} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{l.nom}</p>
                    <p className="cellule-tabulaire text-xs text-slate-400">{formatNombre(l.prixUnitaire)} × {l.quantite}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => panier.decrementer(l.produitId)} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-100" aria-label="Diminuer">
                      <Minus className="size-4" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={l.quantite}
                      onChange={(e) => panier.definirQuantite(l.produitId, versMontant(e.target.value))}
                      aria-label={`Quantité de ${l.nom}`}
                      className="cellule-tabulaire w-14 rounded-lg border border-slate-200 bg-white py-1 text-center text-sm font-bold text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25"
                    />
                    <button type="button" onClick={() => { const p = (produits ?? []).find((x) => x.id === l.produitId); if (p) panier.ajouter(p); }} className="flex size-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-100" aria-label="Augmenter">
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="cellule-tabulaire w-20 text-right text-sm font-bold text-slate-800">{formatNombre(l.prixUnitaire * l.quantite)}</span>
                  <button type="button" onClick={() => { const p = (produits ?? []).find((x) => x.id === l.produitId); if (p) retirer(p); }} className="text-slate-300 hover:text-red-600" aria-label="Retirer">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-2 border-t border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Remise (FCFA)</span>
            <input
              type="number"
              inputMode="numeric"
              className="champ w-28 px-2 py-1 text-right text-sm"
              value={panier.remise || ''}
              onChange={(e) => panier.definirRemise(e.target.valueAsNumber ? e.target.valueAsNumber : 0)}
              min={0}
            />
          </div>
          {panier.remise > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Sous-total</span>
              <span className="cellule-tabulaire">{formatFCFA(sousTotal)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="cellule-tabulaire font-display text-2xl font-bold text-brand-700">{formatFCFA(total)}</span>
          </div>
          {bloquerStock && lignesAlerte.length > 0 && (
            <Alerte type="erreur">
              Stock insuffisant : {lignesAlerte.map((l) => l.nom).join(', ')}.
            </Alerte>
          )}
          {erreur && <Alerte>{erreur}</Alerte>}
          <Bouton
            taille="lg"
            className="w-full"
            disabled={
              lignes.length === 0 ||
              lignesInvalides.length > 0 ||
              (bloquerStock && lignesAlerte.length > 0)
            }
            onClick={() => {
              if (lignesInvalides.length > 0) {
                setErreur(
                  'Certains articles du panier ne sont plus disponibles (produit archivé ou supprimé).',
                );
                return;
              }
              setErreur('');
              setPaiementOuvert(true);
            }}
          >
            Encaisser {formatFCFA(total)}
          </Bouton>
        </div>
      </aside>

      {brouillon && paiementOuvert && utilisateur && (
        <PaymentDialog
          brouillon={brouillon}
          vendeurId={utilisateur.id}
          onFermer={() => setPaiementOuvert(false)}
          onTermine={surVenteTerminee}
        />
      )}

      {venteFaite && settings && (
        <Ticket
          vente={venteFaite}
          settings={settings}
          resolveClient={(id) => db.customers.get(id).then((c) => c?.nom)}
          annulateurId={utilisateur?.id}
          onFermer={() => setVenteFaite(null)}
        />
      )}
    </div>
  );
}
