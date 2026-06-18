import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Shell from './components/Shell';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SetupWizardPage from './pages/SetupWizardPage';
import DashboardPage from './pages/DashboardPage';
import ReservationsPage from './pages/ReservationsPage';
import FloorPlanPage from './pages/FloorPlanPage';
import BlockedPeriodsPage from './pages/BlockedPeriodsPage';
import SettingsPage from './pages/SettingsPage';

// Wraps protected pages in the shell, and forces first-login users into setup.
function Protected({ children }: { children: React.ReactNode }) {
  const { staff } = useAuth();
  if (staff?.firstLogin) {
    return <Navigate to="/setup" replace />;
  }
  return (
    <ProtectedRoute>
      <Shell>{children}</Shell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/setup"
        element={
          <ProtectedRoute>
            <SetupWizardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/reservations" element={<Protected><ReservationsPage /></Protected>} />
      <Route path="/floor-plan" element={<Protected><FloorPlanPage /></Protected>} />
      <Route path="/blocked" element={<Protected><BlockedPeriodsPage /></Protected>} />
      <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
