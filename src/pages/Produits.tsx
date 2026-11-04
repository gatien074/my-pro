import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus, Search } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../db/hooks';
import { basculerProduitActif, creerCategoriesParDefaut, enregistrerProduit } from '../db/ops';
import type { Produit } from '../db/types';
import { formatNombre } from '../lib/money';
import { margePourcent } from '../lib/calc';
import { genererImageProduit } from '../lib/productImage';
import { telechargerImageProduit } from '../lib/remoteImage';
import { useSession } from '../store/session';
import { ListeProduits } from '../components/produits/ListeProduits';
import { Alerte, Bouton, Champ, cn, EtatVide, Libelle, Liste, Modale } from '../components/ui';

interface Champs {
  nom: string;
  codeBarres: string;
  categoryId: string;
  unite: string;
  prixAchat: string;
  prixVente: string;
  stock: string;
  seuilAlerte: string;
  imageUrl: string;
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
  imageUrl: '',
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
      imageUrl: p.imageUrl ?? '',
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
          imageUrl: await (async () => {
            const saisie = champs.imageUrl.trim();
            if (saisie) return saisie;

            const categorie = champs.categoryId && categoriesMap.has(Number(champs.categoryId))
              ? categoriesMap.get(Number(champs.categoryId))?.nom
              : undefined;
            const telechargee = await telechargerImageProduit(champs.nom, categorie);
            return telechargee ?? genererImageProduit({ nom: champs.nom, categorie });
          })(),
        },
        edition !== 'nouveau' && edition ? edition.id : undefined,
      );
      setEdition(null);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  async function ajouterCategoriesRapides() {
    setErreur('');
    try {
      await creerCategoriesParDefaut();
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  async function archiver(p: Produit) {
    if (!confirm(`Archiver « ${p.nom} » ? Il ne sera plus visible en caisse (l'historique des ventes est conservé).`)) return;
    await basculerProduitActif(p.id!, false);
  }

  const margeUtile = edition
    ? margePourcent(Number(champs.prixAchat || 0), Number(champs.prixVente || 0))
    : null;

  const imagesTraiteesRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!navigator.onLine) return;
    const manquants = (produits ?? []).filter((p) => p.id != null && !p.imageUrl && !imagesTraiteesRef.current.has(p.id!));
    if (manquants.length === 0) return;

    let actif = true;
    void (async () => {
      for (const produit of manquants) {
        if (!actif) return;
        imagesTraiteesRef.current.add(produit.id!);
        const categorie = produit.categoryId != null ? categoriesMap.get(produit.categoryId)?.nom : undefined;
        const image = await telechargerImageProduit(produit.nom, categorie);
        if (!actif) return;
        await db.products.update(produit.id!, {
          imageUrl: image ?? genererImageProduit({ nom: produit.nom, categorie }),
        });
      }
    })();

    return () => {
      actif = false;
    };
  }, [produits, categoriesMap]);

  return (
    <div className="space-y-3 p-3 sm:p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="titre-page">Produits</h1>
        {estGerant && (
          <Bouton onClick={ouvrirNouveau}>
            <Plus className="size-4" /> Nouveau produit
          </Bouton>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative w-full sm:min-w-56 sm:flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input className="champ pl-9" placeholder="Rechercher un produit…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
        </div>
        <Liste value={filtreCat} onChange={(e) => setFiltreCat(e.target.value)} className="w-full sm:w-40">
          <option value="tout">Toutes catégories</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={String(c.id)}>{c.nom}</option>
          ))}
        </Liste>
        <button
          type="button"
          onClick={() => { setSeulementStockBas((v) => !v); setMontrerInactifs(false); }}
          className={cn('w-full rounded-xl border px-3 py-2 text-sm font-medium sm:w-auto', seulementStockBas ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
        >
          Stock bas
        </button>
        <button
          type="button"
          onClick={() => { setMontrerInactifs((v) => !v); setSeulementStockBas(false); }}
          className={cn('w-full rounded-xl border px-3 py-2 text-sm font-medium sm:w-auto', montrerInactifs ? 'border-slate-400 bg-slate-100 text-slate-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}
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
        <ListeProduits
          produits={liste}
          categoriesMap={new Map<number, string>((categories ?? []).map((c) => [c.id!, c.nom]))}
          peutGerer={estGerant}
          onModifier={(p) => ouvrirEdition(p)}
          onArchiver={(p) => void archiver(p)}
        />
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
              {(categories ?? []).length === 0 && (
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-amber-600">
                    Aucune catégorie enregistrée.
                  </p>
                  <Bouton type="button" taille="sm" variante="secondaire" onClick={() => void ajouterCategoriesRapides()}>
                    Créer des catégories
                  </Bouton>
                </div>
              )}
            </div>
            <div>
              <Libelle>Seuil d'alerte stock</Libelle>
              <Champ type="number" inputMode="numeric" min={0} value={champs.seuilAlerte} onChange={(e) => setChamps((c) => ({ ...c, seuilAlerte: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 items-start">
            <div>
              <Libelle className="min-h-10 leading-tight">Prix d'achat (FCFA)</Libelle>
              <Champ type="number" inputMode="numeric" min={0} value={champs.prixAchat} onChange={(e) => setChamps((c) => ({ ...c, prixAchat: e.target.value }))} />
            </div>
            <div>
              <Libelle className="min-h-10 leading-tight">Prix de vente (FCFA)</Libelle>
              <Champ type="number" inputMode="numeric" min={0} value={champs.prixVente} onChange={(e) => setChamps((c) => ({ ...c, prixVente: e.target.value }))} />
            </div>
            <div>
              <Libelle className="min-h-10 leading-tight">Stock {edition !== 'nouveau' && '(actuel)'}</Libelle>
              <Champ type="number" inputMode="numeric" value={champs.stock} onChange={(e) => setChamps((c) => ({ ...c, stock: e.target.value }))} />
            </div>
          </div>
          <div>
            <Libelle>URL de l'image (facultatif)</Libelle>
            <Champ
              value={champs.imageUrl}
              onChange={(e) => setChamps((c) => ({ ...c, imageUrl: e.target.value }))}
              placeholder="Laisser vide pour générer une image automatique"
              inputMode="url"
            />
            <p className="mt-1 text-xs text-slate-500">
              Si vous ne mettez pas d'image, une image professionnelle est générée automatiquement à partir du nom et de la catégorie.
            </p>
          </div>
          {margeUtile != null && !Number.isNaN(margeUtile) && (
            <p className="text-xs text-slate-500">
              Marge prévue : <span className="font-semibold text-green-700">{formatNombre(Number(champs.prixVente || 0) - Number(champs.prixAchat || 0))} FCFA ({margeUtile} %)</span>
            </p>
          )}
          {erreur && <Alerte>{erreur}</Alerte>}
        </form>
      </Modale>
    </div>
  );
}
