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

  const trimmed = keywords.map((k: string) => k.trim());
  if (trimmed.some((k) => !k)) {
    return NextResponse.json({ error: "Keywords cannot be empty" }, { status: 400 });
  }

  const newState = await updateGameState((state) => {
    if (state.status !== "keyword_entry") {
      throw new Error("Not in keyword entry phase");
    }
    const participant = state.participants.find((p) => p.id === participantId);
    if (!participant) throw new Error("Participant not found");

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
}
