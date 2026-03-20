import { NextRequest, NextResponse } from "next/server";
import { getGameState } from "@/lib/store";

export async function GET(req: NextRequest) {
  const participantId = req.nextUrl.searchParams.get("participantId");
  const state = await getGameState();

  const participant = participantId
    ? state.participants.find((p) => p.id === participantId)
    : null;

  // Find group for this participant in current round
  const currentRound = state.rounds.find((r) => r.round === state.currentRound);
  const myGroup = currentRound?.groups.find((g) =>
    participantId ? g.participantIds.includes(participantId) : false
  );

  const allJoined = state.participants.length > 0 && state.participants.every((p) => p.joined);
  const allKeywordsSubmitted =
    state.participants.length > 0 &&
    state.participants.every((p) => p.keywords.length === 3);

  // Build keyword list for client — hide owner except for own keywords
  let groupPayload = null;
  if (myGroup) {
    groupPayload = {
      id: myGroup.id,
      participantIds: myGroup.participantIds,
      turnOrder: myGroup.turnOrder.map((id) => {
        const p = state.participants.find((x) => x.id === id);
        return { id, name: p?.name ?? "" };
      }),
      currentTurnIndex: myGroup.currentTurnIndex,
      currentTurnParticipantId: myGroup.turnOrder[myGroup.currentTurnIndex],
      keywords: myGroup.keywords.map((k) => ({
        word: k.word,
        isOwn: k.ownerId === participantId,
        // Only reveal owner if deactivated (guessed or 2+ tries)
        ownerName: k.deactivated
          ? state.participants.find((p) => p.id === k.ownerId)?.name ?? ""
          : "",
        guessCount: k.guessCount,
        correctlyGuessed: k.correctlyGuessed,
        deactivated: k.deactivated,
      })),
      participants: myGroup.participantIds.map((id) => {
        const p = state.participants.find((x) => x.id === id);
        return { id, name: p?.name ?? "", score: p?.score ?? 0 };
      }),
      finished: myGroup.finished,
      lastGuess: myGroup.lastGuess ?? null,
    };
  }

  return NextResponse.json({
    status: state.status,
    currentRound: state.currentRound,
    totalRounds: state.roundConfigs.length,
    participant: participant
      ? {
          id: participant.id,
          name: participant.name,
          keywords: participant.keywords,
          score: participant.score,
          joined: participant.joined,
        }
      : null,
    participants: state.participants.map((p) => ({
      id: p.id,
      name: p.name,
      score: p.score,
      joined: p.joined,
      keywordsSubmitted: p.keywords.length === 3,
    })),
    group: groupPayload,
    allJoined,
    allKeywordsSubmitted,
  });
}
