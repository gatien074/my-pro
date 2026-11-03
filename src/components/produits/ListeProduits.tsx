import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Produit } from '../../db/types';
import { CarteProduit } from './CarteProduit';

interface ListeProduitsProps {
  produits: Produit[];
  categoriesMap: Map<number, string>;
  peutGerer: boolean;
  onModifier: (produit: Produit) => void;
  onArchiver: (produit: Produit) => void;
}

export function ListeProduits({ produits, categoriesMap, peutGerer, onModifier, onArchiver }: ListeProduitsProps) {
  const listeRef = useRef<HTMLDivElement>(null);
  const [debut, setDebut] = useState(true);
  const [fin, setFin] = useState(false);

  function mesurer() {
    const el = listeRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setDebut(el.scrollLeft <= 8);
    setFin(max <= 8 || el.scrollLeft >= max - 8);
  }

  useEffect(() => {
    mesurer();
    const el = listeRef.current;
    if (!el) return;

    const observateur = new ResizeObserver(mesurer);
    observateur.observe(el);
    window.addEventListener('resize', mesurer);

    return () => {
      observateur.disconnect();
      window.removeEventListener('resize', mesurer);
    };
  }, [produits.length]);

  useEffect(() => {
    const el = listeRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;

      const auDebut = el.scrollLeft <= 1;
      const aLaFin = el.scrollLeft >= max - 1;
      if ((event.deltaY > 0 && aLaFin) || (event.deltaY < 0 && auDebut)) return;

      event.preventDefault();
      el.scrollLeft += event.deltaY;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function defiler(direction: -1 | 1) {
    const el = listeRef.current;
    if (!el) return;
    const pas = Math.max(el.clientWidth * 0.8, 240);
    el.scrollBy({ left: pas * direction, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div
        ref={listeRef}
        onScroll={mesurer}
        className="liste-produits-h"
        role="region"
        aria-label="Liste des produits"
      >
        {produits.map((produit, index) => (
          <CarteProduit
            key={produit.id}
            produit={produit}
            index={index}
            categorie={produit.categoryId != null ? categoriesMap.get(produit.categoryId) : undefined}
            peutGerer={peutGerer}
            onModifier={() => onModifier(produit)}
            onArchiver={() => onArchiver(produit)}
          />
        ))}
      </div>

      {!debut && (
        <button
          type="button"
          onClick={() => defiler(-1)}
          aria-label="Produits précédents"
          className="absolute top-1/2 left-2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-600 shadow-md transition hover:border-brand-300 hover:text-brand-700 md:flex"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}

      {!fin && (
        <>
          <button
            type="button"
            onClick={() => defiler(1)}
            aria-label="Produits suivants"
            className="absolute top-1/2 right-2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-slate-400 bg-white/5 text-slate-600 shadow-md transition hover:border-brand-300 hover:text-brand-700 md:flex"
          >
            <ChevronRight className="size-5" />
          </button>

          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex w-20 items-center justify-end bg-gradient-to- from-slate-500 via-slate-800 to-transparent pr-1">
            <div className="flex flex-col items-center gap-0.5 text-brand-700">
              <span className="hidden text-[11px] font-semibold sm:block">Faites défiler</span>
              <ChevronRight className="animer-fleche-defilement size-5" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
