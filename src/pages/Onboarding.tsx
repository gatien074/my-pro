import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Upload } from 'lucide-react';
import { useSettings } from '../db/hooks';
import { creerBoutique } from '../db/ops';
import { analyserSauvegarde, lireFichierTexte, restaurerDonnees, toutEffacer } from '../db/backup';
import { pinValide } from '../lib/pin';
import { useSession } from '../store/session';
import { Alerte, Bouton, Champ, Libelle, Chargement } from '../components/ui';

export default function Onboarding() {
  const { settings, enChargement } = useSettings();
  const navigate = useNavigate();
  const connecter = useSession((s) => s.connecter);
  const deconnecter = useSession((s) => s.deconnecter);

  const [nomBoutique, setNomBoutique] = useState('');
  const [nomGerant, setNomGerant] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [nomCaissier, setNomCaissier] = useState('');
  const [pinCaissier, setPinCaissier] = useState('');
  const [erreur, setErreur] = useState('');
  const [erreurSauvegarde, setErreurSauvegarde] = useState('');
  const [enCours, setEnCours] = useState(false);
  const inputSauvegardeRef = useRef<HTMLInputElement>(null);

  if (enChargement) return <Chargement />;
  if (settings) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-encre px-4 py-10">
        <div className="w-full max-w-md space-y-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white ring-1 ring-white/15">
            <Store className="size-7" />
          </div>
          <h1 className="font-display text-2xl font-bold text-white">Boutique déjà créée</h1>
          <p className="text-sm text-white/60">
            Une boutique existe déjà sur cet appareil. Vous pouvez vous connecter ou remplacer la boutique actuelle.
            <br />
            <span className="text-red-300">Attention : créer une nouvelle boutique efface toutes les données actuelles.</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Bouton onClick={() => navigate('/connexion', { replace: true })}>Se connecter</Bouton>
            <Bouton
              variante="danger"
              disabled={enCours}
              onClick={async () => {
                if (!confirm('Effacer la boutique actuelle et toutes ses données pour en créer une nouvelle ?')) return;
                setEnCours(true);
                try {
                  await toutEffacer();
                  deconnecter();
                } catch (err) {
                  setErreur(err instanceof Error ? err.message : 'Erreur inattendue.');
                } finally {
                  setEnCours(false);
                }
              }}
            >
              {enCours ? 'Suppression…' : 'Créer une nouvelle boutique'}
            </Bouton>
          </div>
          {erreur && <Alerte>{erreur}</Alerte>}
        </div>
      </div>
    );
  }

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

  async function restaurerSauvegarde(file: File) {
    setErreurSauvegarde('');
    try {
      const texte = await lireFichierTexte(file);
      const sauvegarde = analyserSauvegarde(texte);
      await restaurerDonnees(sauvegarde);
      navigate('/connexion', { replace: true });
    } catch (err) {
      setErreurSauvegarde(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-encre">
      <div className="bande-gabon h-1 shrink-0" aria-hidden="true" />
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <form onSubmit={soumettre} className="w-full max-w-md space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-3xl bg-brand-600 text-white shadow-lg ring-1 ring-white/15">
              <img src="/icon.svg" alt="Logo Caisse & Stock" className="size-10 rounded-xl" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">Bienvenue !</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-white/65">
              Configurez votre boutique une fois pour toutes. Tout reste ensuite dans cet appareil, hors ligne.
            </p>
          </div>

          <div className="carte space-y-5 p-5 shadow-xl sm:p-6">
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
                <Libelle>Code PIN (4 chiffres) *</Libelle>
                <Champ
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="••••"
                />
              </div>
              <div>
                <Libelle>Répétez le PIN *</Libelle>
                <Champ
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoComplete="off"
                  value={pin2}
                  onChange={(e) => setPin2(e.target.value)}
                  placeholder="••••"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
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
                    maxLength={4}
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

        <div className="text-center">
          <button type="button" onClick={() => navigate('/connexion')} className="text-xs text-white/60 underline-offset-2 hover:text-white hover:underline">
            J'ai déjà une boutique → Se connecter
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
          <p className="mb-3 text-xs text-white/55">
            Vous êtes caissier ? Ne créez pas de boutique : demandez au gérant une sauvegarde de la boutique, puis restaurez-la ici.
          </p>
          <Bouton variante="secondaire" taille="sm" onClick={() => inputSauvegardeRef.current?.click()}>
            <Upload className="size-4" /> Restaurer une sauvegarde
          </Bouton>
          <input
            ref={inputSauvegardeRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void restaurerSauvegarde(f);
              e.target.value = '';
            }}
          />
          {erreurSauvegarde && <div className="mt-3"><Alerte>{erreurSauvegarde}</Alerte></div>}
        </div>
      </div>
    </div>
  );
}
