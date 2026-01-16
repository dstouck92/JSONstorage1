import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login, signup } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const result = await login(username, password || undefined);
        if (result.success) {
          navigate('/profile');
        } else if (result.needsPassword) {
          setNeedsPassword(true);
          setError('This account has a password. Please enter it.');
        } else {
          setError(result.error || 'Login failed');
        }
      } else {
        const result = await signup(username, password || undefined);
        if (result.success) {
          navigate('/profile');
        } else {
          setError(result.error || 'Signup failed');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-100 via-emerald-50 to-green-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🐐</div>
          <h1 className="text-3xl font-bold text-gray-800">HERD</h1>
          <p className="text-gray-600 mt-2">Prove you're the Goat</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            <button
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                mode === 'login'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => { setMode('login'); setError(''); setNeedsPassword(false); }}
            >
              Log In
            </button>
            <button
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                mode === 'signup'
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              onClick={() => { setMode('signup'); setError(''); setNeedsPassword(false); }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="Enter your username"
                required
              />
            </div>

            {(mode === 'signup' || needsPassword) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password {mode === 'signup' && <span className="text-gray-400">(optional)</span>}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                  placeholder={mode === 'signup' ? 'Create a password (optional)' : 'Enter your password'}
                  required={needsPassword}
                />
                {mode === 'signup' && (
                  <p className="text-xs text-gray-500 mt-1">
                    You can set a password now or later
                  </p>
                )}
              </div>
            )}

            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white py-3 px-4 rounded-lg font-medium hover:from-emerald-600 hover:to-green-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Please wait...' : mode === 'login' ? 'Log In' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              {mode === 'login' ? (
                <>
                  New to Herd?{' '}
                  <button
                    onClick={() => { setMode('signup'); setError(''); }}
                    className="text-emerald-600 hover:underline font-medium"
                  >
                    Create an account
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <button
                    onClick={() => { setMode('login'); setError(''); }}
                    className="text-emerald-600 hover:underline font-medium"
                  >
                    Log in
                  </button>
                </>
              )}
            </p>
          </div>
        </div>

        <p className="text-center text-gray-500 text-sm mt-6">
          Upload your Spotify data and compete on artist leaderboards
        </p>
      </div>
    </div>
  );
}
