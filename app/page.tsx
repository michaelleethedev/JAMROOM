"use client";

import {
  ChevronDown,
  ChevronUp,
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
  Pause,
  Play,
  Plus,
  Repeat2,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Shuffle,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserMinus,
  Users,
  Volume2,
  Wand2,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

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
};

type QueueSong = Song & {
  queueId: string;
  addedBy: string;
  votes: number;
  approved: boolean;
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

const PROJECT_LINKS = {
  github: process.env.NEXT_PUBLIC_GITHUB_URL || "#",
  portfolio: process.env.NEXT_PUBLIC_PORTFOLIO_URL || "#",
  app: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
};

const DEMO_INTRO_STORAGE_KEY = "jamroom-demo-intro-dismissed";

const library: Song[] = [
  { id: "aurora", title: "Aurora Circuit", artist: "Nova Saint", album: "Midnight Arcade", duration: 224, cover: ["#8b5cf6", "#ec4899", "#22d3ee"] },
  { id: "velvet", title: "Velvet Satellite", artist: "Mira Vale", album: "Orbital Bloom", duration: 198, cover: ["#f43f5e", "#7c3aed", "#111827"] },
  { id: "neon", title: "Neon Undertow", artist: "Glass Harbor", album: "Low Tide Lights", duration: 242, cover: ["#06b6d4", "#2563eb", "#111827"] },
  { id: "pulse", title: "Pulse Check", artist: "The Afterparty", album: "Late Checkout", duration: 187, cover: ["#f59e0b", "#ef4444", "#3b0764"] },
  { id: "loft", title: "Loft Windows", artist: "June Static", album: "City Room", duration: 215, cover: ["#10b981", "#0f766e", "#172554"] },
  { id: "swerve", title: "Swerve Theory", artist: "Kito Park", album: "Fast Friends", duration: 176, cover: ["#a855f7", "#4f46e5", "#020617"] },
  { id: "solstice", title: "Solstice Drive", artist: "North Runner", album: "Open Roads", duration: 268, cover: ["#f97316", "#be123c", "#312e81"] },
  { id: "glimmer", title: "Glimmer Mode", artist: "Pixel Choir", album: "Shared Screen", duration: 203, cover: ["#38bdf8", "#8b5cf6", "#1e1b4b"] },
  { id: "after", title: "Afterimage", artist: "Sable Room", album: "Violet Hour", duration: 231, cover: ["#d946ef", "#9333ea", "#0f172a"] },
  { id: "signal", title: "Signal Bloom", artist: "The Relay", album: "Everyone Online", duration: 192, cover: ["#84cc16", "#14b8a6", "#172554"] },
  { id: "mono", title: "Monorail Hearts", artist: "Luca Drift", album: "Transit Dreams", duration: 209, cover: ["#fb7185", "#facc15", "#0f172a"] },
  { id: "static", title: "Static Jubilee", artist: "Echo Vale", album: "Room Tone", duration: 254, cover: ["#6366f1", "#0ea5e9", "#020617"] }
];

const mockUsers: User[] = [
  { id: "you", name: "You", role: "host", avatar: "YO", color: "#9a6cff", online: true, listening: true },
  { id: "sarah", name: "Sarah", role: "guest", avatar: "SA", color: "#49d9ff", online: true, listening: true },
  { id: "mike", name: "Mike", role: "guest", avatar: "MI", color: "#5ee5a1", online: true, listening: true },
  { id: "jules", name: "Jules", role: "guest", avatar: "JU", color: "#e65cff", online: true, listening: true },
  { id: "kenji", name: "Kenji", role: "guest", avatar: "KE", color: "#f59e0b", online: true, listening: true },
  { id: "maya", name: "Maya", role: "guest", avatar: "MA", color: "#fb7185", online: true, listening: false },
  { id: "ari", name: "Ari", role: "guest", avatar: "AR", color: "#22c55e", online: true, listening: true },
  { id: "noor", name: "Noor", role: "guest", avatar: "NO", color: "#38bdf8", online: false, listening: false }
];

const demoChat: ChatMessage[] = [
  { id: "c1", userId: "system", text: "Sarah joined the room", time: "8:04 PM", reactions: [], system: true },
  { id: "c2", userId: "sarah", text: "This queue already has main character energy.", time: "8:05 PM", reactions: ["🔥"] },
  { id: "c3", userId: "mike", text: "Adding something with a bigger chorus next.", time: "8:06 PM", reactions: [] },
  { id: "c4", userId: "system", text: "Mike added Pulse Check", time: "8:06 PM", reactions: [], system: true },
  { id: "c5", userId: "jules", text: "Vote Glimmer Mode up, trust me.", time: "8:07 PM", reactions: ["💜", "✨"] }
];

const emptyChat: ChatMessage[] = [
  { id: "welcome", userId: "system", text: "Room created. Invite friends or start Demo Mode to fill the room.", time: "now", reactions: [], system: true }
];

const makeCode = () => Math.random().toString(36).slice(2, 8).toUpperCase();
const nowTime = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const guestAdderIds = ["sarah", "mike", "jules", "kenji", "maya", "ari"];

const createQueueItem = (song: Song, index: number, addedBy = "you", approved = true): QueueSong => ({
  ...song,
  queueId: `${song.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${index}`,
  addedBy,
  votes: index === 0 ? 4 : Math.max(-1, 5 - index),
  approved
});

const sortedQueue = (queue: QueueSong[], currentSongId: string | null) => {
  if (!queue.length || !currentSongId) return queue;
  const current = queue.find((item) => item.queueId === currentSongId);
  const upcoming = queue
    .filter((item) => item.queueId !== currentSongId)
    .sort((a, b) => Number(b.approved) - Number(a.approved) || b.votes - a.votes);
  return current ? [current, ...upcoming] : upcoming;
};

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
        get().addToast("Room created");
      },
      joinRoom: (code) => {
        const cleanCode = code.trim().toUpperCase();
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
        get().addToast("Joined room");
        return true;
      },
      startDemo: () => {
        const queue = library.slice(0, 8).map((song, index) => createQueueItem(song, index, guestAdderIds[index % guestAdderIds.length], true));
        set({
          screen: "room",
          viewMode: "host",
          mobileTab: "player",
          room: {
            name: "Friday Night Jam",
            code: "JAM247",
            mood: "Neon lounge",
            guestsCanAdd: true,
            requireApproval: false,
            ended: false
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
          reactions: ["🔥", "💜", "✨"]
        });
        get().addToast("Demo loaded. Try switching between Host and Guest views.");
      },
      resetDemo: () =>
        set({
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
          repeat: false,
          shuffle: false,
          volume: 72,
          reactions: []
        }),
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
        const queue = get().queue.map((item) => (item.queueId === queueId ? { ...item, votes: item.votes + delta } : item));
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
  const setScreen = useJamStore((state) => state.setScreen);
  const joinRoom = useJamStore((state) => state.joinRoom);
  const startDemo = useJamStore((state) => state.startDemo);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <div className="text-right">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.16em] text-cyan-200">Best way to explore</p>
          <button onClick={startDemo} className="rounded-full border border-violet-200/40 bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-violet-950/40 transition hover:scale-[1.02]">
            Demo Mode
          </button>
        </div>
      </header>
      <div className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="max-w-2xl">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
            <Sparkles size={16} /> Portfolio demo
          </p>
          <h1 className="text-5xl font-black tracking-normal text-white sm:text-6xl lg:text-7xl">JamRoom</h1>
          <p className="mt-5 max-w-xl text-2xl font-semibold leading-tight text-white/88">One room. Everyone&apos;s music. Listen together.</p>
          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
            Create a shared listening room, invite friends with a code, build a queue together, react in the moment, and chat while the simulated player stays in sync.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button onClick={() => setScreen("create")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-bold text-slate-950 transition hover:scale-[1.02]">
              <Plus size={18} /> Create a Room
            </button>
            <button onClick={startDemo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c3aed,#a855f7_50%,#d946ef)] px-5 py-3 font-bold text-white shadow-lg shadow-violet-950/40 transition hover:scale-[1.02]">
              <Wand2 size={18} /> Start Demo
            </button>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              joinRoom(code);
            }}
            className="mt-5 flex max-w-lg flex-col gap-3 sm:flex-row"
          >
            <label className="sr-only" htmlFor="room-code">
              Enter room code
            </label>
            <input id="room-code" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter room code" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-white placeholder:text-slate-500" />
            <button className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 font-bold text-white transition hover:bg-white/10">
              <Link2 size={18} /> Join a Room
            </button>
          </form>
        </div>
        <LandingDeviceShowcase />
      </div>
      <div className="grid gap-3 pb-8 text-sm text-slate-300 md:grid-cols-3">
        {["Create or join with a six-character code", "Vote songs up so the best tracks rise", "Use Host or Guest View to test both roles"].map((text) => (
          <div key={text} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            {text}
          </div>
        ))}
      </div>
    </section>
  );
}

