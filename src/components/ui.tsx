import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { X } from 'lucide-react';

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/* ---------------------------------- Bouton ---------------------------------- */

type Variante = 'primaire' | 'accent' | 'secondaire' | 'fantome' | 'danger';
type Taille = 'md' | 'lg' | 'sm';

const VARIANTES: Record<Variante, string> = {
  primaire: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800',
  accent: 'bg-amber-400 text-amber-900 hover:bg-amber-500 active:bg-amber-600',
  secondaire: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400',
  fantome: 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
};

const TAILLES: Record<Taille, string> = {
  sm: 'gap-1.5 px-3 py-1.5 text-xs rounded-lg',
  md: 'gap-2 px-4 py-2.5 text-sm rounded-lg',
  lg: 'gap-2 px-5 py-3.5 text-base rounded-xl',
};

interface BoutonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  taille?: Taille;
}

export function Bouton({ variante = 'primaire', taille = 'md', className, ...props }: BoutonProps) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-colors duration-100 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-y-0',
        VARIANTES[variante],
        TAILLES[taille],
        className,
      )}
      {...props}
    />
  );
}

/* ---------------------------------- Inputs ---------------------------------- */

interface ChampProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Champ({ className, ...props }: ChampProps) {
  return <input className={cn('champ', className)} {...props} />;
}

interface ListeProps extends SelectHTMLAttributes<HTMLSelectElement> {}

export function Liste({ className, children, ...props }: ListeProps) {
  return (
    <select className={cn('champ bg-white', className)} {...props}>
      {children}
    </select>
  );
}

interface ZoneProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function ZoneTexte({ className, ...props }: ZoneProps) {
  return <textarea className={cn('champ min-h-24', className)} {...props} />;
}

export function Libelle({ children }: { children: ReactNode }) {
  return <label className="libelle">{children}</label>;
}

/* ----------------------------------- Badge ----------------------------------- */

type CouleurBadge = 'gris' | 'vert' | 'ambre' | 'rouge' | 'bleu' | 'violet' | 'teal';

const COULEURS_BADGE: Record<CouleurBadge, string> = {
  gris: 'bg-slate-100 text-slate-600',
  vert: 'bg-green-100 text-green-800',
  ambre: 'bg-amber-100 text-amber-800',
  rouge: 'bg-red-100 text-red-700',
  bleu: 'bg-azur-100 text-azur-700',
  violet: 'bg-violet-100 text-violet-700',
  teal: 'bg-brand-100 text-brand-700',
};

export function Badge({ couleur = 'gris', children, className }: { couleur?: CouleurBadge; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap', COULEURS_BADGE[couleur], className)}>
      {children}
    </span>
  );
}

/* ----------------------------------- Modale ----------------------------------- */

interface ModaleProps {
  ouverte: boolean;
  onFermer: () => void;
  titre: string;
  children: ReactNode;
  piedDePage?: ReactNode;
  large?: boolean;
}

export function Modale({ ouverte, onFermer, titre, children, piedDePage, large }: ModaleProps) {
  useEffect(() => {
    if (!ouverte) return;
    const ecouteSrc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', ecouteSrc);
    return () => window.removeEventListener('keydown', ecouteSrc);
  }, [ouverte, onFermer]);

  if (!ouverte) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-encre/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onFermer(); }}>
      <div
        className={cn(
          'animer-apparition flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl ring-1 ring-encre/10 sm:rounded-2xl',
          large ? 'sm:max-w-2xl' : 'sm:max-w-md',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={titre}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300 sm:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="font-display text-base font-bold text-slate-900">{titre}</h2>
          <button type="button" onClick={onFermer} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fermer">
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {piedDePage != null && (
          <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3.5">{piedDePage}</div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- Divers éléments -------------------------------- */

export function EtatVide({ titre, texte, children }: { titre: string; texte?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="font-semibold text-slate-700">{titre}</p>
      {texte != null && <p className="max-w-sm text-sm text-slate-500">{texte}</p>}
      {children}
    </div>
  );
}

export function CarteStats({ libelle, valeur, detail, icone }: { libelle: string; valeur: string; detail?: string; icone?: ReactNode }) {
  return (
    <div className="carte flex items-center gap-3 p-4">
      {icone != null && <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">{icone}</div>}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{libelle}</p>
        <p className="cellule-tabulaire font-display truncate text-lg font-bold text-slate-900">{valeur}</p>
        {detail != null && <p className="truncate text-xs text-slate-400">{detail}</p>}
      </div>
    </div>
  );
}

export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center" role="status">
      <div className="flex items-center gap-3 text-sm font-medium text-slate-500">
        <span className="size-2 animate-ping rounded-full bg-brand-500" />
        <span className="size-2 animate-ping rounded-full bg-brand-500 [animation-delay:150ms]" />
        <span className="size-2 animate-ping rounded-full bg-brand-500 [animation-delay:300ms]" />
        {texte}
      </div>
    </div>
  );
}

export function Alerte({ children, type = 'erreur' }: { children: ReactNode; type?: 'erreur' | 'info' }) {
  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', type === 'erreur' ? 'border-red-200 bg-red-50 text-red-700' : 'border-azur-200 bg-azur-50 text-azur-700')}>
      {children}
    </div>
  );
}
