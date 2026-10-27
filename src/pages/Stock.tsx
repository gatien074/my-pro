import { useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowDownLeft, ClipboardCheck, Layers, TriangleAlert } from 'lucide-react';
import { db } from '../db/db';
import { enregistrerMouvementStock } from '../db/ops';
import type { Produit } from '../db/types';
import { formaterDateHeure } from '../lib/dates';
import { formatNombre, versMontant } from '../lib/money';
import { LIBELLES_MOUVEMENTS } from '../lib/helpers';
import { useSession } from '../store/session';
import { Alerte, Badge, Bouton, Champ, cn, EtatVide, Libelle, Liste, Modale, Montant } from '../components/ui';

type Action = 'entree' | 'perte' | 'ajustement';

const COULEUR_ORIGINE: Record<string, 'vert' | 'ambre' | 'rouge' | 'bleu'> = {
  vente: 'bleu',
  annulation: 'ambre',
  entree: 'vert',
  perte: 'rouge',
  ajustement: 'ambre',
};

export default function Stock() {
  const produits = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const mouvements = useLiveQuery(() => db.stockMovements.orderBy('date').reverse().limit(80).toArray(), []);
  const vendeurId = useSession((s) => s.utilisateur?.id);

  const [action, setAction] = useState<Action | null>(null);
  const [produitId, setProduitId] = useState<string>('');
  const [quantite, setQuantite] = useState('');
  const [stockReel, setStockReel] = useState('');
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState('');
  const [succes, setSucces] = useState('');

  const produitsMap = useMemo(() => new Map((produits ?? []).map((p) => [p.id!, p])), [produits]);
  const catMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id!, c])), [categories]);

  const enAlerte = useMemo(
    () => (produits ?? []).filter((p) => p.actif && p.stock <= p.seuilAlerte).sort((a, b) => a.stock - b.stock),
    [produits],
  );
  const valeurStock = useMemo(() => (produits ?? []).reduce((s, p) => s + p.prixAchat * p.stock, 0), [produits]);

  const produitChoisi = produitId ? produitsMap.get(Number(produitId)) : undefined;

  function ouvrir(a: Action, p?: Produit) {
    setAction(a);
    setProduitId(p ? String(p.id) : '');
    setQuantite('');
    setStockReel(p ? String(p.stock) : '');
    setMotif('');
    setErreur('');
    setSucces('');
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    if (!action) return;
    setErreur('');
    try {
      await enregistrerMouvementStock({
        action,
        produitId: Number(produitId),
        quantite: versMontant(quantite),
        stockReel: action === 'ajustement' ? versMontant(stockReel) : undefined,
        motif,
        userId: vendeurId,
      });
      const nom = produitsMap.get(Number(produitId))?.nom ?? 'produit';
      setSucces(
        action === 'entree'
          ? `Entrée de stock enregistrée pour « ${nom} ».`
          : action === 'perte'
            ? `Perte enregistrée pour « ${nom} ».`
            : `Stock de « ${nom} » ajusté.`,
      );
      setAction(null);
      setTimeout(() => setSucces(''), 4000);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  return (
    <div className="space-y-4 p-3 lg:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titre-page">Stock</h1>
        <div className="flex gap-2">
          <Bouton variante="accent" onClick={() => ouvrir('entree')}>
            <ArrowDownLeft className="size-4" /> Entrée de stock
          </Bouton>
          <Bouton variante="secondaire" onClick={() => ouvrir('ajustement')}>
            <ClipboardCheck className="size-4" /> Inventaire
          </Bouton>
          <Bouton variante="danger" onClick={() => ouvrir('perte')}>
            <TriangleAlert className="size-4" /> Perte
          </Bouton>
        </div>
      </div>

      {succes && <Alerte type="info">{succes}</Alerte>}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="carte flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><TriangleAlert className="size-5" /></div>
          <div>
            <p className="text-xs font-medium text-slate-500">Produits en alerte</p>
            <p className="cellule-tabulaire font-display text-lg font-bold text-slate-900">{formatNombre(enAlerte.length)}</p>
          </div>
        </div>
        <div className="carte flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Layers className="size-5" /></div>
          <div>
            <p className="text-xs font-medium text-slate-500">Nombre de références</p>
            <p className="cellule-tabulaire font-display text-lg font-bold text-slate-900">{formatNombre((produits ?? []).filter((p) => p.actif).length)}</p>
          </div>
        </div>
        <div className="carte-accent flex items-center gap-3 p-4">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Layers className="size-5" /></div>
          <div>
            <p className="text-xs font-medium text-slate-500">Valeur du stock (prix d'achat)</p>
            <p className="cellule-tabulaire font-display text-lg font-bold text-amber-800">
              <Montant valeur={formatNombre(valeurStock)} />
            </p>
          </div>
        </div>
      </div>

      <div className="carte p-4">
        <h2 className="mb-2 text-sm font-bold text-slate-700">Alertes de rupture</h2>
        {enAlerte.length === 0 ? (
          <p className="text-sm text-slate-400">Aucun produit sous le seuil d'alerte. Tout va bien !</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {enAlerte.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{p.nom}</p>
                  <p className="text-xs text-slate-400">{catMap.get(p.categoryId ?? -1)?.nom ?? '—'}</p>
                </div>
                <Badge couleur={p.stock <= 0 ? 'rouge' : 'ambre'}>
                  {p.stock <= 0 ? 'Épuisé' : `${formatNombre(p.stock)} / seuil ${p.seuilAlerte}`}
                </Badge>
                <Bouton taille="sm" variante="accent" onClick={() => ouvrir('entree', p)}>
                  <ArrowDownLeft className="size-4" /> Réappro
                </Bouton>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="carte overflow-hidden">
        <h2 className="px-4 py-3 text-sm font-bold text-slate-700 border-b border-slate-100">Derniers mouvements</h2>
        {(mouvements ?? []).length === 0 ? (
          <div className="p-4"><EtatVide titre="Aucun mouvement enregistré" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Produit</th>
                  <th className="px-3 py-2.5 text-right font-medium">Qté</th>
                  <th className="hidden px-3 py-2.5 font-medium sm:table-cell">Motif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(mouvements ?? []).map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">{formaterDateHeure(m.date)}</td>
                    <td className="px-3 py-2.5"><Badge couleur={COULEUR_ORIGINE[m.type] ?? 'gris'}>{LIBELLES_MOUVEMENTS[m.type]}</Badge></td>
                    <td className="px-3 py-2.5 font-medium text-slate-700">{produitsMap.get(m.produitId)?.nom ?? 'Produit supprimé'}</td>
                    <td className={cn('cellule-tabulaire px-3 py-2.5 text-right font-bold', m.quantite >= 0 ? 'text-green-700' : 'text-red-600')}>
                      {m.quantite >= 0 ? '+' : ''}{formatNombre(m.quantite)}
                    </td>
                    <td className="hidden px-3 py-2.5 text-slate-500 sm:table-cell">{m.motif ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modale
        ouverte={action !== null}
        onFermer={() => setAction(null)}
        titre={action === 'entree' ? 'Entrée de stock' : action === 'perte' ? 'Déclarer une perte' : 'Inventaire (ajustement du stock)'}
        piedDePage={
          <>
            <Bouton variante="secondaire" onClick={() => setAction(null)}>Annuler</Bouton>
            <Bouton type="submit" form="form-stock">Enregistrer</Bouton>
          </>
        }
      >
        <form id="form-stock" onSubmit={soumettre} className="space-y-3">
          <div>
            <Libelle>Produit *</Libelle>
            <Liste value={produitId} onChange={(e) => { setProduitId(e.target.value); setErreur(''); }} autoFocus>
              <option value="">— Choisir —</option>
              {(produits ?? []).filter((p) => p.actif).map((p) => (
                <option key={p.id} value={String(p.id)}>{p.nom} (stock : {p.stock})</option>
              ))}
            </Liste>
          </div>

          {(action === 'entree' || action === 'perte') && (
            <div>
              <Libelle>Quantité {action === 'entree' ? 'reçue' : 'perdue'} *</Libelle>
              <Champ type="number" inputMode="numeric" min={action === 'perte' ? undefined : 0} value={quantite} onChange={(e) => setQuantite(e.target.value)} />
            </div>
          )}

          {action === 'ajustement' && produitChoisi && (
            <div>
              <Libelle>Stock réel compté</Libelle>
              <Champ type="number" inputMode="numeric" value={stockReel} onChange={(e) => setStockReel(e.target.value)} />
              <p className="mt-1 text-xs text-slate-500">
                Écart avec le stock en logiciel : <span className="font-semibold">{formatNombre(Number(stockReel || 0) - produitChoisi.stock)}</span>
              </p>
            </div>
          )}

          <div>
            <Libelle>Motif {action === 'perte' ? '*' : '(facultatif)'}</Libelle>
            <Champ value={motif} onChange={(e) => setMotif(e.target.value)} placeholder={action === 'entree' ? 'Réapprovisionnement, don reçu…' : action === 'perte' ? 'Casse, vol suspecté, péremption…' : 'Inventaire mensuel…'} />
          </div>

          {action === 'perte' && (
            <Alerte type="info">
              Chaque perte est consignée dans l'historique : c'est votre trace en cas de litige ou de disparition de marchandise.
            </Alerte>
          )}

          {erreur && <Alerte>{erreur}</Alerte>}
        </form>
      </Modale>
    </div>
  );
}
