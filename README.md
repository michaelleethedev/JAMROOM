# JamRoom

JamRoom is a polished portfolio demonstration of a social music-listening room. Visitors can explore an offline Demo Mode, or create a Supabase-backed Live Room where multiple physical devices share the same queue, votes, chat, reactions, participants, and visible playback state.

JamRoom does not stream copyrighted music through a server. In Live Party Mode, only the Host device initializes the YouTube IFrame player and plays audio; guest devices see now-playing metadata and visual progress without playing audio.

## Features

- Recruiter-friendly landing page with Create Room, Join Room, and prominent Demo Mode
- Live Party Mode powered by Supabase anonymous auth, Postgres, Realtime, and Presence
- `/live` room creation with room code, join URL, copy actions, and local QR code
- `/room/[code]` join flow for guests on separate phones or computers
- First-time Demo Mode introduction with a localStorage-powered "Do not show again" option
- Host View and Guest View mode switch for testing both roles instantly
- Host-only YouTube playback controls in Live Party Mode
- Simulated synced player with play, pause, skip, shuffle, repeat, progress, and volume controls in Demo Mode
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
- Supabase client for Live Rooms
- qrcode.react for local invite QR generation

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

Demo Mode remains fully local and works without Supabase.

## Live Party Mode

Live Party Mode is the first real multiplayer mode. It is designed for in-person listening where the Host device is connected to a Bluetooth speaker or sound system.

- Host creates a room at `/live`
- Guests join at `/room/[code]` or by scanning the generated QR code
- Guests use anonymous Supabase auth and only enter a display name
- Queue additions, votes, chat, reactions, participants, room settings, and player state update through Supabase Realtime
- Only the Host device initializes audible YouTube playback
- Guest devices do not initialize the YouTube player and cannot control playback
- Sync Mode is intentionally labeled as coming soon

## Host View vs Guest View

Host View exposes room controls such as playback management, queue removal and reordering, guest permissions, approval settings, participant removal, invite copying, and ending the room.

Guest View keeps host-only controls out of the way while still allowing the visitor to vote, chat, react, and add songs when the host permits it.

## Supabase Setup

Create a Supabase project, enable Anonymous Sign-Ins in Authentication, then run:

```text
supabase/schema.sql
```

Enable Realtime for these tables in the Supabase Dashboard:

```text
rooms
participants
queue_items
votes
messages
player_state
```

The schema includes:

- `rooms`
- `participants`
- `queue_items`
- `votes`
- `messages`
- `player_state`

It also includes a vote-score trigger, duplicate-vote prevention, participant access policies, and host-only RLS policies for playback, queue administration, room settings, participant removal, and ending rooms.

## Environment Variables

```text
NEXT_PUBLIC_GITHUB_URL
NEXT_PUBLIC_PORTFOLIO_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Only the public Supabase anon key belongs in the client. Do not put Supabase service-role credentials in Vercel client environment variables.

## Mocked Functionality

Demo Mode simulates:

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

- Optional named accounts beyond anonymous auth
- Provider OAuth where required
- Licensed playback SDKs or API integrations
- Cross-device audio Sync Mode
- Robust invite links and access controls
- Provider compliance review and playback-rights handling

## Project Structure

```text
app/
  live/page.tsx           Live Party Mode room creation
  room/[code]/page.tsx    Live Room route wrapper
  room/[code]/room-client.tsx  Supabase realtime room experience
  globals.css    Global Tailwind styles and product polish
  layout.tsx     App metadata and root shell
  page.tsx       JamRoom demo application, mock data, Zustand store, and UI components
lib/
  jamroom/live.ts         Live Room types and helpers
  supabase/client.ts      Browser Supabase client and anonymous auth
supabase/schema.sql       Postgres schema, triggers, and RLS policies
.env.example     Public URL placeholders
package.json     Scripts and dependencies
```

## Deployment

For Demo Mode only, JamRoom can still run without a database. For Live Party Mode, configure these Vercel environment variables:

```text
NEXT_PUBLIC_GITHUB_URL
NEXT_PUBLIC_PORTFOLIO_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Then deploy with the Vercel dashboard or CLI:

```bash
pnpm build
vercel
```

## Portfolio Context

JamRoom is designed as a recruiter-facing portfolio project. It demonstrates product thinking, responsive UI polish, interactive client-side state, edge-case handling, accessibility details, and deployment readiness without depending on paid APIs or private accounts.
