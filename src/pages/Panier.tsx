import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Minus, Plus, ShoppingCart, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { useSettings } from '../db/hooks';
import type { Vente } from '../db/types';
import { calculeTotaux } from '../lib/calc';
import { formatFCFA, formatNombre, versMontant } from '../lib/money';
import { usePanier } from '../store/cart';
import { useSession } from '../store/session';
import { Alerte, Badge, Bouton, Montant } from '../components/ui';
import PaymentDialog, { type BrouillonVente } from '../components/caisse/PaymentDialog';
import Ticket from '../components/caisse/Ticket';

export default function Panier() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const utilisateur = useSession((s) => s.utilisateur);
  const produits = useLiveQuery(() => db.products.toArray(), []);
  const panier = usePanier();
  const lignes = panier.lignes;

  const [erreur, setErreur] = useState('');
  const [paiementOuvert, setPaiementOuvert] = useState(false);
  const [venteFaite, setVenteFaite] = useState<Vente | null>(null);

  const { sousTotal, total } = useMemo(() => calculeTotaux(lignes, panier.remise), [lignes, panier.remise]);

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

  function retirer(p: { produitId: number }) {
    panier.retirer(p.produitId);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/')} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100">
            <ArrowLeft className="size-5" />
          </button>
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <ShoppingCart className="size-5" />
            Panier ({lignes.reduce((s, l) => s + l.quantite, 0)} article{lignes.reduce((s, l) => s + l.quantite, 0) > 1 ? 's' : ''})
          </h1>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        {lignes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <ShoppingCart className="size-16 text-slate-300" />
            <div>
              <p className="text-lg font-semibold text-slate-700">Votre panier est vide</p>
              <p className="mt-1 text-sm text-slate-500">Ajoutez des produits depuis la caisse</p>
            </div>
            <Bouton onClick={() => navigate('/')}>Retour à la caisse</Bouton>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {lignes.map((l) => (
                <li key={l.produitId} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{l.nom}</p>
                    <p className="cellule-tabulaire text-xs text-slate-500">{formatNombre(l.prixUnitaire)} FCFA / {l.unite}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => panier.decrementer(l.produitId)} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Diminuer">
                      <Minus className="size-4" />
                    </button>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={l.quantite}
                      onChange={(e) => panier.definirQuantite(l.produitId, versMontant(e.target.value))}
                      className="cellule-tabulaire w-14 rounded-lg border border-slate-200 bg-white py-1.5 text-center text-sm font-bold text-slate-800 outline-none focus:border-brand-500"
                    />
                    <button type="button" onClick={() => { const p = (produits ?? []).find((x) => x.id === l.produitId); if (p) panier.ajouter(p); }} className="flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Augmenter">
                      <Plus className="size-4" />
                    </button>
                  </div>
                  <span className="cellule-tabulaire w-24 text-right text-sm font-bold text-slate-900">
                    <Montant valeur={formatNombre(l.prixUnitaire * l.quantite)} />
                  </span>
                  <button type="button" onClick={() => retirer(l)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label="Retirer">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="space-y-2 px-4 py-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Remise (FCFA)</span>
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
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Sous-total</span>
                    <span className="cellule-tabulaire">
                      <Montant valeur={formatNombre(sousTotal)} />
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-slate-100 pt-2">
                  <span className="text-base font-semibold text-slate-900">Total</span>
                  <span className="cellule-tabulaire font-display text-2xl font-bold text-brand-700">
                    <Montant valeur={formatNombre(total)} />
                  </span>
                </div>
              </div>
              <div className="border-t border-slate-100 px-4 py-3">
                {bloquerStock && lignesAlerte.length > 0 && (
                  <Alerte type="erreur">
                    Stock insuffisant : {lignesAlerte.map((l) => l.nom).join(', ')}.
                  </Alerte>
                )}
                {erreur && <Alerte>{erreur}</Alerte>}
                <Bouton
                  taille="lg"
                  className="mt-2 w-full"
                  disabled={
                    lignes.length === 0 ||
                    lignesInvalides.length > 0 ||
                    (bloquerStock && lignesAlerte.length > 0)
                  }
                  onClick={() => {
                    if (lignesInvalides.length > 0) {
                      setErreur('Certains articles du panier ne sont plus disponibles (produit archivé ou supprimé).');
                      return;
                    }
                    setErreur('');
                    setPaiementOuvert(true);
                  }}
                >
                  Encaisser {formatFCFA(total)}
                </Bouton>
              </div>
            </div>
          </div>
        )}
      </div>

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
