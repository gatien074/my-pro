import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import Onboarding from './pages/Onboarding';
import Connexion from './pages/Connexion';
import Caisse from './pages/Caisse';
import Produits from './pages/Produits';
import Stock from './pages/Stock';
import Clients from './pages/Clients';
import ClientDetail from './pages/ClientDetail';
import Rapports from './pages/Rapports';
import Parametres from './pages/Parametres';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/connexion" element={<Connexion />} />
        <Route element={<AppShell />}>
          <Route path="/" element={<Caisse />} />
          <Route path="/produits" element={<Produits />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/clients/:id" element={<ClientDetail />} />
          <Route path="/rapports" element={<Rapports />} />
          <Route path="/parametres" element={<Parametres />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
