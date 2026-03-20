import { NextRequest, NextResponse } from "next/server";
import { updateGameState } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { participantId, keywords } = await req.json();

  if (!participantId || !Array.isArray(keywords) || keywords.length !== 3) {
    return NextResponse.json(
      { error: "participantId and 3 keywords required" },
      { status: 400 }
    );
  }

  const trimmed = keywords.map((k: string) =>
    typeof k === "string" ? k.trim() : ""
  );

  if (trimmed.some((k) => !k)) {
    return NextResponse.json({ error: "키워드를 모두 입력해주세요" }, { status: 400 });
  }

  // Prevent duplicate keywords
  if (new Set(trimmed.map((k) => k.toLowerCase())).size !== 3) {
    return NextResponse.json({ error: "키워드가 중복됩니다" }, { status: 400 });
  }

  try {
    const newState = await updateGameState((state) => {
      if (state.status !== "keyword_entry") {
        throw new Error("키워드 입력 단계가 아닙니다");
      }
      const participant = state.participants.find((p) => p.id === participantId);
      if (!participant) throw new Error("참여자를 찾을 수 없습니다");

      return {
        ...state,
        participants: state.participants.map((p) =>
          p.id === participantId ? { ...p, keywords: trimmed, joined: true } : p
        ),
      };
    });

    return NextResponse.json({
      ok: true,
      participant: newState.participants.find((p) => p.id === participantId),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
