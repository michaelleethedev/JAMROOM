"use client";

import { ArrowLeft, Copy, Crown, Link2, Loader2, PartyPopper, Play, QrCode, ShieldCheck, Sparkles, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { brand } from "@/lib/brand";
import { ensureAnonymousUser, getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getLiveRoomUrl, isLocalInviteUrl, LIVE_DISPLAY_NAME_KEY, makeLiveRoomCode } from "@/lib/jamroom/live";

type CreatedRoom = {
  id: string;
  code: string;
  name: string;
  joinUrl: string;
};

const buttonPrimary = "btn btn-primary";
const buttonSecondary = "btn btn-secondary";
const input = "input-control";

export default function LiveCreatePage() {
  const [displayName, setDisplayName] = useState(() => (typeof window === "undefined" ? "Alex" : window.localStorage.getItem(LIVE_DISPLAY_NAME_KEY) || "Alex"));
  const [roomName, setRoomName] = useState("Weekend Vibes");
  const [mode, setMode] = useState<"party" | "sync">("party");
  const [guestsCanAdd, setGuestsCanAdd] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<CreatedRoom | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const configured = isSupabaseConfigured();

  const publicUrl = useMemo(() => (createdRoom ? createdRoom.joinUrl : ""), [createdRoom]);

  async function createLiveRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!configured) {
      setError("Supabase is not configured yet. Add the public Supabase URL and anon key to your environment.");
      return;
    }
    if (displayName.trim().length < 2) {
      setError("Add a display name so guests know who is hosting.");
      return;
    }
    if (roomName.trim().length < 2) {
      setError("Name the party before starting it.");
      return;
    }
    if (mode !== "party") {
      setError("Sync Mode is intentionally marked coming soon. Crowd Vote is ready for this phase.");
      return;
    }

    try {
      setStatus("Starting party...");
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      const user = await ensureAnonymousUser();
      window.localStorage.setItem(LIVE_DISPLAY_NAME_KEY, displayName.trim());

      let room: CreatedRoom | null = null;
      for (let attempt = 0; attempt < 5 && !room; attempt += 1) {
        const code = makeLiveRoomCode();
        const { data, error: roomError } = await supabase
          .from("rooms")
          .insert({
            code,
            name: roomName.trim(),
            host_user_id: user.id,
            mode: "party",
            guests_can_add: guestsCanAdd,
            require_approval: requireApproval,
            is_active: true
          })
          .select("id, code, name")
          .single();

        if (roomError) {
          if (roomError.code === "23505") continue;
          throw roomError;
        }

        await supabase.from("participants").insert({
          room_id: data.id,
          user_id: user.id,
          display_name: displayName.trim(),
          role: "host"
        });

        await supabase.from("player_state").insert({
          room_id: data.id,
          current_queue_item_id: null,
          playback_state: "paused",
          position_seconds: 0,
          volume: 76
        });

        await supabase.from("messages").insert({
          room_id: data.id,
          user_id: user.id,
          display_name: brand.productName,
          type: "system",
          message: `${displayName.trim()} started the party`
        });

        room = { ...data, joinUrl: getLiveRoomUrl(data.code) };
      }

      if (!room) throw new Error("Could not generate a unique room code. Try again.");
      setCreatedRoom(room);
      setStatus("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Party creation failed.");
      setStatus("");
    }
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard?.writeText(text);
    setStatus(`${label} copied.`);
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <Link href="/" className={buttonSecondary}>
            <ArrowLeft size={17} /> Back
          </Link>
          <div className="flex items-center gap-2 text-lg font-black text-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-500/20 text-cyan-100">
              <PartyPopper size={20} />
            </span>
            {brand.productName}
          </div>
        </header>

        {!configured && (
          <div className="rounded-2xl border border-amber-200/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
            Supabase environment variables are missing. The UI is ready, but creating a real room needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
          </div>
        )}

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <form onSubmit={createLiveRoom} className="glass grid gap-5 rounded-3xl p-5 sm:p-7">
            <div>
              <p className="badge badge-live mb-3"><Sparkles size={14} /> Real multiplayer</p>
              <h1 className="text-4xl font-black text-white">Start a Party</h1>
              <p className="body-copy mt-3 max-w-2xl">
                Connect the Host device to the speaker. Guests scan in, add songs, vote, and shape what plays next.
              </p>
            </div>

            <label className="grid gap-2">
              <span className="font-bold text-white">Your display name</span>
              <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className={input} maxLength={28} autoComplete="nickname" />
            </label>

            <label className="grid gap-2">
              <span className="font-bold text-white">Party name</span>
              <input value={roomName} onChange={(event) => setRoomName(event.target.value)} className={input} maxLength={36} autoComplete="off" />
            </label>

            <fieldset className="grid gap-2">
              <legend className="font-bold text-white">Queue mode</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" onClick={() => setMode("party")} className={`rounded-xl border p-4 text-left transition ${mode === "party" ? "border-cyan-200/35 bg-blue-500/18" : "border-white/10 bg-white/[0.04] hover:bg-white/10"}`} aria-pressed={mode === "party"}>
                  <span className="flex items-center gap-2 font-black text-white"><Users size={17} /> Crowd Vote</span>
                  <span className="mt-2 block text-sm leading-5 text-slate-400">Host plays audio. Guests add songs and vote what rises.</span>
                </button>
                <button type="button" onClick={() => setMode("sync")} className={`rounded-xl border p-4 text-left transition ${mode === "sync" ? "border-cyan-200/35 bg-cyan-500/12" : "border-white/10 bg-white/[0.04] hover:bg-white/10"}`} aria-pressed={mode === "sync"}>
                  <span className="flex items-center gap-2 font-black text-white"><ShieldCheck size={17} /> Sync Mode</span>
                  <span className="mt-2 block text-sm leading-5 text-slate-400">Coming soon. Cross-device audio sync is intentionally not enabled yet.</span>
                </button>
              </div>
            </fieldset>

            <div className="grid gap-2">
              <label className="surface-subtle flex items-center justify-between gap-4 rounded-xl p-4">
                <span>
                  <span className="block font-black text-white">Guest submissions</span>
                  <span className="text-sm text-slate-400">Friends can paste YouTube links or add track ideas.</span>
                </span>
                <input type="checkbox" checked={guestsCanAdd} onChange={(event) => setGuestsCanAdd(event.target.checked)} className="h-6 w-6 accent-cyan-400" />
              </label>
              <label className="surface-subtle flex items-center justify-between gap-4 rounded-xl p-4">
                <span>
                  <span className="block font-black text-white">Require song approval</span>
                  <span className="text-sm text-slate-400">Guest songs wait for host approval before playing.</span>
                </span>
                <input type="checkbox" checked={requireApproval} onChange={(event) => setRequireApproval(event.target.checked)} className="h-6 w-6 accent-cyan-400" />
              </label>
            </div>

            {error && <p className="rounded-xl border border-rose-300/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-50">{error}</p>}
            {status && <p className="text-sm font-bold text-cyan-100">{status}</p>}

            <button disabled={!configured || Boolean(status)} className={`${buttonPrimary} min-h-14`}>
              {status ? <Loader2 className="animate-spin" size={18} /> : <Crown size={18} />}
              Start Party
            </button>
          </form>

          <aside className="glass rounded-3xl p-5">
            {createdRoom ? (
              <div className="grid gap-4">
                <div>
                  <p className="badge badge-live mb-3">Ready to share</p>
                  <h2 className="text-2xl font-black text-white">{createdRoom.name}</h2>
                  <p className="mt-1 font-mono text-3xl font-black tracking-[0.18em] text-cyan-100">{createdRoom.code}</p>
                </div>
                <div className="grid place-items-center rounded-2xl bg-white p-4">
                  <QRCodeSVG value={publicUrl} size={190} bgColor="#ffffff" fgColor="#050711" />
                </div>
                {isLocalInviteUrl(publicUrl) && (
                  <p className="rounded-xl border border-amber-200/20 bg-amber-300/10 p-3 text-sm leading-6 text-amber-50">
                    This invite uses localhost, which only works on this computer. For phone testing, use the Vercel URL or run Next.js on your LAN with `0.0.0.0`.
                  </p>
                )}
                <button onClick={() => copy(publicUrl, "Invite link")} className={buttonSecondary}>
                  <Link2 size={17} /> Copy link
                </button>
                <button onClick={() => copy(createdRoom.code, "Room code")} className={buttonSecondary}>
                  <Copy size={17} /> Copy code
                </button>
                <Link href={`/room/${createdRoom.code}`} className={buttonPrimary}>
                  <Play size={18} fill="currentColor" /> Open Host View
                </Link>
              </div>
            ) : (
              <div className="grid h-full min-h-[28rem] content-center justify-items-center text-center">
                <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/[0.06] text-cyan-100">
                  <QrCode size={28} />
                </span>
                <h2 className="mt-5 text-2xl font-black text-white">Scan-to-join appears here</h2>
                <p className="body-copy mt-2">After creation, {brand.productName} shows the room code, public join URL, copy actions, and a QR code. No download required.</p>
              </div>
            )}
          </aside>
        </section>
      </div>
    </main>
  );
}
