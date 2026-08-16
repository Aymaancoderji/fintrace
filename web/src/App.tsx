import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { AlertsPage } from './pages/AlertsPage';
import { CasesPage } from './pages/CasesPage';
import { NewCasePage } from './pages/NewCasePage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { RiskPage } from './pages/RiskPage';
import { AccountSubgraphPage } from './pages/AccountSubgraphPage';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/cases" element={<CasesPage />} />
        <Route path="/cases/new" element={<NewCasePage />} />
        <Route path="/cases/:caseId" element={<CaseDetailPage />} />
        <Route path="/risk" element={<RiskPage />} />
        <Route path="/accounts/:accountId/subgraph" element={<AccountSubgraphPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/alerts" replace />} />
      <Route path="*" element={<Navigate to="/alerts" replace />} />
    </Routes>
  );
}
