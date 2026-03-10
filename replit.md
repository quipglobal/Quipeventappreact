# Project Overview

A React + Vite + TypeScript frontend application — an event companion app with multiple screens (splash, welcome, event join, home, agenda, events, leaderboard, profile, sponsors, surveys, polls, challenges, etc.).

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
    App.tsx         - Root component with screen flow & routing logic
    components/     - All page/UI components
      EventJoinPage.tsx - Post-login event join screen (code entry + event lists)
    context/        - AppContext (user, event, gamification), ThemeContext
    data/           - Static mock data
    types/          - TypeScript types (config.ts has EventConfig, etc.)
    utils/          - Utility helpers
  styles/           - Global CSS (index, tailwind, theme, fonts)
```

## Screen Flow

`splash` → `welcome` (login) → `event-join` (enter code or browse events) → `main` (full app with bottom nav)

- **Event Join Page**: After login, users must enter an event code or select an event from the upcoming/past lists. Entering a valid code calls `switchEvent(config)` + `joinEvent()` to set up the active event context. Clicking an event card calls `switchEvent(config)` and navigates to the event dashboard.
- Valid mock event codes: `TECH26`, `DEVCON`, `SUMMIT`, `HEALTH`, `DESIGN`
- Event codes are also used in `SwitchEventModal` for switching events within the app.

## Dev Server

- Host: `0.0.0.0`, Port: `5000`
- Command: `npm run dev`
- Vite config sets `allowedHosts: true` for Replit proxy compatibility

## Deployment

- Target: **static** (pure client-side SPA)
- Build: `npm run build` → outputs to `dist/`
