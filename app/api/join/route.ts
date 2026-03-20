import { NextRequest, NextResponse } from "next/server";
import { updateGameState } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { participantId } = await req.json();

  if (!participantId) {
    return NextResponse.json({ error: "participantId required" }, { status: 400 });
  }

  const newState = await updateGameState((state) => {
    if (state.status !== "keyword_entry") {
      return state; // Can only join during keyword_entry phase
    }
    const participant = state.participants.find((p) => p.id === participantId);
    if (!participant) {
      return state;
    }
    return {
      ...state,
      participants: state.participants.map((p) =>
        p.id === participantId ? { ...p, joined: true } : p
      ),
    };
  });

  const participant = newState.participants.find((p) => p.id === participantId);
  if (!participant) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, participant });
}
