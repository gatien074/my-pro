import { useEffect, useState } from 'react';
import { Printer, Repeat, Undo2 } from 'lucide-react';
import type { Settings, StatutVente, Vente } from '../../db/types';
import { annulerVente } from '../../db/ops';
import { formaterDateHeure } from '../../lib/dates';
import { formatNombre } from '../../lib/money';
import { LIBELLES_MODES, LIBELLES_STATUTS_VENTE } from '../../lib/helpers';
import { Alerte, Badge, Bouton, Modale } from '../ui';

interface Props {
  vente: Vente;
  settings: Settings;
  resolveClient: (clientId: number) => Promise<string | undefined>;
  /** Identifiant de l'utilisateur qui annule (traçabilité des mouvements de stock). */
  annulateurId?: number;
  onFermer: () => void;
}

/** Aperçu du ticket 80 mm : impression et annulation de la vente. */
export default function Ticket({ vente, settings, resolveClient, annulateurId, onFermer }: Props) {
  const [clientNom, setClientNom] = useState<string | undefined>(undefined);
  const [statut, setStatut] = useState<StatutVente>(vente.statut);
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    if (vente.clientId == null) return;
    let annule = false;
    void resolveClient(vente.clientId).then((nom) => {
      if (!annule) setClientNom(nom ?? 'Client');
    });
    return () => {
      annule = true;
    };
  }, [vente.clientId, resolveClient]);

  async function confirmerAnnulation() {
    if (vente.id == null) return;
    setErreur('');
    setEnCours(true);
    try {
      await annulerVente(vente.id, annulateurId);
      setStatut('annulee');
      setConfirmation(false);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setEnCours(false);
    }
  }

  const annulee = statut === 'annulee';

  return (
    <Modale
      ouverte
      onFermer={onFermer}
      titre={annulee ? `Vente ${vente.numero} annulée` : `Vente ${vente.numero} enregistrée`}
      piedDePage={
        confirmation ? (
          <>
            <p className="mr-auto self-center text-xs font-medium text-red-700">
              Annuler cette vente ? Le stock sera restitué.
            </p>
            <Bouton variante="secondaire" onClick={() => setConfirmation(false)} disabled={enCours}>
              Renoncer
            </Bouton>
            <Bouton variante="danger" onClick={() => void confirmerAnnulation()} disabled={enCours}>
              {enCours ? 'Annulation…' : 'Confirmer l’annulation'}
            </Bouton>
          </>
        ) : (
          <>
            {!annulee && (
              <Bouton variante="fantome" className="mr-auto text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => { setErreur(''); setConfirmation(true); }}>
                <Undo2 className="size-4" /> Annuler cette vente
              </Bouton>
            )}
            <Bouton variante="secondaire" onClick={onFermer}>
              <Repeat className="size-4" /> Nouvelle vente
            </Bouton>
            <Bouton onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimer le ticket
            </Bouton>
          </>
        )
      }
    >
      {/* zone imprimée : contient uniquement le ticket */}
      <div id="zone-ticket" className="mx-auto w-260px border border-slate-200 bg-white p-3 text-[11px] leading-4 shadow-sm">
        <div className="text-center">
          <p className="text-[13px] font-bold">{settings.nomBoutique}</p>
          {settings.adresse && <p>{settings.adresse}</p>}
          {settings.telephone && <p>{settings.telephone}</p>}
        </div>
        <div className="my-2 border-t border-dashed border-slate-400" />
        <p>Vente : {vente.numero}</p>
        <p>Date : {formaterDateHeure(vente.date)}</p>
        {annulee && <p className="font-bold text-red-700">VENTE ANNULÉE</p>}
        {clientNom && <p>Client : {clientNom}</p>}
        <div className="my-2 border-t border-dashed border-slate-400" />
        <table className="w-full">
          <tbody>
            {vente.lignes.map((l, i) => (
              <tr key={`${l.produitId}-${i}`}>
                <td colSpan={2}>
                  {l.quantite} × {l.nom}
                </td>
                <td className="text-right whitespace-nowrap">{formatNombre(l.prixUnitaire * l.quantite)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="my-2 border-t border-dashed border-slate-400" />
        <div className="flex justify-between">
          <span>Sous-total</span>
          <span>{formatNombre(vente.sousTotal)}</span>
        </div>
        {vente.remise > 0 && (
          <div className="flex justify-between">
            <span>Remise</span>
            <span>− {formatNombre(vente.remise)}</span>
          </div>
        )}
        <div className="mt-0.5 flex justify-between text-[13px] font-bold">
          <span>TOTAL</span>
          <span>{formatNombre(vente.total)} {settings.devise}</span>
        </div>
        <div className="mt-0.5 flex justify-between">
          <span>{LIBELLES_MODES[vente.mode]}</span>
          <span>{formatNombre(vente.montantPaye)}</span>
        </div>
        {vente.mode === 'credit' && vente.total > vente.montantPaye && (
          <div className="flex justify-between font-bold">
            <span>Reste dû</span>
            <span>{formatNombre(vente.total - vente.montantPaye)} {settings.devise}</span>
          </div>
        )}
        <div className="my-2 border-t border-dashed border-slate-400" />
        <p className="text-center">{settings.piedTicket}</p>
      </div>

      <div className="mt-3 space-y-2">
        <div className="flex justify-center">
          <Badge couleur={annulee ? 'rouge' : 'vert'}>{LIBELLES_STATUTS_VENTE[statut]}</Badge>
        </div>
        {erreur && <Alerte>{erreur}</Alerte>}
      </div>
    </Modale>
  );
}
