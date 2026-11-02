import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ShoppingBag, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { useSettings } from '../db/hooks';
import type { Produit } from '../db/types';
import { formatNombre } from '../lib/money';
import { usePanier } from '../store/cart';
import { Badge, cn, EtatVide, Montant } from '../components/ui';

function couleurStock(p: Produit): 'vert' | 'ambre' | 'rouge' {
  if (p.stock <= 0) return 'rouge';
  if (p.stock <= p.seuilAlerte) return 'ambre';
  return 'vert';
}

export default function Caisse() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const produits = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const panier = usePanier();
  const lignes = panier.lignes;

  const [recherche, setRecherche] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [erreur, setErreur] = useState('');
  const [notification, setNotification] = useState<{ nom: string; id: number } | null>(null);

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
      const doitBloquer = !(settings?.autoriserStockNegatif ?? false) && cible.stock <= 0;
      if (doitBloquer) return;
      panier.ajouter(cible);
      setNotification({ nom: cible.nom, id: Date.now() });
      setTimeout(() => setNotification(null), 1500);
      setRecherche('');
      setErreur('');
    } else {
      setErreur(`Aucun produit ne correspond à « ${q} ».`);
    }
  }

  function ajouterProduit(p: Produit) {
    const doitBloquer = !(settings?.autoriserStockNegatif ?? false) && p.stock <= 0;
    if (doitBloquer) return;
    panier.ajouter(p);
    setNotification({ nom: p.nom, id: Date.now() });
    setTimeout(() => setNotification(null), 1500);
    setErreur('');
  }

  const nbArticles = lignes.reduce((s, l) => s + l.quantite, 0);

  return (
    <div className="flex h-full flex-col">
      {/* En-tête avec accès panier */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-3 py-2.5 lg:px-4">
        <h1 className="text-lg font-bold text-slate-900">Caisse</h1>
        <button
          type="button"
          onClick={() => navigate('/panier')}
          className="relative flex items-center gap-2 rounded-lg bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800"
        >
          <ShoppingBag className="size-4" />
          <span>Panier</span>
          {nbArticles > 0 && (
            <span className="absolute -top-2 -right-2 flex size-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
              {nbArticles > 99 ? '99+' : nbArticles}
            </span>
          )}
        </button>
      </div>

      <section className="flex min-h-0 flex-1 flex-col">
        <div className="p-3 lg:p-4">
          <div className="relative">
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

        <div className="flex gap-2 overflow-x-auto px-3 pb-2 lg:px-4">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-6 lg:px-4">
          {produits === undefined ? (
            <p className="p-6 text-sm text-slate-400">Chargement du catalogue…</p>
          ) : produitsAffiches.length === 0 ? (
            <EtatVide titre="Aucun produit trouvé" texte="Modifiez la recherche, ou ajoutez vos produits dans l'onglet Produits." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {produitsAffiches.map((p) => {
                const doitBloquer = !(settings?.autoriserStockNegatif ?? false) && p.stock <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => ajouterProduit(p)}
                    disabled={doitBloquer}
                    className="etiquette relative"
                  >
                    <span className="line-clamp-2 text-sm font-semibold text-slate-800">{p.nom}</span>
                    <span className="cellule-tabulaire text-base font-bold text-brand-700">
                      <Montant valeur={formatNombre(p.prixVente)} />
                    </span>
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

      {/* Notification d'ajout au panier */}
      {notification && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 animate-in fade-in slide-in-from-bottom-2 lg:bottom-6">
          <div className="flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-lg">
            <Check className="size-4" />
            <span className="max-w-[200px] truncate">{notification.nom}</span>
            <span>ajouté au panier</span>
          </div>
        </div>
      )}
    </div>
  );
}

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
                    <button type="button" onClick={() => panier.decrementer(l.produitId)} className="flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-100 touch-manipulation" aria-label="Diminuer">
                      <Minus className="size-5" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={l.quantite}
                      onChange={(e) => panier.definirQuantite(l.produitId, versMontant(e.target.value))}
                      aria-label={`Quantité de ${l.nom}`}
                      className="cellule-tabulaire w-16 rounded-lg border border-slate-200 bg-white py-2 text-center text-base font-bold text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 touch-manipulation"
                    />
                    <button type="button" onClick={() => { const p = (produits ?? []).find((x) => x.id === l.produitId); if (p) panier.ajouter(p); }} className="flex size-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 active:bg-slate-100 touch-manipulation" aria-label="Augmenter">
                      <Plus className="size-5" />
                    </button>
                  </div>
                  <span className="cellule-tabulaire w-20 text-right text-sm font-bold text-slate-800">
                    <Montant valeur={formatNombre(l.prixUnitaire * l.quantite)} />
                  </span>
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
              <span className="cellule-tabulaire">
                <Montant valeur={formatNombre(sousTotal)} />
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700">Total</span>
            <span className="cellule-tabulaire font-display text-2xl font-bold text-brand-700">
              <Montant valeur={formatNombre(total)} />
            </span>
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
