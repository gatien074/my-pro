import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Banknote, CalendarClock, Smartphone, Users } from 'lucide-react';
import { db } from '../../db/db';
import { creerVente } from '../../db/ops';
import type { Vente } from '../../db/types';
import { depuisDateInput, enDateInput, JOUR_MS } from '../../lib/dates';
import { formatFCFA, formatNombre, versMontant } from '../../lib/money';
import type { LignePanier } from '../../store/cart';
import { Alerte, Bouton, Champ, cn, Liste, Libelle, Modale, Montant } from '../ui';

export interface BrouillonVente {
  lignes: LignePanier[];
  remise: number;
  sousTotal: number;
  total: number;
}

type ModeActif = 'especes' | 'airtel' | 'moov' | 'credit';

const OPTIONS: Array<{ id: ModeActif; libelle: string; icone: typeof Banknote }> = [
  { id: 'especes', libelle: 'Espèces', icone: Banknote },
  { id: 'airtel', libelle: 'Airtel Money', icone: Smartphone },
  { id: 'moov', libelle: 'Moov Money', icone: Smartphone },
  { id: 'credit', libelle: 'Crédit client', icone: Users },
];

interface Props {
  brouillon: BrouillonVente;
  vendeurId: number;
  onFermer: () => void;
  onTermine: (v: Vente) => void;
}

