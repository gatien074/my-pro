import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

window.addEventListener('error', (event) => {
  console.error('Global error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
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
    document.body.innerHTML = '<pre>Erreur lors du chargement de l\'application. Veuillez vider le cache (IndexedDB) et recharger la page.</pre>';
  }
}
