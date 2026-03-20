import { NextRequest, NextResponse } from "next/server";
import { updateGameState } from "@/lib/store";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";

export async function POST(req: NextRequest) {
  const { password, scores } = await req.json();

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // scores: { [participantId]: number }
  if (!scores || typeof scores !== "object") {
    return NextResponse.json({ error: "scores object required" }, { status: 400 });
  }

  const newState = await updateGameState((state) => {
    if (state.status === "playing" || state.status === "finished") {
      throw new Error("게임 진행 중에는 초기 점수를 변경할 수 없습니다");
    }

    return {
      ...state,
      participants: state.participants.map((p) => {
        const val = scores[p.id];
        if (val === undefined) return p;
        const n = Number(val);
        if (!Number.isInteger(n) || n < 0) return p;
        return { ...p, score: n };
      }),
    };
  });

  return NextResponse.json({ ok: true, participants: newState.participants });
}
