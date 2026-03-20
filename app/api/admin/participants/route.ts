import { NextRequest, NextResponse } from "next/server";
import { updateGameState } from "@/lib/store";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";

export async function POST(req: NextRequest) {
  const { password, names } = await req.json();

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!Array.isArray(names) || names.length === 0) {
    return NextResponse.json({ error: "Names array required" }, { status: 400 });
  }

  const newState = await updateGameState((state) => {
    const participants = names.map((name: string, i: number) => ({
      id: `p${i + 1}`,
      name: name.trim(),
      keywords: [],
      score: 0,
      joined: false,
    }));

    return {
      ...state,
      participants,
      rounds: [],
    };
  });

  return NextResponse.json({ ok: true, participants: newState.participants });
}
