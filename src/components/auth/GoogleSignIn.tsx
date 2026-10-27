import { useEffect, useRef, useCallback, useState } from 'react';
import {
  loadGoogleSdk,
  extraireProfilGoogle,
  googleEstConfigurable,
  CLIENT_ID,
} from '../../lib/googleAuth';
import { creerOuLierUtilisateurGoogle } from '../../db/ops';
import { useSession } from '../../store/session';
import { Alerte } from '../ui';

interface GoogleSignInProps {
  onSucces?: (user: { id: number; nom: string; role: string }) => void;
}

export default function GoogleSignIn({ onSucces }: GoogleSignInProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const connecter = useSession((s) => s.connecter);
  const [erreur, setErreur] = useState<string>('');
  const [enCours, setEnCours] = useState(false);

  const handleCredentialResponse = useCallback(
    async (credentialResponse: { credential: string }) => {
      setEnCours(true);
      setErreur('');
      try {
        const profil = extraireProfilGoogle(credentialResponse.credential);
        const user = await creerOuLierUtilisateurGoogle({
          nom: profil.nom,
          email: profil.email,
          googleId: profil.googleId,
          imageUrl: profil.imageUrl,
          role: 'caissier',
        });
        connecter({ id: user.id!, nom: user.nom, role: user.role });
        onSucces?.({ id: user.id!, nom: user.nom, role: user.role });
      } catch (err) {
        setErreur(err instanceof Error ? err.message : 'Erreur lors de la connexion Google.');
      } finally {
        setEnCours(false);
      }
    },
    [connecter, onSucces],
  );

  useEffect(() => {
    if (!googleEstConfigurable()) {
      setErreur(
        'Connexion Google non configurée : ajoutez la variable VITE_GOOGLE_CLIENT_ID (Google Cloud Console).',
      );
      return;
    }

    let annule = false;
    (async () => {
      await loadGoogleSdk();
      if (annule) return;

      const g = (window as unknown as {
        google: {
          accounts: {
            id: {
              initialize: (config: {
                clientId: string;
                callback: (resp: { credential: string }) => void;
              }) => void;
              renderButton: (elem: HTMLElement, options: Record<string, unknown>) => void;
            };
          };
        };
      }).google;

      g.accounts.id.initialize({
        clientId: CLIENT_ID!,
        callback: handleCredentialResponse,
      });

      if (buttonRef.current) {
        g.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: '100%',
          text: 'signin_with',
          logo_alignment: 'center',
        });
      }
    })();

    return () => {
      annule = true;
    };
  }, [handleCredentialResponse]);

  return (
    <div className="space-y-2">
      {erreur && <Alerte>{erreur}</Alerte>}
      <div ref={buttonRef} className="w-full" />
      {enCours && (
        <p className="text-xs text-slate-500 text-center">Connexion Google en cours…</p>
      )}
    </div>
  );
}
