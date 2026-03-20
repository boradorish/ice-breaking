import { NextRequest, NextResponse } from "next/server";
import { setGameState } from "@/lib/store";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await setGameState({
    status: "setup",
    currentRound: 0,
    participants: [],
    roundConfigs: [],
    rounds: [],
  });

  return NextResponse.json({ ok: true });
}
