import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import UserProfile from './pages/UserProfile';
import ArtistLeaderboard from './pages/ArtistLeaderboard';
import OtherUserProfile from './pages/OtherUserProfile';
import Upload from './pages/Upload';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/profile" replace />} />
        <Route path="profile" element={<UserProfile />} />
        <Route path="profile/:userId" element={<OtherUserProfile />} />
        <Route path="artist/:artistId" element={<ArtistLeaderboard />} />
        <Route path="upload" element={<Upload />} />
      </Route>
    </Routes>
  );
}

export default App;
