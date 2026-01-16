# Herd - Music Streaming Leaderboard App

## Overview
Herd is a social music app that allows users to view and share their Spotify listening history, compete on artist leaderboards, and interact with other fans. The name is a play on words - representing both "herd" (a group of fans following their favorite artist like goats following a shepherd) and "heard" (the music they've listened to).

## Tagline
"Prove you're the Goat."

## Project Structure
```
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # Shared components (Layout)
│   │   ├── pages/       # Page components
│   │   └── main.tsx     # Entry point
│   └── public/          # Static assets
├── server/              # Express backend
│   ├── index.ts         # API server
│   └── db.ts            # Database connection
├── attached_assets/     # Reference images and logo
└── *.json               # Spotify streaming history data files
```

## Tech Stack
- **Frontend**: React, TypeScript, Tailwind CSS, React Router
- **Backend**: Express.js, TypeScript
- **Database**: PostgreSQL (Neon)
- **Build Tool**: Vite

## Core Features
1. **User Profile**: View total listening minutes, total songs, top artists, and top songs
2. **Artist Leaderboards**: See who has listened to any artist the most
3. **Fan Comments**: Users can comment on artist pages and like comments
4. **Data Upload**: Users can upload their Spotify Extended Streaming History JSON files

## API Endpoints
- `GET /api/user/:userId?` - Get user profile and stats
- `GET /api/artist/:artistName` - Get artist leaderboard and comments
- `POST /api/artist/:artistName/comment` - Add a comment to an artist page
- `POST /api/comment/:commentId/like` - Like a comment
- `POST /api/upload` - Upload Spotify streaming history files
- `GET /api/users/search` - Search for users

## Database Schema
- `users` - User accounts with username and avatar
- `streaming_history` - Individual stream records from Spotify
- `comments` - Fan comments on artist pages
- `comment_likes` - Track which users liked which comments

## Color Scheme
Blue-to-green gradient representing blue sky fading into green fields (herd imagery)

## Development
- Frontend runs on port 5000 (public webview)
- Backend API runs on port 3001 (proxied by Vite)

## Recent Changes
- January 16, 2026: Initial build with User Profile, Artist Leaderboard, and Upload pages

## User Preferences
- Clean, modern design inspired by Spotify Wrapped
- Herd-related imagery (goats, fields, outdoors)
- Gamified leaderboard experience
