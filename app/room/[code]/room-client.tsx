"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  Crown,
  ExternalLink,
  Loader2,
  LogOut,
  MessageCircle,
  Music2,
  Pause,
  Play,
  Plus,
  Radio,
  Send,
  Settings2,
  SkipForward,
  Trash2,
  UserMinus,
  Users,
  Volume2,
  Wifi,
  X
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ensureAnonymousUser, getSupabaseBrowserClient, isSupabaseConfigured } from "../../../lib/supabase/client";
import {
  createTrackFromInput,
  formatDuration,
  getLiveRoomUrl,
  initials,
  LIVE_DISPLAY_NAME_KEY,
  type LiveMessage,
  type LiveParticipant,
  type LivePlayerState,
  type LiveQueueItem,
  type LiveRoom,
  type LiveVote,
  normalizeRoomCode
} from "../../../lib/jamroom/live";

type PresenceMeta = {
  user_id: string;
  display_name: string;
  role: "host" | "guest";
  online_at: string;
};

type LoadState = "loading" | "join" | "room" | "ended" | "missing" | "config";

type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  setVolume: (volume: number) => void;
  destroy: () => void;
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
  PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
    jamroomYouTubeApiReady?: Promise<YouTubeApi>;
  }
}

const buttonPrimary = "btn btn-primary";
const buttonSecondary = "btn btn-secondary";
const buttonGhost = "btn btn-ghost";
const buttonIcon = "btn-icon";
const buttonDanger = "btn btn-destructive";
const input = "input-control";

