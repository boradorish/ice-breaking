import { NextRequest, NextResponse } from "next/server";
import { updateGameState } from "@/lib/store";
import { processGuess } from "@/lib/game";

export async function POST(req: NextRequest) {
  const { participantId, keyword, guessedParticipantId } = await req.json();

  if (!participantId || !keyword || !guessedParticipantId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    let correct = false;
    const newState = await updateGameState((state) => {
      const result = processGuess(state, participantId, keyword, guessedParticipantId);
      correct = result.correct;
      return result.newState;
    });

    const currentRound = newState.rounds.find(
      (r) => r.round === newState.currentRound
    );
    const group = currentRound?.groups.find((g) =>
      g.participantIds.includes(participantId)
    );

    return NextResponse.json({ ok: true, correct, lastGuess: group?.lastGuess });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
