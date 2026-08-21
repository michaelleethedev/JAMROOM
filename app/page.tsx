"use client";

import {
  ChevronDown,
  ChevronUp,
  Clock3,
  Copy,
  Crown,
  Gauge,
  Github,
  Home,
  Info,
  Link2,
  ListMusic,
  LogOut,
  MessageCircle,
  Mic2,
  MoreVertical,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  Repeat2,
  RotateCcw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Shuffle,
  SkipForward,
  Sparkles,
  Trash2,
  UserMinus,
  Users,
  Volume2,
  Wifi,
  Wand2,
  X
} from "lucide-react";
import { FormEvent, KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { brand } from "@/lib/brand";

type ViewMode = "host" | "guest";
type Screen = "landing" | "create" | "room";
type MobileTab = "player" | "queue" | "people" | "chat";

type Song = {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  cover: [string, string, string];
  artwork?: string;
  sourceId?: string;
  sourceUrl?: string;
  sourceProvider?: "YouTube" | "Spotify" | "Apple Music" | "SoundCloud" | "Music Link";
  embedUrl?: string;
};

type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  setVolume: (volume: number) => void;
  destroy: () => void;
};

type YouTubeControls = {
  play: () => void;
  pause: () => void;
  seekPercent: (percent: number) => void;
  setVolume: (volume: number) => void;
};

type YouTubeApi = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void;
        onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
        onError?: () => void;
      };
    }
  ) => YouTubePlayer;
  PlayerState: {
    PLAYING: number;
    PAUSED: number;
    ENDED: number;
  };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
    jamroomYouTubeApiReady?: Promise<YouTubeApi>;
  }
}

type QueueSong = Song & {
  queueId: string;
  addedBy: string;
  votes: number;
  approved: boolean;
  userVote?: 1 | -1;
  unavailable?: boolean;
};

type User = {
  id: string;
  name: string;
  role: "host" | "guest";
  avatar: string;
  color: string;
  online: boolean;
  listening: boolean;
};

type ChatMessage = {
  id: string;
  userId: string | "system";
  text: string;
  time: string;
  reactions: string[];
  system?: boolean;
};

type Room = {
  name: string;
  code: string;
  mood: string;
  guestsCanAdd: boolean;
  requireApproval: boolean;
  ended: boolean;
  demoRunId?: string;
};

type Toast = {
  id: string;
  text: string;
};

type JamState = {
  screen: Screen;
  viewMode: ViewMode;
  mobileTab: MobileTab;
  room: Room | null;
  queue: QueueSong[];
  users: User[];
  chat: ChatMessage[];
  currentSongId: string | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  repeat: boolean;
  shuffle: boolean;
  reactions: string[];
  toasts: Toast[];
  setScreen: (screen: Screen) => void;
  setViewMode: (mode: ViewMode) => void;
  setMobileTab: (tab: MobileTab) => void;
  createRoom: (input: Pick<Room, "name" | "mood" | "guestsCanAdd" | "requireApproval">) => void;
  joinRoom: (code: string) => boolean;
  startDemo: () => void;
  resetDemo: () => void;
  addSong: (song: Song, addedBy?: string) => void;
  approveSong: (queueId: string) => void;
  removeSong: (queueId: string) => void;
  voteSong: (queueId: string, delta: 1 | -1) => void;
  moveSong: (queueId: string, direction: -1 | 1) => void;
  skipSong: () => void;
  clearQueue: () => void;
  shuffleQueue: () => void;
  togglePlay: () => void;
  setProgress: (progress: number) => void;
  setVolume: (volume: number) => void;
  toggleSetting: (setting: "guestsCanAdd" | "requireApproval") => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  removeUser: (id: string) => void;
  sendMessage: (text: string) => void;
  addReaction: (emoji: string) => void;
  endRoom: () => void;
  addToast: (text: string) => void;
  dismissToast: (id: string) => void;
};

type PersistedJamState = Pick<
  JamState,
  "screen" | "viewMode" | "mobileTab" | "room" | "queue" | "users" | "chat" | "currentSongId" | "isPlaying" | "progress" | "volume" | "repeat" | "shuffle"
>;

const PROJECT_LINKS = {
  github: process.env.NEXT_PUBLIC_GITHUB_URL || brand.githubUrl,
  portfolio: process.env.NEXT_PUBLIC_PORTFOLIO_URL || brand.portfolioUrl,
  app: process.env.NEXT_PUBLIC_APP_URL || brand.appUrl
};

const PERSISTED_STATE_VERSION = 6;

const buttonStyles = {
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  neutral: "btn btn-neutral",
  ghost: "btn btn-ghost",
  icon: "btn-icon",
  destructive: "btn btn-destructive"
};

const inputStyles = {
  base: "input-control",
  error: "input-control input-error"
};

const reactionOptions = [
  { emoji: "🔥", label: "Heat", icon: Gauge },
  { emoji: "💜", label: "Love", icon: Music2 },
  { emoji: "✨", label: "Glow", icon: Sparkles },
  { emoji: "🙌", label: "Hype", icon: Radio },
  { emoji: "⚡", label: "Boost", icon: Wifi }
] as const;

const reactionLabel = (emoji: string) => reactionOptions.find((reaction) => reaction.emoji === emoji)?.label ?? "React";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const library: Song[] = [
  { id: "daydreams", title: "Daydreams", artist: "The Midnight", album: "Night Drive", duration: 215, cover: ["#1d4ed8", "#2563eb", "#38bdf8"], artwork: "/images/openaux-artwork/daydreams.jpg" },
  { id: "midnight", title: "Midnight Drive", artist: "Khruangbin", album: "City Lights", duration: 182, cover: ["#0b1426", "#1d4ed8", "#38bdf8"], artwork: "/images/openaux-artwork/midnight-drive.jpg" },
  { id: "ocean", title: "Electric Feel", artist: "MGMT", album: "Waveform", duration: 165, cover: ["#0ea5e9", "#2563eb", "#020617"], artwork: "/images/openaux-artwork/electric-feel.jpg" },
  { id: "sleepless", title: "Nights", artist: "Frank Ocean", album: "Late Hallway", duration: 192, cover: ["#f97316", "#be123c", "#312e81"], artwork: "/images/openaux-artwork/nights.jpg" },
  { id: "better", title: "Sunset Lover", artist: "Petit Biscuit", album: "Pink Horizon", duration: 208, cover: ["#10b981", "#2563eb", "#172554"], artwork: "/images/openaux-artwork/sunset-lover.jpg" },
  { id: "afterimage", title: "Afterglow", artist: "RUFUS DU SOL", album: "Signal Hills", duration: 231, cover: ["#38bdf8", "#2563eb", "#0f172a"], artwork: "/images/openaux-artwork/afterglow.jpg" },
  { id: "solstice", title: "Higher", artist: "ODESZA", album: "Neon Triangle", duration: 268, cover: ["#f97316", "#be123c", "#312e81"], artwork: "/images/openaux-artwork/higher.jpg" },
  { id: "glimmer", title: "The Less I Know", artist: "Tame Impala", album: "Blue Marble", duration: 203, cover: ["#38bdf8", "#2563eb", "#0f172a"], artwork: "/images/openaux-artwork/the-less-i-know.jpg" },
  { id: "golden", title: "Neon Heart", artist: "Moonchild", album: "Open Circle", duration: 231, cover: ["#38bdf8", "#2563eb", "#0f172a"], artwork: "/images/openaux-artwork/neon-heart.jpg" },
  { id: "signal", title: "Breathe", artist: "RUFUS DU SOL", album: "Equalizer", duration: 192, cover: ["#84cc16", "#14b8a6", "#172554"], artwork: "/images/openaux-artwork/breathe.jpg" },
  { id: "mono", title: "Cloudnine", artist: "FKJ", album: "Soft Sky", duration: 209, cover: ["#fb7185", "#facc15", "#0f172a"], artwork: "/images/openaux-artwork/cloudnine.jpg" },
  { id: "static", title: "Hold On", artist: "Chet Faker", album: "Painted Static", duration: 254, cover: ["#6366f1", "#0ea5e9", "#020617"], artwork: "/images/openaux-artwork/hold-on.jpg" },
  { id: "lost", title: "Lost In Time", artist: "The Weeknd", album: "Sunset Water", duration: 226, cover: ["#f97316", "#be123c", "#312e81"], artwork: "/images/openaux-artwork/lost-in-time.jpg" },
  { id: "nowhere", title: "Nowhere", artist: "HONNE", album: "Mountain Air", duration: 214, cover: ["#60a5fa", "#312e81", "#020617"], artwork: "/images/openaux-artwork/nowhere.jpg" },
  { id: "fade", title: "Fade Away", artist: "ODESZA", album: "Low Light", duration: 219, cover: ["#2563eb", "#d946ef", "#020617"], artwork: "/images/openaux-artwork/fade-away.jpg" }
];

const mockUsers: User[] = [
  { id: "you", name: "Alex", role: "host", avatar: "AL", color: "#38bdf8", online: true, listening: true },
  { id: "sarah", name: "Sarah", role: "guest", avatar: "SA", color: "#49d9ff", online: true, listening: true },
  { id: "mike", name: "Mike", role: "guest", avatar: "MI", color: "#5ee5a1", online: true, listening: true },
  { id: "jules", name: "Jules", role: "guest", avatar: "JU", color: "#60a5fa", online: true, listening: true },
  { id: "kenji", name: "Kenji", role: "guest", avatar: "KE", color: "#f59e0b", online: true, listening: true },
  { id: "maya", name: "Maya", role: "guest", avatar: "MA", color: "#fb7185", online: true, listening: false },
  { id: "ari", name: "Ari", role: "guest", avatar: "AR", color: "#22c55e", online: true, listening: true },
  { id: "noor", name: "Noor", role: "guest", avatar: "NO", color: "#38bdf8", online: false, listening: false }
];

const demoChat: ChatMessage[] = [
  { id: "c1", userId: "system", text: "Weekend Vibes is live", time: "8:04 PM", reactions: [], system: true },
  { id: "c2", userId: "sarah", text: "This opener is perfect for the drive home.", time: "8:05 PM", reactions: ["🔥"] },
  { id: "c3", userId: "mike", text: "Electric Feel should sit right after Midnight Drive.", time: "8:06 PM", reactions: [] },
  { id: "c4", userId: "system", text: "Mike added Electric Feel", time: "8:06 PM", reactions: [], system: true },
  { id: "c5", userId: "jules", text: "Vote Midnight Drive up next?", time: "8:07 PM", reactions: ["💜"] },
  { id: "c6", userId: "you", text: "Welcome in. Add a track, vote, or switch to Guest view.", time: "8:08 PM", reactions: ["✨"] }
];

const emptyChat: ChatMessage[] = [
  { id: "welcome", userId: "system", text: "Room created. Invite friends or start Demo Mode to fill the room.", time: "now", reactions: [], system: true }
];

const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const normalizeRoomCode = (value: string) => value.replace(/\s+/g, "").toUpperCase().slice(0, 6);
const nowTime = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const guestAdderIds = ["sarah", "mike", "jules", "kenji", "maya", "ari"];
const mobileNavItems: { tab: MobileTab; icon: typeof Play; label: string }[] = [
  { tab: "player", icon: Play, label: "Player" },
  { tab: "queue", icon: ListMusic, label: "Queue" },
  { tab: "people", icon: Users, label: "People" },
  { tab: "chat", icon: MessageCircle, label: "Chat" }
];

const createQueueItem = (song: Song, index: number, addedBy = "you", approved = true): QueueSong => ({
  ...song,
  queueId: `${song.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${index}`,
  addedBy,
  votes: song.sourceUrl ? 8 : index === 0 ? 4 : Math.max(-1, 5 - index),
  approved
});

const createDemoQueue = () => {
  const demoVotes = [18, 14, 11, 8, 6, 5, 3, 2];
  const demoAdders = ["you", "sarah", "mike", "jules", "kenji", "maya", "ari", "sarah"];

  return library.slice(0, 8).map((song, index) => ({
    ...createQueueItem(song, index, demoAdders[index], true),
    votes: demoVotes[index],
    userVote: index === 1 ? (1 as const) : undefined
  }));
};

const sortedQueue = (queue: QueueSong[], currentSongId: string | null) => {
  if (!queue.length || !currentSongId) return queue;
  const current = queue.find((item) => item.queueId === currentSongId);
  const upcoming = queue
    .filter((item) => item.queueId !== currentSongId)
    .sort((a, b) => Number(b.approved) - Number(a.approved) || b.votes - a.votes);
  return current ? [current, ...upcoming] : upcoming;
};

