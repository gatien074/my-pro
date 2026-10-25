import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, Plus, Search } from 'lucide-react';
import { db } from '../db/db';
import { enregistrerClient } from '../db/ops';
import { resteDette, statutVisible } from '../lib/calc';
import { finDeJour } from '../lib/dates';
import { formatFCFA } from '../lib/money';
import { initiales } from '../lib/helpers';
import { Alerte, Bouton, Champ, EtatVide, Libelle, Modale, ZoneTexte } from '../components/ui';

export default function Clients() {
  const clients = useLiveQuery(() => db.customers.toArray(), []);
  const dettes = useLiveQuery(() => db.debts.toArray(), []);

  const [recherche, setRecherche] = useState('');
  const [formOuvert, setFormOuvert] = useState(false);
  const [champs, setChamps] = useState({ nom: '', telephone: '', note: '' });
  const [erreur, setErreur] = useState('');

  const encoursParClient = useMemo(() => {
    finDeJour(); // garantit un statut à jour (échéances dépassées)
    const m = new Map<number, { total: number; retards: number }>();
    for (const d of dettes ?? []) {
      const reste = resteDette(d);
      if (reste <= 0) continue;
      const actuelle = m.get(d.clientId) ?? { total: 0, retards: 0 };
      actuelle.total += reste;
      if (statutVisible(d) === 'en_retard') actuelle.retards += 1;
      m.set(d.clientId, actuelle);
    }
    return m;
  }, [dettes]);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (clients ?? [])
      .filter((c) => !q || c.nom.toLowerCase().includes(q) || (c.telephone ?? '').includes(q))
      .sort(
        (a, b) =>
          (encoursParClient.get(b.id!)?.total ?? 0) - (encoursParClient.get(a.id!)?.total ?? 0) ||
          a.nom.localeCompare(b.nom),
      );
  }, [clients, recherche, encoursParClient]);

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur('');
    try {
      await enregistrerClient(champs);
      setFormOuvert(false);
      setChamps({ nom: '', telephone: '', note: '' });
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  return (
    <div className="space-y-3 p-3 lg:p-4">
      <div className="flex items-center justify-between">
        <h1 className="titre-page">Clients &amp; dettes</h1>
        <Bouton onClick={() => setFormOuvert(true)}>
          <Plus className="size-4" /> Nouveau client
        </Bouton>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
        <input
          className="champ pl-9"
          placeholder="Rechercher un nom ou un téléphone…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />
      </div>

      {liste.length === 0 ? (
        <EtatVide
          titre="Aucun client"
          texte="Les ventes à crédit créent automatiquement une fiche client. Vous pouvez aussi les ajouter ici, avec leurs dettes de l'ancien cahier."
        />
      ) : (
        <div className="carte overflow-hidden">
          <ul className="divide-y divide-slate-100">
            {liste.map((c) => {
              const acc = encoursParClient.get(c.id!);
              return (
                <li key={c.id}>
                  <Link to={`/clients/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                      {initiales(c.nom)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-slate-800">{c.nom}</span>
                      <span className="text-xs text-slate-400">{c.telephone ?? 'Téléphone non renseigné'}</span>
                    </span>
                    {acc && acc.total > 0 ? (
                      <span className="text-right">
                        <span className="cellule-tabulaire block text-sm font-bold text-red-600">{formatFCFA(acc.total)}</span>
                        <span className="text-xs text-slate-400">{acc.retards > 0 ? `${acc.retards} dette(s) en retard` : 'en cours'}</span>
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">À jour</span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-slate-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Modale
        ouverte={formOuvert}
        onFermer={() => setFormOuvert(false)}
        titre="Nouveau client"
        piedDePage={
          <>
            <Bouton variante="secondaire" onClick={() => setFormOuvert(false)}>Annuler</Bouton>
            <Bouton type="submit" form="form-client">Enregistrer</Bouton>
          </>
        }
      >
        <form id="form-client" onSubmit={soumettre} className="space-y-3">
          <div>
            <Libelle>Nom *</Libelle>
            <Champ value={champs.nom} onChange={(e) => setChamps((c) => ({ ...c, nom: e.target.value }))} placeholder="Ex. Mme Ndong Béatrice" autoFocus />
          </div>
          <div>
            <Libelle>Téléphone (pour la relance WhatsApp)</Libelle>
            <Champ value={champs.telephone} onChange={(e) => setChamps((c) => ({ ...c, telephone: e.target.value }))} placeholder="06 12 34 56" />
          </div>
          <div>
            <Libelle>Note (facultatif)</Libelle>
            <ZoneTexte value={champs.note} onChange={(e) => setChamps((c) => ({ ...c, note: e.target.value }))} placeholder="Quartier, habitudes d'achat…" />
          </div>
          {erreur && <Alerte>{erreur}</Alerte>}
        </form>
      </Modale>
    </div>
  );
}
