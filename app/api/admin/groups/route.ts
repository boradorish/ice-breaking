import { NextRequest, NextResponse } from "next/server";
import { updateGameState } from "@/lib/store";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";

export async function POST(req: NextRequest) {
  const { password, roundConfigs } = await req.json();

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!Array.isArray(roundConfigs)) {
    return NextResponse.json({ error: "roundConfigs array required" }, { status: 400 });
  }

  const newState = await updateGameState((state) => ({
    ...state,
    roundConfigs,
  }));

  return NextResponse.json({ ok: true, roundConfigs: newState.roundConfigs });
}