const freshPersistedState = (): PersistedJamState => ({
  screen: "landing",
  viewMode: "host",
  mobileTab: "player",
  room: null,
  queue: [],
  users: [mockUsers[0]],
  chat: [],
  currentSongId: null,
  isPlaying: false,
  progress: 0,
  volume: 72,
  repeat: false,
  shuffle: false
});

const freshJamState = (): Partial<JamState> => ({
  ...freshPersistedState(),
  reactions: [],
  toasts: []
});

const useJamStore = create<JamState>()(
  persist(
    (set, get) => ({
      screen: "landing",
      viewMode: "host",
      mobileTab: "player",
      room: null,
      queue: [],
      users: [mockUsers[0]],
      chat: [],
      currentSongId: null,
      isPlaying: false,
      progress: 0,
      volume: 72,
      repeat: false,
      shuffle: false,
      reactions: [],
      toasts: [],
      setScreen: (screen) => set({ screen }),
      setViewMode: (viewMode) => set({ viewMode }),
      setMobileTab: (mobileTab) => set({ mobileTab }),
      createRoom: (input) => {
        const first = createQueueItem(library[0], 0, "you");
        set({
          screen: "room",
          viewMode: "host",
          mobileTab: "player",
          room: { ...input, code: makeCode(), ended: false },
          queue: [first],
          users: [mockUsers[0]],
          chat: emptyChat,
          currentSongId: first.queueId,
          isPlaying: true,
          progress: 0
        });
        get().addToast("Room created. You’re hosting now.");
      },
      joinRoom: (code) => {
        const cleanCode = normalizeRoomCode(code);
        if (!cleanCode) {
          get().addToast("Enter a room code first");
          return false;
        }
        if (!/^[A-Z0-9]{6}$/.test(cleanCode)) {
          get().addToast("Room codes are six letters or numbers. Try JAM247 for the demo.");
          return false;
        }
        const first = createQueueItem(library[2], 0, "sarah");
        set({
          screen: "room",
          viewMode: "guest",
          mobileTab: "player",
          room: {
            name: "After Hours Mix",
            code: cleanCode,
            mood: "Late-night",
            guestsCanAdd: true,
            requireApproval: false,
            ended: false
          },
          queue: [first, createQueueItem(library[5], 1, "mike")],
          users: mockUsers.slice(0, 5).map((user) => (user.id === "you" ? { ...user, role: "guest" } : user)),
          chat: [{ id: "joined", userId: "system", text: "You joined the room", time: "now", reactions: [], system: true }, ...demoChat.slice(1, 4)],
          currentSongId: first.queueId,
          isPlaying: true,
          progress: 18
        });
        get().addToast("Joined room as guest.");
        return true;
      },
      startDemo: () => {
        const queue = createDemoQueue();
        set({
          screen: "room",
          viewMode: "host",
          mobileTab: "player",
          room: {
            name: "Weekend Vibes",
            code: "JAM247",
            mood: "Neon lounge",
            guestsCanAdd: true,
            requireApproval: false,
            ended: false,
            demoRunId: `demo-${Date.now()}`
          },
          queue,
          users: mockUsers,
          chat: demoChat,
          currentSongId: queue[0]?.queueId ?? null,
          isPlaying: true,
          progress: 34,
          volume: 78,
          repeat: false,
          shuffle: false,
          reactions: ["🔥", "💜", "✨"],
          toasts: []
        });
        get().addToast("Live demo room loaded with simulated activity.");
      },
      resetDemo: () => {
        set({
          ...freshJamState(),
          toasts: []
        });
        get().addToast(`${brand.productName} reset to the current build.`);
      },
      addSong: (song, addedBy = get().viewMode === "host" ? "you" : "sarah") => {
        const room = get().room;
        if (get().viewMode === "guest" && room && !room.guestsCanAdd) {
          get().addToast("The host has paused guest song adds for now.");
          return;
        }
        const needsApproval = Boolean(room?.requireApproval && get().viewMode === "guest");
        const queueItem = createQueueItem(song, get().queue.length, addedBy, !needsApproval);
        const nextQueue = sortedQueue([...get().queue, queueItem], get().currentSongId);
        set({
          queue: nextQueue,
          currentSongId: get().currentSongId ?? (queueItem.approved ? queueItem.queueId : null),
          chat: [
            ...get().chat,
            {
              id: `chat-${Date.now()}`,
              userId: "system",
              text: `${get().users.find((user) => user.id === addedBy)?.name ?? "Guest"} added ${song.title}`,
              time: nowTime(),
              reactions: [],
              system: true
            }
          ]
        });
        get().addToast(needsApproval ? `${song.title} is waiting for host approval.` : `${song.title} added`);
      },
      approveSong: (queueId) => {
        const queue = get().queue.map((item) => (item.queueId === queueId ? { ...item, approved: true } : item));
        set({ queue: sortedQueue(queue, get().currentSongId), currentSongId: get().currentSongId ?? queue.find((item) => item.queueId === queueId)?.queueId ?? null });
        get().addToast("Song approved for the shared queue");
      },
      removeSong: (queueId) => {
        if (get().viewMode !== "host") {
          get().addToast("Only the host can remove songs from the queue.");
          return;
        }
        const nextQueue = get().queue.filter((item) => item.queueId !== queueId);
        set({
          queue: nextQueue,
          currentSongId: get().currentSongId === queueId ? nextQueue[0]?.queueId ?? null : get().currentSongId
        });
        get().addToast("Song removed");
      },
      voteSong: (queueId, delta) => {
        const queue = get().queue.map((item) => {
          if (item.queueId !== queueId) return item;
          const previousVote = item.userVote ?? 0;
          const nextVote = previousVote === delta ? 0 : delta;
          return { ...item, votes: item.votes - previousVote + nextVote, userVote: nextVote === 0 ? undefined : nextVote };
        });
        set({ queue: sortedQueue(queue, get().currentSongId) });
      },
      moveSong: (queueId, direction) => {
        if (get().viewMode !== "host") {
          get().addToast("Only the host can reorder the queue.");
          return;
        }
        const queue = [...get().queue];
        const index = queue.findIndex((item) => item.queueId === queueId);
        const target = index + direction;
        if (index <= 0 || target <= 0 || target >= queue.length) return;
        [queue[index], queue[target]] = [queue[target], queue[index]];
        set({ queue });
      },
      skipSong: () => {
        const queue = get().queue;
        if (!queue.length) return;
        const currentIndex = queue.findIndex((song) => song.queueId === get().currentSongId);
        const approvedQueue = queue.filter((song) => song.approved);
        const next = queue.slice(currentIndex + 1).find((song) => song.approved) ?? (get().repeat ? approvedQueue[0] : null);
        set({ currentSongId: next?.queueId ?? approvedQueue[0]?.queueId ?? null, progress: 0, isPlaying: Boolean(next ?? approvedQueue[0]) });
        get().addToast(next || approvedQueue[0] ? "Skipped to next song" : "No approved songs are ready yet.");
      },
      clearQueue: () => {
        const current = get().queue.find((item) => item.queueId === get().currentSongId);
        set({ queue: current ? [current] : [], currentSongId: current?.queueId ?? null });
        get().addToast("Upcoming queue cleared");
      },
      shuffleQueue: () => {
        const [current, ...upcoming] = get().queue;
        const shuffled = [...upcoming].sort(() => Math.random() - 0.5);
        set({ queue: current ? [current, ...shuffled] : shuffled, shuffle: true });
        get().addToast("Queue shuffled");
      },
      togglePlay: () => set({ isPlaying: !get().isPlaying }),
      setProgress: (progress) => set({ progress }),
      setVolume: (volume) => set({ volume }),
      toggleSetting: (setting) => {
        const room = get().room;
        set({ room: room ? { ...room, [setting]: !room[setting] } : null });
      },
      toggleRepeat: () => set({ repeat: !get().repeat }),
      toggleShuffle: () => set({ shuffle: !get().shuffle }),
      removeUser: (id) => {
        if (get().viewMode !== "host") {
          get().addToast("Participant management is available in Host View.");
          return;
        }
        set({
          users: get().users.filter((user) => user.id !== id),
          chat: [...get().chat, { id: `removed-${id}`, userId: "system", text: `${get().users.find((user) => user.id === id)?.name ?? "Guest"} left the room`, time: nowTime(), reactions: [], system: true }]
        });
      },
      sendMessage: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        set({
          chat: [...get().chat, { id: `msg-${Date.now()}`, userId: "you", text: trimmed, time: nowTime(), reactions: [], system: false }]
        });
      },
      addReaction: (emoji) => {
        set({ reactions: [...get().reactions.slice(-5), emoji] });
        setTimeout(() => get().dismissToast(`reaction-${emoji}`), 900);
      },
      endRoom: () => {
        const room = get().room;
        set({ room: room ? { ...room, ended: true } : null, isPlaying: false });
        get().addToast("Room ended");
      },
      addToast: (text) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        set({ toasts: [...get().toasts, { id, text }] });
        setTimeout(() => get().dismissToast(id), 2600);
      },
      dismissToast: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) })
    }),
    {
      name: "jamroom-demo-state",
      version: PERSISTED_STATE_VERSION,
      migrate: (persistedState, version) => {
        if (version < PERSISTED_STATE_VERSION) return freshPersistedState();
        return persistedState as PersistedJamState;
      },
      partialize: (state) => ({
        screen: state.screen,
        viewMode: state.viewMode,
        mobileTab: state.mobileTab,
        room: state.room,
        queue: state.queue,
        users: state.users,
        chat: state.chat,
        currentSongId: state.currentSongId,
        isPlaying: state.isPlaying,
        progress: state.progress,
        volume: state.volume,
        repeat: state.repeat,
        shuffle: state.shuffle
      })
    }
  )
);

export default function JamRoomApp() {
  const screen = useJamStore((state) => state.screen);
  const toasts = useJamStore((state) => state.toasts);

  useDemoPulse();

  return (
    <main className="min-h-screen overflow-x-hidden">
      {screen === "landing" && <Landing />}
      {screen === "create" && <CreateRoom />}
      {screen === "room" && <RoomExperience />}
      <div className="fixed inset-x-4 top-4 z-50 grid gap-2 sm:inset-x-auto sm:right-4" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="glass rounded-lg px-4 py-3 text-sm text-white motion-safe:animate-[toast-in_180ms_ease-out]">
            {toast.text}
          </div>
        ))}
      </div>
    </main>
  );
}

