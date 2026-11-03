import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Store } from 'lucide-react';
import { useSettings } from '../db/hooks';
import { creerBoutique } from '../db/ops';
import { pinValide } from '../lib/pin';
import { useSession } from '../store/session';
import { Alerte, Bouton, Champ, Libelle, Chargement } from '../components/ui';

export default function Onboarding() {
  const { settings, enChargement } = useSettings();
  const navigate = useNavigate();
  const connecter = useSession((s) => s.connecter);

  const [nomBoutique, setNomBoutique] = useState('');
  const [nomGerant, setNomGerant] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [nomCaissier, setNomCaissier] = useState('');
  const [pinCaissier, setPinCaissier] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  if (enChargement) return <Chargement />;
  if (settings) return <Navigate to="/connexion" replace />;

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur('');
    if (!nomBoutique.trim()) return setErreur('Indiquez le nom de la boutique.');
    if (!nomGerant.trim()) return setErreur('Indiquez votre nom (gérant).');
    if (!pinValide(pin)) return setErreur('Le code PIN doit contenir exactement 4 chiffres.');
    if (pin !== pin2) return setErreur('Les deux codes PIN ne correspondent pas.');
    if (nomCaissier.trim() && !pinValide(pinCaissier)) {
      return setErreur('Le code PIN du caissier doit contenir exactement 4 chiffres.');
    }

    setEnCours(true);
    try {
      const caissier = nomCaissier.trim() ? { nom: nomCaissier.trim(), pin: pinCaissier } : undefined;
      const id = await creerBoutique({ nomBoutique: nomBoutique.trim(), nomGerant: nomGerant.trim(), pin: pin, caissier });
      connecter({ id, nom: nomGerant.trim(), role: 'gerant' });
      navigate('/', { replace: true });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inattendue.');
      setEnCours(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-encre">
      <div className="bande-gabon h-1 shrink-0" aria-hidden="true" />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form onSubmit={soumettre} className="w-full max-w-md space-y-5">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white ring-1 ring-white/15">
              <Store className="size-7" />
            </div>
            <h1 className="font-display text-2xl font-bold text-white">Bienvenue !</h1>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/60">
              Configurez votre boutique une fois pour toutes. Tout reste ensuite dans cet appareil, hors ligne.
            </p>
          </div>

          <div className="carte space-y-4 p-5">
            <div>
              <Libelle>Nom de la boutique *</Libelle>
              <Champ value={nomBoutique} onChange={(e) => setNomBoutique(e.target.value)} placeholder="Ex. Alimentation Chez Nzamba" autoFocus />
            </div>
            <div>
              <Libelle>Votre nom (gérant) *</Libelle>
              <Champ value={nomGerant} onChange={(e) => setNomGerant(e.target.value)} placeholder="Ex. Joseph Nzamba" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Libelle>Code PIN (10 chiffres) *</Libelle>
                <Champ
                  type="password"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="off"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••••••••••"
                />
              </div>
              <div>
                <Libelle>Répétez le PIN *</Libelle>
                <Champ
                  type="password"
                  inputMode="numeric"
                  maxLength={10}
                  autoComplete="off"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value)}
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Compte caissier (facultatif)</p>
                <p className="text-xs text-slate-500">
                  Créez-le maintenant, ou plus tard dans Paramètres → Utilisateurs. Il reste rattaché à votre compte de gérant.
                </p>
              </div>
              <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2">
                <div>
                  <Libelle className="min-h-10 leading-tight">Nom du caissier / de la caissière</Libelle>
                  <Champ value={nomCaissier} onChange={(e) => setNomCaissier(e.target.value)} placeholder="Ex. Reine Mbeng" />
                </div>
                <div>
                  <Libelle className="min-h-10 leading-tight">Code PIN caissier</Libelle>
                  <Champ
                    type="password"
                    inputMode="numeric"
                    maxLength={10}
                    autoComplete="off"
                    value={pinCaissier}
                    onChange={(e) => setPinCaissier(e.target.value)}
                    placeholder="••••••••••••"
                  />
                </div>
              </div>
            </div>

            {erreur && <Alerte>{erreur}</Alerte>}
          </div>

          <Bouton type="submit" taille="lg" className="w-full" disabled={enCours}>
            {enCours ? 'Création en cours…' : 'Créer ma boutique'}
          </Bouton>
        </form>
      </div>
    </div>
  );
}
