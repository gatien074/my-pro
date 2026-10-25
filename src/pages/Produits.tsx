import { useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, Pencil, Plus, Search } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../db/hooks';
import { basculerProduitActif, enregistrerProduit } from '../db/ops';
import type { Produit } from '../db/types';
import { formatNombre } from '../lib/money';
import { margePourcent } from '../lib/calc';
import { useSession } from '../store/session';
import { Alerte, Badge, Bouton, Champ, cn, EtatVide, Libelle, Liste, Modale } from '../components/ui';

function badgeStock(p: Produit): { couleur: 'vert' | 'ambre' | 'rouge'; texte: string } {
  if (p.stock <= 0) return { couleur: 'rouge', texte: 'Épuisé' };
  if (p.stock <= p.seuilAlerte) return { couleur: 'ambre', texte: `Stock bas (${formatNombre(p.stock)})` };
  return { couleur: 'vert', texte: `${formatNombre(p.stock)} en stock` };
}

interface Champs {
  nom: string;
  codeBarres: string;
  categoryId: string;
  unite: string;
  prixAchat: string;
  prixVente: string;
  stock: string;
  seuilAlerte: string;
}

const CHAMPS_VIDES: Champs = {
  nom: '',
  codeBarres: '',
  categoryId: '',
  unite: 'pièce',
  prixAchat: '',
  prixVente: '',
  stock: '',
  seuilAlerte: '',
};

