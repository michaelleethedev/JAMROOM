import LiveRoomClient from "./room-client";

export default async function LiveRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <LiveRoomClient code={code} />;
}
