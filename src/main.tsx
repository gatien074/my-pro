import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY) {
  void import('./sync/service').then(({ bootstrapSynchronisation }) => {
    void bootstrapSynchronisation().catch((err) => console.error('Sync Supabase:', err));
  });
}

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
  // En cas d'erreur Dexie critique, proposer de réinitialiser
  if (event.error && (event.error.name === 'DexieError' || String(event.error).includes('Dexie'))) {
    const shouldReset = confirm('Erreur de base de données détectée. Voulez-vous réinitialiser l\'application (cela effacera les données locales) ?');
    if (shouldReset) {
      indexedDB.deleteDatabase('caisse-stock-gabon');
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  if (event.reason && (event.reason.name === 'DexieError' || String(event.reason).includes('Dexie'))) {
    event.preventDefault();
    indexedDB.deleteDatabase('caisse-stock-gabon');
    window.location.reload();
  }
});

const root = document.getElementById('root');
if (!root) {
  document.body.innerHTML = '<pre>NO_ROOT</pre>';
} else {
  try {
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (e) {
    console.error('Render error:', e);
    document.body.innerHTML = '<pre>Erreur lors du chargement de l\'application.<br/>Essayez de vider le stockage IndexedDB dans les outils de développement.</pre>';
  }
}
