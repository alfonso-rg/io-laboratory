import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { useGameStore } from './stores/gameStore';
import { useSocket } from './hooks/useSocket';
import { HomePage } from './components/HomePage';
import { GameBoard } from './components/game/GameBoard';
import { GameResults } from './components/results/GameResults';
import { AdminPanel } from './components/admin/AdminPanel';
import { Login } from './components/Login';

const API_BASE_URL = import.meta.env.VITE_SOCKET_URL ||
  (window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://io-laboratory.onrender.com');

function Navigation() {
  const location = useLocation();
  const { gameState, connected } = useGameStore();

  const isActive = (path: string) =>
    location.pathname === path ? 'bg-blue-700' : 'hover:bg-blue-600';

  return (
    <nav className="bg-blue-500 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <Link to="/" className="font-bold text-xl">
              IO Laboratory
            </Link>
            <div className="flex space-x-2">
              <Link
                to="/"
                className={`px-3 py-2 rounded transition-colors ${isActive('/')}`}
              >
                Configure
              </Link>
              <Link
                to="/game"
                className={`px-3 py-2 rounded transition-colors ${isActive('/game')}`}
              >
                Game
              </Link>
              <Link
                to="/results"
                className={`px-3 py-2 rounded transition-colors ${isActive('/results')}`}
              >
                Results
              </Link>
              <Link
                to="/admin"
                className={`px-3 py-2 rounded transition-colors ${isActive('/admin')}`}
              >
                Admin
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {gameState && (
              <span className="text-sm">
                Game: <span className="font-medium">{gameState.status}</span>
              </span>
            )}
            <span
              className={`inline-block w-3 h-3 rounded-full ${
                connected ? 'bg-green-400' : 'bg-red-400'
              }`}
              title={connected ? 'Connected' : 'Disconnected'}
            />
          </div>
        </div>
      </div>
    </nav>
  );
}

function AppContent() {
  const { gameState } = useGameStore();

  // Initialize socket connection
  useSocket();

  // Auto-redirect based on game state
  const getDefaultComponent = () => {
    if (!gameState || gameState.status === 'idle' || gameState.status === 'configuring') {
      return <HomePage />;
    }
    if (gameState.status === 'running' || gameState.status === 'paused') {
      return <GameBoard />;
    }
    if (gameState.status === 'completed') {
      return <GameResults />;
    }
    return <HomePage />;
  };

  return (
    <>
      <Navigation />
      <main className="min-h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={getDefaultComponent()} />
          <Route path="/game" element={<GameBoard />} />
          <Route path="/results" element={<GameResults />} />
          <Route path="/admin" element={<AdminPanel />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Check if authentication is required
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/status`);
        const data = await response.json();

        if (data.success) {
          setAuthRequired(data.authRequired);

          // If auth is required, check if already authenticated
          if (data.authRequired) {
            const isAuth = sessionStorage.getItem('io-lab-authenticated') === 'true';
            setAuthenticated(isAuth);
          } else {
            setAuthenticated(true);
          }
        }
      } catch (err) {
        // If we can't check, assume no auth required (dev mode)
        console.error('Failed to check auth status:', err);
        setAuthenticated(true);
      } finally {
        setAuthChecked(true);
      }
    };

    checkAuth();
  }, []);

  // Show loading while checking auth
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Show login if auth required and not authenticated
  if (authRequired && !authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
