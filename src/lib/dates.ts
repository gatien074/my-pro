import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export const JOUR_MS = 86_400_000;

export function debutDeJour(t: number = Date.now()): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function debutSemaine(t: number = Date.now()): number {
  const d = new Date(debutDeJour(t));
  const jour = d.getDay(); // 0 = dimanche
  d.setDate(d.getDate() - ((jour + 6) % 7));
  return d.getTime();
}

export function finDeJour(t: number = Date.now()): number {
  const d = new Date(t);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

export function debutDuMois(t: number = Date.now()): number {
  const d = new Date(t);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function finDuMois(t: number = Date.now()): number {
  const d = new Date(debutDuMois(t));
  d.setMonth(d.getMonth() + 1);
  return d.getTime() - 1;
}

export function debutAnnee(t: number = Date.now()): number {
  return new Date(new Date(t).getFullYear(), 0, 1).getTime();
}

export function formaterDate(t: number): string {
  return format(t, 'dd/MM/yyyy', { locale: fr });
}

export function formaterDateHeure(t: number): string {
  return format(t, "dd/MM/yyyy 'à' HH:mm", { locale: fr });
}

/** Une date au format yyyy-MM-dd avec date-fns (locale fr). */
export function formaterDateCourte(t: number): string {
  return format(t, 'd MMM', { locale: fr });
}

/** Valeur pour un champ <input type="date">. */
export function enDateInput(t: number = Date.now()): string {
  return format(t, 'yyyy-MM-dd');
}

/** Convertit une valeur de champ date ("yyyy-MM-dd") en timestamp (début du jour). */
export function depuisDateInput(s: string, finJour = false): number {
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
  return finJour ? finDeJour(date.getTime()) : debutDeJour(date.getTime());
}
