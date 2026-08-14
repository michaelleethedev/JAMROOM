"use client";

export type LiveMode = "party" | "sync";
export type LiveRole = "host" | "guest";
export type PlaybackState = "playing" | "paused" | "ended";
export type ApprovalStatus = "approved" | "pending" | "rejected" | "unavailable";
export type MessageType = "chat" | "system" | "reaction";

export type LiveRoom = {
  id: string;
  code: string;
  name: string;
  host_user_id: string;
  mode: LiveMode;
  guests_can_add: boolean;
  require_approval: boolean;
  is_active: boolean;
  created_at: string;
};

export type LiveParticipant = {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string;
  role: LiveRole;
  joined_at: string;
};

export type LiveQueueItem = {
  id: string;
  room_id: string;
  provider: string;
  provider_id: string | null;
  external_url: string | null;
  title: string;
  artist: string;
  artwork: string | null;
  duration: number;
  added_by: string;
  vote_score: number;
  position: number;
  approval_status: ApprovalStatus;
  created_at: string;
};

export type LiveVote = {
  id: string;
  room_id: string;
  queue_item_id: string;
  user_id: string;
  value: 1 | -1;
};

export type LiveMessage = {
  id: string;
  room_id: string;
  user_id: string | null;
  display_name: string;
  type: MessageType;
  message: string;
  created_at: string;
};

export type LivePlayerState = {
  room_id: string;
  current_queue_item_id: string | null;
  playback_state: PlaybackState;
  position_seconds: number;
  volume: number;
  updated_at: string;
};

export type ParsedMusicLink = {
  provider: "YouTube" | "Spotify" | "Apple Music" | "SoundCloud" | "Music Link";
  providerId: string | null;
  externalUrl: string | null;
  title: string;
  artist: string;
  duration: number;
  artwork: string | null;
};

export const LIVE_DISPLAY_NAME_KEY = "jamroom-live-display-name";

export const liveFallbackTracks = [
  { title: "Daydreams", artist: "Miami Dusk", duration: 215 },
  { title: "Midnight Glow", artist: "Luna Waves", duration: 182 },
  { title: "Ocean Drive", artist: "Coastal Club", duration: 165 },
  { title: "Sleepless Nights", artist: "Kyoto Coast", duration: 192 },
  { title: "Better Together", artist: "The Brights", duration: 208 },
  { title: "Signal Bloom", artist: "The Relay", duration: 192 }
];

export function normalizeRoomCode(value: string) {
  return value.replace(/\s+/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function makeLiveRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "JR";
}

export function formatDuration(seconds: number) {
  const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const minutes = Math.floor(safeSeconds / 60);
  const rest = safeSeconds % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

export function getLiveRoomUrl(code: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  return `${base.replace(/\/$/, "")}/room/${normalizeRoomCode(code)}`;
}

export function isLocalInviteUrl(url: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\//i.test(url);
}

export function createTrackFromInput(raw: string): ParsedMusicLink {
  const input = raw.trim();
  const parsed = parseMusicUrl(input);
  if (parsed) return parsed;

  const fallback = liveFallbackTracks[Math.abs(hash(input || "jamroom")) % liveFallbackTracks.length];
  return {
    provider: "Music Link",
    providerId: null,
    externalUrl: null,
    title: input || fallback.title,
    artist: input ? "OpenAux request" : fallback.artist,
    duration: fallback.duration,
    artwork: null
  };
}

export function parseMusicUrl(raw: string): ParsedMusicLink | null {
  if (!/^https?:\/\//i.test(raw.trim())) return null;

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const youtubeId = getYouTubeVideoId(url);
  if (youtubeId) {
    return {
      provider: "YouTube",
      providerId: youtubeId,
      externalUrl: raw.trim(),
      title: "YouTube link",
      artist: "Playable on host device",
      duration: 210,
      artwork: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`
    };
  }

  if (host.includes("spotify.com")) return providerLink(raw, "Spotify", host);
  if (host.includes("music.apple.com") || host.includes("apple.com")) return providerLink(raw, "Apple Music", host);
  if (host.includes("soundcloud.com")) return providerLink(raw, "SoundCloud", host);
  return null;
}

export function getYouTubeVideoId(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") return cleanYouTubeId(url.pathname.slice(1));
  if (host.includes("youtube.com")) {
    if (url.pathname.startsWith("/watch")) return cleanYouTubeId(url.searchParams.get("v") ?? "");
    if (url.pathname.startsWith("/shorts/")) return cleanYouTubeId(url.pathname.split("/")[2] ?? "");
    if (url.pathname.startsWith("/embed/")) return cleanYouTubeId(url.pathname.split("/")[2] ?? "");
  }
  return null;
}

function providerLink(raw: string, provider: ParsedMusicLink["provider"], host: string): ParsedMusicLink {
  return {
    provider,
    providerId: null,
    externalUrl: raw.trim(),
    title: `${provider} link`,
    artist: host,
    duration: 210,
    artwork: null
  };
}

function cleanYouTubeId(value: string) {
  const id = value.trim().split(/[?&#/]/)[0];
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}

function hash(input: string) {
  return input.split("").reduce((total, char) => ((total << 5) - total + char.charCodeAt(0)) | 0, 0);
}
