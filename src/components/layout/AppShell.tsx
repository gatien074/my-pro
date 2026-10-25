import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { BarChart3, Boxes, Lock, Package, Settings, ShoppingCart, Users } from 'lucide-react';
import { useSettings } from '../../db/hooks';
import { useSession } from '../../store/session';
import type { Role } from '../../db/types';
import { Chargement, cn } from '../ui';

const navigation: Array<{ vers: string; libelle: string; icone: typeof ShoppingCart; roles: Role[] }> = [
  { vers: '/', libelle: 'Caisse', icone: ShoppingCart, roles: ['gerant', 'caissier'] },
  { vers: '/produits', libelle: 'Produits', icone: Package, roles: ['gerant', 'caissier'] },
  { vers: '/stock', libelle: 'Stock', icone: Boxes, roles: ['gerant'] },
  { vers: '/clients', libelle: 'Clients', icone: Users, roles: ['gerant', 'caissier'] },
  { vers: '/rapports', libelle: 'Rapports', icone: BarChart3, roles: ['gerant'] },
  { vers: '/parametres', libelle: 'Paramètres', icone: Settings, roles: ['gerant'] },
];

export function AppShell() {
  const { settings, enChargement } = useSettings();
  const utilisateur = useSession((s) => s.utilisateur);
  const deconnecter = useSession((s) => s.deconnecter);
  const location = useLocation();

  if (enChargement) return <Chargement />;
  if (!settings) return <Navigate to="/onboarding" replace />;
  if (!utilisateur) return <Navigate to="/connexion" replace />;

  const autorise = navigation.some(
    (n) =>
      n.roles.includes(utilisateur.role) &&
      (location.pathname === n.vers || (n.vers !== '/' && location.pathname.startsWith(`${n.vers}/`))),
  );
  if (!autorise) return <Navigate to="/" replace />;

  const navAutorisee = navigation.filter((n) => n.roles.includes(utilisateur.role));

  return (
    <div className="flex h-dvh flex-col bg-slate-50">
      {/* Bande du drapeau — signature de l'application */}
      <div className="bande-gabon h-1 shrink-0" aria-hidden="true" />

      <div className="flex min-h-0 flex-1">
        {/* Barre latérale — bureau */}
        <aside className="hidden w-60 shrink-0 flex-col bg-encre lg:flex">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <div className="font-display flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white ring-1 ring-white/15">
              C+S
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{settings.nomBoutique}</p>
              <p className="text-xs text-white/50">Caisse &amp; Stock</p>
            </div>
          </div>

          <nav className="mt-2 flex-1 space-y-1 px-2">
            {navAutorisee.map(({ vers, libelle, icone: Icone }) => (
              <NavLink
                key={vers}
                to={vers}
                className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/[0.07]"
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full bg-amber-400" />
                    )}
                    <Icone className={cn('size-5 shrink-0', isActive ? 'text-amber-300' : 'text-white/55')} />
                    <span className={cn('transition-colors', isActive ? 'text-white' : 'text-white/75 group-hover:text-white')}>
                      {libelle}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="border-t border-white/10 p-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="flex size-8 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                {utilisateur.nom.slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{utilisateur.nom}</p>
                <p className="text-xs text-white/50">{utilisateur.role === 'gerant' ? 'Gérant' : 'Caissier'}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={deconnecter}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Lock className="size-4" /> Verrouiller
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* En-tête — mobile */}
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <div className="font-display flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
                C+S
              </div>
              <p className="truncate text-sm font-bold text-slate-900">{settings.nomBoutique}</p>
            </div>
            <button
              type="button"
              onClick={deconnecter}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              aria-label="Verrouiller la session"
            >
              <Lock className="size-5" />
            </button>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto pb-20 lg:pb-0">
            <Outlet />
          </main>

          {/* Navigation — mobile */}
          <nav
            className="fixed inset-x-0 bottom-0 z-40 grid bg-encre pb-[env(safe-area-inset-bottom)] lg:hidden"
            style={{ gridTemplateColumns: `repeat(${navAutorisee.length}, minmax(0,1fr))` }}
          >
            {navAutorisee.map(({ vers, libelle, icone: Icone }) => (
              <NavLink key={vers} to={vers} className="group flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium">
                {({ isActive }) => (
                  <>
                    <Icone className={cn('size-5 transition-colors', isActive ? 'text-amber-300' : 'text-white/55 group-hover:text-white/80')} />
                    <span className={cn('transition-colors', isActive ? 'text-white' : 'text-white/60 group-hover:text-white/80')}>
                      {libelle}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
