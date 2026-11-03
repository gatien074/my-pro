import { useState } from 'react';
import { Archive, Pencil } from 'lucide-react';
import type { Produit } from '../../db/types';
import { formatNombre } from '../../lib/money';
import { decalageAnimationProduit, genererImageProduit } from '../../lib/productImage';
import { Badge, Bouton, Montant } from '../ui';

interface CarteProduitProps {
  produit: Produit;
  categorie?: string;
  index: number;
  peutGerer: boolean;
  onModifier: () => void;
  onArchiver: () => void;
}

export function CarteProduit({ produit, categorie, index, peutGerer, onModifier, onArchiver }: CarteProduitProps) {
  const imageGeneree = genererImageProduit({ nom: produit.nom, categorie });
  const [imageCourante, setImageCourante] = useState(() => produit.imageUrl?.trim() || imageGeneree);

  const stockCouleur = produit.stock <= 0 ? 'rouge' : produit.stock <= produit.seuilAlerte ? 'ambre' : 'vert';
  const stockTexte = produit.stock <= 0 ? 'Épuisé' : `${formatNombre(produit.stock)} en stock`;

  return (
    <article
      className="animer-apparition carte-produit group flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-within:border-brand-400"
      style={{ animationDelay: `${decalageAnimationProduit(produit.nom, index)}ms` }}
    >
      <div className="relative aspect-\[4/3] w-full overflow-hidden bg-slate-100">
        <img
          src={imageCourante}
          alt={produit.nom}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          onError={() => setImageCourante(imageGeneree)}
        />
        <div className="absolute top-2 left-2">
          <Badge couleur={stockCouleur}>{stockTexte}</Badge>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold text-slate-800">{produit.nom}</h3>
          <p className="truncate text-xs text-slate-400">
            {categorie ?? 'Sans catégorie'} · {produit.unite}
          </p>
        </div>

        <div className="mt-auto flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400">Prix de vente</p>
            <Montant valeur={formatNombre(produit.prixVente)} classe="cellule-tabulaire text-lg text-brand-700" />
          </div>
          <p className="cellule-tabulaire text-right text-xs text-slate-500">
            {produit.codeBarres ? `Code ${produit.codeBarres}` : `Seuil ${formatNombre(produit.seuilAlerte)}`}
          </p>
        </div>

        {peutGerer && (
          <div className="flex gap-1.5 border-t border-s-slate-50 pt-2">
            <Bouton taille="sm" variante="secondaire" className="flex-1" onClick={onModifier}>
              <Pencil className="size-4" />
              <span className="hidden sm:inline">Modifier</span>
            </Bouton>
            {produit.actif && (
              <Bouton taille="sm" variante="fantome" onClick={onArchiver} aria-label={`Archiver ${produit.nom}`}>
                <Archive className="size-4" />
                <span className="hidden sm:inline">Archiver</span>
              </Bouton>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
