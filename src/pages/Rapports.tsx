import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Eye, Printer, Search } from 'lucide-react';
import { db } from '../db/db';
import { useSettings } from '../db/hooks';
import { useSession } from '../store/session';
import type { ModePaiement, Vente } from '../db/types';
import { beneficeVente, resteDette, statutVisible } from '../lib/calc';
import { debutDeJour, debutDuMois, debutSemaine, finDeJour, finDuMois, depuisDateInput, enDateInput, formaterDateCourte, formaterDateHeure } from '../lib/dates';
import { formatFCFA, formatNombre } from '../lib/money';
import { LIBELLES_MODES } from '../lib/helpers';
import { telechargerCsv } from '../lib/csv';
import { Alerte, Badge, Bouton, Champ, cn, EtatVide, Libelle } from '../components/ui';
import Ticket from '../components/caisse/Ticket';

type Preset = 'aujourdhui' | 'hier' | '7j' | '30j' | 'mois' | 'moisDernier' | 'periode';

const PRESETS: Array<{ id: Preset; libelle: string }> = [
  { id: 'aujourdhui', libelle: "Aujourd'hui" },
  { id: 'hier', libelle: 'Hier' },
  { id: '7j', libelle: '7 jours' },
  { id: '30j', libelle: '30 jours' },
  { id: 'mois', libelle: 'Ce mois' },
  { id: 'moisDernier', libelle: 'Mois dernier' },
  { id: 'periode', libelle: 'Période' },
];

