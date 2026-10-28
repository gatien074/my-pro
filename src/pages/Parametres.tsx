import { useRef, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DatabaseBackup, Download, RotateCcw, Store, Trash2, Upload, UserPlus, Users2 } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../db/hooks';
import {
  ajouterCategorie,
  creerUtilisateur,
  majSettings,
  majUtilisateur,
  redefinirPin,
  supprimerCategorie,
  supprimerUtilisateur,
} from '../db/ops';
import { semerDonneesDemo } from '../db/seed';
import {
  analyserSauvegarde,
  lireFichierTexte,
  restaurerDonnees,
  telechargerSauvegarde,
  toutEffacer,
} from '../db/backup';
import { pinValide } from '../lib/pin';
import { formatNombre } from '../lib/money';
import { useSession } from '../store/session';
import { Alerte, Badge, Bouton, Champ, Libelle, Liste, Modale } from '../components/ui';

export default function Parametres() {
  const { settings } = useSettings();
  const utilisateurs = useLiveQuery(() => db.users.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const produits = useLiveQuery(() => db.products.toArray(), []);
  const deconnecter = useSession((s) => s.deconnecter);

  /* ------ Boutique ------ */
  const [formBoutique, setFormBoutique] = useState(() => ({
    nomBoutique: settings?.nomBoutique ?? '',
    adresse: settings?.adresse ?? '',
    telephone: settings?.telephone ?? '',
    piedTicket: settings?.piedTicket ?? '',
    seuilAlerteDefaut: String(settings?.seuilAlerteDefaut ?? 5),
    autoriserStockNegatif: settings?.autoriserStockNegatif ?? false,
  }));
  const [msgBoutique, setMsgBoutique] = useState('');

  async function enregistrerBoutique(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    if (!formBoutique.nomBoutique.trim()) {
      setMsgBoutique('Le nom de la boutique est obligatoire.');
      return;
    }
    await majSettings({
      nomBoutique: formBoutique.nomBoutique.trim(),
      adresse: formBoutique.adresse.trim() || undefined,
      telephone: formBoutique.telephone.trim() || undefined,
      piedTicket: formBoutique.piedTicket.trim(),
      seuilAlerteDefaut: Number(formBoutique.seuilAlerteDefaut || 5),
      autoriserStockNegatif: formBoutique.autoriserStockNegatif,
    });
    setMsgBoutique('Paramètres enregistrés.');
    setTimeout(() => setMsgBoutique(''), 3000);
  }

  /* ------ Utilisateurs ------ */
  const [formUser, setFormUser] = useState<{ ouverte: boolean; nom: string; role: 'gerant' | 'caissier'; pin: string }>({ ouverte: false, nom: '', role: 'caissier', pin: '' });
  const [pinUser, setPinUser] = useState<number | null>(null);
  const [nouveauPin, setNouveauPin] = useState('');
  const [erreurUser, setErreurUser] = useState('');

  async function soumettreUser(e: FormEvent) {
    e.preventDefault();
    setErreurUser('');
    try {
      if (!formUser.nom.trim()) throw new Error('Le nom est obligatoire.');
      if (!pinValide(formUser.pin)) throw new Error('Le PIN doit contenir 4 chiffres.');
      await creerUtilisateur({ nom: formUser.nom, role: formUser.role, pin: formUser.pin });
      setFormUser({ ouverte: false, nom: '', role: 'caissier', pin: '' });
    } catch (err) {
      setErreurUser(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  async function changerPin(e: FormEvent) {
    e.preventDefault();
    if (pinUser == null) return;
    setErreurUser('');
    try {
      if (!pinValide(nouveauPin)) throw new Error('Le PIN doit contenir 4 chiffres.');
      await redefinirPin(pinUser, nouveauPin);
      setPinUser(null);
      setNouveauPin('');
    } catch (err) {
      setErreurUser(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  async function basculerActif(userId: number, actif: boolean) {
    setErreurUser('');
    try {
      await majUtilisateur(userId, { actif });
    } catch (err) {
      setErreurUser(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  /* ------ Catégories ------ */
  const [nouvelleCat, setNouvelleCat] = useState('');
  const [erreurCat, setErreurCat] = useState('');

  async function ajouterCat(e: FormEvent) {
    e.preventDefault();
    setErreurCat('');
    try {
      await ajouterCategorie(nouvelleCat);
      setNouvelleCat('');
    } catch (err) {
      setErreurCat(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  /* ------ Données ------ */
  const inputImport = useRef<HTMLInputElement>(null);
  const [msgDonnees, setMsgDonnees] = useState('');
  const [erreurDonnees, setErreurDonnees] = useState('');
  const [confirmEffacer, setConfirmEffacer] = useState('');
  const [surementEffacer, setSurementEffacer] = useState(false);

  async function exporter() {
    setMsgDonnees('');
    try {
      await telechargerSauvegarde();
      setMsgDonnees('Sauvegarde téléchargée. Conservez-la sur une clé USB ou dans un dossier sûr.');
    } catch (err) {
      setErreurDonnees(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  async function importer(file: File) {
    setMsgDonnees('');
    setErreurDonnees('');
    try {
      const texte = await lireFichierTexte(file);
      const sauvegarde = analyserSauvegarde(texte);
      const ok = window.confirm(
        `Restaurer la sauvegarde du ${new Date(sauvegarde.dateSauvegarde).toLocaleString('fr-FR')} ?\n\nATTENTION : toutes les données actuelles seront remplacées.`,
      );
      if (!ok) return;
      await restaurerDonnees(sauvegarde);
      deconnecter();
    } catch (err) {
      setErreurDonnees(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  async function rejouerDemo() {
    setMsgDonnees('');
    setErreurDonnees('');
    try {
      await toutEffacer();
      await semerDonneesDemo();
      setMsgDonnees('Données de démonstration recréées.');
    } catch (err) {
      setErreurDonnees(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  async function effacerTout() {
    setMsgDonnees('');
    setErreurDonnees('');
    try {
      await toutEffacer();
      deconnecter();
    } catch (err) {
      setErreurDonnees(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  /* ------ Catégorie suppression helper ------ */
  async function supprimerCat(id: number) {
    setErreurCat('');
    try {
      await supprimerCategorie(id);
    } catch (err) {
      setErreurCat(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  if (!settings) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-3 lg:p-4">
      <h1 className="titre-page">Paramètres</h1>

      {/* Boutique */}
      <section className="carte p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
          <Store className="size-4" /> Boutique
        </h2>
        <form onSubmit={enregistrerBoutique} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Libelle>Nom de la boutique</Libelle>
              <Champ value={formBoutique.nomBoutique} onChange={(e) => setFormBoutique((f) => ({ ...f, nomBoutique: e.target.value }))} />
            </div>
            <div>
              <Libelle>Téléphone</Libelle>
              <Champ value={formBoutique.telephone} onChange={(e) => setFormBoutique((f) => ({ ...f, telephone: e.target.value }))} />
            </div>
          </div>
          <div>
            <Libelle>Adresse (affichée sur le ticket)</Libelle>
            <Champ value={formBoutique.adresse} onChange={(e) => setFormBoutique((f) => ({ ...f, adresse: e.target.value }))} placeholder="Ex. Marché Mont-Bouët, Libreville" />
          </div>
          <div>
            <Libelle>Pied du ticket</Libelle>
            <Champ value={formBoutique.piedTicket} onChange={(e) => setFormBoutique((f) => ({ ...f, piedTicket: e.target.value }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Libelle>Seuil d'alerte par défaut</Libelle>
              <Champ type="number" inputMode="numeric" min={0} value={formBoutique.seuilAlerteDefaut} onChange={(e) => setFormBoutique((f) => ({ ...f, seuilAlerteDefaut: e.target.value }))} />
            </div>
            <label className="flex items-start gap-2.5 self-end rounded-xl bg-slate-50 p-3">
              <input type="checkbox" checked={formBoutique.autoriserStockNegatif} onChange={(e) => setFormBoutique((f) => ({ ...f, autoriserStockNegatif: e.target.checked }))} className="mt-0.5 size-4 accent-teal-600" />
              <span className="text-sm text-slate-600">
                Autoriser la vente sans stock
                <span className="block text-xs text-slate-400">
                  Utile quand les données de l'inventaire n'ont pas encore été saisies.
                </span>
              </span>
            </label>
          </div>
          {msgBoutique && <Alerte type="info">{msgBoutique}</Alerte>}
          <Bouton type="submit">Enregistrer</Bouton>
        </form>
      </section>

      {/* Utilisateurs */}
      <section className="carte p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Users2 className="size-4" /> Utilisateurs
          </h2>
          <Bouton taille="sm" onClick={() => { setFormUser({ ouverte: true, nom: '', role: 'caissier', pin: '' }); setErreurUser(''); }}>
            <UserPlus className="size-4" /> Ajouter
          </Bouton>
        </div>
        {erreurUser && <div className="mb-2"><Alerte>{erreurUser}</Alerte></div>}
        <ul className="divide-y divide-slate-100 text-sm">
          {(utilisateurs ?? []).map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="font-medium text-slate-800">{u.nom}</span>
                {u.role === 'gerant' && <Badge couleur="teal" className="ml-2">Gérant</Badge>}
                {u.role === 'caissier' && <Badge couleur="gris" className="ml-2">Caissier</Badge>}
                <Badge couleur={u.actif ? 'vert' : 'rouge'} className="ml-2">{u.actif ? 'Actif' : 'Désactivé'}</Badge>
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <Bouton taille="sm" variante="secondaire" onClick={() => { setPinUser(u.id!); setNouveauPin(''); setErreurUser(''); }}>
                  Modifier le PIN
                </Bouton>
                <Bouton taille="sm" variante="secondaire" onClick={() => void basculerActif(u.id!, !u.actif)}>
                  {u.actif ? 'Désactiver' : 'Activer'}
                </Bouton>
                <Bouton
                  taille="sm"
                  variante="danger"
                  onClick={async () => {
                    if (!confirm(`Supprimer définitivement l'utilisateur ${u.nom} ?`)) return;
                    try {
                      await supprimerUtilisateur(u.id!);
                    } catch (err) {
                      alert(err instanceof Error ? err.message : 'Erreur');
                    }
                  }}
                >
                  <Trash2 className="size-4" /> Supprimer
                </Bouton>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Catégories */}
      <section className="carte p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-700">Catégories</h2>
        {erreurCat && <div className="mb-2"><Alerte>{erreurCat}</Alerte></div>}
        <form onSubmit={ajouterCat} className="mb-3 flex gap-2">
          <Champ value={nouvelleCat} onChange={(e) => setNouvelleCat(e.target.value)} placeholder="Nouvelle catégorie…" />
          <Bouton type="submit">Ajouter</Bouton>
        </form>
        {(categories ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">Aucune catégorie.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(categories ?? []).map((c) => {
              const nb = (produits ?? []).filter((p) => p.categoryId === c.id).length;
              return (
                <span key={c.id} className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-3 pr-1.5 text-sm">
                  {c.nom}
                  <span className="text-xs text-slate-400">{formatNombre(nb)}</span>
                  <button
                    type="button"
                    onClick={() => void supprimerCat(c.id!)}
                    className="rounded-full p-1 text-slate-300 hover:bg-red-50 hover:text-red-600"
                    aria-label={`Supprimer ${c.nom}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </section>

      {/* Données */}
      <section className="carte p-4">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-700">
          <DatabaseBackup className="size-4" /> Données &amp; sauvegarde
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          Les données restent dans cet appareil. Exportez régulièrement une sauvegarde (par ex. le dimanche) et conservez-la ailleurs.
        </p>
        <div className="flex flex-wrap gap-2">
          <Bouton onClick={() => void exporter()}>
            <Download className="size-4" /> Exporter une sauvegarde
          </Bouton>
          <Bouton variante="secondaire" onClick={() => inputImport.current?.click()}>
            <Upload className="size-4" /> Restaurer une sauvegarde
          </Bouton>
          <input
            ref={inputImport}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importer(f);
              e.target.value = '';
            }}
          />
          {settings.modeDemo && (
            <Bouton variante="accent" onClick={() => void rejouerDemo()}>
              <RotateCcw className="size-4" /> Recharger la démo
            </Bouton>
          )}
        </div>
        {msgDonnees && <div className="mt-3"><Alerte type="info">{msgDonnees}</Alerte></div>}
        {erreurDonnees && <div className="mt-3"><Alerte>{erreurDonnees}</Alerte></div>}

        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-sm font-semibold text-red-700">Zone dangereuse</p>
          <p className="text-xs text-red-600/80">Efface toutes les données de l'application (boutique, produits, ventes, dettes…). Faites d'abord une sauvegarde !</p>
          <div className="mt-2 flex gap-2">
            <Champ
              className="w-44"
              placeholder="Tapez EFFACER"
              value={confirmEffacer}
              onChange={(e) => {
                setConfirmEffacer(e.target.value);
                setSurementEffacer(e.target.value.trim().toUpperCase() === 'EFFACER');
              }}
            />
            <Bouton variante="danger" disabled={!surementEffacer} onClick={() => void effacerTout()}>
              <Trash2 className="size-4" /> Tout effacer
            </Bouton>
          </div>
        </div>
      </section>

      {/* Modales utilisateurs */}
      <Modale
        ouverte={formUser.ouverte}
        onFermer={() => setFormUser((f) => ({ ...f, ouverte: false }))}
        titre="Nouvel utilisateur"
        piedDePage={
          <>
            <Bouton variante="secondaire" onClick={() => setFormUser((f) => ({ ...f, ouverte: false }))}>Annuler</Bouton>
            <Bouton type="submit" form="form-user">Créer</Bouton>
          </>
        }
      >
        <form id="form-user" onSubmit={soumettreUser} className="space-y-3">
          <div>
            <Libelle>Nom</Libelle>
            <Champ value={formUser.nom} onChange={(e) => setFormUser((f) => ({ ...f, nom: e.target.value }))} autoFocus />
          </div>
          <div>
            <Libelle>Rôle</Libelle>
            <Liste value={formUser.role} onChange={(e) => setFormUser((f) => ({ ...f, role: e.target.value as 'gerant' | 'caissier' }))}>
              <option value="caissier">Caissier (caisse, produits, clients)</option>
              <option value="gerant">Gérant (tout, y compris les rapports)</option>
            </Liste>
          </div>
          <div>
            <Libelle>Code PIN (4 chiffres)</Libelle>
            <Champ type="password" inputMode="numeric" maxLength={4} value={formUser.pin} onChange={(e) => setFormUser((f) => ({ ...f, pin: e.target.value }))} />
          </div>
          {erreurUser && <Alerte>{erreurUser}</Alerte>}
        </form>
      </Modale>

      <Modale
        ouverte={pinUser != null}
        onFermer={() => setPinUser(null)}
        titre="Modifier le code PIN"
        piedDePage={
          <>
            <Bouton variante="secondaire" onClick={() => setPinUser(null)}>Annuler</Bouton>
            <Bouton type="submit" form="form-pin">Enregistrer</Bouton>
          </>
        }
      >
        <form id="form-pin" onSubmit={changerPin} className="space-y-3">
          <div>
            <Libelle>Nouveau PIN (4 chiffres)</Libelle>
            <Champ type="password" inputMode="numeric" maxLength={4} value={nouveauPin} onChange={(e) => setNouveauPin(e.target.value)} autoFocus />
          </div>
          {erreurUser && <Alerte>{erreurUser}</Alerte>}
        </form>
      </Modale>
    </div>
  );
}