export default function Produits() {
  const { settings } = useSettings();
  const role = useSession((s) => s.utilisateur?.role);
  const estGerant = role === 'gerant';
  const produits = useLiveQuery(() => db.products.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const [recherche, setRecherche] = useState('');
  const [filtreCat, setFiltreCat] = useState<string>('tout');
  const [seulementStockBas, setSeulementStockBas] = useState(false);
  const [montrerInactifs, setMontrerInactifs] = useState(false);
  const [edition, setEdition] = useState<Produit | 'nouveau' | null>(null);
  const [champs, setChamps] = useState<Champs>(CHAMPS_VIDES);
  const [erreur, setErreur] = useState('');

  const categoriesMap = useMemo(() => new Map((categories ?? []).map((c) => [c.id!, c])), [categories]);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (produits ?? []).filter((p) => {
      if (!montrerInactifs && !p.actif) return false;
      if (montrerInactifs && p.actif) return false;
      if (filtreCat !== 'tout' && String(p.categoryId ?? '') !== filtreCat) return false;
      if (seulementStockBas && !(p.stock <= p.seuilAlerte)) return false;
      if (q && !(p.nom.toLowerCase().includes(q) || (p.codeBarres ?? '').includes(q))) return false;
      return true;
    });
  }, [produits, recherche, filtreCat, seulementStockBas, montrerInactifs]);

  function ouvrirNouveau() {
    setChamps({ ...CHAMPS_VIDES, seuilAlerte: String(settings?.seuilAlerteDefaut ?? 5) });
    setErreur('');
    setEdition('nouveau');
  }

  function ouvrirEdition(p: Produit) {
    setChamps({
      nom: p.nom,
      codeBarres: p.codeBarres ?? '',
      categoryId: p.categoryId != null ? String(p.categoryId) : '',
      unite: p.unite,
      prixAchat: String(p.prixAchat),
      prixVente: String(p.prixVente),
      stock: String(p.stock),
      seuilAlerte: String(p.seuilAlerte),
    });
    setErreur('');
    setEdition(p);
  }

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur('');
    try {
      await enregistrerProduit(
        {
          nom: champs.nom,
          codeBarres: champs.codeBarres,
          categoryId: champs.categoryId ? Number(champs.categoryId) : undefined,
          unite: champs.unite || 'pièce',
          prixAchat: Number(champs.prixAchat || 0),
          prixVente: Number(champs.prixVente || 0),
          stock: Number(champs.stock || 0),
          seuilAlerte: Number(champs.seuilAlerte || 0),
        },
        edition !== 'nouveau' && edition ? edition.id : undefined,
      );
      setEdition(null);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  async function archiver(p: Produit) {
    if (!confirm(`Archiver « ${p.nom} » ? Il ne sera plus visible en caisse (l'historique des ventes est conservé).`)) return;
    await basculerProduitActif(p.id!, false);
  }

  const margeNutile = edition
    ? margePourcent(Number(champs.prixAchat || 0), Number(champs.prixVente || 0))
    : null;

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <div className="flex items-center justify-between">
        <h1 className="titre-page">Produits</h1>
        {estGerant && (
          <Bouton onClick={ouvrirNouveau}>
            <Plus className="size-4" /> Nouveau produit
          </Bouton>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input className="champ pl-9" placeholder="Rechercher un produit…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <Liste value={filtreCat} onChange={(e) => setFiltreCat(e.target.value)} className="w-40">
          <option value="tout">Toutes catégories</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={String(c.id)}>{c.nom}</option>
          ))}
        </Liste>
        <button
          type="button"
          onClick={() => { setSeulementStockBas((v) => !v); setMontrerInactifs(false); }}
          className={cn('rounded-xl border px-3 py-2 text-sm font-medium', seulementStockBas ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
        >
          Stock bas
        </button>
        <button
          type="button"
          onClick={() => { setMontrerInactifs((v) => !v); setSeulementStockBas(false); }}
          className={cn('rounded-xl border px-3 py-2 text-sm font-medium', montrerInactifs ? 'border-slate-400 bg-slate-100 text-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
        >
          Archivés
        </button>
      </div>

      {liste.length === 0 ? (
        <EtatVide
          titre={montrerInactifs ? 'Aucun produit archivé' : 'Aucun produit'}
          texte="Ajoutez vos produits avec leur prix d'achat et de vente pour suivre la marge et le stock."
        />
      ) : (
        <div className="carte overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Produit</th>
                  <th className="hidden px-3 py-2.5 font-medium md:table-cell">Catégorie</th>
                  <th className="px-3 py-2.5 text-right font-medium">Prix vente</th>
                  <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Achat</th>
                  <th className="px-3 py-2.5 text-right font-medium">Marge</th>
                  <th className="px-3 py-2.5 font-medium">Stock</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {liste.map((p) => {
                  const bs = badgeStock(p);
                  const marge = margePourcent(p.prixAchat, p.prixVente);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800">{p.nom}</p>
                        {p.codeBarres && <p className="text-xs text-slate-400">{p.codeBarres}</p>}
                      </td>
                      <td className="hidden px-3 py-2.5 text-slate-500 md:table-cell">{categoriesMap.get(p.categoryId ?? -1)?.nom ?? '—'}</td>
                      <td className="cellule-tabulaire px-3 py-2.5 text-right font-semibold text-slate-700">{formatNombre(p.prixVente)}</td>
                      <td className="cellule-tabulaire hidden px-3 py-2.5 text-right text-slate-500 sm:table-cell">{formatNombre(p.prixAchat)}</td>
                      <td className="cellule-tabulaire px-3 py-2.5 text-right text-green-700">
                        {marge != null ? `${formatNombre(p.prixVente - p.prixAchat)} (${marge} %)` : '—'}
                      </td>
                      <td className="px-3 py-2.5"><Badge couleur={bs.couleur}>{bs.texte}</Badge></td>
                      <td className="px-3 py-2.5 text-right">
                        {estGerant && (
                          <span className="flex justify-end gap-1">
                            <button type="button" onClick={() => ouvrirEdition(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-700" aria-label="Modifier">
                              <Pencil className="size-4" />
                            </button>
                            {p.actif && (
                              <button type="button" onClick={() => void archiver(p)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600" aria-label="Archiver">
                                <Archive className="size-4" />
                              </button>
                            )}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modale
        ouverte={edition !== null}
        onFermer={() => setEdition(null)}
        titre={edition === 'nouveau' ? 'Nouveau produit' : 'Modifier le produit'}
        large
        piedDePage={
          <>
            <Bouton variante="secondaire" onClick={() => setEdition(null)}>Annuler</Bouton>
            <Bouton type="submit" form="form-produit">Enregistrer</Bouton>
          </>
        }
      >
        <form id="form-produit" onSubmit={soumettre} className="space-y-3">
          <div>
            <Libelle>Nom du produit *</Libelle>
            <Champ value={champs.nom} onChange={(e) => setChamps((c) => ({ ...c, nom: e.target.value }))} placeholder="Ex. Sardines 125 g" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Libelle>Code-barres (facultatif)</Libelle>
              <Champ value={champs.codeBarres} onChange={(e) => setChamps((c) => ({ ...c, codeBarres: e.target.value }))} placeholder="Scan avec le lecteur…" />
            </div>
            <div>
              <Libelle>Unité</Libelle>
              <Champ value={champs.unite} onChange={(e) => setChamps((c) => ({ ...c, unite: e.target.value }))} placeholder="pièce, kg, boîte…" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Libelle>Catégorie</Libelle>
              <Liste value={champs.categoryId} onChange={(e) => setChamps((c) => ({ ...c, categoryId: e.target.value }))}>
                <option value="">— Aucune —</option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={String(c.id)}>{c.nom}</option>
                ))}
              </Liste>
            </div>
            <div>
              <Libelle>Seuil d'alerte stock</Libelle>
              <Champ type="number" inputMode="numeric" min={0} value={champs.seuilAlerte} onChange={(e) => setChamps((c) => ({ ...c, seuilAlerte: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Libelle>Prix d'achat (FCFA)</Libelle>
              <Champ type="number" inputMode="numeric" min={0} value={champs.prixAchat} onChange={(e) => setChamps((c) => ({ ...c, prixAchat: e.target.value }))} />
            </div>
            <div>
              <Libelle>Prix de vente (FCFA)</Libelle>
              <Champ type="number" inputMode="numeric" min={0} value={champs.prixVente} onChange={(e) => setChamps((c) => ({ ...c, prixVente: e.target.value }))} />
            </div>
            <div>
              <Libelle>Stock {edition !== 'nouveau' && '(actuel)'}</Libelle>
              <Champ type="number" inputMode="numeric" value={champs.stock} onChange={(e) => setChamps((c) => ({ ...c, stock: e.target.value }))} />
            </div>
          </div>
          {margeNutile != null && !Number.isNaN(margeNutile) && (
            <p className="text-xs text-slate-500">
              Marge prévue : <span className="font-semibold text-green-700">{formatNombre(Number(champs.prixVente || 0) - Number(champs.prixAchat || 0))} FCFA ({margeNutile} %)</span>
            </p>
          )}
          {erreur && <Alerte>{erreur}</Alerte>}
        </form>
      </Modale>
    </div>
  );
}
