import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const isArtistPage = location.pathname.startsWith('/artist');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      if (isArtistPage) {
        navigate(`/artist/${encodeURIComponent(searchQuery.trim())}`);
      } else {
        navigate(`/profile/${encodeURIComponent(searchQuery.trim())}`);
      }
      setSearchQuery('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white/80 backdrop-blur-sm shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/profile" className="flex items-center gap-2">
            <img src="/herd-logo.png" alt="Herd" className="w-10 h-10" />
            <span className="font-bold text-xl text-gray-800">HERD</span>
          </Link>
          <form onSubmit={handleSearch} className="flex-1 max-w-xs ml-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isArtistPage ? "Search artists..." : "Search fans..."}
              className="w-full px-4 py-2 rounded-full bg-gray-100 border-none focus:outline-none focus:ring-2 focus:ring-green-400 text-sm"
            />
          </form>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6">
        <Outlet />
      </main>

      <nav className="bg-white shadow-lg sticky bottom-0">
        <div className="max-w-4xl mx-auto flex">
          <Link
            to="/profile"
            className={`flex-1 py-4 text-center font-medium ${
              !isArtistPage ? 'text-green-600 border-t-2 border-green-600' : 'text-gray-500'
            }`}
          >
            Fans
          </Link>
          <Link
            to="/artist/Taylor Swift"
            className={`flex-1 py-4 text-center font-medium ${
              isArtistPage ? 'text-green-600 border-t-2 border-green-600' : 'text-gray-500'
            }`}
          >
            Artists
          </Link>
        </div>
      </nav>
    </div>
  );
}
