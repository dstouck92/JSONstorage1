import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AVATARS = ['goat', 'cow', 'sheep', 'pig', 'horse', 'chicken', 'duck', 'rabbit'];

const avatarEmoji: Record<string, string> = {
  goat: '🐐',
  cow: '🐄',
  sheep: '🐑',
  pig: '🐷',
  horse: '🐴',
  chicken: '🐔',
  duck: '🦆',
  rabbit: '🐰'
};

interface UserData {
  user: {
    id: number;
    username: string;
    avatar: string;
    createdAt: string;
  };
  stats: {
    totalMinutes: number;
    totalSongs: number;
  };
  topArtists: Array<{ name: string; minutes: number; plays: number }>;
  topSongs: Array<{ name: string; artist: string; minutes: number; plays: number }>;
}

export default function UserProfile() {
  const { user: authUser, loading: authLoading, setPassword } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAvatars, setShowAvatars] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/spotify/status', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setSpotifyConnected(data.connected))
      .catch(() => setSpotifyConnected(false));
  }, []);

  useEffect(() => {
    if (authLoading) return;
    
    const userId = authUser?.id || '';
    fetch(`/api/user/${userId}`, { credentials: 'include' })
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authUser, authLoading]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    const result = await setPassword(newPassword);
    if (result.success) {
      setShowPasswordModal(false);
      setNewPassword('');
    } else {
      setPasswordError(result.error || 'Failed to set password');
    }
  };

  const handleSpotifySync = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch('/api/spotify/sync', { 
        method: 'POST', 
        credentials: 'include' 
      });
      const result = await res.json();
      if (res.ok) {
        setSyncMessage(`Synced ${result.imported} tracks from Spotify!`);
        const userId = authUser?.id || '';
        const newData = await fetch(`/api/user/${userId}`, { credentials: 'include' }).then(r => r.json());
        setData(newData);
      } else {
        setSyncMessage(result.error || 'Failed to sync');
      }
    } catch (e) {
      setSyncMessage('Failed to sync with Spotify');
    } finally {
      setSyncing(false);
    }
  };

  if (loading || authLoading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!authUser) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🐐</div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to Herd</h2>
        <p className="text-gray-600 mb-6">Prove you're the Goat. Log in to see your stats and compete on leaderboards.</p>
        <Link 
          to="/login" 
          className="inline-block bg-gradient-to-r from-emerald-500 to-green-600 text-white px-8 py-3 rounded-lg font-medium hover:from-emerald-600 hover:to-green-700 transition-all"
        >
          Get Started
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">No data yet. Upload your Spotify history to get started!</p>
        <Link to="/upload" className="inline-block bg-green-500 text-white px-6 py-3 rounded-lg font-medium">
          Upload Data
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/70 backdrop-blur rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowAvatars(!showAvatars)}
              className="w-16 h-16 bg-gradient-to-br from-blue-200 to-green-200 rounded-full flex items-center justify-center text-3xl"
            >
              {avatarEmoji[data.user.avatar] || '🐐'}
            </button>
            {showAvatars && (
              <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg p-2 grid grid-cols-4 gap-2 z-10">
                {AVATARS.map(a => (
                  <button key={a} className="text-2xl p-2 hover:bg-gray-100 rounded">
                    {avatarEmoji[a]}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800">{data.user.username}</h1>
            <p className="text-gray-500 text-sm">
              Member since {new Date(data.user.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          {spotifyConnected === false ? (
            <div className="text-right">
              <Link 
                to="/upload"
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Upload Data
              </Link>
              <p className="text-xs text-gray-500 mt-1">Spotify sync coming soon</p>
            </div>
          ) : (
            <button 
              onClick={handleSpotifySync}
              disabled={syncing || spotifyConnected === null}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          )}
        </div>
        
        {syncMessage && (
          <div className={`mt-3 text-sm ${syncMessage.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>
            {syncMessage}
          </div>
        )}
        
        {authUser && !authUser.hasPassword && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              Secure your account by setting a password.{' '}
              <button 
                onClick={() => setShowPasswordModal(true)}
                className="text-amber-600 underline font-medium"
              >
                Set password
              </button>
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/70 backdrop-blur rounded-2xl p-6 shadow-sm text-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-green-600">🕐</span>
          </div>
          <p className="text-gray-500 text-sm">Total Minutes</p>
          <p className="text-4xl font-bold text-gray-800">{data.stats.totalMinutes.toLocaleString()}</p>
          <p className="text-gray-400 text-xs">≈ {Math.round(data.stats.totalMinutes / 60).toLocaleString()} hours</p>
        </div>
        <div className="bg-white/70 backdrop-blur rounded-2xl p-6 shadow-sm text-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-green-600">🎵</span>
          </div>
          <p className="text-gray-500 text-sm">Total Songs</p>
          <p className="text-4xl font-bold text-gray-800">{data.stats.totalSongs.toLocaleString()}</p>
          <p className="text-gray-400 text-xs">streams since joining</p>
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>🏆</span> Top Artists
        </h2>
        <div className="space-y-3">
          {data.topArtists.map((artist, i) => (
            <Link
              key={artist.name}
              to={`/artist/${encodeURIComponent(artist.name)}`}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/50 transition"
            >
              <span className="w-6 text-gray-500 font-medium">{i + 1}</span>
              <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                <span className="text-gray-500 text-lg">🎤</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">{artist.name}</p>
                <p className="text-sm text-gray-500">{artist.minutes.toLocaleString()} minutes</p>
              </div>
              <span className="text-gray-400">›</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="bg-white/70 backdrop-blur rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>🎧</span> Top Songs
        </h2>
        <div className="space-y-3">
          {data.topSongs.map((song, i) => (
            <div key={`${song.name}-${song.artist}`} className="flex items-center gap-4 p-3 rounded-xl">
              <span className="w-6 text-gray-500 font-medium">{i + 1}</span>
              <div className="w-12 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                <span className="text-gray-500 text-lg">🎵</span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">{song.name}</p>
                <p className="text-sm text-gray-500">{song.artist} • {song.minutes.toLocaleString()} minutes</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Set Your Password</h3>
            <form onSubmit={handleSetPassword}>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter a password (4+ characters)"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none mb-4"
                minLength={4}
                required
              />
              {passwordError && (
                <p className="text-red-600 text-sm mb-4">{passwordError}</p>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-500 text-white rounded-lg font-medium"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