export default function PaymentDialog({ brouillon, vendeurId, onFermer, onTermine }: Props) {
  const clients = useLiveQuery(() => db.customers.toArray(), []);
  const [mode, setMode] = useState<ModeActif>('especes');
  const [montantRecu, setMontantRecu] = useState<number>(brouillon.total);
  const [clientId, setClientId] = useState<number | null>(null);
  const [nouveauClient, setNouveauClient] = useState('');
  const [acompte, setAcompte] = useState(0);
  const [echeance, setEcheance] = useState<string>(() => enDateInput(Date.now() + 7 * JOUR_MS));
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const rendu = useMemo(() => Math.max(0, montantRecu - brouillon.total), [montantRecu, brouillon.total]);
  const reste = brouillon.total - acompte;

  // Montants de saisie rapide pour espèces (arrondis pratiques au Gabon)
  const montantsRapides = useMemo(() => {
    const total = brouillon.total;
    return [
      { label: 'Total', valeur: total },
      { label: 'Arrondi 100', valeur: Math.ceil(total / 100) * 100 },
      { label: 'Arrondi 500', valeur: Math.ceil(total / 500) * 500 },
    ];
  }, [brouillon.total]);

  async function confirmer() {
    setErreur('');
    setEnCours(true);
    try {
      let idClientFinal = clientId ?? undefined;
      if (mode === 'credit') {
        if (nouveauClient.trim()) {
          idClientFinal = await db.customers.add({ nom: nouveauClient.trim(), creeLe: Date.now() });
        } else if (idClientFinal == null) {
          throw new Error('Choisissez ou créez un client pour la vente à crédit.');
        }
        if (reste < 0) throw new Error('L’acompte ne peut pas dépasser le total.');
      }
      const venteId = await creerVente({
        lignes: brouillon.lignes.map((l) => ({ produitId: l.produitId, quantite: l.quantite, prixUnitaire: l.prixUnitaire })),
        remise: brouillon.remise,
        mode,
        montantRecu: mode === 'especes' ? montantRecu : undefined,
        clientId: idClientFinal,
        acompte: mode === 'credit' ? acompte : undefined,
        echeance: mode === 'credit' ? (echeance ? depuisDateInput(echeance, true) : undefined) : undefined,
        vendeurId,
      });
      const vente = await db.sales.get(venteId);
      if (!vente) throw new Error('Erreur : la vente n’a pas été retrouvée.');
      onTermine(vente);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inattendue.');
      setEnCours(false);
    }
  }

  return (
    <Modale
      ouverte
      onFermer={onFermer}
      titre={`Encaissement — ${formatFCFA(brouillon.total)}`}
      piedDePage={
        <>
          <Bouton variante="secondaire" onClick={onFermer} disabled={enCours}>Annuler</Bouton>
          <Bouton onClick={confirmer} disabled={enCours || (mode === 'especes' && montantRecu < brouillon.total)}>
            {enCours ? 'Enregistrement…' : `Valider ${formatFCFA(brouillon.total)}`}
          </Bouton>
        </>
      }
      large
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {OPTIONS.map(({ id, libelle, icone: Icone }) => (
            <button
              key={id}
              type="button"
              onClick={() => { setMode(id); setErreur(''); }}
              className={cn(
                'flex items-center gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold transition active:scale-95',
                mode === id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
              )}
            >
              <Icone className="size-5 shrink-0" />
              {libelle}
            </button>
          ))}
        </div>

        {mode === 'especes' && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-4">
            <div>
              <Libelle>Montant reçu</Libelle>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {montantsRapides.map((m) => (
                  <button
                    key={m.label}
                    type="button"
                    onClick={() => setMontantRecu(m.valeur)}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs font-medium transition active:scale-95',
                      montantRecu === m.valeur ? 'border-brand-600 bg-brand-50 text-brand-700' : 'text-slate-600 hover:border-brand-400',
                    )}
                  >
                    <Montant valeur={formatNombre(m.valeur)} />
                    <span className="text-[10px] text-slate-400">{m.label}</span>
                  </button>
                ))}
              </div>
              <Champ
                type="number"
                inputMode="numeric"
                value={montantRecu}
                min={0}
                onChange={(e) => setMontantRecu(versMontant(e.target.value))}
                className="text-lg"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Rendu au client</span>
              <span className={cn('cellule-tabulaire font-display text-lg font-bold', rendu >= 0 ? 'text-green-700' : 'text-red-600')}>
                {rendu >= 0 ? formatFCFA(rendu) : ''}
              </span>
            </div>
            {montantRecu < brouillon.total && <Alerte>Le montant reçu est insuffisant.</Alerte>}
          </div>
        )}

        {(mode === 'airtel' || mode === 'moov') && (
          <Alerte type="info">
            Vérifiez la réception du paiement sur votre téléphone avant de valider. La vente sera enregistrée comme « {mode === 'airtel' ? 'Airtel Money' : 'Moov Money'} ».
          </Alerte>
        )}

        {mode === 'credit' && (
          <div className="space-y-3 rounded-xl bg-amber-50 p-4">
            <div>
              <Libelle>Client</Libelle>
              <Liste value={clientId ?? ''} onChange={(e) => { setClientId(e.target.value ? Number(e.target.value) : null); setNouveauClient(''); }}>
                <option value="">— Choisir un client existant —</option>
                {(clients ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nom}{c.telephone ? ` · ${c.telephone}` : ''}</option>
                ))}
              </Liste>
            </div>
            <div>
              <Libelle>Ou nouveau client</Libelle>
              <Champ value={nouveauClient} onChange={(e) => { setNouveauClient(e.target.value); if (e.target.value) setClientId(null); }} placeholder="Nom du client" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Libelle>Acompte versé</Libelle>
                <Champ type="number" inputMode="numeric" value={acompte || ''} min={0} max={brouillon.total} onChange={(e) => setAcompte(versMontant(e.target.value))} placeholder="0" />
              </div>
              <div>
                <Libelle><CalendarClock className="mr-1 inline size-4" />Échéance</Libelle>
                <Champ type="date" value={echeance} onChange={(e) => setEcheance(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-600">Reste qui sera dû</span>
              <span className="cellule-tabulaire font-bold text-amber-700">
                <Montant valeur={formatNombre(Math.max(0, reste))} />
              </span>
            </div>
          </div>
        )}

        {erreur && <Alerte>{erreur}</Alerte>}

        <div className="rounded-xl border border-slate-200 px-4 py-3 text-sm">
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Articles</span><span>{brouillon.lignes.reduce((s, l) => s + l.quantite, 0)}</span></div>
          <div className="flex justify-between py-0.5"><span className="text-slate-500">Sous-total</span><span className="cellule-tabulaire">
            <Montant valeur={formatNombre(brouillon.sousTotal)} />
          </span></div>
          {brouillon.remise > 0 && <div className="flex justify-between py-0.5"><span className="text-slate-500">Remise</span><span className="cellule-tabulaire">− <Montant valeur={formatNombre(brouillon.remise)} /></span></div>}
          <div className="flex justify-between border-t border-slate-100 pt-1.5 font-bold text-slate-900"><span>Total</span><span className="cellule-tabulaire font-display">
            <Montant valeur={formatNombre(brouillon.total)} />
          </span></div>
        </div>
      </div>
    </Modale>
  );
}
