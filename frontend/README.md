# Mafia Game - Frontend

Modern, feature-rich web client for the Multiplayer Mafia game, built with React, TypeScript, and Vite.

## Features

- **Real-time Multiplayer:** Play classic Mafia with various roles (Serial Killer, Escort, Jester, Lawyer, Bodyguard, Mayor, etc.) using WebSockets.
- **Matchmaking & Lobbies:** Create private games, join via room codes, or queue for online matchmaking.
- **Social Features:** Friends system, direct messaging, user profiles, and trading.
- **Clans & Wars:** Form clans, manage members, and declare wars on other clans with a dedicated leaderboard.
- **Store & Inventory:** Purchase cosmetics, roles, and items. Trade them with other players.
- **Localization:** Full support for both English (en) and Ukrainian (uk) languages.
- **PWA Ready:** Installable as a Progressive Web App on mobile and desktop devices.
- **Admin Panel:** Comprehensive Role-Based Access Control (RBAC) system for game staff with up to 9 power levels for moderation.

## Tech Stack

- **Framework:** React 18 + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS (Vanilla CSS & utilities)
- **State Management:** Zustand
- **Networking:** Socket.IO Client
- **Routing:** React Router DOM
- **Icons:** Lucide React
- **Internationalization:** i18next

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn

### Installation generated

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   Create a `.env` file in the root of the `frontend` directory:
   ```env
   VITE_API_URL=http://localhost:3000
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

### Building for Production

To create a production build:
```bash
npm run build
```

This command will output the compiled assets to the `dist` folder. You can test the built app with:
```bash
npm run preview
```

## Supported Roles
- **Standard:** Mafia, Don, Detective, Doctor, Citizen
- **Neutral / Special:** Serial Killer, Escort, Jester, Lawyer, Bodyguard, Tracker, Informer, Mayor, Judge, Bomber, Trapper, Silencer, Lovers, Whore, Journalist
