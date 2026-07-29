# JamRoom

JamRoom is a polished portfolio demonstration of a social music-listening room. Visitors can create or join a room, build a shared queue, vote on tracks, chat, react, and switch between Host View and Guest View without creating an account or connecting a real music service.

JamRoom does not stream copyrighted music and does not connect to Spotify, Apple Music, YouTube, SoundCloud, or any external music-service account. Playback, search, link matching, presence, chat, and realtime activity are simulated for portfolio review.

## Features

- Recruiter-friendly landing page with Create Room, Join Room, and prominent Demo Mode
- First-time Demo Mode introduction with a localStorage-powered "Do not show again" option
- Host View and Guest View mode switch for testing both roles instantly
- Simulated synced player with play, pause, skip, shuffle, repeat, progress, and volume controls
- Shared queue with mock search, music-link matching, voting, host reorder, host remove, and approval states
- People panel with avatars, online status, listening indicators, and Host/Guest badges
- Live-style chat with avatars, timestamps, system messages, and reactions
- Host dashboard for playback, queue, invite, permissions, participant, and end-room controls
- About This Demo panel with technologies, mocked areas, and future production notes
- Local storage persistence with safe fallbacks for missing public environment variables
- Responsive desktop and mobile layouts with mobile tabs and sticky compact player

## Screenshots

Add screenshots here after deployment:

- Landing page
- Demo listening room
- Host dashboard
- Mobile queue tab

## Tech Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Zustand
- Local storage persistence
- Lucide React icons
- Mock data for rooms, songs, users, chat, reactions, and queue activity

## Local Setup

Install dependencies:

```bash
pnpm install
```

Run the development server:

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

## Available Scripts

```bash
pnpm dev
pnpm build
pnpm typecheck
```

Linting is not currently configured as a separate script. Next.js still validates TypeScript during `pnpm build`.

## Demo Mode

Demo Mode is the recommended way for recruiters to explore JamRoom. It resets the app into a predictable sample room with code `JAM247`, realistic participants, populated queue, chat history, emoji reactions, and occasional simulated activity such as new votes, song additions, and reactions.

The first Demo Mode launch shows a short introduction explaining what JamRoom is, what is simulated, and three suggested actions to try.

## Host View vs Guest View

Host View exposes room controls such as playback management, queue removal and reordering, guest permissions, approval settings, participant removal, invite copying, and ending the room.

Guest View keeps host-only controls out of the way while still allowing the visitor to vote, chat, react, and add songs when the host permits it.

## Mocked Functionality

This portfolio version simulates:

- Music playback and progress
- Universal search and pasted music-link matching
- Realtime chat delivery
- Room presence
- Emoji reactions
- Queue synchronization
- Invite links
- Song approval workflow

## Future Production Integrations

A production version would require:

- Authentication and user accounts
- Provider OAuth where required
- Licensed playback SDKs or API integrations
- Realtime backend transport such as WebSockets or server-sent events
- Database-backed rooms, queues, votes, chat, and moderation records
- Robust invite links and access controls
- Provider compliance review and playback-rights handling

## Project Structure

```text
app/
  globals.css    Global Tailwind styles and product polish
  layout.tsx     App metadata and root shell
  page.tsx       JamRoom demo application, mock data, Zustand store, and UI components
.env.example     Public URL placeholders
package.json     Scripts and dependencies
```

## Deployment

JamRoom is ready for Vercel deployment without a database or server secrets.

Set these optional public environment variables in Vercel when real URLs are available:

```text
NEXT_PUBLIC_GITHUB_URL
NEXT_PUBLIC_PORTFOLIO_URL
NEXT_PUBLIC_APP_URL
```

Then deploy with the Vercel dashboard or CLI:

```bash
pnpm build
vercel
```

## Portfolio Context

JamRoom is designed as a recruiter-facing portfolio project. It demonstrates product thinking, responsive UI polish, interactive client-side state, edge-case handling, accessibility details, and deployment readiness without depending on paid APIs or private accounts.
