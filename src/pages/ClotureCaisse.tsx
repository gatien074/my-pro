import { useMemo, useState, type FormEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Printer, RotateCcw } from 'lucide-react';
import { db } from '../db/db';
import { enDateInput, depuisDateInput, formaterDateHeure } from '../lib/dates';
import { formatFCFA, formatNombre } from '../lib/money';
import { Alerte, Bouton, Champ, cn, EtatVide, Libelle } from '../components/ui';
import { telechargerCsv } from '../lib/csv';

export default function ClotureCaisse() {
  const [dateSaisie, setDateSaisie] = useState(() => enDateInput());
  const [fondInitial, setFondInitial] = useState('');
  const [fondCompte, setFondCompte] = useState('');
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const debut = depuisDateInput(dateSaisie);
  const fin = depuisDateInput(dateSaisie, true);

  const ventesEspeces = useLiveQuery(
    () =>
      db.sales
        .where('date')
        .between(debut, fin)
        .filter((v) => v.mode === 'especes' && v.statut === 'vendue')
        .toArray(),
    [debut, fin],
  );
  const clotures = useLiveQuery(
    () => db.cashClosures.where('date').between(debut, fin).toArray(),
    [debut, fin],
  );

  const especesAttendues = useMemo(() => {
    const fond = Number(fondInitial || 0);
    const ventes = (ventesEspeces ?? []).reduce((s, v) => s + v.total, 0);
    return fond + ventes;
  }, [fondInitial, ventesEspeces]);

  const ecart = useMemo(() => {
    return Number(fondCompte || 0) - especesAttendues;
  }, [fondCompte, especesAttendues]);

  const clotureExistante = (clotures ?? []).find((c) => {
    const d = new Date(c.date);
    return d.toDateString() === new Date(debut).toDateString();
  });

  async function soumettre(e: FormEvent) {
    e.preventDefault();
    setErreur('');
    setMsg('');
    if (!fondInitial.trim()) {
      setErreur('Le fond initial est obligatoire.');
      return;
    }
    if (!fondCompte.trim()) {
      setErreur('Le fonds compté est obligatoire.');
      return;
    }
    if (clotureExistante) {
      setErreur('Une clôture existe déjà pour cette date.');
      return;
    }

    setEnCours(true);
    try {
      await db.cashClosures.add({
        date: debut,
        fondInitial: Number(fondInitial),
        especesAttendues,
        fondCompte: Number(fondCompte),
        ecart,
        fermeLe: Date.now(),
      });
      setMsg(`Clôture enregistrée : écart de ${ecart >= 0 ? '+' : ''}${formatNombre(ecart)} FCFA.`);
      setFondCompte('');
      setTimeout(() => setMsg(''), 4000);
    } catch (err) {
      setErreur(err instanceof Error ? err.message : 'Erreur inattendue.');
    } finally {
      setEnCours(false);
    }
  }

  function exporter() {
    telechargerCsv(
      `cloture-${enDateInput(debut)}.csv`,
      ['Date', 'Fond initial', 'Espèces attendues', 'Fond compté', 'Écart'],
      (clotures ?? [])
        .slice()
        .sort((a, b) => b.date - a.date)
        .map((c) => [
          formaterDateHeure(c.date),
          formatFCFA(c.fondInitial),
          formatFCFA(c.especesAttendues),
          formatFCFA(c.fondCompte),
          formatFCFA(c.ecart),
        ]),
    );
  }

  return (
    <div className="space-y-4 p-3 lg:p-4">
      <div className="flex items-center justify-between">
        <h1 className="titre-page">Clôture de caisse</h1>
        <div className="flex gap-2">
          <Bouton variante="secondaire" taille="sm" onClick={exporter}>
            <RotateCcw className="size-4" /> CSV
          </Bouton>
          <Bouton variante="secondaire" taille="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimer
          </Bouton>
        </div>
      </div>

      <p className="text-sm text-slate-500">
        Date : {formaterDateHeure(debut)}
      </p>

      {/* Saisie */}
      <section className="carte p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-700">Saisie de la clôture</h2>
        <form onSubmit={soumettre} className="grid gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <Libelle>Date</Libelle>
            <Champ type="date" value={dateSaisie} onChange={(e) => setDateSaisie(e.target.value)} />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Libelle>Fond initial (caisse du matin)</Libelle>
            <Champ type="number" inputMode="numeric" min={0} value={fondInitial} onChange={(e) => setFondInitial(e.target.value)} placeholder="0" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Libelle>Fonds compté (espèces en caisse)</Libelle>
            <Champ type="number" inputMode="numeric" min={0} value={fondCompte} onChange={(e) => setFondCompte(e.target.value)} placeholder="0" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Libelle>Espèces attendues (calculé)</Libelle>
            <div className="champ bg-slate-50 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800">
              {formatFCFA(especesAttendues)}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Libelle>Écart</Libelle>
            <div className={cn('champ bg-slate-50 rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-bold', ecart < 0 ? 'text-red-600' : ecart > 0 ? 'text-green-700' : 'text-slate-600')}>
              {formatFCFA(ecart)}
            </div>
          </div>
          <div className="col-span-3">
            <Bouton
              type="submit"
              disabled={enCours || !!clotureExistante || !fondInitial || !fondCompte}
            >
              {enCours ? 'Enregistrement…' : !!clotureExistante ? 'Déjà clôturé' : 'Clôturer la journée'}
            </Bouton>
          </div>
        </form>
        {erreur && <Alerte>{erreur}</Alerte>}
        {msg && <Alerte type="info">{msg}</Alerte>}
        {clotureExistante && (
          <Alerte type="info">
            Cette journée est déjà clôturée (écart : {formatFCFA(clotureExistante.ecart)}).
          </Alerte>
        )}
        {ventesEspeces === undefined && <p className="text-xs text-slate-400">Chargement…</p>}
      </section>

      {/* Résumé du jour */}
      <section className="carte p-4">
        <h2 className="mb-3 text-sm font-bold text-slate-700">Détail du jour</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="carte p-3">
            <p className="text-xs font-medium text-slate-500">Ventes espèces</p>
            <p className="cellule-tabulaire font-display text-lg font-bold text-slate-900">
              {formatNombre((ventesEspeces ?? []).length)} vente(s)
            </p>
          </div>
          <div className="carte p-3">
            <p className="text-xs font-medium text-slate-500">Montant espèces</p>
            <p className="cellule-tabulaire font-display text-lg font-bold text-slate-900">
              {formatFCFA((ventesEspeces ?? []).reduce((s, v) => s + v.total, 0))}
            </p>
          </div>
          <div className="carte p-3">
            <p className="text-xs font-medium text-slate-500">Fond initial</p>
            <p className="cellule-tabulaire font-display text-lg font-bold text-slate-900">{formatFCFA(Number(fondInitial || 0))}</p>
          </div>
          <div className="carte p-3">
            <p className="text-xs font-medium text-slate-500">Espèces attendues</p>
            <p className="cellule-tabulaire font-display text-lg font-bold text-slate-900">{formatFCFA(especesAttendues)}</p>
          </div>
        </div>
      </section>

      {/* Historique */}
      <section className="carte overflow-hidden">
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">Historique des clôtures</h2>
        {(clotures ?? []).length === 0 ? (
          <div className="p-4"><EtatVide titre="Aucune clôture enregistrée" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 text-right font-medium">Fond initial</th>
                  <th className="px-3 py-2.5 text-right font-medium">Attendues</th>
                  <th className="px-3 py-2.5 text-right font-medium">Compté</th>
                  <th className="px-3 py-2.5 text-right font-medium">Écart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(clotures ?? [])
                  .slice()
                  .sort((a, b) => b.date - a.date)
                  .map((c) => (
                    <tr key={c.id} className={cn('hover:bg-slate-50/60', c.ecart < 0 && 'text-red-600')}>
                      <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{formaterDateHeure(c.date)}</td>
                      <td className="px-3 py-2.5 text-right cellule-tabulaire">{formatFCFA(c.fondInitial)}</td>
                      <td className="px-3 py-2.5 text-right cellule-tabulaire">{formatFCFA(c.especesAttendues)}</td>
                      <td className="px-3 py-2.5 text-right cellule-tabulaire">{formatFCFA(c.fondCompte)}</td>
                      <td className={cn('px-3 py-2.5 text-right cellule-tabulaire font-bold', c.ecart < 0 ? 'text-red-600' : c.ecart > 0 ? 'text-green-700' : 'text-slate-600')}>
                        {formatFCFA(c.ecart)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ventesEspeces === undefined ? (
        <p className="text-sm text-slate-400 text-center">Chargement des ventes…</p>
      ) : null}
    </div>
  );
}