export default function LiveRoomClient({ code }: { code: string }) {
  const roomCode = normalizeRoomCode(code);
  const supabase = getSupabaseBrowserClient();
  const configured = isSupabaseConfigured();
  const [loadState, setLoadState] = useState<LoadState>(configured ? "loading" : "config");
  const [room, setRoom] = useState<LiveRoom | null>(null);
  const [participant, setParticipant] = useState<LiveParticipant | null>(null);
  const [participants, setParticipants] = useState<LiveParticipant[]>([]);
  const [queue, setQueue] = useState<LiveQueueItem[]>([]);
  const [votes, setVotes] = useState<LiveVote[]>([]);
  const [messages, setMessages] = useState<LiveMessage[]>([]);
  const [player, setPlayer] = useState<LivePlayerState | null>(null);
  const [displayName, setDisplayName] = useState(() => (typeof window === "undefined" ? "" : window.localStorage.getItem(LIVE_DISPLAY_NAME_KEY) || ""));
  const [activeMobileTab, setActiveMobileTab] = useState<"player" | "queue" | "people" | "chat">("player");
  const [presence, setPresence] = useState<Record<string, PresenceMeta[]>>({});
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const userIdRef = useRef<string | null>(null);

  const isHost = participant?.role === "host";
  const currentSong = queue.find((item) => item.id === player?.current_queue_item_id) ?? null;
  const hostParticipant = participants.find((person) => person.role === "host");
  const hostOnline = Boolean(hostParticipant && presence[hostParticipant.user_id]?.length);
  const userVoteBySong = useMemo(() => new Map(votes.filter((vote) => vote.user_id === userIdRef.current).map((vote) => [vote.queue_item_id, vote.value])), [votes]);
  const joinUrl = getLiveRoomUrl(roomCode);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast(""), 2400);
  }, []);

  const loadRoom = useCallback(async () => {
    if (!supabase) return;
    const { data, error: roomError } = await supabase.from("rooms").select("*").eq("code", roomCode).maybeSingle();
    if (roomError) {
      setError(roomError.message);
      setLoadState("missing");
      return;
    }
    if (!data) {
      setLoadState("missing");
      return;
    }
    setRoom(data);
    if (!data.is_active) {
      setLoadState("ended");
      return;
    }

    const { data: visibleParticipants } = await supabase.from("participants").select("*").eq("room_id", data.id).order("joined_at", { ascending: true });
    if (visibleParticipants) setParticipants(visibleParticipants);

    const user = await ensureAnonymousUser();
    userIdRef.current = user.id;
    const { data: existingParticipant } = await supabase.from("participants").select("*").eq("room_id", data.id).eq("user_id", user.id).maybeSingle();
    if (existingParticipant) {
      setParticipant(existingParticipant);
      setLoadState("room");
    } else {
      setLoadState("join");
    }
  }, [roomCode, supabase]);

  const refreshSharedState = useCallback(async (roomId: string) => {
    if (!supabase) return;
    const [participantResult, queueResult, voteResult, messageResult, playerResult] = await Promise.all([
      supabase.from("participants").select("*").eq("room_id", roomId).order("joined_at", { ascending: true }),
      supabase.from("queue_items").select("*").eq("room_id", roomId).neq("approval_status", "rejected").order("position", { ascending: true }).order("vote_score", { ascending: false }),
      supabase.from("votes").select("*").eq("room_id", roomId),
      supabase.from("messages").select("*").eq("room_id", roomId).order("created_at", { ascending: true }).limit(80),
      supabase.from("player_state").select("*").eq("room_id", roomId).maybeSingle()
    ]);

    if (participantResult.data) setParticipants(participantResult.data);
    if (queueResult.data) setQueue(queueResult.data);
    if (voteResult.data) setVotes(voteResult.data);
    if (messageResult.data) setMessages(messageResult.data);
    if (playerResult.data) setPlayer(playerResult.data);
  }, [supabase]);

  useEffect(() => {
    if (!configured) return;
    loadRoom();
  }, [configured, loadRoom]);

  useEffect(() => {
    if (!supabase || !room || !participant) return;
    refreshSharedState(room.id);

    const tableChannel = supabase
      .channel(`jamroom-live-db-${room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, (payload) => {
        const nextRoom = payload.new as LiveRoom;
        if (nextRoom?.id) setRoom(nextRoom);
        if (nextRoom && !nextRoom.is_active) setLoadState("ended");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "participants", filter: `room_id=eq.${room.id}` }, () => refreshSharedState(room.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "queue_items", filter: `room_id=eq.${room.id}` }, () => refreshSharedState(room.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${room.id}` }, () => refreshSharedState(room.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `room_id=eq.${room.id}` }, () => refreshSharedState(room.id))
      .on("postgres_changes", { event: "*", schema: "public", table: "player_state", filter: `room_id=eq.${room.id}` }, () => refreshSharedState(room.id))
      .subscribe();

    const presenceChannel = supabase.channel(`jamroom-presence-${room.id}`, {
      config: { presence: { key: participant.user_id } }
    });
    presenceChannel
      .on("presence", { event: "sync" }, () => setPresence(presenceChannel.presenceState<PresenceMeta>()))
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({
            user_id: participant.user_id,
            display_name: participant.display_name,
            role: participant.role,
            online_at: new Date().toISOString()
          });
        }
      });

    return () => {
      supabase.removeChannel(tableChannel);
      supabase.removeChannel(presenceChannel);
    };
  }, [participant, refreshSharedState, room, supabase]);

  async function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !room) return;
    const name = displayName.trim();
    if (name.length < 2) {
      setError("Enter a display name to join.");
      return;
    }

    try {
      setError("");
      const user = await ensureAnonymousUser();
      userIdRef.current = user.id;
      window.localStorage.setItem(LIVE_DISPLAY_NAME_KEY, name);
      const { data, error: joinError } = await supabase
        .from("participants")
        .upsert({ room_id: room.id, user_id: user.id, display_name: name, role: "guest" }, { onConflict: "room_id,user_id" })
        .select("*")
        .single();
      if (joinError) throw joinError;
      await supabase.from("messages").insert({ room_id: room.id, user_id: user.id, display_name: "JamRoom", type: "system", message: `${name} joined the room` });
      setParticipant(data);
      setLoadState("room");
      showToast("Joined Party Mode.");
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : "Could not join this room.");
    }
  }

  async function addSong(raw: string) {
    if (!supabase || !room || !participant) return;
    if (!isHost && !room.guests_can_add) {
      showToast("The host is not accepting guest songs right now.");
      return;
    }

    const song = createTrackFromInput(raw);
    const approval = !isHost && room.require_approval ? "pending" : "approved";
    const nextPosition = queue.length ? Math.max(...queue.map((item) => item.position)) + 1 : 0;
    const { error: addError } = await supabase.from("queue_items").insert({
      room_id: room.id,
      provider: song.provider,
      provider_id: song.providerId,
      external_url: song.externalUrl,
      title: song.title,
      artist: song.artist,
      artwork: song.artwork,
      duration: song.duration,
      added_by: participant.user_id,
      vote_score: 0,
      position: nextPosition,
      approval_status: approval
    });
    if (addError) {
      showToast(addError.message);
      return;
    }
    if (isHost && approval === "approved" && !player?.current_queue_item_id) {
      const { data: firstItem } = await supabase
        .from("queue_items")
        .select("*")
        .eq("room_id", room.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (firstItem) await updatePlayer({ current_queue_item_id: firstItem.id, playback_state: "playing", position_seconds: 0 });
    }
    await supabase.from("messages").insert({ room_id: room.id, user_id: participant.user_id, display_name: "JamRoom", type: "system", message: `${participant.display_name} added ${song.title}` });
    showToast(approval === "pending" ? "Song sent for host approval." : "Song added to the queue.");
  }

  async function voteSong(item: LiveQueueItem, value: 1 | -1) {
    if (!supabase || !participant) return;
    const existing = votes.find((vote) => vote.queue_item_id === item.id && vote.user_id === participant.user_id);
    if (existing?.value === value) {
      await supabase.from("votes").delete().eq("id", existing.id);
      return;
    }
    await supabase.from("votes").upsert({ room_id: item.room_id, queue_item_id: item.id, user_id: participant.user_id, value }, { onConflict: "room_id,queue_item_id,user_id" });
  }

  async function updatePlayer(next: Partial<LivePlayerState>) {
    if (!supabase || !room || !isHost) return;
    await supabase.from("player_state").upsert({ room_id: room.id, ...player, ...next, updated_at: new Date().toISOString() }, { onConflict: "room_id" });
  }

  async function skipSong() {
    if (!room || !isHost) return;
    const approved = queue.filter((item) => item.approval_status === "approved");
    const currentIndex = approved.findIndex((item) => item.id === player?.current_queue_item_id);
    const next = approved[currentIndex + 1] ?? approved[0] ?? null;
    await updatePlayer({ current_queue_item_id: next?.id ?? null, playback_state: next ? "playing" : "paused", position_seconds: 0 });
    if (next && supabase && participant) {
      await supabase.from("messages").insert({ room_id: room.id, user_id: participant.user_id, display_name: "JamRoom", type: "system", message: `${participant.display_name} skipped to ${next.title}` });
    }
  }

  async function removeSong(item: LiveQueueItem) {
    if (!supabase || !isHost) return;
    await supabase.from("queue_items").delete().eq("id", item.id);
    showToast("Song removed.");
  }

  async function approveSong(item: LiveQueueItem) {
    if (!supabase || !isHost) return;
    await supabase.from("queue_items").update({ approval_status: "approved" }).eq("id", item.id);
    showToast("Song approved.");
  }

  async function removeParticipant(target: LiveParticipant) {
    if (!supabase || !isHost || target.role !== "guest") return;
    await supabase.from("participants").delete().eq("id", target.id);
    showToast(`${target.display_name} was removed.`);
  }

  async function updateRoomSettings(next: Partial<Pick<LiveRoom, "guests_can_add" | "require_approval">>) {
    if (!supabase || !room || !isHost) return;
    await supabase.from("rooms").update(next).eq("id", room.id);
  }

  async function clearUpcomingQueue() {
    if (!supabase || !room || !isHost || !window.confirm("Clear all upcoming songs?")) return;
    let query = supabase.from("queue_items").delete().eq("room_id", room.id);
    if (player?.current_queue_item_id) query = query.neq("id", player.current_queue_item_id);
    await query;
    showToast("Upcoming queue cleared.");
  }

  async function moveSong(item: LiveQueueItem, direction: -1 | 1) {
    if (!supabase || !isHost) return;
    const index = queue.findIndex((queueItem) => queueItem.id === item.id);
    const target = queue[index + direction];
    if (!target) return;
    await Promise.all([
      supabase.from("queue_items").update({ position: target.position }).eq("id", item.id),
      supabase.from("queue_items").update({ position: item.position }).eq("id", target.id)
    ]);
  }

  async function playQueueItem(item: LiveQueueItem) {
    if (!isHost || item.approval_status !== "approved") return;
    await updatePlayer({ current_queue_item_id: item.id, playback_state: "playing", position_seconds: 0 });
  }

  async function sendMessage(raw: string) {
    if (!supabase || !room || !participant) return;
    const message = raw.trim();
    if (!message) return;
    await supabase.from("messages").insert({ room_id: room.id, user_id: participant.user_id, display_name: participant.display_name, type: "chat", message });
  }

  async function sendReaction(emoji: string) {
    if (!supabase || !room || !participant) return;
    await supabase.from("messages").insert({ room_id: room.id, user_id: participant.user_id, display_name: participant.display_name, type: "reaction", message: emoji });
  }

  async function endRoom() {
    if (!supabase || !room || !isHost || !window.confirm("End this live room for everyone?")) return;
    await supabase.from("rooms").update({ is_active: false }).eq("id", room.id);
  }

  async function copyInvite() {
    await navigator.clipboard?.writeText(joinUrl);
    showToast("Invite link copied.");
  }

  if (loadState === "config") return <CenteredState title="Supabase setup needed" text="Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY before testing Live Rooms." />;
  if (loadState === "loading") return <CenteredState title="Opening room" text="Checking the live JamRoom code..." loading />;
  if (loadState === "missing") return <CenteredState title="Room not found" text="This room code is invalid, ended, or unavailable." />;
  if (loadState === "ended") return <CenteredState title="Room ended" text="The host closed this Party Mode session." />;
  if (loadState === "join" && room) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-6">
        <form onSubmit={joinRoom} className="glass w-full max-w-md rounded-3xl p-6">
          <Link href="/" className={`${buttonGhost} mb-5 px-0`}><ArrowLeft size={17} /> Back home</Link>
          <p className="badge badge-live mb-3"><Wifi size={14} /> Party Mode</p>
          <h1 className="text-3xl font-black text-white">{room.name}</h1>
          <p className="metadata mt-2">Hosted room `{room.code}` · {participants.length || "Live"} participants</p>
          <label className="mt-6 grid gap-2">
            <span className="font-bold text-white">Display name</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={input} autoFocus maxLength={28} />
          </label>
          {error && <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-50">{error}</p>}
          <button className={`${buttonPrimary} mt-5 w-full`}><Users size={18} /> Join Room</button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden px-3 pb-[7rem] pt-3 sm:px-5 lg:pb-5">
      <div className="mx-auto grid max-w-[96rem] gap-4">
        <header className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3">
          <div className="min-w-0">
            <p className="badge badge-live mb-2"><Wifi size={14} /> Live Party Mode</p>
            <h1 className="room-title truncate">{room?.name}</h1>
            <p className="metadata mt-1 text-sm">{isHost ? "Host device plays audio" : "Guest view: no audio playback on this device"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={copyInvite} className={buttonSecondary}><Copy size={16} /> Invite <span className="font-mono text-xs">{room?.code}</span></button>
            <Link href="/" className={buttonGhost}><LogOut size={16} /> Leave</Link>
          </div>
        </header>

        {!isHost && hostParticipant && !hostOnline && (
          <div className="rounded-2xl border border-amber-200/20 bg-amber-300/10 p-4 text-sm font-bold text-amber-50">
            Waiting for host to reconnect. The queue, chat, and votes are still available.
          </div>
        )}

        <section className="hidden gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_25rem]">
          <div className="grid gap-4">
            <LivePlayer currentSong={currentSong} player={player} isHost={isHost} onPlayPause={() => updatePlayer({ playback_state: player?.playback_state === "playing" ? "paused" : "playing" })} onSkip={skipSong} onSeek={(position) => updatePlayer({ position_seconds: position })} onVolume={(volume) => updatePlayer({ volume })} />
            <LiveQueue queue={queue} votes={userVoteBySong} participants={participants} isHost={isHost} room={room} currentItemId={player?.current_queue_item_id ?? null} onAdd={addSong} onVote={voteSong} onRemove={removeSong} onApprove={approveSong} onMove={moveSong} onPlayItem={playQueueItem} />
          </div>
          <div className="grid content-start gap-4">
            <LivePeople participants={participants} presence={presence} isHost={isHost} onRemove={removeParticipant} />
            <LiveChat messages={messages} participants={participants} onSend={sendMessage} onReaction={sendReaction} />
            {isHost && room && <LiveHostPanel room={room} player={player} onSetting={updateRoomSettings} onClear={clearUpcomingQueue} onEnd={endRoom} />}
          </div>
        </section>

        <section className="lg:hidden">
          {activeMobileTab === "player" && <LivePlayer currentSong={currentSong} player={player} isHost={isHost} onPlayPause={() => updatePlayer({ playback_state: player?.playback_state === "playing" ? "paused" : "playing" })} onSkip={skipSong} onSeek={(position) => updatePlayer({ position_seconds: position })} onVolume={(volume) => updatePlayer({ volume })} />}
          {activeMobileTab === "queue" && <LiveQueue queue={queue} votes={userVoteBySong} participants={participants} isHost={isHost} room={room} currentItemId={player?.current_queue_item_id ?? null} onAdd={addSong} onVote={voteSong} onRemove={removeSong} onApprove={approveSong} onMove={moveSong} onPlayItem={playQueueItem} />}
          {activeMobileTab === "people" && <LivePeople participants={participants} presence={presence} isHost={isHost} onRemove={removeParticipant} />}
          {activeMobileTab === "chat" && <LiveChat messages={messages} participants={participants} onSend={sendMessage} onReaction={sendReaction} />}
          {activeMobileTab !== "player" && <CompactLivePlayer song={currentSong} player={player} onClick={() => setActiveMobileTab("player")} />}
        </section>
      </div>

      <nav className="mobile-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/10 bg-slate-950/94 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden" aria-label="Mobile live room sections">
        {(["player", "queue", "people", "chat"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveMobileTab(tab)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold capitalize ${activeMobileTab === tab ? "bg-white/10 text-white" : "text-slate-400"}`} aria-current={activeMobileTab === tab ? "page" : undefined}>
            {tab === "player" && <Play size={18} />}
            {tab === "queue" && <Music2 size={18} />}
            {tab === "people" && <Users size={18} />}
            {tab === "chat" && <MessageCircle size={18} />}
            {tab}
          </button>
        ))}
      </nav>

      {messages.filter((message) => message.type === "reaction").slice(-3).map((message) => (
        <span key={message.id} className="reaction-pop pointer-events-none fixed bottom-28 left-1/2 z-50 text-4xl">{message.message}</span>
      ))}
      {toast && <div className="glass fixed right-4 top-4 z-50 rounded-lg px-4 py-3 text-sm font-bold text-white">{toast}</div>}
    </main>
  );
}

function LivePlayer({ currentSong, player, isHost, onPlayPause, onSkip, onSeek, onVolume }: { currentSong: LiveQueueItem | null; player: LivePlayerState | null; isHost: boolean; onPlayPause: () => void; onSkip: () => void; onSeek: (seconds: number) => void; onVolume: (volume: number) => void }) {
  const visualProgress = useLiveProgress(player, currentSong?.duration ?? 0);
  const isYouTube = currentSong?.provider === "YouTube" && currentSong.provider_id;

  return (
    <section className="player-shell glass rounded-[1.6rem] p-4 sm:p-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(18rem,0.74fr)_1fr] xl:items-center">
        <div className="desktop-art-wrap">
          {isHost && isYouTube ? <LiveYouTubePlayer videoId={currentSong.provider_id!} player={player} onEnded={onSkip} onProgress={onSeek} /> : <LiveArtwork item={currentSong} large />}
        </div>
        <div className="min-w-0">
          <p className="eyebrow text-violet-100">{isHost ? "Host playback" : "Now playing"}</p>
          <h2 className="mt-3 truncate text-4xl font-black text-white sm:text-5xl">{currentSong?.title ?? "Queue is ready"}</h2>
          <p className="mt-2 truncate text-lg text-slate-300">{currentSong?.artist ?? "Add the first track to start Party Mode"}</p>
          <p className="metadata mt-2 text-sm">{isHost ? "This device controls the speaker." : "Guests see progress without playing audio."}</p>
          <div className="mt-6">
            <input type="range" min={0} max={currentSong?.duration ?? 100} value={visualProgress} disabled={!isHost || !currentSong} onChange={(event) => onSeek(Number(event.target.value))} className="w-full accent-violet-400" aria-label="Playback progress" />
            <div className="mt-2 flex justify-between text-xs font-bold text-slate-400">
              <span>{formatDuration(visualProgress)}</span>
              <span>{formatDuration(currentSong?.duration ?? 0)}</span>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 sm:justify-start">
            <button disabled={!isHost || !currentSong} onClick={onPlayPause} className={`${buttonPrimary} play-toggle h-16 w-16 rounded-full p-0`} aria-label={player?.playback_state === "playing" ? "Pause live room" : "Play live room"}>
              {player?.playback_state === "playing" ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
            </button>
            <button disabled={!isHost || !currentSong} onClick={onSkip} className={buttonSecondary}><SkipForward size={18} /> Skip</button>
            <label className="flex min-w-[12rem] items-center gap-3 text-sm font-bold text-slate-300">
              <Volume2 size={17} />
              <input type="range" min={0} max={100} value={player?.volume ?? 76} disabled={!isHost} onChange={(event) => onVolume(Number(event.target.value))} className="w-full accent-violet-400" aria-label="Host volume" />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}

function LiveQueue({
  queue,
  votes,
  participants,
  isHost,
  room,
  currentItemId,
  onAdd,
  onVote,
  onRemove,
  onApprove,
  onMove,
  onPlayItem
}: {
  queue: LiveQueueItem[];
  votes: Map<string, 1 | -1>;
  participants: LiveParticipant[];
  isHost: boolean;
  room: LiveRoom | null;
  currentItemId: string | null;
  onAdd: (raw: string) => void;
  onVote: (item: LiveQueueItem, value: 1 | -1) => void;
  onRemove: (item: LiveQueueItem) => void;
  onApprove: (item: LiveQueueItem) => void;
  onMove: (item: LiveQueueItem, direction: -1 | 1) => void;
  onPlayItem: (item: LiveQueueItem) => void;
}) {
  const [songInput, setSongInput] = useState("");
  const canAdd = isHost || room?.guests_can_add;

  return (
    <section className="panel rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="section-title">Shared Queue</h2>
          <p className="metadata mt-1 text-sm">{queue.length} tracks · realtime votes</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!songInput.trim()) return;
            onAdd(songInput);
            setSongInput("");
          }}
          className="grid w-full gap-2 sm:w-auto sm:min-w-[24rem] sm:grid-cols-[1fr_auto]"
        >
          <input value={songInput} disabled={!canAdd} onChange={(event) => setSongInput(event.target.value)} className={input} placeholder={canAdd ? "Search or paste YouTube link" : "Host disabled guest song adds"} />
          <button disabled={!canAdd} className={buttonPrimary}><Plus size={17} /> Add</button>
        </form>
      </div>
      <div className="queue-list mt-4 grid gap-2">
        {queue.length === 0 && <EmptyBlock title="No songs yet" text="Add a mock title or paste a YouTube link to start the live queue." />}
        {queue.map((item, index) => {
          const addedBy = participants.find((person) => person.user_id === item.added_by);
          const userVote = votes.get(item.id);
          return (
            <div key={item.id} className={`queue-row grid grid-cols-[auto_3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-white/8 bg-white/[0.04] p-3 ${item.id === currentItemId ? "queue-row-current" : ""} ${item.approval_status === "pending" ? "queue-row-pending" : ""}`}>
              <span className="text-sm font-black text-slate-500">{index + 1}</span>
              <LiveArtwork item={item} />
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <p className="song-title truncate">{item.title}</p>
                  <span className={`badge ${item.provider === "YouTube" ? "badge-youtube" : "badge-neutral"}`}>{item.provider}</span>
                  {item.id === currentItemId && <span className="badge badge-live">Playing</span>}
                  {item.approval_status === "pending" && <span className="badge badge-warning">Pending</span>}
                </div>
                <p className="metadata mt-1 truncate text-sm">{item.artist} · added by {addedBy?.display_name ?? "Guest"} · {formatDuration(item.duration)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => onVote(item, 1)} className={`${buttonIcon} h-10 min-h-10 w-10 ${userVote === 1 ? "bg-green-400/15 text-green-100" : ""}`} aria-label={`Upvote ${item.title}`}>+{item.vote_score}</button>
                {isHost && item.approval_status === "approved" && item.id !== currentItemId && <button onClick={() => onPlayItem(item)} className={buttonIcon} aria-label={`Play ${item.title} now`}><Play size={17} /></button>}
                {isHost && item.approval_status === "pending" && <button onClick={() => onApprove(item)} className={buttonIcon} aria-label={`Approve ${item.title}`}><Check size={17} /></button>}
                {isHost && <button onClick={() => onMove(item, -1)} className={buttonIcon} aria-label={`Move ${item.title} up`}>↑</button>}
                {isHost && <button onClick={() => onMove(item, 1)} className={buttonIcon} aria-label={`Move ${item.title} down`}>↓</button>}
                {isHost && <button onClick={() => onRemove(item)} className={`${buttonIcon} text-rose-100`} aria-label={`Remove ${item.title}`}><Trash2 size={17} /></button>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LivePeople({ participants, presence, isHost, onRemove }: { participants: LiveParticipant[]; presence: Record<string, PresenceMeta[]>; isHost: boolean; onRemove: (participant: LiveParticipant) => void }) {
  return (
    <section className="panel rounded-2xl p-4">
      <h2 className="section-title">People</h2>
      <div className="mt-4 grid gap-2">
        {participants.map((person) => {
          const online = Boolean(presence[person.user_id]?.length);
          return (
            <div key={person.id} className="flex items-center gap-3 rounded-xl bg-white/[0.035] p-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-500/20 font-black text-violet-100">{initials(person.display_name)}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-white">{person.display_name}</p>
                <p className="metadata text-xs">{person.role === "host" ? "Host" : "Guest"} · {online ? "online" : "disconnected"}</p>
              </div>
              {person.role === "host" && <Crown size={17} className="text-violet-100" />}
              {isHost && person.role === "guest" && <button onClick={() => onRemove(person)} className={buttonIcon} aria-label={`Remove ${person.display_name}`}><UserMinus size={16} /></button>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function LiveChat({ messages, participants, onSend, onReaction }: { messages: LiveMessage[]; participants: LiveParticipant[]; onSend: (raw: string) => void; onReaction: (emoji: string) => void }) {
  const [text, setText] = useState("");
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => chatEnd.current?.scrollIntoView({ block: "end" }), [messages.length]);

  return (
    <section className="panel flex max-h-[42rem] min-h-[28rem] flex-col rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <h2 className="section-title">Chat</h2>
        <div className="flex gap-1">
          {["🔥", "💜", "✨"].map((emoji) => <button key={emoji} onClick={() => onReaction(emoji)} className={buttonIcon} aria-label={`Send ${emoji} reaction`}>{emoji}</button>)}
        </div>
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
        {messages.length === 0 && <EmptyBlock title="No messages yet" text="Send the first chat message or reaction." />}
        {messages.map((message) => {
          const author = participants.find((person) => person.user_id === message.user_id);
          if (message.type === "system") return <p key={message.id} className="my-2 rounded-lg bg-white/[0.04] px-3 py-2 text-center text-xs font-bold text-slate-400">{message.message}</p>;
          if (message.type === "reaction") return null;
          return (
            <div key={message.id} className="mb-3 flex gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-black text-white">{initials(author?.display_name ?? message.display_name)}</span>
              <div className="min-w-0 rounded-2xl bg-white/[0.055] px-3 py-2">
                <p className="text-xs font-black text-slate-300">{message.display_name}</p>
                <p className="break-words text-sm leading-6 text-white">{message.message}</p>
              </div>
            </div>
          );
        })}
        <div ref={chatEnd} />
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSend(text);
          setText("");
        }}
        className="chat-composer mt-3 grid grid-cols-[1fr_auto] gap-2"
      >
        <input value={text} onChange={(event) => setText(event.target.value)} className={input} placeholder="Type a message..." />
        <button className={buttonPrimary} aria-label="Send message"><Send size={17} /></button>
      </form>
    </section>
  );
}

function LiveHostPanel({ room, player, onSetting, onClear, onEnd }: { room: LiveRoom; player: LivePlayerState | null; onSetting: (next: Partial<LiveRoom>) => void; onClear: () => void; onEnd: () => void }) {
  return (
    <section className="panel rounded-2xl p-4">
      <h2 className="section-title">Host Dashboard</h2>
      <div className="mt-4 grid gap-2">
        <button onClick={() => onSetting({ guests_can_add: !room.guests_can_add })} className={buttonSecondary}>Guests can add: {room.guests_can_add ? "On" : "Off"}</button>
        <button onClick={() => onSetting({ require_approval: !room.require_approval })} className={buttonSecondary}>Approval: {room.require_approval ? "Required" : "Open"}</button>
        <button onClick={onClear} className={buttonSecondary}><Trash2 size={17} /> Clear upcoming queue</button>
        <p className="metadata text-xs">Playback state: {player?.playback_state ?? "paused"}</p>
        <button onClick={onEnd} className={buttonDanger}><X size={17} /> End Room</button>
      </div>
    </section>
  );
}

function LiveYouTubePlayer({ videoId, player, onEnded, onProgress }: { videoId: string; player: LivePlayerState | null; onEnded: () => void; onProgress: (seconds: number) => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const lastSyncRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then((api) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current?.destroy();
      playerRef.current = new api.Player(mountRef.current, {
        videoId,
        playerVars: { playsinline: 1, modestbranding: 1 },
        events: {
          onReady: ({ target }) => {
            target.setVolume(player?.volume ?? 76);
            if (player?.position_seconds) target.seekTo(player.position_seconds, true);
            if (player?.playback_state === "playing") target.playVideo();
          },
          onStateChange: ({ data, target }) => {
            if (data === api.PlayerState.ENDED) onEnded();
            if (data === api.PlayerState.PLAYING || data === api.PlayerState.PAUSED) {
              const now = Date.now();
              if (now - lastSyncRef.current > 8500) {
                lastSyncRef.current = now;
                onProgress(Math.round(target.getCurrentTime()));
              }
            }
          }
        }
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [onEnded, onProgress, player?.playback_state, player?.position_seconds, player?.volume, videoId]);

  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.setVolume(player?.volume ?? 76);
    if (player?.playback_state === "playing") playerRef.current.playVideo();
    if (player?.playback_state === "paused") playerRef.current.pauseVideo();
  }, [player?.playback_state, player?.volume]);

  return <div ref={mountRef} className="aspect-video w-full overflow-hidden rounded-2xl bg-black" aria-label="Host YouTube player" />;
}

function LiveArtwork({ item, large = false }: { item: LiveQueueItem | null; large?: boolean }) {
  if (item?.artwork) return <img src={item.artwork} alt={`${item.title} artwork`} className={`${large ? "aspect-video" : "h-12 w-12"} rounded-xl object-cover`} />;
  return (
    <div className={`${large ? "aspect-video w-full rounded-2xl" : "h-12 w-12 rounded-xl"} artwork grid place-items-center bg-[linear-gradient(135deg,#7c3aed,#d946ef,#0ea5e9)]`}>
      <Music2 size={large ? 46 : 18} className="text-white" />
    </div>
  );
}

function CompactLivePlayer({ song, player, onClick }: { song: LiveQueueItem | null; player: LivePlayerState | null; onClick: () => void }) {
  return (
    <button onClick={onClick} className="fixed inset-x-3 bottom-[5.2rem] z-30 grid grid-cols-[3rem_1fr_auto] items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/94 p-3 text-left shadow-2xl backdrop-blur">
      <LiveArtwork item={song} />
      <span className="min-w-0">
        <span className="block truncate font-black text-white">{song?.title ?? "No song playing"}</span>
        <span className="metadata block truncate text-xs">{song?.artist ?? "Open Player"}</span>
      </span>
      <span className="badge badge-primary">{player?.playback_state ?? "paused"}</span>
    </button>
  );
}

function EmptyBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.025] p-5 text-center">
      <p className="font-black text-white">{title}</p>
      <p className="metadata mt-1 text-sm">{text}</p>
    </div>
  );
}

function CenteredState({ title, text, loading = false }: { title: string; text: string; loading?: boolean }) {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <div className="glass max-w-md rounded-3xl p-7 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.06] text-violet-100">
          {loading ? <Loader2 className="animate-spin" /> : <Radio />}
        </div>
        <h1 className="mt-5 text-3xl font-black text-white">{title}</h1>
        <p className="body-copy mt-3">{text}</p>
        <Link href="/" className={`${buttonSecondary} mt-6`}><ArrowLeft size={17} /> Back home</Link>
      </div>
    </main>
  );
}

function useLiveProgress(player: LivePlayerState | null, duration: number) {
  const [progress, setProgress] = useState(player?.position_seconds ?? 0);
  useEffect(() => {
    if (!player) return;
    const calculate = () => {
      if (player.playback_state !== "playing") {
        setProgress(player.position_seconds);
        return;
      }
      const elapsed = (Date.now() - new Date(player.updated_at).getTime()) / 1000;
      setProgress(Math.min(duration || 0, Math.round(player.position_seconds + elapsed)));
    };
    calculate();
    const timer = window.setInterval(calculate, 1000);
    return () => window.clearInterval(timer);
  }, [duration, player]);
  return progress;
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
