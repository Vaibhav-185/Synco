# Synco Frontend

React 19 + Vite single-page app for the Synco timetable-sharing product.

## Scripts

- `npm run dev` - local dev server (Vite, port 5173)
- `npm run build` - production build to `dist/`
- `npm run lint` - oxlint
- `npm test` - vitest suite (upload regression tests live in `src/pages/Dashboard.test.jsx`)
- `npm run preview` - preview the production build

## Stack

React 19, React Router, axios, custom CSS design system (Light / Dark / System themes, Quiet Premium style).

## PWA

- `public/manifest.webmanifest` - installable app manifest
- `public/icon-192.png`, `public/icon-512.png`, `public/icon-180.png` - install icons
- `public/sw.js` - service worker (push notifications)
- Install via browser on Android (Chrome) or iOS (Safari Share -> Add to Home Screen).

## Structure

- `src/pages/` - screens (Dashboard, Friends, Groups, Profile, Login, Signup)
- `src/components/` - TimetableGrid, TimetableReview, EnableNotifications, SlotForm, Navbar, etc.
- `src/context/` - AuthContext, ThemeContext
- `src/index.css` - design tokens and component styles

See the repository root `README.md` for the full project overview.