function CreateRoom() {
  const [name, setName] = useState("My Listening Room");
  const [mood, setMood] = useState("Neon lounge");
  const [guestsCanAdd, setGuestsCanAdd] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const createRoom = useJamStore((state) => state.createRoom);
  const setScreen = useJamStore((state) => state.setScreen);

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 py-6 sm:px-8">
      <header className="flex items-center justify-between">
        <Logo />
        <button onClick={() => setScreen("landing")} className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/10">
          Back
        </button>
      </header>
      <div className="my-auto grid items-center gap-6 py-10 lg:grid-cols-[1fr_0.82fr]">
        <div>
          <div className="mb-8">
            <p className="mb-3 inline-flex rounded-full border border-violet-200/25 bg-violet-400/10 px-3 py-1 text-sm font-bold text-violet-100">Host setup</p>
            <h1 className="text-4xl font-black">Create a listening room</h1>
            <p className="mt-3 max-w-xl text-slate-300">Set the mood, decide how much guests can shape the queue, then share the generated room code.</p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              createRoom({ name, mood, guestsCanAdd, requireApproval });
            }}
            className="glass grid gap-6 rounded-3xl p-5 sm:p-7"
          >
            <Field label="Room name">
              <input value={name} onChange={(event) => setName(event.target.value)} required className="w-full rounded-xl border border-white/10 bg-white/8 px-4 py-3 text-white" />
            </Field>
            <div className="grid gap-2">
              <p className="font-bold text-white">Mood or theme</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {["Neon lounge", "Late-night drive", "House party", "Focus flow", "Arcade pop"].map((option) => (
                  <button key={option} type="button" onClick={() => setMood(option)} className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${mood === option ? "border-violet-200/45 bg-violet-500/25 text-white" : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"}`}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <Toggle label="Guests can add songs" checked={guestsCanAdd} onChange={setGuestsCanAdd} />
            <Toggle label="Songs require host approval" checked={requireApproval} onChange={setRequireApproval} />
            <button className="inline-flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#7c3aed,#a855f7_50%,#d946ef)] px-5 py-3 font-black text-white shadow-lg shadow-violet-950/40 transition hover:scale-[1.01]">
              <Crown size={18} /> Create room
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
              <p className="text-xs uppercase tracking-[0.18em] text-violet-200">Room preview</p>
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
  const setMobileTab = useJamStore((state) => state.setMobileTab);
  const resetDemo = useJamStore((state) => state.resetDemo);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);

  useEffect(() => {
    if (room?.code === "JAM247" && window.localStorage.getItem(DEMO_INTRO_STORAGE_KEY) !== "true") {
      setIntroOpen(true);
    }
  }, [room?.code]);

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
      <div className="min-w-0 flex-1 px-4 pb-24 pt-4 lg:px-5 lg:pb-5">
        <div className="hidden lg:block">
          <TopBar onAbout={() => setAboutOpen(true)} />
        </div>
        <MobileRoomHeader onAbout={() => setAboutOpen(true)} />
        <div className="mt-4 hidden grid-cols-[minmax(0,1.05fr)_minmax(420px,1.35fr)_minmax(300px,0.72fr)] gap-4 xl:grid">
          <div className="grid min-w-0 content-start gap-4">
            <Player />
          </div>
          <div className="grid min-w-0 content-start gap-4">
            <QueuePanel />
            <HostDashboard />
          </div>
          <div className="grid min-w-0 content-start gap-4">
            <PeoplePanel />
            <ChatPanel />
            <FeatureCard />
          </div>
        </div>
        <div className="mt-4 hidden grid-cols-[minmax(0,1fr)_360px] gap-4 lg:grid xl:hidden">
          <div className="grid min-w-0 gap-4">
            <Player />
            <QueuePanel />
            <HostDashboard />
          </div>
          <div className="grid min-w-0 content-start gap-4">
            <PeoplePanel />
            <ChatPanel />
          </div>
        </div>
        <div className="mt-4 lg:hidden">
          {mobileTab === "player" && <Player />}
          {mobileTab === "queue" && <QueuePanel />}
          {mobileTab === "people" && <PeoplePanel />}
          {mobileTab === "chat" && <ChatPanel />}
          {mobileTab !== "player" && <CompactPlayer />}
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-slate-950/92 px-2 py-2 backdrop-blur lg:hidden">
        {[
          ["player", Play, "Player"],
          ["queue", ListMusic, "Queue"],
          ["people", Users, "People"],
          ["chat", MessageCircle, "Chat"]
        ].map(([tab, Icon, label]) => (
          <button key={String(tab)} onClick={() => setMobileTab(tab as MobileTab)} className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs ${mobileTab === tab ? "bg-white/10 text-white" : "text-slate-400"}`} aria-label={String(label)}>
            <Icon size={18} />
            {String(label)}
          </button>
        ))}
      </nav>
      {introOpen && <DemoIntroDialog onClose={() => setIntroOpen(false)} />}
      {aboutOpen && <AboutDemoDialog onClose={() => setAboutOpen(false)} />}
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
        <h1 className="truncate text-2xl font-black text-white">{room?.name}</h1>
        <p className="mt-1 flex items-center gap-2 text-sm text-slate-300">
          <span className="inline-grid h-5 w-5 place-items-center rounded-full bg-violet-400/20 text-[10px] font-black text-violet-100">JR</span>
          {room?.mood} room
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
          {(["host", "guest"] as const).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)} className={`rounded-lg px-3 py-2 text-sm font-bold capitalize transition ${viewMode === mode ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10"}`}>
              {mode} View
            </button>
          ))}
        </div>
        <button onClick={startDemo} className="inline-flex items-center gap-2 rounded-xl border border-violet-300/25 px-3 py-2 text-sm font-bold text-white hover:bg-violet-400/15" aria-label="Start demo mode">
          <Wand2 size={16} /> Demo
        </button>
        <button onClick={() => copyText(invite, addToast, "Invite link copied")} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/10" aria-label="Copy invite link">
          <Copy size={16} /> {room?.code}
        </button>
        <button onClick={onAbout} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-white hover:bg-white/10" aria-label="Open About This Demo">
          <Info size={16} /> About
        </button>
        <button onClick={resetDemo} className="rounded-xl border border-white/10 p-2 text-slate-300 hover:bg-white/10" aria-label="Reset demo">
          <RotateCcw size={18} />
        </button>
      </div>
      <div className="basis-full text-sm text-slate-300 lg:basis-auto">
        <span className="font-bold text-white">{users.filter((user) => user.online).length}</span> listeners online
      </div>
    </header>
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
    <header className="mb-4 lg:hidden">
      <div className="mb-3 flex items-center justify-between px-1 text-xs font-bold text-white">
        <span>9:41</span>
        <span>{users.filter((user) => user.online).length} online</span>
      </div>
      <div className="glass rounded-[1.35rem] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Room</p>
            <h1 className="truncate text-lg font-black">{room?.name}</h1>
            <p className="truncate text-xs text-slate-400">Hosted by alex</p>
          </div>
          <button onClick={() => copyText(invite, addToast, "Invite link copied")} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white" aria-label="Copy invite link">
            {room?.code}
          </button>
        </div>
        <div className="mt-3 grid grid-cols-[1fr_auto_auto] gap-2">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {(["host", "guest"] as const).map((mode) => (
              <button key={mode} onClick={() => setViewMode(mode)} className={`rounded-lg px-3 py-2 text-xs font-black capitalize ${viewMode === mode ? "bg-white text-slate-950" : "text-slate-300"}`}>
                {mode}
              </button>
            ))}
          </div>
          <button onClick={startDemo} className="rounded-xl border border-violet-300/25 px-3 py-2 text-xs font-black text-white" aria-label="Start demo mode">
            Demo
          </button>
          <button onClick={onAbout} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white" aria-label="Open About This Demo">
            About
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
      <nav className="mt-3 grid gap-1">
        {[
          [Home, "Home"],
          [ListMusic, "My Rooms"],
          [Search, "Search"],
          [MessageCircle, "Messages"],
          [Users, "Profile"]
        ].map(([Icon, label], index) => (
          <button key={String(label)} onClick={() => index > 0 && addToast(`${label} is a portfolio demo placeholder.`)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${index === 1 ? "bg-white/10 text-white" : "text-slate-300 hover:bg-white/10 hover:text-white"}`} aria-label={String(label)}>
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
              <p className="truncate text-sm font-bold">alex</p>
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
  const toggleRepeat = useJamStore((state) => state.toggleRepeat);
  const toggleShuffle = useJamStore((state) => state.toggleShuffle);
  const addReaction = useJamStore((state) => state.addReaction);
  const reactions = useJamStore((state) => state.reactions);
  const current = queue.find((song) => song.queueId === currentSongId) ?? queue[0];
  const elapsed = current ? Math.round((current.duration * progress) / 100) : 0;

  return (
    <section className="glass relative overflow-hidden rounded-3xl p-4 sm:p-6">
      <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(168,85,247,0.16),transparent)]" />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(220px,0.72fr)_1fr] xl:grid-cols-1">
        <AlbumArt song={current} large />
        <div className="min-w-0 self-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-green-300/20 bg-green-300/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-green-100">
            <Mic2 size={15} /> Now playing
          </p>
          <h2 className="truncate text-3xl font-black sm:text-4xl">{current?.title ?? "Queue is empty"}</h2>
          <p className="mt-2 truncate text-lg text-slate-300">{current ? `${current.artist} • ${current.album}` : "Add a song to start listening together."}</p>
          <p className="mt-1 text-sm text-slate-500">Simulated synced playback</p>
          <div className="mt-6">
            <input aria-label="Playback progress" type="range" min="0" max="100" value={progress} onChange={(event) => setProgress(Number(event.target.value))} className="range w-full" />
            <div className="mt-2 flex justify-between text-xs text-slate-400">
              <span>{formatTime(elapsed)}</span>
              <span>{formatTime(current?.duration ?? 0)}</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <IconButton active={shuffle} label="Shuffle queue" onClick={toggleShuffle}>
              <Shuffle size={20} />
            </IconButton>
            <button onClick={togglePlay} className="grid h-14 w-14 place-items-center rounded-full bg-white text-slate-950 shadow-xl shadow-violet-950/40 transition hover:scale-105" aria-label={isPlaying ? "Pause" : "Play"}>
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
            <IconButton label="Skip song" onClick={skipSong}>
              <SkipForward size={20} />
            </IconButton>
            <IconButton active={repeat} label="Repeat" onClick={toggleRepeat}>
              <Repeat2 size={20} />
            </IconButton>
            <div className="ml-0 flex min-w-[170px] items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 sm:ml-3">
              <Volume2 size={18} className="text-slate-300" />
              <input aria-label="Volume" type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="range w-full" />
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {["🔥", "💜", "✨", "🙌", "⚡"].map((emoji) => (
              <button key={emoji} onClick={() => addReaction(emoji)} className="h-12 min-w-12 rounded-xl border border-white/10 bg-white/[0.06] px-3 text-xl shadow-sm transition hover:scale-105 hover:bg-white/10" aria-label={`React ${emoji}`}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute right-8 top-8 flex gap-2">
        {reactions.slice(-4).map((emoji, index) => (
          <span key={`${emoji}-${index}`} className="animate-bounce rounded-full bg-white/10 px-3 py-2 text-2xl shadow-lg">
            {emoji}
          </span>
        ))}
      </div>
    </section>
  );
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
    <section className="panel rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black">Queue</h2>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-black">{queue.length}</span>
          </div>
          <p className="text-sm text-slate-400">Upcoming tracks auto-sort by vote count.</p>
        </div>
        <ListMusic className="text-violet-200" />
      </div>
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <label className="relative block">
          <span className="sr-only">Search music or paste link</span>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search songs or paste Spotify, Apple, YouTube, SoundCloud URL" className="w-full rounded-xl border border-white/10 bg-white/[0.06] py-3 pl-10 pr-3 text-sm text-white placeholder:text-slate-500" />
        </label>
        <button onClick={() => result && addSong(result)} disabled={!result} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-45">
          <Plus size={17} /> Add Song
        </button>
      </div>
      {query && (
        <div className={`mb-4 rounded-xl border p-3 text-sm ${result ? "border-cyan-300/15 bg-cyan-300/8 text-cyan-50" : "border-amber-300/20 bg-amber-300/10 text-amber-50"}`}>
          {result ? (
            <span>
              Demo match: <b>{result.title}</b> by {result.artist}. Link matching is simulated for portfolio review.
            </span>
          ) : (
            invalidMusicLink(query)
              ? "That link does not look like a supported demo music URL. Try a Spotify, Apple Music, YouTube, SoundCloud-style link, or search Aurora, Neon, or Glimmer."
              : "No demo result found. Try Aurora, Neon, Glimmer, or paste a music-style link."
          )}
        </div>
      )}
      <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1">
        {queue.length === 0 && <EmptyState icon={<ListMusic />} title="No songs yet" text="Search the mock library or paste a demo link to add the first track." />}
        {queue.map((song, index) => (
          <div key={song.queueId} className={`grid grid-cols-[1.25rem_3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border p-2 ${song.queueId === currentSongId ? "border-violet-300/35 bg-white/[0.075]" : "border-white/10 bg-white/[0.025]"}`}>
            <span className="text-center text-xs text-slate-500">{index + 1}</span>
            <AlbumArt song={song} />
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate font-bold">{song.title}</p>
                {index === 0 && <span className="shrink-0 rounded-full bg-green-300/15 px-2 py-0.5 text-xs text-green-100">Now</span>}
                {!song.approved && <span className="shrink-0 rounded-full border border-amber-200/25 bg-amber-300/10 px-2 py-0.5 text-xs text-amber-100">Awaiting approval</span>}
              </div>
              <p className="truncate text-sm text-slate-400">
                {song.artist} • {formatTime(song.duration)} • added by {song.addedBy === "you" ? "You" : userName(song.addedBy)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => voteSong(song.queueId, 1)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label={`Upvote ${song.title}`}>
                <ChevronUp size={17} />
              </button>
              <span className="w-7 text-center text-sm font-black">{song.votes}</span>
              <button onClick={() => voteSong(song.queueId, -1)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label={`Downvote ${song.title}`}>
                <ChevronDown size={17} />
              </button>
              {canManage && (
                <>
                  {!song.approved && (
                    <button onClick={() => approveSong(song.queueId)} className="rounded-lg border border-green-200/20 px-2 py-2 text-xs font-bold text-green-100 hover:bg-green-400/15" aria-label={`Approve ${song.title}`}>
                      Approve
                    </button>
                  )}
                  <button onClick={() => moveSong(song.queueId, -1)} disabled={index <= 1} className="hidden rounded-lg p-2 text-slate-300 hover:bg-white/10 disabled:opacity-35 sm:block" aria-label={`Move ${song.title} up`}>
                    <SlidersHorizontal size={16} />
                  </button>
                  <button onClick={() => removeSong(song.queueId)} className="rounded-lg p-2 text-rose-200 hover:bg-rose-400/15" aria-label={`Remove ${song.title}`}>
                    <Trash2 size={16} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function PeoplePanel() {
  const users = useJamStore((state) => state.users);
  const viewMode = useJamStore((state) => state.viewMode);
  const removeUser = useJamStore((state) => state.removeUser);
  const addToast = useJamStore((state) => state.addToast);

  return (
    <section className="panel rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black">People</h2>
          <p className="text-sm text-slate-400">{users.filter((user) => user.listening).length} currently listening</p>
        </div>
        <button onClick={() => addToast("Invite link copied")} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-bold hover:bg-white/10">
          Invite Friends
        </button>
      </div>
      <div className="grid gap-2">
        {users.length === 0 && <EmptyState icon={<Users />} title="No one is in the room yet" text="Invite friends or start Demo Mode to see the room feel alive." />}
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-3 rounded-xl border border-white/8 bg-transparent p-2.5 transition hover:bg-white/[0.04]">
            <Avatar user={user} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-bold">{user.name}</p>
                {user.role === "host" ? <span className="rounded-full bg-violet-300/15 px-2 py-0.5 text-xs text-violet-100">Host</span> : <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs text-slate-300">Guest</span>}
              </div>
              <p className="text-sm text-slate-400">{user.online ? "Online" : "Away"} {user.listening ? "• listening" : ""}</p>
            </div>
            <span className={`h-2.5 w-2.5 rounded-full ${user.online ? "bg-green-300" : "bg-slate-600"}`} />
            {viewMode === "host" && user.role !== "host" && (
              <button onClick={() => removeUser(user.id)} className="rounded-lg p-2 text-slate-300 hover:bg-white/10" aria-label={`Remove ${user.name}`}>
                <UserMinus size={16} />
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function ChatPanel() {
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
    <section className="panel rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-black">Live chat</h2>
        <MessageCircle className="text-fuchsia-200" />
      </div>
      <div className="grid max-h-[420px] gap-3 overflow-y-auto pr-1">
        {chat.length === 0 && <EmptyState icon={<MessageCircle />} title="Chat is quiet" text="Send the first message or start Demo Mode to load a realistic conversation." />}
        {chat.map((messageItem) => {
          const user = users.find((item) => item.id === messageItem.userId);
          const isYou = messageItem.userId === "you";
          return (
            <div key={messageItem.id} className={`flex gap-3 ${isYou ? "justify-end" : ""} ${messageItem.system ? "rounded-xl bg-white/[0.035] p-3 text-sm text-slate-300" : ""}`}>
              {!messageItem.system && user && <Avatar user={user} small />}
              <div className={`min-w-0 ${!messageItem.system ? `max-w-[82%] rounded-2xl px-3 py-2 ${isYou ? "bg-violet-500/35 text-white" : "bg-white/[0.06]"}` : ""}`}>
                {!messageItem.system && (
                  <p className="text-sm font-bold">
                    {user?.name ?? "Guest"} <span className="font-normal text-slate-500">{messageItem.time}</span>
                  </p>
                )}
                <p className="break-words text-sm">{messageItem.text}</p>
                {messageItem.reactions.length > 0 && <p className="mt-1 text-sm">{messageItem.reactions.join(" ")}</p>}
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <label className="sr-only" htmlFor="chat-message">
          Message
        </label>
        <input id="chat-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Send a message..." className="min-w-0 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white placeholder:text-slate-500" />
        <button className="grid h-12 w-12 place-items-center rounded-xl bg-white text-slate-950" aria-label="Send message">
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
  const currentSongId = useJamStore((state) => state.currentSongId);
  const progress = useJamStore((state) => state.progress);
  const volume = useJamStore((state) => state.volume);
  const isPlaying = useJamStore((state) => state.isPlaying);
  const togglePlay = useJamStore((state) => state.togglePlay);
  const skipSong = useJamStore((state) => state.skipSong);
  const clearQueue = useJamStore((state) => state.clearQueue);
  const shuffleQueue = useJamStore((state) => state.shuffleQueue);
  const toggleSetting = useJamStore((state) => state.toggleSetting);
  const setVolume = useJamStore((state) => state.setVolume);
  const endRoom = useJamStore((state) => state.endRoom);
  const addToast = useJamStore((state) => state.addToast);
  const current = queue.find((song) => song.queueId === currentSongId);

  if (viewMode !== "host") {
    return (
      <section className="panel rounded-2xl p-4">
        <h2 className="text-xl font-black">Guest view</h2>
        <p className="mt-2 text-sm text-slate-300">Host-only controls are hidden. Guests can chat, react, vote, and add songs when permissions allow.</p>
        <button onClick={() => useJamStore.getState().addToast("Host controls are only available in Host View.")} className="mt-4 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold text-white hover:bg-white/10">
          Try a host-only action
        </button>
      </section>
    );
  }

  return (
    <section className="panel rounded-2xl p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gauge className="text-cyan-200" />
          <h2 className="text-xl font-black">Host dashboard</h2>
        </div>
        <span className="rounded-full bg-violet-400/20 px-3 py-1 text-xs font-black text-violet-100">Host</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.05fr_0.85fr_1.1fr]">
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm font-bold text-slate-300">Playback</p>
          <div className="mt-4 flex items-center gap-3">
            <AlbumArt song={current} />
            <div className="min-w-0">
              <p className="truncate font-black">{current?.title ?? "Nothing playing"}</p>
              <p className="truncate text-sm text-slate-400">{current?.artist ?? "Add a song to begin"}</p>
            </div>
          </div>
          <input aria-label="Host playback progress" value={progress} readOnly type="range" min="0" max="100" className="range mt-4 w-full" />
          <div className="mt-4 flex items-center justify-center gap-3">
            <IconButton label={isPlaying ? "Pause playback" : "Play playback"} onClick={togglePlay}>{isPlaying ? <Pause size={18} /> : <Play size={18} />}</IconButton>
            <IconButton label="Skip song" onClick={skipSong}><SkipForward size={18} /></IconButton>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm font-bold text-slate-300">Controls</p>
          <div className="mt-4 grid gap-2">
            <button onClick={togglePlay} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold hover:bg-white/10">{isPlaying ? <Pause size={15} /> : <Play size={15} />} {isPlaying ? "Pause playback" : "Play playback"}</button>
            <button onClick={skipSong} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold hover:bg-white/10"><SkipForward size={15} /> Skip song</button>
            <button onClick={clearQueue} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold hover:bg-white/10"><Trash2 size={15} /> Clear queue</button>
            <button onClick={shuffleQueue} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold hover:bg-white/10"><Shuffle size={15} /> Shuffle queue</button>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <p className="text-sm font-bold text-slate-300">Room info</p>
          <div className="mt-4 grid gap-3">
            <div>
              <p className="text-xs text-slate-500">Room code</p>
              <button onClick={() => copyText(room?.code ?? "", addToast, "Room code copied")} className="mt-1 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-left font-black tracking-[0.18em]">
                {room?.code}<Copy size={15} className="tracking-normal text-slate-400" />
              </button>
            </div>
            <div>
              <p className="text-xs text-slate-500">Invite link</p>
              <button onClick={() => copyText(`${PROJECT_LINKS.app.replace(/\/$/, "")}?room=${room?.code ?? ""}`, addToast, "Invitation copied")} className="mt-1 flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-left text-xs text-slate-300">
                jamroom.app/{room?.code}<Copy size={15} className="text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1fr]">
        <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
          <span className="font-bold text-white">Volume</span>
          <span className="w-24"><input aria-label="Host volume control" value={volume} onChange={(event) => setVolume(Number(event.target.value))} type="range" min="0" max="100" className="range w-full" /></span>
        </label>
        <Toggle label="Guests can add songs" checked={Boolean(room?.guestsCanAdd)} onChange={() => toggleSetting("guestsCanAdd")} />
        <Toggle label="Require song approval" checked={Boolean(room?.requireApproval)} onChange={() => toggleSetting("requireApproval")} />
        <button onClick={endRoom} className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-400/10 px-4 py-3 font-bold text-rose-100 hover:bg-rose-400/15">
          <LogOut size={17} /> End Room
        </button>
      </div>
    </section>
  );
}

function CompactPlayer() {
  const queue = useJamStore((state) => state.queue);
  const currentSongId = useJamStore((state) => state.currentSongId);
  const isPlaying = useJamStore((state) => state.isPlaying);
  const togglePlay = useJamStore((state) => state.togglePlay);
  const current = queue.find((song) => song.queueId === currentSongId) ?? queue[0];

  return (
    <div className="glass fixed inset-x-3 bottom-[4.75rem] z-30 flex items-center gap-3 rounded-2xl p-2 lg:hidden">
      <AlbumArt song={current} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black">{current?.title}</p>
        <p className="truncate text-xs text-slate-400">{current?.artist}</p>
      </div>
      <button onClick={togglePlay} className="grid h-10 w-10 place-items-center rounded-full bg-white text-slate-950" aria-label={isPlaying ? "Pause" : "Play"}>
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
  const addReaction = useJamStore((state) => state.addReaction);
  const addSong = useJamStore((state) => state.addSong);
  const voteSong = useJamStore((state) => state.voteSong);
  const queue = useJamStore((state) => state.queue);

  useEffect(() => {
    if (screen !== "room" || !isPlaying) return;
    const timer = window.setInterval(() => {
      const next = progress + 1;
      if (next >= 100) skipSong();
      else setProgress(next);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [screen, isPlaying, progress, setProgress, skipSong]);

  useEffect(() => {
    if (screen !== "room" || room?.code !== "JAM247") return;
    const timer = window.setInterval(() => {
      const action = Math.random();
      if (action < 0.5) addReaction(["🔥", "💜", "✨", "🙌"][Math.floor(Math.random() * 4)]);
      else if (action < 0.76) voteSong(queue[Math.max(1, Math.floor(Math.random() * queue.length))]?.queueId ?? "", 1);
      else addSong(library[Math.floor(Math.random() * library.length)], guestAdderIds[Math.floor(Math.random() * guestAdderIds.length)]);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [screen, room?.code, addReaction, addSong, voteSong, queue]);
}

function DemoIntroDialog({ onClose }: { onClose: () => void }) {
  const [hideAgain, setHideAgain] = useState(false);

  return (
    <Modal title="Welcome to JamRoom" onClose={onClose}>
      <p className="text-sm leading-6 text-slate-300">
        JamRoom is a real-time-style social listening demo where friends share a room, shape the queue, react, and chat while the player stays in sync.
      </p>
      <p className="mt-3 rounded-xl border border-amber-200/20 bg-amber-300/10 p-3 text-sm text-amber-50">
        Music playback and service integrations are simulated for this portfolio version. No Spotify, Apple Music, YouTube, or SoundCloud account is required.
      </p>
      <div className="mt-5 grid gap-2 text-sm text-slate-200">
        {["Switch between Host and Guest", "Add and vote on songs", "Send messages and reactions"].map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-xl bg-white/[0.045] p-3">
            <Sparkles size={16} className="shrink-0 text-cyan-200" />
            {item}
          </div>
        ))}
      </div>
      <label className="mt-5 flex items-center gap-3 text-sm text-slate-300">
        <input type="checkbox" checked={hideAgain} onChange={(event) => setHideAgain(event.target.checked)} className="h-5 w-5 accent-violet-400" />
        Do not show again
      </label>
      <button
        onClick={() => {
          if (hideAgain) window.localStorage.setItem(DEMO_INTRO_STORAGE_KEY, "true");
          onClose();
        }}
        className="mt-5 w-full rounded-xl bg-white px-5 py-3 font-black text-slate-950 hover:scale-[1.01]"
      >
        Start Exploring
      </button>
    </Modal>
  );
}

function AboutDemoDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="About This Demo" onClose={onClose}>
      <div className="grid gap-4 text-sm text-slate-300">
        <InfoBlock title="Project">JamRoom</InfoBlock>
        <InfoBlock title="Description">A real-time-style social music room portfolio demonstration.</InfoBlock>
        <InfoBlock title="Technologies">Next.js App Router, TypeScript, Tailwind CSS, Zustand, localStorage, Lucide icons.</InfoBlock>
        <InfoBlock title="Major Features">Create/join room flows, Demo Mode, Host/Guest views, shared queue voting, simulated playback, participants, chat, reactions, and host controls.</InfoBlock>
        <InfoBlock title="Simulated">Music streaming, universal music-link matching, realtime presence, chat delivery, queue synchronization, and invite links.</InfoBlock>
        <InfoBlock title="Production Needs">Provider OAuth, licensed playback APIs, realtime backend, durable database, moderation, auth, analytics, deployment secrets, and provider compliance review.</InfoBlock>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <a href={PROJECT_LINKS.github} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 font-bold text-white hover:bg-white/10">
          <Github size={17} /> View Source on GitHub
        </a>
        <a href={PROJECT_LINKS.portfolio} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-bold text-slate-950">
          <Home size={17} /> Back to Portfolio
        </a>
      </div>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/78 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="glass max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl p-5 shadow-2xl sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-2xl font-black">{title}</h2>
          <button ref={closeRef} onClick={onClose} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-slate-200 hover:bg-white/10" aria-label="Close dialog">
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
      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-cyan-300 font-black text-white shadow-lg shadow-violet-950/50">
        JR
      </div>
      {!compact && (
        <div>
          <p className="text-lg font-black leading-none">JamRoom</p>
          <p className="text-xs text-slate-400">Social listening</p>
        </div>
      )}
    </div>
  );
}

function AlbumArt({ song, large = false }: { song?: Pick<Song, "title" | "cover">; large?: boolean }) {
  const cover = song?.cover ?? ["#334155", "#111827", "#020617"];
  return (
    <div
      className={`artwork grid shrink-0 place-items-center rounded-2xl ${large ? "aspect-square w-full min-w-0" : "h-14 w-14"}`}
      style={{ "--from": cover[0], "--via": cover[1], "--to": cover[2] } as React.CSSProperties}
      aria-label={song ? `${song.title} album artwork` : "Album artwork placeholder"}
    >
      <span className={`${large ? "text-6xl" : "text-lg"} font-black text-white/85`}>{song?.title?.slice(0, 1) ?? "J"}</span>
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
        <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-400 to-cyan-300" />
      </div>
    </div>
  );
}

function LandingDeviceShowcase() {
  return (
    <div className="relative min-h-[34rem] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/45 p-5 shadow-2xl shadow-black/40">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(168,85,247,0.26),transparent_20rem)]" />
      <div className="relative grid h-full items-center gap-5 md:grid-cols-[0.82fr_1fr]">
        <div className="phone-frame mx-auto w-full max-w-[17rem]">
          <div className="flex items-center justify-between text-xs text-white">
            <span>9:41</span>
            <span>5G</span>
          </div>
          <div className="mt-10 grid place-items-center text-center">
            <div className="artwork mb-7 grid h-32 w-32 place-items-center rounded-[2rem]" style={{ "--from": "#7c3aed", "--via": "#d946ef", "--to": "#22d3ee" } as React.CSSProperties}>
              <ListMusic size={54} className="text-white drop-shadow-xl" />
            </div>
            <h3 className="text-3xl font-black">
              Jam<span className="text-violet-300">Room</span>
            </h3>
            <p className="mt-3 max-w-[12rem] text-sm leading-6 text-slate-300">One room. Everyone&apos;s music. Listen together.</p>
          </div>
          <div className="mt-10 grid gap-3">
            <div className="rounded-xl bg-[linear-gradient(135deg,#7c3aed,#a855f7)] px-4 py-3 text-center text-sm font-black">Create a Room</div>
            <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-center text-sm font-bold">Join a Room</div>
          </div>
        </div>
        <div className="glass rounded-[1.75rem] p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.18em] text-violet-200">Weekend Vibes</p>
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
      <div className="artwork mb-6 grid h-28 place-items-center rounded-2xl" style={{ "--from": "#2e1065", "--via": "#7c3aed", "--to": "#111827" } as React.CSSProperties}>
        <Users size={46} className="text-violet-100" />
      </div>
      <div className="grid gap-3 text-sm text-slate-200">
        {["Real-time synced playback", "Shared queue", "Reactions and chat", "Host controls", "Invite anyone"].map((feature) => (
          <p key={feature} className="flex items-center gap-3">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300" />
            {feature}
          </p>
        ))}
      </div>
      <p className="mt-8 text-2xl font-black leading-tight text-violet-300">
        One room.<br />Everyone&apos;s music.<br />Listen together.
      </p>
    </section>
  );
}

function MiniSong({ song, votes }: { song: Song; votes: number }) {
  return (
    <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
      <AlbumArt song={song} />
      <div className="min-w-0">
        <p className="truncate font-bold">{song.title}</p>
        <p className="truncate text-sm text-slate-400">{song.artist}</p>
      </div>
      <span className="rounded-full bg-white/10 px-2 py-1 text-sm font-black">+{votes}</span>
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
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
      <span className="font-bold text-white">{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 accent-violet-400" />
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

function IconButton({ children, label, onClick, active = false }: { children: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button onClick={onClick} className={`grid h-11 w-11 place-items-center rounded-xl border border-white/10 transition hover:bg-white/10 ${active ? "bg-violet-400/20 text-violet-100" : "text-slate-200"}`} aria-label={label} title={label}>
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
  const isUrl = /spotify|apple|youtube|youtu\.be|soundcloud|https?:\/\//.test(trimmed);
  if (isUrl) return library[Math.abs(hash(trimmed)) % library.length];
  return library.find((song) => `${song.title} ${song.artist} ${song.album}`.toLowerCase().includes(trimmed)) ?? null;
}

function invalidMusicLink(query: string) {
  const trimmed = query.trim().toLowerCase();
  return /^https?:\/\//.test(trimmed) && !/spotify|apple|music\.apple|youtube|youtu\.be|soundcloud/.test(trimmed);
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
