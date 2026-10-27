import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, MessageCircle, Phone, Plus, Send } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../db/hooks';
import { encaisserDette, creerDetteManuelle } from '../db/ops';
import type { Dette, ModePaiement } from '../db/types';
import { resteDette, statutVisible } from '../lib/calc';
import { enDateInput, depuisDateInput, formaterDate, finDeJour, JOUR_MS } from '../lib/dates';
import { formatFCFA, formatNombre, versMontant } from '../lib/money';
import {
  initiales,
  lienAppel,
  lienWhatsApp,
  LIBELLES_MODES,
  LIBELLES_STATUTS_DETTE,
  LIBELLES_STATUTS_VENTE,
} from '../lib/helpers';
import { Alerte, Badge, Bouton, Champ, EtatVide, Libelle, Liste, Modale, Montant, ZoneTexte } from '../components/ui';

type StatutAffiche = ReturnType<typeof statutVisible>;

const COULEUR_STATUT: Record<StatutAffiche, 'vert' | 'ambre' | 'rouge' | 'gris'> = {
  en_cours: 'ambre',
  en_retard: 'rouge',
  soldee: 'vert',
  annulee: 'gris',
};

export default function ClientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const clientId = Number(id);
  const { settings } = useSettings();

  const client = useLiveQuery(() => db.customers.get(clientId), [clientId]);
  const dettes = useLiveQuery(() => db.debts.where('clientId').equals(clientId).toArray(), [clientId]);
  const ventes = useLiveQuery(() => db.sales.where('clientId').equals(clientId).sortBy('date'), [clientId]);

  const [paiement, setPaiement] = useState<{ dette: Dette; montant: string; mode: ModePaiement; note: string } | null>(null);
  const [erreurPaiement, setErreurPaiement] = useState('');
  const [detteOuverte, setDetteOuverte] = useState(false);
  const [detteForm, setDetteForm] = useState({ montant: '', motif: '', echeance: enDateInput(Date.now() + 15 * JOUR_MS) });
  const [erreurDette, setErreurDette] = useState('');

  const finJour = useMemo(() => finDeJour(), []);
  const actives = useMemo(
    () => (dettes ?? []).filter((d) => resteDette(d) > 0).sort((a, b) => (a.echeance ?? Number.MAX_SAFE_INTEGER) - (b.echeance ?? Number.MAX_SAFE_INTEGER)),
    [dettes],
  );
  const closes = useMemo(() => (dettes ?? []).filter((d) => resteDette(d) <= 0), [dettes]);
  const totalDu = useMemo(() => actives.reduce((s, d) => s + resteDette(d), 0), [actives]);
  const nbRetards = useMemo(() => actives.filter((d) => d.echeance && d.echeance < finJour).length, [actives, finJour]);

  const ventesMap = useMemo(() => new Map((ventes ?? []).map((v) => [v.id!, v])), [ventes]);

  if (client === undefined) {
    return (
      <div className="p-4">
        <Bouton variante="fantome" onClick={() => navigate('/clients')}>
          <ArrowLeft className="size-4" /> Retour
        </Bouton>
        <p className="mt-4 text-sm text-slate-400">Chargement…</p>
      </div>
    );
  }
  if (client === null) {
    return (
      <div className="p-4">
        <EtatVide titre="Client introuvable">
          <Bouton variante="secondaire" onClick={() => navigate('/clients')}>Retour aux clients</Bouton>
        </EtatVide>
      </div>
    );
  }

  const wa = lienWhatsApp(client.telephone, `Bonjour ${client.nom}, c'est ${settings?.nomBoutique ?? 'votre boutique'}. Nous vous rappelons gentiment le solde de votre crédit : ${formatFCFA(totalDu)}. Merci d'avance pour votre règlement !`);

  async function confirmerPaiement(e: FormEvent) {
    e.preventDefault();
    if (!paiement) return;
    setErreurPaiement('');
    try {
      await encaisserDette(paiement.dette.id!, {
        montant: versMontant(paiement.montant),
        mode: paiement.mode as Exclude<ModePaiement, 'credit'>,
        note: paiement.note,
      });
      setPaiement(null);
    } catch (err) {
      setErreurPaiement(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  async function soumettreDette(e: FormEvent) {
    e.preventDefault();
    setErreurDette('');
    try {
      await creerDetteManuelle({
        clientId,
        montant: versMontant(detteForm.montant),
        motif: detteForm.motif,
        echeance: detteForm.echeance ? depuisDateInput(detteForm.echeance) : undefined,
      });
      setDetteOuverte(false);
      setDetteForm({ montant: '', motif: '', echeance: enDateInput(Date.now() + 15 * JOUR_MS) });
    } catch (err) {
      setErreurDette(err instanceof Error ? err.message : 'Erreur inattendue.');
    }
  }

  return (
    <div className="space-y-4 p-3 lg:p-4">
      <div className="flex items-center gap-2">
        <Bouton variante="fantome" taille="sm" onClick={() => navigate('/clients')}>
          <ArrowLeft className="size-4" /> Clients
        </Bouton>
      </div>

      <div className="carte flex flex-wrap items-center gap-4 p-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-brand-100 text-base font-bold text-brand-700">
          {initiales(client.nom)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold text-slate-800">{client.nom}</h1>
          <p className="text-sm text-slate-500">{client.telephone ?? 'Téléphone non renseigné'}</p>
          {client.note && <p className="mt-0.5 text-xs text-slate-400">{client.note}</p>}
        </div>
        <div className="text-right">
          <p className="text-xs font-medium text-slate-500">Total dû</p>
          <p className={`cellule-tabulaire font-display text-2xl font-bold ${totalDu > 0 ? 'text-red-600' : 'text-green-700'}`}>
            <Montant valeur={formatNombre(totalDu)} />
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer">
            <Bouton taille="sm" variante="accent">
              <MessageCircle className="size-4" /> Relancer par WhatsApp
            </Bouton>
          </a>
        )}
        {lienAppel(client.telephone) && (
          <a href={lienAppel(client.telephone)!} target="_blank" rel="noreferrer">
            <Bouton taille="sm" variante="secondaire">
              <Phone className="size-4" /> Appeler
            </Bouton>
          </a>
        )}
        <Bouton taille="sm" onClick={() => setDetteOuverte(true)}>
          <Plus className="size-4" /> Nouvelle dette (ancien cahier)
        </Bouton>
      </div>

      {nbRetards > 0 && (
        <Alerte>
          {nbRetards} dette(s) ont dépassé leur échéance. Une relance par WhatsApp est recommandée : {formatFCFA(totalDu)} au total.
        </Alerte>
      )}

      <div className="carte p-4">
        <h2 className="mb-2 text-sm font-bold text-slate-700">Dettes en cours</h2>
        {actives.length === 0 ? (
          <p className="text-sm text-slate-400">Aucune dette : ce client est à jour.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {actives.map((d) => {
              const statut = statutVisible(d);
              const vente = d.venteId != null ? ventesMap.get(d.venteId) : undefined;
              const waDette = lienWhatsApp(client.telephone, `Bonjour ${client.nom}, c'est ${settings?.nomBoutique ?? 'votre boutique'}. Nous vous rappelons le solde de ${formatFCFA(resteDette(d))} (${formaterDate(d.date)}). Merci d'avance !`);
              return (
                <li key={d.id} className="flex flex-wrap items-center gap-2 py-3">
                  <div className="min-w-40 flex-1">
                    <p className="text-sm font-semibold text-slate-800">
                      <Montant valeur={formatNombre(d.montant)} />
                    </p>
                    <p className="text-xs text-slate-400">
                      {formaterDate(d.date)} · payé {formatNombre(d.montantPaye)} · reste{' '}
                      <span className="font-bold text-red-600">
                        <Montant valeur={formatNombre(resteDette(d))} />
                      </span>
                      {vente ? ` · vente ${vente.numero}` : ` · ${d.motif ?? 'Dette'}`}
                    </p>
                  </div>
                  <Badge couleur={COULEUR_STATUT[statut]}>{LIBELLES_STATUTS_DETTE[statut]}</Badge>
                  {d.echeance && <span className="text-xs text-slate-400">échéance : {formaterDate(d.echeance)}</span>}
                  <div className="flex gap-1.5">
                    {waDette && (
                      <a href={waDette} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-amber-600 hover:bg-amber-50" aria-label="Relancer sur WhatsApp">
                        <Send className="size-4" />
                      </a>
                    )}
                    <Bouton
                      taille="sm"
                      onClick={() => {
                        setPaiement({ dette: d, montant: String(resteDette(d)), mode: 'especes', note: '' });
                        setErreurPaiement('');
                      }}
                    >
                      Encaisser
                    </Bouton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(closes.length > 0 || (ventes ?? []).length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {closes.length > 0 && (
            <div className="carte p-4">
              <h2 className="mb-2 text-sm font-bold text-slate-700">Dettes réglées / annulées</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {closes.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-slate-600">
                      <Montant valeur={formatNombre(d.montant)} /> · {formaterDate(d.date)}
                    </span>
                    <Badge couleur={COULEUR_STATUT[statutVisible(d)]}>{LIBELLES_STATUTS_DETTE[statutVisible(d)]}</Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(ventes ?? []).length > 0 && (
            <div className="carte p-4">
              <h2 className="mb-2 text-sm font-bold text-slate-700">Historique des ventes</h2>
              <ul className="divide-y divide-slate-100 text-sm">
                {(ventes ?? []).slice().reverse().slice(0, 15).map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-medium text-slate-700">{v.numero}</span>
                      <span className="ml-2 text-xs text-slate-400">{formaterDate(v.date)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="cellule-tabulaire font-semibold text-slate-700">
                        <Montant valeur={formatNombre(v.total)} />
                      </span>
                      <Badge couleur={v.statut === 'annulee' ? 'rouge' : v.mode === 'credit' ? 'ambre' : 'gris'}>
                        {v.statut === 'annulee' ? LIBELLES_STATUTS_VENTE.annulee : LIBELLES_MODES[v.mode]}
                      </Badge>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Modale encaissement */}
      <Modale
        ouverte={paiement !== null}
        onFermer={() => setPaiement(null)}
        titre={paiement ? `Encaissement — reste ${formatFCFA(resteDette(paiement.dette))}` : ''}
        piedDePage={
          <>
            <Bouton variante="secondaire" onClick={() => setPaiement(null)}>Annuler</Bouton>
            <Bouton type="submit" form="form-paiement">Enregistrer le paiement</Bouton>
          </>
        }
      >
        {paiement && (
          <form id="form-paiement" onSubmit={confirmerPaiement} className="space-y-3">
            <div>
              <Libelle>Montant reçu</Libelle>
              <Champ type="number" inputMode="numeric" value={paiement.montant} onChange={(e) => setPaiement({ ...paiement, montant: e.target.value })} autoFocus />
            </div>
            <div>
              <Libelle>Mode d'encaissement</Libelle>
              <Liste value={paiement.mode} onChange={(e) => setPaiement({ ...paiement, mode: e.target.value as ModePaiement })}>
                <option value="especes">Espèces</option>
                <option value="airtel">Airtel Money</option>
                <option value="moov">Moov Money</option>
              </Liste>
            </div>
            <div>
              <Libelle>Note (facultatif)</Libelle>
              <ZoneTexte value={paiement.note} onChange={(e) => setPaiement({ ...paiement, note: e.target.value })} placeholder="Ex. payé au comptoir" />
            </div>
            {erreurPaiement && <Alerte>{erreurPaiement}</Alerte>}
          </form>
        )}
      </Modale>

      {/* Modale nouvelle dette manuelle */}
      <Modale
        ouverte={detteOuverte}
        onFermer={() => setDetteOuverte(false)}
        titre="Nouvelle dette (ancien cahier)"
        piedDePage={
          <>
            <Bouton variante="secondaire" onClick={() => setDetteOuverte(false)}>Annuler</Bouton>
            <Bouton type="submit" form="form-dette">Enregistrer</Bouton>
          </>
        }
      >
        <form id="form-dette" onSubmit={soumettreDette} className="space-y-3">
          <p className="text-xs text-slate-500">
            Utilisez cette option pour transcrire une dette notée à la main dans le cahier. Les dettes de vente à crédit sont créées automatiquement en caisse.
          </p>
          <div>
            <Libelle>Montant dû (FCFA) *</Libelle>
            <Champ type="number" inputMode="numeric" value={detteForm.montant} onChange={(e) => setDetteForm((f) => ({ ...f, montant: e.target.value }))} autoFocus />
          </div>
          <div>
            <Libelle>Motif</Libelle>
            <Champ value={detteForm.motif} onChange={(e) => setDetteForm((f) => ({ ...f, motif: e.target.value }))} placeholder="Ex. sac de riz de mai" />
          </div>
          <div>
            <Libelle>Échéance</Libelle>
            <Champ type="date" value={detteForm.echeance} onChange={(e) => setDetteForm((f) => ({ ...f, echeance: e.target.value }))} />
          </div>
          {erreurDette && <Alerte>{erreurDette}</Alerte>}
        </form>
      </Modale>
    </div>
  );
}
