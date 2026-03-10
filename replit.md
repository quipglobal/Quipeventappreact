# Project Overview

A React + Vite + TypeScript frontend application — an event companion app with multiple screens (splash, welcome, home, agenda, events, leaderboard, profile, sponsors, surveys, polls, challenges, etc.).

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 6
- **Styling**: Tailwind CSS v4 + CSS custom properties
- **UI Libraries**: Radix UI, MUI, Lucide React, Recharts, Framer Motion
- **State**: React Context (AppContext, ThemeContext)

## Project Layout

```
src/
  main.tsx          - Entry point
  app/
    App.tsx         - Root component with routing logic
    components/     - All page/UI components
    context/        - AppContext, ThemeContext
    data/           - Static mock data
    types/          - TypeScript types
    utils/          - Utility helpers
  styles/           - Global CSS (index, tailwind, theme, fonts)
```

## Dev Server

- Host: `0.0.0.0`, Port: `5000`
- Command: `npm run dev`
- Vite config sets `allowedHosts: true` for Replit proxy compatibility

## Deployment

- Target: **static** (pure client-side SPA)
- Build: `npm run build` → outputs to `dist/`
