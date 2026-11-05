import { useEffect, useState } from 'react';
import { Cloud, RefreshCcw } from 'lucide-react';
import { compteurEnAttente } from '../../sync/queue';
import { configurationSupabaseValide } from '../../sync/supabase';

export function SyncStatus() {
  const [enAttente, setEnAttente] = useState(0);
  const [configOk, setConfigOk] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    setConfigOk(configurationSupabaseValide());
    if (!configurationSupabaseValide()) return;

    const intervalle = setInterval(async () => {
      try {
        const n = await compteurEnAttente();
        setEnAttente(n);
      } catch {
        // ignore
      }
    }, 5000);
    return () => clearInterval(intervalle);
  }, []);

  if (configOk === undefined) return null;
  if (!configOk) return null; // pas de Supabase configuré = pas d'indicateur

  const style = enAttente > 0
    ? { borderColor: '#d3940f' as const, backgroundColor: '#fdf6e3' as const, color: '#8b5a09' as const }
    : { borderColor: '#1e6b47' as const, backgroundColor: '#edf6f1' as const, color: '#18553a' as const };

  return (
    <div
      title={enAttente > 0 ? `${enAttente} modification(s) en attente de synchronisation` : 'Synchronisé'}
      className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] transition-colors"
      style={style}
    >
      {enAttente > 0 ? (
        <RefreshCcw className="size-3.5 animate-spin" />
      ) : (
        <Cloud className="size-3.5" />
      )}
      {enAttente > 0 ? `${enAttente} en attente` : 'Synchronisé'}
    </div>
  );
}
