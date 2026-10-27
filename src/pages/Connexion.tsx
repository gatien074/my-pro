import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Delete, LogIn, ShieldCheck } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../db/hooks';
import { hacherPin } from '../lib/pin';
import { initiales } from '../lib/helpers';
import { useSession } from '../store/session';
import { Alerte, cn } from '../components/ui';
import GoogleSignIn from '../components/auth/GoogleSignIn';

export default function Connexion() {
  const { settings, enChargement } = useSettings();
  const utilisateurs = useLiveQuery(() => db.users.toArray().then((us) => us.filter((u) => u.actif)), []) ?? null;
  const connecter = useSession((s) => s.connecter);
  const dejaConnecte = useSession((s) => s.utilisateur);

  const [idChoisi, setIdChoisi] = useState<number | null>(null);
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState('');

  if (enChargement || utilisateurs === null) return null;
  if (!settings) return <Navigate to="/onboarding" replace />;
  if (dejaConnecte) return <Navigate to="/" replace />;

  const choisi = utilisateurs.find((u) => u.id === idChoisi) ?? null;

  function taper(d: string) {
    setErreur('');
    const suivante = (saisie + d).slice(0, 4);
    setSaisie(suivante);
    if (suivante.length === 4 && choisi) void verifier(choisi.pinHash, suivante);
  }

  async function verifier(pinhash: string, pin: string) {
    try {
      const hashSaisie = await hacherPin(pin);
      if (hashSaisie === pinhash) {
        if (choisi?.id != null) {
          connecter({ id: choisi.id, nom: choisi.nom, role: choisi.role });
        }
        setSaisie('');
      } else {
        setErreur('Code incorrect. Réessayez.');
        setSaisie('');
      }
    } catch {
      setErreur('Erreur technique, réessayez.');
      setSaisie('');
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-encre">
      <div className="bande-gabon h-1 shrink-0" aria-hidden="true" />

      {!choisi ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white ring-1 ring-white/15">
              <ShieldCheck className="size-7" />
            </div>
            <h1 className="font-display text-xl font-bold text-white">{settings.nomBoutique}</h1>
            <p className="mt-1 mb-6 text-sm text-white/60">Qui utilise la caisse ?</p>
            {utilisateurs.length === 0 ? (
              <Alerte>Aucun profil actif. Contactez le gérant.</Alerte>
            ) : (
              <div className="space-y-2">
                {utilisateurs.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      if (u.googleId) {
                        // Compte lié à Google : connexion directe, sans PIN.
                        connecter({ id: u.id!, nom: u.nom, role: u.role });
                        setSaisie('');
                        setErreur('');
                        return;
                      }
                      setIdChoisi(u.id!);
                      setSaisie('');
                      setErreur('');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand-400 hover:bg-brand-50"
                  >
                    <span className="flex size-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                      {initiales(u.nom)}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{u.nom}</span>
                      <span className="text-xs text-slate-400">{u.role === 'gerant' ? 'Gérant' : 'Caissier'}</span>
                    </span>
                    <LogIn className="size-5 text-slate-300" />
                  </button>
                ))}
                {utilisateurs.length > 0 && (
                  <div className="mt-6 border-t border-white/10 pt-4">
                    <p className="text-xs text-white/50 text-center uppercase tracking-wider">ou continuer avec Google</p>
                    <GoogleSignIn onSucces={() => {}} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white ring-1 ring-white/15">
              {initiales(choisi.nom)}
            </div>
            <h1 className="font-display text-lg font-bold text-white">{choisi.nom}</h1>
            <p className="mt-1 mb-5 text-sm text-white/60">Saisissez votre code PIN</p>

            <div className="cellule-tabulaire mb-2 flex justify-center gap-3">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    'flex size-12 items-center justify-center rounded-xl border-2 bg-white/[0.06] text-2xl font-bold',
                    saisie.length > i ? 'border-amber-400 text-amber-300' : 'border-white/15 text-white/25',
                  )}
                >
                  {saisie.length > i ? '•' : ''}
                </span>
              ))}
            </div>
            {erreur && <div className="animer-secousse mb-2"><Alerte>{erreur}</Alerte></div>}

            <div className="mx-auto mt-4 grid max-w-xs grid-cols-3 gap-2.5">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((c) => (
                <button key={c} type="button" onClick={() => taper(c)} className="rounded-xl bg-white py-4 text-xl font-bold text-slate-800 transition-colors active:bg-brand-100">
                  {c}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setSaisie('');
                  setErreur('');
                  setIdChoisi(null);
                }}
                className="rounded-xl py-4 text-sm font-semibold text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                Retour
              </button>
              <button type="button" onClick={() => taper('0')} className="rounded-xl bg-white py-4 text-xl font-bold text-slate-800 transition-colors active:bg-brand-100">
                0
              </button>
              <button
                type="button"
                onClick={() => setSaisie((s) => s.slice(0, -1))}
                className="rounded-xl py-4 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Effacer"
              >
                <Delete className="mx-auto size-5" />
              </button>
            </div>

            {settings.modeDemo && (
              <p className="mt-6 text-xs text-white/40">Démo : gérant « 1234 » · caissière « 4321 »</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
