import { LobbyContainer } from "@/components/lobby/lobby-container";

type RoomPageProps = {
  params: Promise<{ code: string }>;
};

export default async function RoomPage({ params }: RoomPageProps) {
  const { code } = await params;
  return <LobbyContainer roomCode={code} />;
}