function Landing() {
  const [code, setCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const setScreen = useJamStore((state) => state.setScreen);
  const joinRoom = useJamStore((state) => state.joinRoom);
  const startDemo = useJamStore((state) => state.startDemo);
  const submitJoin = () => {
    const cleanCode = normalizeRoomCode(code);
    setCode(cleanCode);
    if (!cleanCode) {
      setJoinError("Enter the 6-character room code.");
      return;
    }
    if (cleanCode.length !== 6) {
      setJoinError("Room codes are 6 letters or numbers.");
      return;
    }
    setJoinError("");
    setIsJoining(true);
    if (cleanCode !== "JAM247") {
      window.location.href = `/room/${cleanCode}`;
      return;
    }
    const joined = joinRoom(cleanCode);
    if (!joined) setIsJoining(false);
  };

  return (
    <section className="landing-stage mx-auto flex min-h-screen w-full max-w-[96rem] flex-col px-4 py-4 sm:px-6">
      <header className="relative z-10 flex items-center justify-between gap-4">
        <Logo />
        <div className="flex items-center gap-2">
          <button onClick={() => setAboutOpen(true)} className={buttonStyles.ghost}>
            About This Demo
          </button>
          <button onClick={startDemo} className={`${buttonStyles.primary} landing-header-demo hidden sm:inline-flex`}>
            Try Demo
          </button>
        </div>
      </header>

      <div className="relative mt-4 grid flex-1 overflow-hidden rounded-[1.8rem] border border-white/10 bg-slate-950/45 px-5 py-7 shadow-2xl shadow-black/35 sm:px-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(24rem,1.08fr)] lg:items-center lg:gap-10 lg:py-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(37,99,235,0.24),transparent_24rem),radial-gradient(circle_at_86%_24%,rgba(56,189,248,0.14),transparent_22rem)]" />
        <div className="relative z-10 max-w-2xl py-3 text-left lg:py-8">
          <p className="badge badge-primary mb-4">
            <Sparkles size={15} /> Best way to explore
          </p>
          <h1 className="text-5xl font-black leading-[0.95] tracking-normal text-white sm:text-6xl lg:text-7xl">
            {brand.productName}
          </h1>
          <p className="mt-5 max-w-xl text-balance text-3xl font-black leading-tight text-white sm:text-4xl">
            {brand.headline}
          </p>
          <p className="mt-5 max-w-lg text-base leading-7 text-slate-300 sm:text-lg">
            {brand.description}
          </p>

          <div className="mt-8 grid gap-3 sm:max-w-xl sm:grid-cols-[1.15fr_0.85fr]">
            <button onClick={startDemo} className={`${buttonStyles.primary} min-h-16 rounded-2xl px-6 py-4 text-lg`}>
              <Play size={21} fill="currentColor" /> Try Demo
            </button>
            <button onClick={() => window.location.href = "/live"} className={`${buttonStyles.secondary} min-h-16 rounded-2xl px-5 py-4`}>
              <Wifi size={18} /> Start a Party
            </button>
          </div>

          <button onClick={() => setScreen("create")} className={`${buttonStyles.ghost} mt-3 px-1`}>
            <Users size={16} /> Start offline demo party
          </button>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitJoin();
            }}
            className={`mt-4 grid max-w-xl gap-2 rounded-2xl border bg-white/[0.035] p-2 transition sm:grid-cols-[1fr_auto] ${joinError ? "border-rose-300/40" : "border-white/10"}`}
          >
            <label className="sr-only" htmlFor="room-code">
              Enter room code
            </label>
            <div className="min-w-0">
              <input
                id="room-code"
                value={code}
                onChange={(event) => {
                  setCode(normalizeRoomCode(event.target.value));
                  if (joinError) setJoinError("");
                }}
                placeholder="Enter room code"
                maxLength={6}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                aria-invalid={Boolean(joinError)}
                aria-describedby={joinError ? "room-code-error" : undefined}
                className={`${inputStyles.base} border-transparent bg-transparent font-bold uppercase tracking-[0.12em] placeholder:normal-case placeholder:tracking-normal`}
              />
              {joinError && <p id="room-code-error" className="px-3 pb-1 text-xs font-bold text-rose-100">{joinError}</p>}
            </div>
            <button disabled={isJoining} className={`${buttonStyles.neutral} min-h-12 px-5 py-3`}>
              <Link2 size={16} /> {isJoining ? "Joining..." : "Join a Party"}
            </button>
          </form>

          <div className="mt-7 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            {[
              [Radio, "One speaker"],
              [ListMusic, "Shared queue"],
              [MessageCircle, "Vote what plays"]
            ].map(([Icon, title]) => (
              <div key={String(title)} className="flex items-center gap-3 rounded-2xl bg-white/[0.035] p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.06] text-cyan-100"><Icon size={18} /></span>
                <b className="text-white">{String(title)}</b>
              </div>
            ))}
          </div>
        </div>

        <LandingSocialArtwork />
      </div>
      {aboutOpen && <AboutDemoDialog onClose={() => setAboutOpen(false)} />}
    </section>
  );
}

