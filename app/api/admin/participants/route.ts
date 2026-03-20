import { NextRequest, NextResponse } from "next/server";
import { updateGameState } from "@/lib/store";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";

export async function POST(req: NextRequest) {
  const { password, names } = await req.json();

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!Array.isArray(names)) {
    return NextResponse.json({ error: "Names array required" }, { status: 400 });
  }

  const cleanNames: string[] = names
    .map((n: unknown) => (typeof n === "string" ? n.trim() : ""))
    .filter((n) => n.length > 0);

  if (cleanNames.length === 0) {
    return NextResponse.json({ error: "최소 1명 이상 입력해주세요" }, { status: 400 });
  }

  // Check for duplicate names
  const uniqueNames = new Set(cleanNames.map((n) => n.toLowerCase()));
  if (uniqueNames.size !== cleanNames.length) {
    return NextResponse.json({ error: "중복된 이름이 있습니다" }, { status: 400 });
  }

  const newState = await updateGameState((state) => {
    if (state.status !== "setup") {
      throw new Error("게임이 이미 시작되어 참여자 목록을 변경할 수 없습니다");
    }

    const participants = cleanNames.map((name, i) => {
      const existing = state.participants.find(
        (p) => p.name.toLowerCase() === name.toLowerCase()
      );
      return existing
        ? { ...existing, id: `p${i + 1}` }
        : { id: `p${i + 1}`, name, keywords: [], score: 0, joined: false };
    });

    return { ...state, participants, rounds: [] };
  });

  return NextResponse.json({ ok: true, participants: newState.participants });
}
