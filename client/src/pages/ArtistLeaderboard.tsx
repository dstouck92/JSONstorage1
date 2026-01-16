import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

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

interface LeaderboardEntry {
  rank: number;
  userId: number;
  username: string;
  avatar: string;
  minutes: number;
  songCount: number;
  isCurrentUser: boolean;
}

interface Comment {
  id: number;
  content: string;
  likes: number;
  createdAt: string;
  username: string;
  avatar: string;
}

interface ArtistData {
  artist: { name: string };
  leaderboard: LeaderboardEntry[];
  comments: Comment[];
}

export default function ArtistLeaderboard() {
  const { artistId } = useParams();
  const [data, setData] = useState<ArtistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = () => {
    if (!artistId) return;
    setLoading(true);
    fetch(`/api/artist/${encodeURIComponent(artistId)}`)
      .then(res => res.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [artistId]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !artistId) return;
    
    setSubmitting(true);
    try {
      const res = await fetch(`/api/artist/${encodeURIComponent(artistId)}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newComment })
      });
      const comment = await res.json();
      setData(prev => prev ? { ...prev, comments: [comment, ...prev.comments] } : prev);
      setNewComment('');
    } catch (err) {
      console.error(err);
    }
    setSubmitting(false);
  };

  const handleLike = async (commentId: number) => {
    try {
      const res = await fetch(`/api/comment/${commentId}/like`, { method: 'POST' });
      const { likes } = await res.json();
      setData(prev => prev ? {
        ...prev,
        comments: prev.comments.map(c => c.id === commentId ? { ...c, likes } : c)
      } : prev);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!data) {
    return <div className="text-center py-12 text-gray-500">Artist not found</div>;
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white/70 backdrop-blur rounded-2xl p-8 shadow-sm text-center">
        <div className="w-24 h-24 bg-gradient-to-br from-gray-300 to-gray-400 rounded-full mx-auto mb-4 flex items-center justify-center">
          <span className="text-4xl">🎤</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">{data.artist.name}</h1>
        <p className="text-gray-500">Artist Leaderboard</p>
      </div>

      <div className="bg-white/70 backdrop-blur rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>👑</span> Top Listeners
        </h2>
        
        {data.leaderboard.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No listeners yet. Be the first!</p>
        ) : (
          <div className="space-y-3">
            {data.leaderboard.map((entry) => (
              <Link
                key={entry.userId}
                to={entry.isCurrentUser ? '/profile' : `/profile/${entry.userId}`}
                className={`flex items-center gap-4 p-3 rounded-xl transition ${
                  entry.isCurrentUser ? 'bg-green-50 border border-green-200' : 'hover:bg-white/50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                  entry.rank === 1 ? 'bg-yellow-500' :
                  entry.rank === 2 ? 'bg-gray-400' :
                  entry.rank === 3 ? 'bg-amber-600' :
                  'bg-gray-300'
                }`}>
                  {entry.rank}
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-200 to-green-200 rounded-full flex items-center justify-center text-xl">
                  {avatarEmoji[entry.avatar] || '🐐'}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800 flex items-center gap-2">
                    {entry.username}
                    {entry.rank === 1 && <span>🐐</span>}
                    {entry.isCurrentUser && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">You</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">
                    {entry.minutes.toLocaleString()} min · {entry.songCount.toLocaleString()} songs
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white/70 backdrop-blur rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-800 mb-4">Fan Comments</h2>
        
        <form onSubmit={handleSubmitComment} className="flex gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-200 to-green-200 rounded-full flex items-center justify-center text-xl flex-shrink-0">
            🐐
          </div>
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your thoughts..."
            className="flex-1 px-4 py-2 rounded-full bg-gray-100 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          <button
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center disabled:opacity-50"
          >
            ➤
          </button>
        </form>

        <div className="space-y-4">
          {data.comments.map(comment => (
            <div key={comment.id} className="flex gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-200 to-green-200 rounded-full flex items-center justify-center text-xl flex-shrink-0">
                {avatarEmoji[comment.avatar] || '🐐'}
              </div>
              <div className="flex-1">
                <p className="text-sm">
                  <span className="font-medium text-gray-800">{comment.username}</span>
                  <span className="text-gray-400 ml-2">{timeAgo(comment.createdAt)}</span>
                </p>
                <p className="text-gray-700">{comment.content}</p>
                <button
                  onClick={() => handleLike(comment.id)}
                  className="text-sm text-gray-400 hover:text-red-500 mt-1 flex items-center gap-1"
                >
                  ❤️ {comment.likes > 0 && comment.likes}
                </button>
              </div>
            </div>
          ))}
          {data.comments.length === 0 && (
            <p className="text-center text-gray-500 py-4">No comments yet. Be the first to share!</p>
          )}
        </div>
      </div>
    </div>
  );
}