function LandingSocialArtwork() {
  return (
    <div className="relative z-10 mt-8 min-h-[28rem] lg:mt-0 lg:min-h-[38rem]" aria-hidden="true">
      <LandingHeroArt side="right" />
      <div className="absolute inset-x-0 top-0 mx-auto w-full max-w-[24rem] rounded-[2rem] border border-white/10 bg-slate-950/72 p-4 shadow-2xl shadow-black/45 backdrop-blur sm:max-w-[27rem] lg:right-4 lg:left-auto">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-100">Crowd Pick</p>
            <h2 className="mt-1 text-2xl font-black text-white">Daydreams</h2>
            <p className="text-sm text-slate-400">The Midnight</p>
          </div>
          <div className="flex -space-x-2">
            {mockUsers.slice(0, 4).map((user) => (
              <div key={user.id} className="rounded-full border-2 border-slate-950">
                <Avatar user={user} small />
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-[1.45rem] border border-white/10 shadow-2xl shadow-black/45">
          <AlbumArt song={library[0]} large />
        </div>
        <div className="mt-5 flex items-center justify-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white/8 text-white"><Shuffle size={18} /></div>
          <div className="grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(135deg,#1D4ED8,#38BDF8)] text-white shadow-xl shadow-blue-950/50"><Pause size={24} fill="currentColor" /></div>
          <div className="grid h-12 w-12 place-items-center rounded-full bg-white/8 text-white"><SkipForward size={18} /></div>
        </div>
        <div className="mt-5 grid gap-2">
          {library.slice(1, 4).map((song, index) => (
            <MiniSong key={song.id} song={song} votes={14 - index * 3} />
          ))}
        </div>
      </div>
      <div className="absolute bottom-4 left-0 hidden w-56 rounded-2xl border border-white/10 bg-slate-950/70 p-4 shadow-2xl shadow-black/40 backdrop-blur sm:block lg:left-2">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-cyan-100">Live chat</p>
        <div className="mt-3 grid gap-2 text-sm text-slate-200">
          <p className="rounded-xl bg-white/[0.06] px-3 py-2">this song hits</p>
          <p className="rounded-xl bg-blue-500/20 px-3 py-2">vote Midnight Drive next</p>
        </div>
      </div>
    </div>
  );
}

function LandingHeroArt({ side }: { side: "left" | "right" }) {
  return (
    <div className={`landing-people hidden h-full min-h-[34rem] items-end lg:flex ${side === "left" ? "justify-start" : "justify-end"}`} aria-hidden="true">
      <div className={`listener-figure ${side}`}>
        <div className="music-note one">♪</div>
        <div className="music-note two">♫</div>
        <div className="music-note three">♪</div>
        <div className="head">
          <span className="hair" />
          <span className="face" />
          <span className="earphone left" />
          <span className="earphone right" />
        </div>
        <div className="body">
          <span className="hood" />
          <span className="arm" />
        </div>
      </div>
    </div>
  );
}

function CreateRoom() {
  const [name, setName] = useState("Weekend Vibes");
  const [mood, setMood] = useState("Neon lounge");
  const [guestsCanAdd, setGuestsCanAdd] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [nameError, setNameError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const createRoom = useJamStore((state) => state.createRoom);
  const setScreen = useJamStore((state) => state.setScreen);
  const moodOptions = [
    { name: "Neon lounge", description: "Late-night and social" },
    { name: "House party", description: "Loud, fast, shared" },
    { name: "Late-night drive", description: "Smooth and cinematic" },
    { name: "Focus flow", description: "Calm background energy" },
    { name: "Arcade pop", description: "Bright and playful" },
    { name: "Study Room", description: "Low-key listening" }
  ];
  const submitCreate = () => {
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setNameError("Give the room a short name first.");
      return;
    }
    setNameError("");
    setIsCreating(true);
    createRoom({ name: trimmedName, mood, guestsCanAdd, requireApproval });
  };

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Logo />
        <button onClick={() => setScreen("landing")} className={buttonStyles.ghost}>
          Back
        </button>
      </header>
      <div className="my-auto grid items-center gap-6 py-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div>
          <div className="mb-8">
            <p className="badge badge-primary mb-3">Host setup</p>
            <h1 className="text-4xl font-black">Start a party in seconds</h1>
            <p className="body-copy mt-3 max-w-xl">Name the session, pick a vibe, and decide how much influence guests have over the shared queue.</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitCreate();
            }}
            className="glass grid gap-5 rounded-3xl p-5 sm:p-7"
          >
            <div className="grid gap-2">
              <label htmlFor="create-room-name" className="font-bold text-white">Party name</label>
              <p className="text-sm metadata">This is what guests see when they scan or enter the code.</p>
              <input
                id="create-room-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (nameError) setNameError("");
                }}
                required
                maxLength={32}
                autoComplete="off"
                aria-invalid={Boolean(nameError)}
                aria-describedby={nameError ? "create-room-name-error" : undefined}
                className={nameError ? inputStyles.error : inputStyles.base}
              />
              {nameError && <p id="create-room-name-error" className="text-sm font-bold text-rose-100">{nameError}</p>}
            </div>

            <fieldset className="grid gap-2">
              <legend className="font-bold text-white">Mood / theme</legend>
              <p className="text-sm metadata">Choose a starting vibe for the room.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {moodOptions.map((option) => (
                  <button key={option.name} type="button" onClick={() => setMood(option.name)} className={`rounded-xl border px-3 py-3 text-left transition ${mood === option.name ? "border-cyan-200/35 bg-blue-500/18 text-white" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"}`} aria-pressed={mood === option.name}>
                    <span className="block text-sm font-black">{option.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{option.description}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="grid gap-2">
              <CreateSettingToggle label="Guest submissions" description="Let everyone suggest tracks directly into the queue." checked={guestsCanAdd} onChange={setGuestsCanAdd} />
              <CreateSettingToggle label="Require song approval" description="New guest songs wait for the host before playing." checked={requireApproval} onChange={setRequireApproval} />
            </div>

            <button disabled={isCreating} className={`${buttonStyles.primary} min-h-14`}>
              <Crown size={18} /> {isCreating ? "Starting..." : "Start a Party"}
            </button>
          </form>
        </div>
        <div className="glass rounded-[2rem] p-5">
          <div className="phone-frame mx-auto max-w-[18rem]">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span>9:41</span>
              <span>Host</span>
            </div>
            <div className="mt-8">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">Party preview</p>
              <h2 className="mt-2 truncate text-2xl font-black">{name || "Untitled Room"}</h2>
              <p className="mt-1 text-sm text-slate-400">{mood}</p>
              <AlbumArt song={library[3]} large />
              <div className="mt-5 grid gap-2 text-sm">
                <p className="rounded-xl bg-white/[0.06] p-3">{guestsCanAdd ? "Guests can add songs" : "Host controls all song adds"}</p>
                <p className="rounded-xl bg-white/[0.06] p-3">{requireApproval ? "New songs wait for approval" : "Songs enter the queue instantly"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoomExperience() {
  const room = useJamStore((state) => state.room);
  const mobileTab = useJamStore((state) => state.mobileTab);
  const viewMode = useJamStore((state) => state.viewMode);
  const setMobileTab = useJamStore((state) => state.setMobileTab);
  const resetDemo = useJamStore((state) => state.resetDemo);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);

  useEffect(() => {
    if (room?.demoRunId) setHintDismissed(false);
  }, [room?.demoRunId]);

  if (!room) return null;
  if (room.ended) {
    return (
      <section className="flex min-h-screen items-center justify-center px-5">
        <div className="glass max-w-md rounded-3xl p-7 text-center">
          <Logo />
          <h1 className="mt-8 text-3xl font-black">Room ended</h1>
          <p className="mt-3 text-slate-300">The host closed this listening session. Reset the demo to start again.</p>
          <button onClick={resetDemo} className="mt-6 rounded-xl bg-white px-5 py-3 font-bold text-slate-950">
            Return home
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-screen w-full overflow-x-hidden">
      <Sidebar />
      <div className="min-w-0 flex-1 px-3 pb-[12rem] pt-3 sm:px-4 lg:px-5 lg:pb-5 lg:pt-4">
        <div className="hidden lg:block">
          <TopBar onAbout={() => setAboutOpen(true)} />
        </div>
        <MobileRoomHeader onAbout={() => setAboutOpen(true)} />
        {room.demoRunId && !hintDismissed && <DemoHint onClose={() => setHintDismissed(true)} />}
        <div className="mt-4 hidden grid-cols-[minmax(0,1fr)_24rem] gap-4 xl:grid 2xl:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="grid min-w-0 gap-4">
            <Player />
            <QueuePanel />
          </div>
          <div className="grid min-w-0 content-start gap-4">
            <DesktopSocialPanel />
            <HostDashboard />
          </div>
        </div>
        <div className="mt-4 hidden grid-cols-[minmax(0,1fr)_21rem] gap-4 lg:grid xl:hidden">
          <div className="grid min-w-0 gap-4">
            <Player />
            <QueuePanel />
          </div>
          <div className="grid min-w-0 content-start gap-4">
            <DesktopSocialPanel />
            <HostDashboard />
          </div>
        </div>
        <div className="mobile-screen mt-4 lg:hidden">
          {mobileTab === "player" && <Player />}
          {mobileTab === "queue" && <QueuePanel />}
          {mobileTab === "people" && (
            <div className="grid gap-4">
              <PeoplePanel />
              {viewMode === "host" && <HostDashboard />}
            </div>
          )}
          {mobileTab === "chat" && <ChatPanel />}
          {mobileTab !== "player" && <CompactPlayer />}
        </div>
      </div>
      <nav className="mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-slate-950/94 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" aria-label="Mobile room sections">
        {mobileNavItems.map(({ tab, icon: Icon, label }) => (
          <button type="button" key={tab} onClick={() => setMobileTab(tab)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold ${mobileTab === tab ? "bg-white/10 text-white" : "text-slate-400"}`} aria-label={label} aria-current={mobileTab === tab ? "page" : undefined}>
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
      {aboutOpen && <AboutDemoDialog onClose={() => setAboutOpen(false)} />}
    </section>
  );
}

function DesktopSocialPanel() {
  const [activePanel, setActivePanel] = useState<"people" | "chat">("people");
  const users = useJamStore((state) => state.users);
  const chat = useJamStore((state) => state.chat);
  const tabs = [
    { id: "people" as const, icon: Users, label: `People ${users.length}` },
    { id: "chat" as const, icon: MessageCircle, label: `Chat ${chat.length}` }
  ];
  const moveTabFocus = (event: ReactKeyboardEvent<HTMLButtonElement>, id: "people" | "chat") => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? "people" : event.key === "End" ? "chat" : id === "people" ? "chat" : "people";
    setActivePanel(next);
    window.requestAnimationFrame(() => {
      event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`[data-social-tab="${next}"]`)?.focus();
    });
  };

  return (
    <section className="panel min-h-[34rem] rounded-2xl p-3">
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-xl border border-white/8 bg-white/[0.035] p-1" role="tablist" aria-label="Social panel">
        {tabs.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActivePanel(id)}
              onKeyDown={(event) => moveTabFocus(event, id)}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-black transition ${activePanel === id ? "active-pill bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
              role="tab"
              aria-selected={activePanel === id}
              aria-controls="desktop-social-panel"
              data-social-tab={id}
              tabIndex={activePanel === id ? 0 : -1}
            >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div id="desktop-social-panel" role="tabpanel" aria-label={activePanel === "people" ? "People" : "Chat"}>
        {activePanel === "people" ? <PeoplePanel embedded /> : <ChatPanel embedded />}
      </div>
    </section>
  );
}

function TopBar({ onAbout }: { onAbout: () => void }) {
  const room = useJamStore((state) => state.room);
  const users = useJamStore((state) => state.users);
  const viewMode = useJamStore((state) => state.viewMode);
  const setViewMode = useJamStore((state) => state.setViewMode);
  const startDemo = useJamStore((state) => state.startDemo);
  const addToast = useJamStore((state) => state.addToast);
  const resetDemo = useJamStore((state) => state.resetDemo);
  const invite = typeof window === "undefined" ? "" : `${PROJECT_LINKS.app.replace(/\/$/, "")}?room=${room?.code ?? ""}`;

  return (
    <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <p className="text-xs font-black uppercase tracking-[0.16em] text-green-100">Live room</p>
        </div>
        <h1 className="room-title mt-1 truncate">{room?.name}</h1>
        <p className="metadata mt-1 flex items-center gap-2 text-sm">
          <span>{users.filter((user) => user.listening).length} listening</span>
          <span className="h-1 w-1 rounded-full bg-slate-600" />
          <span>{room?.mood}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1" role="group" aria-label="Preview as host or guest">
          {(["host", "guest"] as const).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)} className={`rounded-lg px-3 py-2 text-sm font-bold capitalize transition ${viewMode === mode ? "active-pill bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"}`} aria-pressed={viewMode === mode}>
              {mode} View
            </button>
          ))}
        </div>
        <button onClick={() => copyText(invite, addToast, "Invite link copied")} className={`${buttonStyles.neutral} min-h-10 px-3 py-2`} aria-label={`Copy invite link for room ${room?.code}`}>
          <Link2 size={16} /> Invite <span className="font-mono text-xs font-black text-slate-500">{room?.code}</span>
        </button>
        <details className="relative">
          <summary className={`${buttonStyles.icon} min-h-10 w-10 cursor-pointer list-none`} aria-label="More room actions" title="More room actions">
            <MoreVertical size={18} />
          </summary>
          <div className="details-popover absolute right-0 z-30 mt-2 w-44 rounded-xl border border-white/10 bg-slate-950/96 p-1.5 shadow-2xl shadow-black/50 backdrop-blur">
            <button onClick={() => copyText(room?.code ?? "", addToast, "Room code copied")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-200 hover:bg-white/10" aria-label="Copy room code">
              <Copy size={15} /> Copy code
            </button>
            <button onClick={startDemo} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-200 hover:bg-white/10" aria-label="Start demo mode">
              <Wand2 size={15} /> Demo mode
            </button>
            <button onClick={onAbout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-200 hover:bg-white/10" aria-label="Open About This Demo">
              <Info size={15} /> About
            </button>
            <button onClick={resetDemo} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-200 hover:bg-white/10" aria-label="Reset demo">
              <RotateCcw size={15} /> Reset
            </button>
          </div>
        </details>
      </div>
    </header>
  );
}

function RoomMetrics() {
  const room = useJamStore((state) => state.room);
  const users = useJamStore((state) => state.users);
  const queue = useJamStore((state) => state.queue);
  const chat = useJamStore((state) => state.chat);
  const currentSongId = useJamStore((state) => state.currentSongId);
  const current = queue.find((song) => song.queueId === currentSongId) ?? queue[0];
  const pending = queue.filter((song) => !song.approved).length;

  const metrics = [
    { icon: Radio, label: "Now playing", value: current?.title ?? "Queue empty", tone: "text-cyan-100" },
    { icon: Users, label: "Listeners", value: `${users.filter((user) => user.listening).length}/${users.length} active`, tone: "text-cyan-100" },
    { icon: ListMusic, label: "Queue depth", value: `${queue.length} tracks${pending ? ` · ${pending} pending` : ""}`, tone: "text-blue-100" },
    { icon: MessageCircle, label: "Room activity", value: `${chat.length} messages`, tone: "text-green-100" }
  ];

  return (
    <div className="mt-4 grid gap-3 xl:grid-cols-4">
      {metrics.map(({ icon: Icon, label, value, tone }) => (
        <div key={label} className="metric-card flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
          <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/8 ${tone}`}>
            <Icon size={18} />
          </div>
          <div className="min-w-0">
            <p className="eyebrow metadata">{label}</p>
            <p className="truncate text-sm font-bold text-white">{value}</p>
          </div>
        </div>
      ))}
      <div className="sr-only">Current room is {room?.name}</div>
    </div>
  );
}

function MobileRoomHeader({ onAbout }: { onAbout: () => void }) {
  const room = useJamStore((state) => state.room);
  const users = useJamStore((state) => state.users);
  const viewMode = useJamStore((state) => state.viewMode);
  const setViewMode = useJamStore((state) => state.setViewMode);
  const startDemo = useJamStore((state) => state.startDemo);
  const addToast = useJamStore((state) => state.addToast);
  const invite = `${PROJECT_LINKS.app.replace(/\/$/, "")}?room=${room?.code ?? ""}`;

  return (
    <header className="mobile-room-header mb-3 lg:hidden">
      <div className="glass rounded-[1.1rem] p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-green-100"><span className="live-dot" /> Live · {users.filter((user) => user.online).length} online</div>
            <h1 className="room-title mt-0.5 truncate text-lg">{room?.name}</h1>
          </div>
          <button onClick={() => copyText(invite, addToast, "Invite link copied")} className={`${buttonStyles.secondary} min-h-10 shrink-0 px-3 py-2 text-xs`} aria-label="Copy invite link">
            <Copy size={14} /> {room?.code}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <div className="inline-flex min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] p-1" role="group" aria-label="Preview as host or guest">
            {(["host", "guest"] as const).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`min-h-10 flex-1 rounded-lg px-3 py-2 text-xs font-black capitalize transition ${viewMode === mode ? "active-pill bg-white text-slate-950" : "text-slate-300"}`} aria-pressed={viewMode === mode}>
                {mode}
              </button>
            ))}
          </div>
          <button onClick={startDemo} className={`${buttonStyles.icon} min-h-10 w-11 border-cyan-300/25 text-white`} aria-label="Start demo mode" title="Start demo mode">
            <Wand2 size={15} />
          </button>
          <button onClick={onAbout} className={`${buttonStyles.icon} min-h-10 w-11 text-white`} aria-label="Open About This Demo" title="About this demo">
            <Info size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}

function Sidebar() {
  const addToast = useJamStore((state) => state.addToast);

  return (
    <aside className="sticky top-0 hidden h-screen w-[12.25rem] shrink-0 border-r border-white/10 bg-slate-950/70 p-4 lg:flex lg:flex-col lg:gap-5">
      <Logo />
      <nav className="mt-3 grid gap-1" aria-label="Primary">
        {[
          [Home, "Home"],
          [ListMusic, "My Rooms"],
          [Search, "Search"],
          [MessageCircle, "Messages"],
          [Users, "Profile"]
        ].map(([Icon, label], index) => (
          <button key={String(label)} onClick={() => index > 0 && addToast(`${label} is a portfolio demo placeholder.`)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${index === 1 ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`} aria-label={String(label)} aria-current={index === 1 ? "page" : undefined}>
            <Icon size={18} />
            {String(label)}
          </button>
        ))}
      </nav>
      <div className="mt-auto grid gap-3">
        <button onClick={() => addToast("Settings are simulated for this portfolio demo.")} className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Settings">
          <Settings2 size={18} /> Settings
        </button>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <Avatar user={mockUsers[0]} small />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">Alex</p>
              <p className="text-xs text-green-200">Online</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Player() {
  const queue = useJamStore((state) => state.queue);
  const currentSongId = useJamStore((state) => state.currentSongId);
  const isPlaying = useJamStore((state) => state.isPlaying);
  const progress = useJamStore((state) => state.progress);
  const volume = useJamStore((state) => state.volume);
  const repeat = useJamStore((state) => state.repeat);
  const shuffle = useJamStore((state) => state.shuffle);
  const togglePlay = useJamStore((state) => state.togglePlay);
  const skipSong = useJamStore((state) => state.skipSong);
  const setProgress = useJamStore((state) => state.setProgress);
  const setVolume = useJamStore((state) => state.setVolume);
  const youtubeControls = useRef<YouTubeControls | null>(null);
  const toggleRepeat = useJamStore((state) => state.toggleRepeat);
  const toggleShuffle = useJamStore((state) => state.toggleShuffle);
  const addReaction = useJamStore((state) => state.addReaction);
  const reactions = useJamStore((state) => state.reactions);
  const current = queue.find((song) => song.queueId === currentSongId) ?? queue[0];
  const elapsed = current ? Math.round((current.duration * progress) / 100) : 0;
  const usesEmbeddedPlayback = current?.sourceProvider === "YouTube";
  const playbackElapsed = usesEmbeddedPlayback ? elapsed : elapsed;
  const toggleCurrentPlayback = () => {
    if (usesEmbeddedPlayback && youtubeControls.current) {
      if (isPlaying) youtubeControls.current.pause();
      else youtubeControls.current.play();
      return;
    }
    togglePlay();
  };
  const changeProgress = (nextProgress: number) => {
    if (usesEmbeddedPlayback && youtubeControls.current) youtubeControls.current.seekPercent(nextProgress);
    setProgress(nextProgress);
  };
  const changeVolume = (nextVolume: number) => {
    if (usesEmbeddedPlayback && youtubeControls.current) youtubeControls.current.setVolume(nextVolume);
    setVolume(nextVolume);
  };
  const setYouTubePlaying = useCallback((playing: boolean) => {
    if (playing !== useJamStore.getState().isPlaying) useJamStore.setState({ isPlaying: playing });
  }, []);
  const registerYouTubeControls = useCallback((controls: YouTubeControls | null) => {
    youtubeControls.current = controls;
  }, []);

  return (
    <section className="glass player-shell mobile-player-screen relative min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5 xl:p-6">
      <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(56,189,248,0.12),transparent)]" />
      <div className="relative grid min-w-0 gap-5 xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(21rem,0.66fr)_minmax(0,1fr)]">
        <div className="relative min-w-0">
          <div className="mobile-art-wrap desktop-art-wrap">
            {current?.embedUrl ? (
              <YouTubeEmbed
                videoId={current.sourceId ?? ""}
                title={current.title}
                queueId={current.queueId}
                volume={volume}
                setProgress={setProgress}
                setPlaying={setYouTubePlaying}
                onEnded={skipSong}
                onControls={registerYouTubeControls}
              />
            ) : (
              <AlbumArt song={current} large />
            )}
          </div>
          <div className="mobile-sync-card absolute bottom-3 left-3 right-3 rounded-xl border border-white/10 bg-slate-950/62 px-3 py-2 backdrop-blur">
            <div className="flex items-center justify-between gap-3 text-xs font-bold text-slate-200">
              <span className="inline-flex items-center gap-2"><Wifi size={14} className="text-green-200" /> Synced</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className={`sound-bars mt-2 ${isPlaying ? "" : "is-paused"}`} aria-hidden="true">
              {Array.from({ length: 24 }).map((_, index) => (
                <span key={index} style={{ animationDelay: `${index * 70}ms` }} />
              ))}
            </div>
          </div>
        </div>
        <div key={current?.queueId ?? "empty-track"} className="player-track-motion min-w-0 self-center xl:pl-2">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="badge badge-live uppercase tracking-[0.12em]">
              <Mic2 size={15} /> Now playing
            </p>
            <p className="badge badge-neutral">
              <Clock3 size={14} /> {usesEmbeddedPlayback ? `${formatTime(playbackElapsed)} YouTube` : `${formatTime(elapsed)} elapsed`}
            </p>
          </div>
          <h2 className="song-title truncate text-3xl leading-tight sm:text-4xl xl:text-5xl">{current?.title ?? "Queue is empty"}</h2>
          <p className="mt-2 truncate text-lg font-semibold text-slate-200 xl:text-xl">{current ? current.artist : "Add a song to start listening together."}</p>
          {current && <p className="metadata mt-1 truncate text-sm">{current.album}</p>}
          <p className="metadata mt-1 text-sm">{usesEmbeddedPlayback ? "YouTube player linked to room controls" : "Synced playback · host-controlled room state"}</p>
          <div className="mt-5">
            <input
              aria-label={`Playback progress for ${current?.title ?? "current song"}`}
              aria-valuetext={`${formatTime(playbackElapsed)} of ${formatTime(current?.duration ?? 0)}`}
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={(event) => changeProgress(Number(event.target.value))}
              className="range w-full"
            />
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>{formatTime(playbackElapsed)}</span>
              <span>{formatTime(current?.duration ?? 0)}</span>
            </div>
          </div>
          {usesEmbeddedPlayback && (
            <div className="mt-3 rounded-xl border border-cyan-200/15 bg-cyan-300/10 px-3 py-2 text-sm leading-6 text-cyan-50">
              YouTube IFrame playback is active for this track.
            </div>
          )}
          <div className="mobile-playback-controls mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <IconButton active={shuffle} label="Shuffle queue" onClick={toggleShuffle}>
              <Shuffle size={20} />
            </IconButton>
            <button onClick={toggleCurrentPlayback} className={`play-toggle grid h-16 w-16 place-items-center rounded-full bg-[linear-gradient(135deg,#1d4ed8,#38bdf8)] text-white shadow-xl shadow-blue-950/40 transition hover:scale-105 ${isPlaying ? "is-playing" : ""}`} aria-label={isPlaying ? `Pause ${current?.title ?? "playback"}` : `Play ${current?.title ?? "playback"}`} aria-pressed={isPlaying} title={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause size={27} fill="currentColor" /> : <Play size={27} fill="currentColor" />}
            </button>
            <IconButton label="Skip song" onClick={skipSong}>
              <SkipForward size={20} />
            </IconButton>
            <IconButton active={repeat} label="Repeat" onClick={toggleRepeat}>
              <Repeat2 size={20} />
            </IconButton>
            <div className="mobile-volume ml-0 flex min-w-[150px] flex-1 items-center gap-2 rounded-xl bg-white/[0.055] px-3 py-2 sm:ml-3 sm:flex-none">
              <Volume2 size={18} className="text-slate-300" />
              <input aria-label="Playback volume" aria-valuetext={`${volume}% volume`} type="range" min="0" max="100" value={volume} onChange={(event) => changeVolume(Number(event.target.value))} className="range w-full" />
            </div>
          </div>
          <div className="mobile-reactions mt-5 flex flex-wrap items-center gap-2">
            {reactionOptions.map(({ emoji, label, icon: Icon }) => (
              <button key={emoji} onClick={() => addReaction(emoji)} className="reaction-chip" aria-label={`React ${label}`} title={label}>
                <Icon size={16} />
                <span>{label}</span>
              </button>
            ))}
            <span className="ml-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">React</span>
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute right-8 top-8 flex gap-2" aria-hidden="true">
        {reactions.slice(-4).map((emoji, index) => (
          <span key={`${emoji}-${index}`} className="reaction-pop rounded-full border border-cyan-200/15 bg-slate-950/72 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100 shadow-lg">
            {reactionLabel(emoji)}
          </span>
        ))}
      </div>
    </section>
  );
}

function YouTubeEmbed({
  videoId,
  title,
  queueId,
  volume,
  setProgress,
  setPlaying,
  onEnded,
  onControls
}: {
  videoId: string;
  title: string;
  queueId: string;
  volume: number;
  setProgress: (progress: number) => void;
  setPlaying: (playing: boolean) => void;
  onEnded: () => void;
  onControls: (controls: YouTubeControls | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkVisibility = () => {
      const element = containerRef.current;
      setIsVisible(Boolean(element && element.getClientRects().length > 0 && element.offsetParent !== null));
    };
    checkVisibility();
    window.addEventListener("resize", checkVisibility);
    const timer = window.setTimeout(checkVisibility, 50);
    return () => {
      window.removeEventListener("resize", checkVisibility);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let progressTimer: number | undefined;

    if (!videoId || !isVisible || !containerRef.current) return undefined;

    loadYouTubeApi()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        playerRef.current?.destroy();
        const player = new api.Player(containerRef.current, {
          videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            enablejsapi: 1
          },
          events: {
            onReady: (event) => {
              playerRef.current = event.target;
              event.target.setVolume(volume);
              onControls({
                play: () => event.target.playVideo(),
                pause: () => event.target.pauseVideo(),
                seekPercent: (percent) => {
                  const duration = event.target.getDuration();
                  if (duration > 0) event.target.seekTo((duration * percent) / 100, true);
                },
                setVolume: (nextVolume) => event.target.setVolume(nextVolume)
              });
              const duration = Math.round(event.target.getDuration());
              if (duration > 0) updateQueuedSongDuration(queueId, duration);
              progressTimer = window.setInterval(() => {
                const nextDuration = event.target.getDuration();
                const currentTime = event.target.getCurrentTime();
                if (nextDuration > 0) {
                  updateQueuedSongDuration(queueId, Math.round(nextDuration));
                  setProgress(Math.min(100, Math.max(0, (currentTime / nextDuration) * 100)));
                }
              }, 500);
            },
            onStateChange: (event) => {
              if (event.data === api.PlayerState.PLAYING) setPlaying(true);
              if (event.data === api.PlayerState.PAUSED) setPlaying(false);
              if (event.data === api.PlayerState.ENDED) {
                setPlaying(false);
                onEnded();
              }
            },
            onError: () => useJamStore.getState().addToast("This YouTube video cannot be embedded.")
          }
        });
        playerRef.current = player;
      })
      .catch(() => useJamStore.getState().addToast("YouTube player could not load."));

    return () => {
      cancelled = true;
      if (progressTimer) window.clearInterval(progressTimer);
      onControls(null);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [videoId, queueId, isVisible, setProgress, setPlaying, onEnded, onControls]);

  useEffect(() => {
    playerRef.current?.setVolume(volume);
  }, [volume]);

  return <div ref={containerRef} className="aspect-square w-full overflow-hidden rounded-2xl bg-slate-950" role="region" aria-label={`${title} YouTube player`} />;
}

function QueuePanel() {
  const queue = useJamStore((state) => state.queue);
  const currentSongId = useJamStore((state) => state.currentSongId);
  const viewMode = useJamStore((state) => state.viewMode);
  const addSong = useJamStore((state) => state.addSong);
  const approveSong = useJamStore((state) => state.approveSong);
  const removeSong = useJamStore((state) => state.removeSong);
  const voteSong = useJamStore((state) => state.voteSong);
  const moveSong = useJamStore((state) => state.moveSong);
  const [query, setQuery] = useState("");
  const result = useMemo(() => findSong(query), [query]);
  const canManage = viewMode === "host";

  return (
    <section className="queue-panel mobile-queue-screen panel rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="section-title">Queue</h2>
            <span className="badge badge-neutral">{queue.length}</span>
          </div>
          <p className="metadata text-sm">What plays next, shaped by everyone.</p>
        </div>
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/[0.055] text-slate-200">
          <ListMusic size={20} />
        </div>
      </div>
      <div className="mobile-add-song mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="relative block" htmlFor="queue-search">
          <span className="sr-only">Search music or paste link</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input id="queue-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs or paste a music link" autoComplete="off" className={`${inputStyles.base} py-3 pl-10 pr-3`} aria-describedby={query ? "queue-search-result" : undefined} />
        </label>
        <button
          onClick={() => {
            if (!result) return;
            addSong(result);
            setQuery("");
          }}
          disabled={!result}
          className={`${buttonStyles.primary} min-h-12 px-4 py-3`}
          aria-disabled={!result}
        >
          <Plus size={17} /> Add Song
        </button>
      </div>
      {query && (
        <div id="queue-search-result" className={`mb-4 rounded-xl border p-3 text-sm ${result ? "border-cyan-300/15 bg-cyan-300/8 text-cyan-50" : "border-amber-300/20 bg-amber-300/10 text-amber-50"}`}>
          {result ? (
            <span>
              {result.sourceUrl ? (
                <>
                  Ready to add <b>{result.sourceProvider}</b> link. {result.sourceProvider === "YouTube" ? "It will open as an embedded player in the room." : "It will stay attached as an external music link."}
                </>
              ) : (
                <>
                  Demo match: <b>{result.title}</b> by {result.artist}. Link matching is simulated for portfolio review.
                </>
              )}
            </span>
          ) : (
            invalidMusicLink(query)
              ? "That link does not look like a supported demo music URL. Try Spotify, Apple Music, YouTube, or SoundCloud-style links."
              : "No demo result found. Try Daydreams, Electric Feel, Higher, or paste a music-style link."
          )}
        </div>
      )}
      <div className="queue-list max-h-[min(600px,54vh)] overflow-y-auto pr-1 max-lg:max-h-none max-lg:overflow-visible max-lg:pr-0">
        {queue.length === 0 && <EmptyState icon={<ListMusic />} title="Build the first queue" text="Search the demo library or paste a YouTube/music link to start the room." />}
        {queue.map((song, index) => (
          <QueueRow
            key={song.queueId}
            song={song}
            index={index}
            isCurrent={song.queueId === currentSongId}
            isUpNext={index === 1 && song.approved}
            canManage={canManage}
            approveSong={approveSong}
            removeSong={removeSong}
            voteSong={voteSong}
            moveSong={moveSong}
          />
        ))}
      </div>
    </section>
  );
}

function QueueRow({
  song,
  index,
  isCurrent,
  isUpNext,
  canManage,
  approveSong,
  removeSong,
  voteSong,
  moveSong
}: {
  song: QueueSong;
  index: number;
  isCurrent: boolean;
  isUpNext: boolean;
  canManage: boolean;
  approveSong: (queueId: string) => void;
  removeSong: (queueId: string) => void;
  voteSong: (queueId: string, delta: 1 | -1) => void;
  moveSong: (queueId: string, direction: -1 | 1) => void;
}) {
  const providerTone = providerQueueTone(song);
  const status = song.unavailable ? "Unavailable" : !song.approved ? "Pending" : isCurrent ? "Playing" : isUpNext ? "Up next" : null;

  return (
    <div
      className={cx(
        "queue-row group grid grid-cols-[1.35rem_3rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl p-2.5 transition sm:grid-cols-[1.5rem_3.25rem_minmax(0,1fr)_auto]",
        isCurrent && "is-current queue-row-current",
        isUpNext && "queue-row-up-next",
        !song.approved && "queue-row-pending",
        song.unavailable ? "queue-row-unavailable opacity-70" : "hover:bg-white/[0.04]"
      )}
      aria-label={`${song.title} by ${song.artist}, ${status ?? "queued"}, ${song.votes} votes`}
      aria-current={isCurrent ? "true" : undefined}
    >
      <span className={`grid h-7 w-7 place-items-center rounded-lg text-xs font-black ${isCurrent ? "bg-green-300/15 text-green-100" : isUpNext ? "bg-cyan-300/12 text-cyan-100" : "bg-white/[0.04] text-slate-500"}`}>
        {index + 1}
      </span>

      <div className="relative">
        <AlbumArt song={song} />
        {isCurrent && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-slate-950 bg-green-300" aria-hidden="true" />}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-black text-white sm:font-bold">{song.title}</p>
          {status && <span className={`badge shrink-0 ${statusTone(status)}`}>{status}</span>}
          {song.sourceProvider && !isCurrent && <span className={`badge hidden shrink-0 sm:inline-flex ${providerTone.badge}`}>{song.sourceProvider}</span>}
        </div>
        <div className="queue-meta mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400 sm:gap-x-3 sm:text-sm">
          <span className="truncate text-slate-300 sm:text-slate-400">{song.artist}</span>
          <span className="hidden items-center gap-1 sm:inline-flex"><Music2 size={13} /> {song.addedBy === "you" ? "You" : userName(song.addedBy)}</span>
          <span className="inline-flex items-center gap-1"><Clock3 size={13} /> {formatTime(song.duration)}</span>
          {song.sourceProvider && !isCurrent && <span className={`inline-flex sm:hidden ${providerTone.text}`}>{song.sourceProvider}</span>}
          {song.sourceUrl && (
            <a href={song.sourceUrl} target="_blank" rel="noreferrer" className={`hidden items-center gap-1 hover:text-white sm:inline-flex ${providerTone.text}`}>
              <Link2 size={13} /> Open
            </a>
          )}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <div className={`grid grid-cols-[2.25rem_2.2rem] overflow-hidden rounded-xl bg-white/[0.045] ${song.userVote ? "ring-1 ring-cyan-200/25" : ""}`}>
          <button
            onClick={() => voteSong(song.queueId, 1)}
            className={`grid h-10 place-items-center transition ${song.userVote === 1 ? "bg-cyan-300/16 text-cyan-100" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}
            aria-label={`Upvote ${song.title}`}
            title="Upvote"
          >
            <ChevronUp size={17} />
          </button>
          <span key={`${song.queueId}-${song.votes}`} className="vote-count grid h-10 place-items-center text-sm font-black text-white" aria-label={`${song.votes} votes`}>{song.votes}</span>
        </div>
        <button
          onClick={() => voteSong(song.queueId, -1)}
          className={`hidden h-10 w-10 place-items-center rounded-xl transition sm:grid ${song.userVote === -1 ? "bg-rose-300/14 text-rose-100" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}
          aria-label={`Downvote ${song.title}`}
          title="Downvote"
        >
          <ChevronDown size={17} />
        </button>
        {canManage && (
          <div className="hidden items-center gap-1 border-l border-white/8 pl-1 sm:flex">
            {!song.approved && (
              <button onClick={() => approveSong(song.queueId)} className="badge badge-positive min-h-10 rounded-xl px-2" aria-label={`Approve ${song.title}`} title="Approve song">
                <ShieldCheck size={14} /> Approve
              </button>
            )}
            <button onClick={() => moveSong(song.queueId, -1)} disabled={index <= 1} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Move ${song.title} up`} title="Move up">
              <ChevronUp size={16} />
            </button>
            <button onClick={() => moveSong(song.queueId, 1)} disabled={isCurrent} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30" aria-label={`Move ${song.title} down`} title="Move down">
              <ChevronDown size={16} />
            </button>
            <button onClick={() => removeSong(song.queueId)} className="grid h-10 w-10 place-items-center rounded-xl text-slate-400 hover:bg-rose-400/15 hover:text-rose-100" aria-label={`Remove ${song.title}`} title="Remove">
              <Trash2 size={16} />
            </button>
          </div>
        )}
        {canManage && (
          <details className="relative sm:hidden">
            <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl text-slate-300 hover:bg-white/10 hover:text-white" aria-label={`More actions for ${song.title}`} title="Song actions">
              <MoreVertical size={17} />
            </summary>
            <div className="details-popover absolute right-0 z-20 mt-2 w-44 rounded-xl border border-white/10 bg-slate-950/96 p-1.5 shadow-2xl shadow-black/50 backdrop-blur">
              {!song.approved && (
                <button onClick={() => approveSong(song.queueId)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-green-100 hover:bg-green-300/10" aria-label={`Approve ${song.title}`}>
                  <ShieldCheck size={15} /> Approve
                </button>
              )}
              <button onClick={() => moveSong(song.queueId, -1)} disabled={index <= 1} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35" aria-label={`Move ${song.title} up`}>
                <ChevronUp size={15} /> Move up
              </button>
              <button onClick={() => moveSong(song.queueId, 1)} disabled={isCurrent} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-slate-200 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35" aria-label={`Move ${song.title} down`}>
                <ChevronDown size={15} /> Move down
              </button>
              <button onClick={() => removeSong(song.queueId)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-rose-100 hover:bg-rose-400/15" aria-label={`Remove ${song.title}`}>
                <Trash2 size={15} /> Remove
              </button>
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

function providerQueueTone(song: QueueSong) {
  if (song.sourceProvider === "YouTube") {
    return {
      badge: "badge-youtube",
      text: "text-red-100"
    };
  }
  if (song.sourceProvider === "Spotify") {
    return {
      badge: "badge-spotify",
      text: "text-green-100"
    };
  }
  if (song.sourceProvider === "Apple Music") {
    return {
      badge: "badge-apple",
      text: "text-sky-100"
    };
  }
  if (song.sourceProvider === "SoundCloud") {
    return {
      badge: "badge-soundcloud",
      text: "text-orange-100"
    };
  }
  if (song.sourceProvider) {
    return {
      badge: "badge-info",
      text: "text-cyan-100"
    };
  }
  return {
    badge: "badge-neutral",
    text: "text-slate-400"
  };
}

function statusTone(status: string) {
  if (status === "Playing") return "badge-live";
  if (status === "Up next") return "badge-info";
  if (status === "Pending") return "badge-warning";
  if (status === "Unavailable") return "badge-danger";
  return "badge-neutral";
}

function PeoplePanel({ embedded = false }: { embedded?: boolean }) {
  const users = useJamStore((state) => state.users);
  const viewMode = useJamStore((state) => state.viewMode);
  const removeUser = useJamStore((state) => state.removeUser);
  const addToast = useJamStore((state) => state.addToast);
  const listeningCount = users.filter((user) => user.listening).length;
  const onlineCount = users.filter((user) => user.online).length;

  return (
    <section className={embedded ? "rounded-xl p-1" : "mobile-people-screen panel rounded-2xl p-4"}>
      {!embedded && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title">People</h2>
            <p className="metadata text-sm">{listeningCount} listening · {onlineCount} online</p>
          </div>
          <button onClick={() => addToast("Invite link copied")} className={`${buttonStyles.secondary} min-h-11 px-3 py-2`} aria-label="Copy invite link" title="Copy invite link">
            <Link2 size={16} /> Invite Friends
          </button>
        </div>
      )}
      {embedded && <p className="mb-2 px-2 text-sm text-slate-400">{listeningCount} listening · {onlineCount} online</p>}
      <div className="grid gap-2">
        {users.length === 0 && <EmptyState icon={<Users />} title="No one is in the room yet" text="Invite friends or start Demo Mode to see the room feel alive." />}
        {users.map((user) => (
          <div key={user.id} className={`group flex min-h-[4.35rem] items-center gap-3 rounded-xl p-2.5 transition hover:bg-white/[0.04] max-lg:bg-white/[0.025] ${user.role === "host" ? "bg-blue-400/[0.08] ring-1 ring-cyan-200/12" : "bg-transparent"}`}>
            <div className="relative">
              <Avatar user={user} />
              <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-950 ${user.online ? "bg-green-300" : "bg-slate-600"}`} aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate font-bold">{user.name}</p>
                {user.role === "host" && <span className="badge badge-primary shrink-0">Host</span>}
              </div>
              <p className="mt-1 flex min-w-0 items-center gap-2 text-sm text-slate-400">
                <span>{user.role === "host" ? "Host" : "Guest"}</span>
                <span className="h-1 w-1 rounded-full bg-slate-700" />
                <span>{user.online ? "Online" : "Away"}</span>
                {user.listening && (
                  <>
                    <span className="h-1 w-1 rounded-full bg-slate-700" />
                    <span className="inline-flex items-center gap-1 text-green-100">
                      <span className="listening-bars" aria-hidden="true"><i /><i /><i /></span>
                      Listening
                    </span>
                  </>
                )}
              </p>
            </div>
            {viewMode === "host" && user.role !== "host" && (
              <details className="relative">
                <summary className={`${buttonStyles.icon} h-10 w-10 cursor-pointer list-none opacity-100 sm:opacity-0 sm:group-hover:opacity-100`} aria-label={`Manage ${user.name}`} title={`Manage ${user.name}`}>
                  <MoreVertical size={16} />
                </summary>
                <div className="details-popover absolute right-0 z-20 mt-2 w-40 rounded-xl border border-white/10 bg-slate-950/96 p-1.5 shadow-2xl shadow-black/50 backdrop-blur">
                  <button onClick={() => confirmDestructive(`Remove ${user.name} from this room?`, () => removeUser(user.id))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-rose-100 hover:bg-rose-400/15">
                    <UserMinus size={15} /> Remove guest
                  </button>
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ChatPanel({ embedded = false }: { embedded?: boolean }) {
  const chat = useJamStore((state) => state.chat);
  const users = useJamStore((state) => state.users);
  const sendMessage = useJamStore((state) => state.sendMessage);
  const [message, setMessage] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    sendMessage(message);
    setMessage("");
  };

  return (
    <section className={embedded ? "rounded-xl p-1" : "mobile-chat-screen panel rounded-2xl p-4"}>
      {!embedded && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="section-title">Chat</h2>
            <p className="metadata text-sm">Live room conversation</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.055] text-slate-200">
            <MessageCircle size={20} />
          </div>
        </div>
      )}
      <div className={`${embedded ? "max-h-[31rem]" : "max-h-[min(520px,58vh)]"} chat-scroll grid gap-3 overflow-y-auto pr-1 max-lg:max-h-none max-lg:overflow-visible max-lg:pr-0`}>
        {chat.length === 0 && <EmptyState icon={<MessageCircle />} title="Chat is quiet" text="Send the first message or start Demo Mode to load a realistic conversation." />}
        {chat.map((messageItem) => {
          const user = users.find((item) => item.id === messageItem.userId);
          const isYou = messageItem.userId === "you";
          if (messageItem.system) {
            return (
              <div key={messageItem.id} className="chat-system-message motion-enter flex justify-center">
                <div className="max-w-[92%] rounded-full border border-cyan-200/10 bg-cyan-200/[0.055] px-3 py-2 text-center text-xs font-bold leading-5 text-cyan-50/80">
                  {messageItem.text}
                  <span className="ml-2 font-normal text-cyan-100/45">{messageItem.time}</span>
                </div>
              </div>
            );
          }
          return (
            <div key={messageItem.id} className={`chat-message-row motion-enter flex gap-2.5 ${isYou ? "justify-end" : ""}`}>
              {!isYou && user && <Avatar user={user} small />}
              <div className={`chat-bubble min-w-0 max-w-[82%] rounded-2xl border px-3 py-2 max-lg:max-w-[84%] ${isYou ? "border-cyan-200/20 bg-blue-500/35 text-white" : "border-white/8 bg-white/[0.06]"}`}>
                <div className="mb-1 flex min-w-0 items-baseline gap-2">
                  <p className="truncate text-sm font-black">{user?.name ?? "Guest"}</p>
                  <span className="shrink-0 text-[0.68rem] font-medium text-slate-500">{messageItem.time}</span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm leading-5">{messageItem.text}</p>
                {messageItem.reactions.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {messageItem.reactions.map((reaction, index) => (
                      <span key={`${reaction}-${index}`} className="rounded-full border border-white/10 bg-white/[0.055] px-2 py-0.5 text-[0.65rem] font-black uppercase tracking-[0.08em] text-cyan-100">
                        {reactionLabel(reaction)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="chat-composer mt-4 grid grid-cols-[1fr_auto] gap-2">
        <label className="sr-only" htmlFor="chat-message">
          Message
        </label>
        <input id="chat-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Send a message..." autoComplete="off" className={`${inputStyles.base} min-w-0`} />
        <button disabled={!message.trim()} className={`${buttonStyles.neutral} h-12 w-12 p-0`} aria-label="Send message" title="Send message">
          <Send size={18} />
        </button>
      </form>
    </section>
  );
}

function HostDashboard() {
  const viewMode = useJamStore((state) => state.viewMode);
  const room = useJamStore((state) => state.room);
  const queue = useJamStore((state) => state.queue);
  const users = useJamStore((state) => state.users);
  const currentSongId = useJamStore((state) => state.currentSongId);
  const isPlaying = useJamStore((state) => state.isPlaying);
  const volume = useJamStore((state) => state.volume);
  const togglePlay = useJamStore((state) => state.togglePlay);
  const skipSong = useJamStore((state) => state.skipSong);
  const clearQueue = useJamStore((state) => state.clearQueue);
  const shuffleQueue = useJamStore((state) => state.shuffleQueue);
  const toggleSetting = useJamStore((state) => state.toggleSetting);
  const setVolume = useJamStore((state) => state.setVolume);
  const removeUser = useJamStore((state) => state.removeUser);
  const endRoom = useJamStore((state) => state.endRoom);
  const addToast = useJamStore((state) => state.addToast);
  const current = queue.find((song) => song.queueId === currentSongId) ?? queue[0];
  const upcomingCount = Math.max(queue.length - (current ? 1 : 0), 0);
  const guests = users.filter((user) => user.role !== "host");
  const invite = `${PROJECT_LINKS.app.replace(/\/$/, "")}?room=${room?.code ?? ""}`;

  if (viewMode !== "host") {
    return (
      <section className="panel rounded-2xl p-3">
        <h2 className="section-title text-base">Guest mode</h2>
        <p className="metadata mt-1 text-sm">Host controls are hidden. Guests can chat, react, vote, and add songs when permissions allow.</p>
      </section>
    );
  }

  return (
    <details className="host-dashboard panel rounded-2xl p-3" open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-1 py-1">
        <div className="flex items-center gap-2">
          <Gauge className="text-cyan-200" />
          <div>
            <h2 className="section-title text-base">Host Dashboard</h2>
            <p className="metadata text-xs">Control the room without leaving the music.</p>
          </div>
        </div>
        <ChevronDown size={16} className="text-slate-400" />
      </summary>

      <div className="details-panel mt-4 grid gap-3">
        <section className="host-control-group">
          <div className="host-control-heading">
            <p>Playback</p>
            <span className="truncate">{current?.title ?? "Nothing playing"}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={togglePlay} className="host-action" aria-pressed={isPlaying} aria-label={isPlaying ? "Pause host playback" : "Play host playback"}>
              {isPlaying ? <Pause size={15} /> : <Play size={15} />} {isPlaying ? "Pause" : "Play"}
            </button>
            <button onClick={skipSong} className="host-action" aria-label="Skip current song">
              <SkipForward size={15} /> Skip
            </button>
            <button onClick={shuffleQueue} className="host-action" aria-label="Shuffle queue">
              <Shuffle size={15} /> Shuffle
            </button>
            <label className="host-action cursor-pointer">
              <Volume2 size={15} />
              <span className="sr-only">Host volume control</span>
              <input aria-label="Host volume control" aria-valuetext={`${volume}% volume`} value={volume} onChange={(event) => setVolume(Number(event.target.value))} type="range" min="0" max="100" className="range min-w-0 flex-1" />
            </label>
          </div>
        </section>

        <section className="host-control-group">
          <div className="host-control-heading">
            <p>Queue</p>
            <span>{upcomingCount} upcoming</span>
          </div>
          <div className="mt-3 grid gap-2">
            <p className="text-sm leading-5 text-slate-400">Manage song order and approvals in the Queue panel.</p>
            <button onClick={() => confirmDestructive("Clear all upcoming songs? The current song will keep playing.", clearQueue)} className="host-danger-soft" aria-label="Clear upcoming queue">
              <Trash2 size={15} /> Clear upcoming queue
            </button>
          </div>
        </section>

        <section className="host-control-group">
          <div className="host-control-heading">
            <p>Room</p>
            <span>{room?.code}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => copyText(room?.code ?? "", addToast, "Room code copied")} className="host-action">
              <Copy size={15} /> Copy code
            </button>
            <button onClick={() => copyText(invite, addToast, "Invite link copied")} className="host-action">
              <Link2 size={15} /> Copy invite
            </button>
          </div>
        </section>

        <section className="host-control-group">
          <div className="host-control-heading">
            <p>Guest permissions</p>
            <span>{room?.requireApproval ? "Approval on" : "Open queue"}</span>
          </div>
          <div className="mt-3 grid gap-2">
            <CompactToggle label="Guests can add songs" checked={Boolean(room?.guestsCanAdd)} onChange={() => toggleSetting("guestsCanAdd")} />
            <CompactToggle label="Require approval" checked={Boolean(room?.requireApproval)} onChange={() => toggleSetting("requireApproval")} />
          </div>
        </section>

        <section className="host-control-group">
          <div className="host-control-heading">
            <p>Participants</p>
            <span>{guests.length} guests</span>
          </div>
          <div className="mt-3 grid gap-1.5">
            {guests.length === 0 && <p className="metadata text-sm">No guests to manage yet.</p>}
            {guests.slice(0, 4).map((user) => (
              <div key={user.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.025] px-2 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar user={user} small />
                  <span className="truncate text-sm font-bold text-white">{user.name}</span>
                </div>
                <details className="relative">
                  <summary className={`${buttonStyles.icon} h-9 w-9 cursor-pointer list-none`} aria-label={`Manage ${user.name}`}>
                    <MoreVertical size={15} />
                  </summary>
                  <div className="details-popover absolute right-0 z-20 mt-2 w-40 rounded-xl border border-white/10 bg-slate-950/96 p-1.5 shadow-2xl shadow-black/50 backdrop-blur">
                    <button onClick={() => confirmDestructive(`Remove ${user.name} from this room?`, () => removeUser(user.id))} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-bold text-rose-100 hover:bg-rose-400/15">
                      <UserMinus size={15} /> Remove guest
                    </button>
                  </div>
                </details>
              </div>
            ))}
            {guests.length > 4 && <p className="text-xs text-slate-500">More guests can be managed in People.</p>}
          </div>
        </section>

        <section className="rounded-xl border border-rose-300/18 bg-rose-400/[0.055] p-3">
          <div className="host-control-heading">
            <p className="text-rose-100">Danger zone</p>
            <span>Host only</span>
          </div>
          <button onClick={() => confirmDestructive("End this room for everyone?", endRoom)} className={`${buttonStyles.destructive} mt-3 min-h-10 w-full`}>
            <LogOut size={15} /> End Room
          </button>
        </section>
      </div>
    </details>
  );
}

function CompactPlayer() {
  const queue = useJamStore((state) => state.queue);
  const currentSongId = useJamStore((state) => state.currentSongId);
  const isPlaying = useJamStore((state) => state.isPlaying);
  const togglePlay = useJamStore((state) => state.togglePlay);
  const setMobileTab = useJamStore((state) => state.setMobileTab);
  const current = queue.find((song) => song.queueId === currentSongId) ?? queue[0];

  return (
    <div className="glass compact-player fixed inset-x-3 bottom-[5.15rem] z-30 flex items-center gap-2 rounded-2xl p-2 shadow-2xl shadow-black/50 lg:hidden">
      <button type="button" onClick={() => setMobileTab("player")} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1 text-left transition hover:bg-white/[0.04]" aria-label="Return to player">
        <AlbumArt song={current} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black">{current?.title}</span>
          <span className="block truncate text-xs text-slate-400">{current?.artist}</span>
        </span>
      </button>
      <span className="badge badge-live hidden sm:inline-flex">Live</span>
      <button type="button" onClick={togglePlay} className={`play-toggle grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#1d4ed8,#38bdf8)] text-white ${isPlaying ? "is-playing" : ""}`} aria-label={isPlaying ? "Pause compact player" : "Play compact player"} aria-pressed={isPlaying}>
        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
      </button>
    </div>
  );
}

function useDemoPulse() {
  const screen = useJamStore((state) => state.screen);
  const room = useJamStore((state) => state.room);
  const isPlaying = useJamStore((state) => state.isPlaying);
  const progress = useJamStore((state) => state.progress);
  const setProgress = useJamStore((state) => state.setProgress);
  const skipSong = useJamStore((state) => state.skipSong);
  const queue = useJamStore((state) => state.queue);
  const scriptedDemoRun = useRef<string | null>(null);

  useEffect(() => {
    if (screen !== "room" || !isPlaying) return;
    const current = queue.find((song) => song.queueId === useJamStore.getState().currentSongId);
    if (current?.sourceProvider === "YouTube") return;
    const timer = window.setInterval(() => {
      const next = progress + 1;
      if (next >= 100) skipSong();
      else setProgress(next);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, isPlaying, progress, setProgress, skipSong, queue]);

  useEffect(() => {
    if (screen !== "room" || room?.code !== "JAM247" || !room.demoRunId) return;
    if (scriptedDemoRun.current === room.demoRunId) return;
    scriptedDemoRun.current = room.demoRunId;

    const timers = [
      window.setTimeout(() => useJamStore.getState().addReaction("✨"), 3200),
      window.setTimeout(() => {
        useJamStore.setState((state) => ({
          users: state.users.map((user) => (user.id === "noor" ? { ...user, online: true, listening: true } : user)),
          chat: [
            ...state.chat,
            { id: `demo-join-${Date.now()}`, userId: "system", text: "Noor joined from the invite link", time: "now", reactions: [], system: true }
          ]
        }));
      }, 6600),
      window.setTimeout(() => {
        const state = useJamStore.getState();
        const target = state.queue.find((song) => song.approved && song.queueId !== state.currentSongId);
        if (target) state.voteSong(target.queueId, 1);
      }, 9400),
      window.setTimeout(() => {
        useJamStore.setState((state) => ({
          chat: [
            ...state.chat,
            { id: `demo-chat-${Date.now()}`, userId: "maya", text: "This queue is already locked in.", time: "now", reactions: [] }
          ]
        }));
      }, 12400),
      window.setTimeout(() => {
        useJamStore.setState((state) => {
          if (state.queue.some((song) => song.id === "mono") || state.queue.length >= 12) return state;
          const nextSong = createQueueItem(library[10], state.queue.length, "ari", true);
          nextSong.votes = 4;
          return {
            queue: sortedQueue([...state.queue, nextSong], state.currentSongId),
            chat: [
              ...state.chat,
              { id: `demo-add-${Date.now()}`, userId: "system", text: `Ari added ${nextSong.title}`, time: "now", reactions: [], system: true }
            ]
          };
        });
      }, 15600)
    ];

    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [screen, room?.code, room?.demoRunId]);
}

function DemoHint({ onClose }: { onClose: () => void }) {
  return (
    <div className="demo-hint mt-3 flex items-start gap-3 rounded-2xl border border-cyan-200/12 bg-cyan-200/[0.055] p-3 text-sm text-cyan-50 shadow-xl shadow-cyan-950/10 sm:mt-4 sm:items-center sm:justify-between sm:p-4">
      <div className="flex min-w-0 flex-1 gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-cyan-200/10 text-cyan-100 sm:h-9 sm:w-9">
          <Sparkles size={16} />
        </span>
        <div className="min-w-0">
          <p className="font-black text-white">Live {brand.productName} demo</p>
          <p className="mt-0.5 leading-5 text-cyan-50/80">Try Host/Guest, add a song, vote, or chat.</p>
          <p className="mt-1 hidden text-xs font-bold text-cyan-100/65 sm:block">Room activity is simulated. YouTube links use the real embedded player.</p>
        </div>
      </div>
      <button onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-slate-300 transition hover:bg-white/10 hover:text-white" aria-label="Dismiss demo hint" title="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}

function AboutDemoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About This Demo" onClose={onClose}>
      <div className="grid gap-4 text-sm text-slate-300">
        <InfoBlock title="Project">{brand.productName}</InfoBlock>
        <InfoBlock title="Description">{brand.primaryMessage}</InfoBlock>
        <InfoBlock title="Technologies">Next.js App Router, TypeScript, Tailwind CSS, Zustand, localStorage, Lucide icons.</InfoBlock>
        <InfoBlock title="Major Features">Start/join party flows, Demo Mode, Host/Guest views, shared queue voting, simulated playback, participants, chat, reactions, and host controls.</InfoBlock>
        <InfoBlock title="Simulated">Music streaming, universal music-link matching, realtime presence, chat delivery, queue synchronization, and invite links.</InfoBlock>
        <InfoBlock title="Production Needs">Provider OAuth, licensed playback APIs, realtime backend, durable database, moderation, auth, analytics, deployment secrets, and provider compliance review.</InfoBlock>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a href={PROJECT_LINKS.github} className={buttonStyles.secondary}>
          <Github size={17} /> View Source on GitHub
        </a>
        <a href={PROJECT_LINKS.portfolio} className={buttonStyles.neutral}>
          <Home size={17} /> Back to Portfolio
        </a>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      previousFocus.current?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop fixed inset-0 z-50 grid place-items-center bg-slate-950/78 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div ref={panelRef} className="modal-panel glass max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-2xl font-black">{title}</h2>
          <button ref={closeRef} onClick={onClose} className={buttonStyles.icon} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.035] p-3">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">{title}</p>
      <p className="mt-1 leading-6">{children}</p>
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-blue-700 via-blue-500 to-cyan-300 font-black text-white shadow-lg shadow-blue-950/50">
        OA
      </div>
      {!compact && (
        <div>
          <p className="text-lg font-black leading-none">{brand.productName}</p>
          <p className="text-xs text-slate-400">Party jukebox</p>
        </div>
      )}
    </div>
  );
}

function AlbumArt({ song, large = false }: { song?: Pick<Song, "title" | "cover" | "artwork">; large?: boolean }) {
  const cover = song?.cover ?? ["#334155", "#111827", "#020617"];
  return (
    <div
      className={`artwork grid shrink-0 place-items-center rounded-2xl ${song?.artwork ? "has-image" : ""} ${large ? "aspect-square w-full min-w-0" : "h-14 w-14"}`}
      style={{ "--from": cover[0], "--via": cover[1], "--to": cover[2] } as React.CSSProperties}
      aria-label={song ? `${song.title} album artwork` : "Album artwork placeholder"}
    >
      {song?.artwork ? (
        <img className="artwork-image" src={song.artwork} alt="" loading={large ? "eager" : "lazy"} />
      ) : large ? (
        <div className="album-scene" aria-hidden="true">
          <span className="sun" />
          <span className="palm left" />
          <span className="palm right" />
          <span className="skyline one" />
          <span className="skyline two" />
          <span className="car" />
        </div>
      ) : (
        <span className="text-lg font-black text-white/85">{song?.title?.slice(0, 1) ?? "J"}</span>
      )}
    </div>
  );
}

function NowPlayingPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <AlbumArt song={library[0]} large />
      <h3 className="mt-4 truncate text-2xl font-black">{library[0].title}</h3>
      <p className="truncate text-slate-400">{library[0].artist}</p>
      <div className="mt-5 h-2 rounded-full bg-white/10">
        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-blue-500 to-cyan-300" />
      </div>
    </div>
  );
}

function LandingDeviceShowcase() {
  return (
    <div className="relative min-h-[34rem] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/45 p-5 shadow-2xl shadow-black/40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(56,189,248,0.18),transparent_20rem)]" />
      <div className="relative grid h-full items-center gap-5 md:grid-cols-[0.82fr_1fr]">
        <div className="phone-frame mx-auto w-full max-w-[17rem]">
          <div className="flex items-center justify-between text-xs text-white">
            <span>9:41</span>
            <span>5G</span>
          </div>
          <div className="mt-10 grid place-items-center text-center">
            <div className="artwork mb-7 grid h-32 w-32 place-items-center rounded-[2rem]" style={{ "--from": "#1d4ed8", "--via": "#2563eb", "--to": "#22d3ee" } as React.CSSProperties}>
              <ListMusic size={54} className="text-white drop-shadow-xl" />
            </div>
            <h3 className="text-3xl font-black">
              {brand.productName}
            </h3>
            <p className="mt-3 max-w-[12rem] text-sm leading-6 text-slate-300">{brand.tagline}</p>
          </div>
          <div className="mt-10 grid gap-3">
            <div className="rounded-xl bg-[linear-gradient(135deg,#1d4ed8,#38bdf8)] px-4 py-3 text-center text-sm font-black">Start a Party</div>
            <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center text-sm font-bold">Join a Party</div>
          </div>
        </div>
        <div className="glass rounded-[1.75rem] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">Weekend Vibes</p>
              <h3 className="text-2xl font-black">Friday Night Jam</h3>
            </div>
            <div className="rounded-full bg-white/10 px-3 py-1 text-sm font-black">8</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[0.75fr_1fr]">
            <NowPlayingPreview />
            <div className="grid gap-3">
              {library.slice(1, 6).map((song, index) => (
                <MiniSong key={song.id} song={song} votes={12 - index * 2} />
              ))}
            </div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {["People", "Chat", "Host controls"].map((item) => (
              <div key={item} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm font-bold text-slate-200">{item}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard() {
  return (
    <section className="panel overflow-hidden rounded-2xl p-5">
      <div className="artwork mb-6 grid h-28 place-items-center rounded-2xl" style={{ "--from": "#0b1426", "--via": "#1d4ed8", "--to": "#111827" } as React.CSSProperties}>
        <Users size={46} className="text-cyan-100" />
      </div>
      <div className="grid gap-3 text-sm text-slate-200">
        {["Real-time synced playback", "Shared queue", "Reactions and chat", "Host controls", "Invite anyone"].map((feature) => (
          <p key={feature} className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            {feature}
          </p>
        ))}
      </div>
      <p className="mt-8 text-2xl font-black leading-tight text-cyan-300">
        One speaker.<br />Shared queue.<br />Everyone gets a say.
      </p>
    </section>
  );
}

function MiniSong({ song, votes }: { song: Song; votes: number }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
      <AlbumArt song={song} />
      <div className="min-w-0">
        <p className="song-title truncate font-bold">{song.title}</p>
        <p className="metadata truncate text-sm">{song.artist}</p>
      </div>
      <span className="badge badge-neutral">+{votes}</span>
    </div>
  );
}

function Avatar({ user, small = false }: { user: User; small?: boolean }) {
  return (
    <div className={`grid shrink-0 place-items-center rounded-full font-black text-white ${small ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm"}`} style={{ backgroundColor: user.color }}>
      {user.avatar}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="surface-subtle flex cursor-pointer items-center justify-between gap-4 rounded-xl p-4">
      <span className="font-bold text-white">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-cyan-400" aria-label={label} />
    </label>
  );
}

function CompactToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange} className="flex min-h-10 items-center justify-between gap-3 rounded-lg bg-white/[0.035] px-3 py-2 text-left text-sm font-bold text-white transition hover:bg-white/[0.08]" role="switch" aria-checked={checked}>
      <span>{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-cyan-400" : "bg-white/15"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "left-6" : "left-1"}`} />
      </span>
    </button>
  );
}

function CreateSettingToggle({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 transition ${checked ? "border-cyan-200/35 bg-blue-500/18" : "border-white/10 bg-white/[0.035] hover:bg-white/[0.08]"}`}>
      <span className="min-w-0">
        <span className="block font-black text-white">{label}</span>
        <span className="mt-1 block text-sm leading-5 text-slate-400">{description}</span>
      </span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-6 w-6 shrink-0 accent-cyan-400" aria-label={label} />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="font-bold text-white">{label}</span>
      {children}
    </label>
  );
}

function confirmDestructive(message: string, action: () => void) {
  if (window.confirm(message)) action();
}

function IconButton({ children, label, onClick, active = false }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={`${buttonStyles.icon} h-11 w-11 ${active ? "border-cyan-200/25 bg-blue-400/18 text-cyan-100" : ""}`} aria-label={label} title={label}>
      {children}
    </button>
  );
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 p-6 text-center text-slate-300">
      <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-white">{icon}</div>
      <p className="font-black text-white">{title}</p>
      <p className="mt-1 text-sm">{text}</p>
    </div>
  );
}

function findSong(query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return null;
  const linkSong = createSongFromMusicLink(query);
  if (linkSong) return linkSong;
  return library.find((song) => `${song.title} ${song.artist} ${song.album}`.toLowerCase().includes(trimmed)) ?? null;
}

function invalidMusicLink(query: string) {
  const trimmed = query.trim().toLowerCase();
  return /^https?:\/\//.test(trimmed) && !/spotify|apple|music\.apple|youtube|youtu\.be|soundcloud/.test(trimmed);
}

function createSongFromMusicLink(raw: string): Song | null {
  const input = raw.trim();
  if (!/^https?:\/\//i.test(input)) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const youtubeId = getYouTubeVideoId(url);
  if (youtubeId) {
    return {
      id: `youtube-${youtubeId}`,
      title: "YouTube link",
      artist: "Playable embed",
      album: host,
      duration: 210,
      cover: ["#ef4444", "#7f1d1d", "#020617"],
      sourceId: youtubeId,
      sourceUrl: input,
      sourceProvider: "YouTube",
      embedUrl: `https://www.youtube.com/embed/${youtubeId}`
    };
  }

  if (host.includes("spotify.com")) return musicLinkSong(input, "Spotify", ["#22c55e", "#14532d", "#020617"], host);
  if (host.includes("music.apple.com") || host.includes("apple.com")) return musicLinkSong(input, "Apple Music", ["#fb7185", "#be123c", "#111827"], host);
  if (host.includes("soundcloud.com")) return musicLinkSong(input, "SoundCloud", ["#f97316", "#9a3412", "#111827"], host);
  return null;
}

function musicLinkSong(sourceUrl: string, sourceProvider: NonNullable<Song["sourceProvider"]>, cover: [string, string, string], host: string): Song {
  return {
    id: `${sourceProvider.toLowerCase().replace(/\s+/g, "-")}-${hash(sourceUrl)}`,
    title: `${sourceProvider} link`,
    artist: "External music link",
    album: host,
    duration: 210,
    cover,
    sourceUrl,
    sourceProvider
  };
}

function getYouTubeVideoId(url: URL) {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") return cleanYouTubeId(url.pathname.slice(1));
  if (host.includes("youtube.com")) {
    if (url.pathname.startsWith("/watch")) return cleanYouTubeId(url.searchParams.get("v") ?? "");
    if (url.pathname.startsWith("/shorts/")) return cleanYouTubeId(url.pathname.split("/")[2] ?? "");
    if (url.pathname.startsWith("/embed/")) return cleanYouTubeId(url.pathname.split("/")[2] ?? "");
  }
  return null;
}

function cleanYouTubeId(value: string) {
  const id = value.trim().split(/[?&#/]/)[0];
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
}

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.reject(new Error("YouTube API is browser-only."));
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (window.jamroomYouTubeApiReady) return window.jamroomYouTubeApiReady;

  window.jamroomYouTubeApiReady = new Promise<YouTubeApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    window.onYouTubeIframeAPIReady = () => {
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube API loaded without Player."));
    };
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube API failed to load."));
      document.head.appendChild(script);
    }
  });

  return window.jamroomYouTubeApiReady;
}

function updateQueuedSongDuration(queueId: string, duration: number) {
  const { queue } = useJamStore.getState();
  const song = queue.find((item) => item.queueId === queueId);
  if (!song || song.duration === duration) return;
  useJamStore.setState({
    queue: queue.map((item) => (item.queueId === queueId ? { ...item, duration } : item))
  });
}

function copyText(text: string, addToast: (text: string) => void, success: string) {
  if (!navigator.clipboard) {
    addToast("Clipboard access is not available in this browser.");
    return;
  }
  void navigator.clipboard.writeText(text).then(
    () => addToast(success),
    () => addToast("Copy failed. You can manually select the room code instead.")
  );
}

function hash(input: string) {
  return input.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function userName(id: string) {
  return mockUsers.find((user) => user.id === id)?.name ?? "Guest";
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remaining = String(seconds % 60).padStart(2, "0");
  return `${minutes}:${remaining}`;
}
