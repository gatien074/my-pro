import { telechargerFichier } from './helpers';

/** Construit un CSV au format « Excel français » (séparateur point-virgule). */
export function versCsv(
  entetes: string[],
  lignes: Array<Array<string | number | null | undefined>>,
): string {
  const echapper = (v: string | number | null | undefined) => {
    const t = v == null ? '' : String(v);
    return /[",;\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [entetes, ...lignes].map((l) => l.map(echapper).join(';')).join('\r\n');
}

/** Construit puis télécharge un CSV (BOM pour l'accents dans Excel). */
export function telechargerCsv(nomFichier: string, entetes: string[], lignes: Array<Array<string | number | null | undefined>>): void {
  telechargerFichier(nomFichier, '\uFEFF' + versCsv(entetes, lignes), 'text/csv;charset=utf-8');
}
