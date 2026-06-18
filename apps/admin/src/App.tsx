import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import ConsolePage from './pages/ConsolePage';

export default function App() {
  const { authed } = useAuth();
  return authed ? <ConsolePage /> : <LoginPage />;
}
