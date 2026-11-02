import { useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, ShoppingBag, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { useSettings } from '../db/hooks';
import type { Produit } from '../db/types';
import { formatNombre } from '../lib/money';
import { jouerAlerteStock } from '../lib/son';
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
  const [notification, setNotification] = useState<{ nom: string } | null>(null);

  const produitsAffiches = useMemo(() => {
    const actifs = (produits ?? []).filter((p) => p.actif);
    const q = recherche.trim().toLowerCase();
    return actifs.filter((p) => {
      if (categoryId != null && p.categoryId !== categoryId) return false;
      if (!q) return true;
      return p.nom.toLowerCase().includes(q) || (p.codeBarres ?? '').includes(q);
    });
  }, [produits, recherche, categoryId]);

  function onRecherche(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const q = recherche.trim();
    if (!q) return;
    const exact = (produits ?? []).find((p) => p.actif && p.codeBarres === q);
    const cible = exact ?? produitsAffiches[0];
    if (cible) {
      const doitBloquer = !(settings?.autoriserStockNegatif ?? false) && cible.stock <= 0;
      if (doitBloquer) {
        setErreur(`« ${cible.nom} » est en rupture de stock.`);
        jouerAlerteStock();
        return;
      }
      panier.ajouter(cible);
      setNotification({ nom: cible.nom });
      setTimeout(() => setNotification(null), 1500);
      setRecherche('');
      setErreur('');
    } else {
      setErreur(`Aucun produit ne correspond à « ${q} ».`);
    }
  }

  function ajouterProduit(p: Produit) {
    const doitBloquer = !(settings?.autoriserStockNegatif ?? false) && p.stock <= 0;
    if (doitBloquer) {
      setErreur(`« ${p.nom} » est en rupture de stock.`);
      jouerAlerteStock();
      return;
    }
    panier.ajouter(p);
    setNotification({ nom: p.nom });
    setTimeout(() => setNotification(null), 1500);
    setErreur('');
  }

  const nbArticles = lignes.reduce((s, l) => s + l.quantite, 0);

  return (
    <div className="flex h-full flex-col">
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
          {erreur && <p className="mt-2 text-sm text-red-600">{erreur}</p>}
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
                    aria-disabled={doitBloquer}
                    className={cn('etiquette relative', doitBloquer && 'opacity-70 ring-1 ring-red-200')}
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

      {notification && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2">
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