export default function Rapports() {
  const { settings } = useSettings();
  const utilisateur = useSession((s) => s.utilisateur);
  const [preset, setPreset] = useState<Preset>('7j');
  const [debutSaisie, setDebutSaisie] = useState(() => enDateInput(debutSemaine()));
  const [finSaisie, setFinSaisie] = useState(() => enDateInput());
  const [recherche, setRecherche] = useState('');
  const [venteVue, setVenteVue] = useState<Vente | null>(null);

  // bornes temporelles actuelles
  const bornes = useMemo<[number, number]>(() => {
    switch (preset) {
      case 'aujourdhui':
        return [debutDeJour(), finDeJour()];
      case 'hier':
        return [debutDeJour(Date.now() - 86_400_000), finDeJour(Date.now() - 86_400_000)];
      case '7j':
        return [debutDeJour(Date.now() - 6 * 86_400_000), finDeJour()];
      case '30j':
        return [debutDeJour(Date.now() - 29 * 86_400_000), finDeJour()];
      case 'mois':
        return [debutDuMois(), finDuMois()];
      case 'moisDernier':
        return [debutDuMois(debutDuMois() - 86_400_000), finDuMois(debutDuMois() - 86_400_000)];
      case 'periode':
        return [depuisDateInput(debutSaisie), depuisDateInput(finSaisie, true)];
    }
  }, [preset, debutSaisie, finSaisie]);
  const [debut, fin] = bornes;

  const ventes = useLiveQuery(
    () => db.sales.where('date').between(debut, fin).toArray(),
    [debut, fin],
  );
  const dettes = useLiveQuery(() => db.debts.toArray(), []);
  const utilisateurs = useLiveQuery(() => db.users.toArray(), []);

  const vendues = useMemo(() => (ventes ?? []).filter((v) => v.statut === 'vendue'), [ventes]);

  const kpis = useMemo(() => {
    const ca = vendues.reduce((s, v) => s + v.total, 0);
    const benefice = vendues.reduce((s, v) => s + beneficeVente(v), 0);
    const remises = vendues.reduce((s, v) => s + v.remise, 0);
    const nb = vendues.length;
    const marge = ca > 0 ? Math.round((benefice / ca) * 100) : 0;
    return { ca, benefice, remises, nb, marge, panierMoyen: nb > 0 ? Math.round(ca / nb) : 0 };
  }, [vendues]);

  // Série journalière CA / bénéfice
  const serie = useMemo(() => {
    const jours = new Map<number, { ca: number; benefice: number }>();
    const cursseur = debutDeJour(debut);
    const finJour = debutDeJour(fin);
    for (let t = cursseur; t <= finJour; t += 86_400_000) jours.set(t, { ca: 0, benefice: 0 });
    for (const v of vendues) {
      const cle = debutDeJour(v.date);
      const point = jours.get(cle) ?? { ca: 0, benefice: 0 };
      point.ca += v.total;
      point.benefice += beneficeVente(v);
      jours.set(cle, point);
    }
    return [...jours.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([t, p]) => ({ jour: formaterDateCourte(t), ca: p.ca, benefice: p.benefice }));
  }, [vendues, debut, fin]);

  // Répartition des modes de paiement
  const modes = useMemo(() => {
    const m = new Map<ModePaiement, number>();
    for (const v of vendues) m.set(v.mode, (m.get(v.mode) ?? 0) + v.total);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [vendues]);
  const totalModes = modes.reduce((s, [, montant]) => s + montant, 0);

  // Meilleurs produits
  const topProduits = useMemo(() => {
    const m = new Map<string, { qte: number; ca: number; profit: number; prix: number }>();
    for (const v of vendues) {
      for (const l of v.lignes) {
        const courante = m.get(l.nom) ?? { qte: 0, ca: 0, profit: 0, prix: l.prixUnitaire };
        courante.qte += l.quantite;
        courante.ca += l.prixUnitaire * l.quantite;
        courante.profit += (l.prixUnitaire - l.prixAchat) * l.quantite;
        m.set(l.nom, courante);
      }
    }
    return [...m.entries()]
      .map(([nom, s]) => ({ nom, ...s }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 8);
  }, [vendues]);

  const dettesResume = useMemo(() => {
    let encours = 0;
    let retard = 0;
    for (const d of dettes ?? []) {
      const reste = resteDette(d);
      if (reste <= 0) continue;
      encours += reste;
      if (statutVisible(d) === 'en_retard') retard += reste;
    }
    return { encours, retard };
  }, [dettes]);

  // Journal des ventes de la période (annulées comprises), filtrable par n° ou vendeur
  const vendeursMap = useMemo(() => new Map((utilisateurs ?? []).map((u) => [u.id!, u.nom])), [utilisateurs]);
  const journal = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (ventes ?? [])
      .filter((v) => {
        if (!q) return true;
        return (
          v.numero.toLowerCase().includes(q) ||
          (vendeursMap.get(v.sellerId ?? -1) ?? '').toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => b.date - a.date);
  }, [ventes, recherche, vendeursMap]);

  function exporterVentes() {
    telechargerCsv(
      `ventes-${enDateInput(debut)}_${enDateInput(fin)}.csv`,
      ['Numéro', 'Date', 'Heure', 'Mode', 'Articles', 'Sous-total', 'Remise', 'Total', 'Statut'],
      (ventes ?? [])
        .slice()
        .sort((a, b) => b.date - a.date)
        .map((v) => [
          v.numero,
          enDateInput(v.date),
          new Date(v.date).toLocaleTimeString('fr-FR'),
          LIBELLES_MODES[v.mode],
          v.lignes.reduce((s, l) => s + l.quantite, 0),
          v.sousTotal,
          v.remise,
          v.total,
          v.statut === 'annulee' ? 'Annulée' : 'Vendue',
        ]),
    );
  }

  return (
    <div className="space-y-4 p-3 lg:p-4">
      <div className="flex items-center justify-between">
        <h1 className="titre-page">Rapports</h1>
        <div className="zone-non-imprimable flex gap-2">
          <Bouton variante="secondaire" taille="sm" onClick={exporterVentes}>
            <Download className="size-4" /> Export CSV
          </Bouton>
          <Bouton variante="secondaire" taille="sm" onClick={() => window.print()}>
            <Printer className="size-4" /> Imprimer
          </Bouton>
        </div>
      </div>

      {/* Sélecteur de période */}
      <div className="zone-non-imprimable flex flex-wrap items-end gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={cn(
              'rounded-xl border px-3 py-2 text-sm font-medium transition',
              preset === p.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
            )}
          >
            {p.libelle}
          </button>
        ))}
        {preset === 'periode' && (
          <div className="flex gap-2">
            <div className="w-40">
              <Libelle>Du</Libelle>
              <Champ type="date" value={debutSaisie} onChange={(e) => setDebutSaisie(e.target.value)} />
            </div>
            <div className="w-40">
              <Libelle>Au</Libelle>
              <Champ type="date" value={finSaisie} onChange={(e) => setFinSaisie(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div id="zone-rapports" className="space-y-4">
        <p className="text-sm text-slate-500">
          Période : {formaterDateCourte(debut)} → {formaterDateCourte(fin)}
        </p>

        {ventes === undefined ? (
          <Alerte type="info">Chargement des données…</Alerte>
        ) : (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <CarteValue libelle="Chiffre d'affaires" valeur={formatFCFA(kpis.ca)} />
              <CarteValue libelle="Bénéfice brut" valeur={formatFCFA(kpis.benefice)} accent />
              <CarteValue libelle="Ventes" valeur={formatNombre(kpis.nb)} />
              <CarteValue libelle="Panier moyen" valeur={formatFCFA(kpis.panierMoyen)} />
              <CarteValue libelle="Marge" valeur={`${formatNombre(kpis.marge)} %`} />
            </div>

            {/* Courbe */}
            <div className="carte p-4">
              <h2 className="mb-3 text-sm font-bold text-slate-700">Évolution par jour</h2>
              {serie.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune donnée sur la période.</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={serie} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                      <defs>
                        <linearGradient id="gradCa" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1e6b47" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#1e6b47" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradBenef" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#d3940f" stopOpacity={0.32} />
                          <stop offset="100%" stopColor="#d3940f" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#dce0d9" vertical={false} />
                      <XAxis dataKey="jour" tick={{ fontSize: 11, fill: '#717d74' }} tickMargin={6} />
                      <YAxis tick={{ fontSize: 11, fill: '#717d74' }} tickFormatter={(v: number) => `${Math.round(v / 1000)} k`} width={44} />
                      <Tooltip
                        formatter={(valeur, nom) => [formatFCFA(Number(valeur)), nom === 'ca' ? 'Chiffre d’affaires' : 'Bénéfice']}
                        contentStyle={{ borderRadius: 10, border: '1px solid #dce0d9', fontSize: 12 }}
                      />
                      <Area type="monotone" dataKey="ca" stroke="#1e6b47" strokeWidth={2} fill="url(#gradCa)" name="ca" />
                      <Area type="monotone" dataKey="benefice" stroke="#d3940f" strokeWidth={2} fill="url(#gradBenef)" name="benefice" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {/* Modes de paiement */}
              <div className="carte p-4">
                <h2 className="mb-3 text-sm font-bold text-slate-700">Modes de paiement</h2>
                {modes.length === 0 ? (
                  <p className="text-sm text-slate-400">Aucune vente sur la période.</p>
                ) : (
                  <div className="space-y-2.5">
                    {modes.map(([mode, montant]) => {
                      const part = totalModes > 0 ? Math.round((montant / totalModes) * 100) : 0;
                      const couleurs: Record<ModePaiement, string> = {
                        especes: 'bg-brand-600',
                        airtel: 'bg-red-500',
                        moov: 'bg-azur-500',
                        credit: 'bg-amber-500',
                      };
                      return (
                        <div key={mode}>
                          <div className="mb-1 flex justify-between text-sm">
                            <span className="font-medium text-slate-600">{LIBELLES_MODES[mode]}</span>
                            <span className="cellule-tabulaire font-semibold text-slate-800">{formatFCFA(montant)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div className={cn('h-2 rounded-full', couleurs[mode])} style={{ width: `${part}%` }} />
                          </div>
                        </div>
                      );
                    })}
                    {kpis.remises > 0 && (
                      <p className="pt-1 text-xs text-slate-400">Remises accordées sur la période : {formatFCFA(kpis.remises)}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Dettes */}
              <div className="carte p-4">
                <h2 className="mb-3 text-sm font-bold text-slate-700">Situation des dettes clients</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total en cours</span>
                    <span className="cellule-tabulaire font-bold text-slate-800">{formatFCFA(dettesResume.encours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dont en retard (échéance dépassée)</span>
                    <span className="cellule-tabulaire font-bold text-red-600">{formatFCFA(dettesResume.retard)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-2">
                    <span className="text-slate-500">Ventes à crédit de la période</span>
                    <span className="cellule-tabulaire font-semibold">{formatFCFA(vendues.filter((v) => v.mode === 'credit').reduce((s, v) => s + v.total, 0))}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top produits */}
            <div className="carte overflow-hidden">
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">Produits qui se vendent</h2>
              {topProduits.length === 0 ? (
                <div className="p-4"><EtatVide titre="Aucune vente sur la période" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">#</th>
                        <th className="px-3 py-2.5 font-medium">Produit</th>
                        <th className="px-3 py-2.5 text-right font-medium">Qté vendue</th>
                        <th className="px-3 py-2.5 text-right font-medium">CA</th>
                        <th className="px-3 py-2.5 text-right font-medium">Bénéfice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {topProduits.map((p, i) => (
                        <tr key={p.nom} className="hover:bg-slate-50/60">
                          <td className="px-4 py-2.5 text-slate-400">{i + 1}</td>
                          <td className="px-3 py-2.5 font-medium text-slate-700">{p.nom}</td>
                          <td className="cellule-tabulaire px-3 py-2.5 text-right">{formatNombre(p.qte)}</td>
                          <td className="cellule-tabulaire px-3 py-2.5 text-right">{formatNombre(p.ca)}</td>
                          <td className="cellule-tabulaire px-3 py-2.5 text-right font-semibold text-green-700">{formatNombre(p.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Journal des ventes */}
            <div className="carte overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-700">Journal des ventes</h2>
                <div className="zone-non-imprimable relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
                  <input
                    className="champ pl-9"
                    placeholder="N° de vente ou vendeur…"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                  />
                </div>
              </div>
              {journal.length === 0 ? (
                <div className="p-4">
                  <EtatVide
                    titre="Aucune vente sur la période"
                    texte="Choisissez une autre période, ou effacez la recherche."
                  />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">N°</th>
                          <th className="px-3 py-2.5 font-medium">Date</th>
                          <th className="hidden px-3 py-2.5 font-medium md:table-cell">Vendeur</th>
                          <th className="px-3 py-2.5 font-medium">Mode</th>
                          <th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Articles</th>
                          <th className="px-3 py-2.5 text-right font-medium">Total</th>
                          <th className="px-3 py-2.5" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {journal.map((v) => (
                          <tr key={v.id} className={cn('hover:bg-slate-50/60', v.statut === 'annulee' && 'text-slate-400')}>
                            <td className="px-4 py-2.5 font-medium">
                              <span className={cn(v.statut === 'annulee' && 'line-through')}>{v.numero}</span>
                              {v.statut === 'annulee' && <Badge couleur="rouge" className="ml-2">Annulée</Badge>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2.5 text-slate-500">{formaterDateHeure(v.date)}</td>
                            <td className="hidden px-3 py-2.5 text-slate-500 md:table-cell">{vendeursMap.get(v.sellerId ?? -1) ?? '—'}</td>
                            <td className="px-3 py-2.5">
                              <Badge couleur={v.mode === 'credit' ? 'ambre' : 'gris'}>{LIBELLES_MODES[v.mode]}</Badge>
                            </td>
                            <td className="cellule-tabulaire hidden px-3 py-2.5 text-right text-slate-500 sm:table-cell">
                              {formatNombre(v.lignes.reduce((s, l) => s + l.quantite, 0))}
                            </td>
                            <td className="cellule-tabulaire px-3 py-2.5 text-right font-semibold">{formatFCFA(v.total)}</td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => setVenteVue(v)}
                                className="zone-non-imprimable inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
                              >
                                <Eye className="size-3.5" /> Voir
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                    {formatNombre(journal.length)} vente(s) affichée(s). « Voir » ouvre le ticket : réimpression ou annulation.
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {venteVue && settings && (
        <Ticket
          vente={venteVue}
          settings={settings}
          resolveClient={(id) => db.customers.get(id).then((c) => c?.nom)}
          annulateurId={utilisateur?.id}
          onFermer={() => setVenteVue(null)}
        />
      )}
    </div>
  );
}

function CarteValue({ libelle, valeur, accent }: { libelle: string; valeur: string; accent?: boolean }) {
  return (
    <div className={cn('carte min-w-0 p-4', accent && 'border-brand-300 bg-brand-50')}>
      <p className="truncate text-xs font-medium text-slate-500">{libelle}</p>
      <p className={cn('cellule-tabulaire font-display truncate text-lg font-bold', accent ? 'text-brand-700' : 'text-slate-900')}>{valeur}</p>
    </div>
  );
}
