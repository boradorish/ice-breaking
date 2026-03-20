import { GameState, GroupState, KeywordState, Round } from "./types";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function initializeRound(
  state: GameState,
  roundNumber: number
): GameState {
  const config = state.roundConfigs.find((r) => r.round === roundNumber);
  if (!config) throw new Error(`Round ${roundNumber} not configured`);

  const groups: GroupState[] = config.groups.map((groupConfig) => {
    const participants = groupConfig.participantIds
      .map((id) => state.participants.find((p) => p.id === id))
      .filter(Boolean) as NonNullable<(typeof state.participants)[number]>[];

    const keywords: KeywordState[] = shuffle(
      participants.flatMap((p) =>
        p.keywords.map((word) => ({
          word,
          ownerId: p.id,
          guessCount: 0,
          correctlyGuessed: false,
          deactivated: false,
        }))
      )
    );

    return {
      id: groupConfig.id,
      participantIds: groupConfig.participantIds,
      turnOrder: shuffle([...groupConfig.participantIds]),
      currentTurnIndex: 0,
      keywords,
      finished: false,
    };
  });

  const newRound: Round = { round: roundNumber, groups };

  return {
    ...state,
    status: "playing",
    currentRound: roundNumber,
    rounds: [
      ...state.rounds.filter((r) => r.round !== roundNumber),
      newRound,
    ],
  };
}

export function processGuess(
  state: GameState,
  guesserParticipantId: string,
  keyword: string,
  guessedParticipantId: string
): { newState: GameState; correct: boolean } {
  const currentRound = state.rounds.find((r) => r.round === state.currentRound);
  if (!currentRound) throw new Error("No current round");

  const groupIndex = currentRound.groups.findIndex((g) =>
    g.participantIds.includes(guesserParticipantId)
  );
  if (groupIndex === -1) throw new Error("Guesser not in any group");

  const group = currentRound.groups[groupIndex];

  const currentTurnId = group.turnOrder[group.currentTurnIndex];
  if (currentTurnId !== guesserParticipantId) throw new Error("Not your turn");

  const keywordIndex = group.keywords.findIndex(
    (k) => k.word === keyword && !k.deactivated
  );
  if (keywordIndex === -1) throw new Error("Keyword not found or deactivated");

  const keywordState = group.keywords[keywordIndex];
  if (keywordState.ownerId === guesserParticipantId)
    throw new Error("Cannot guess your own keyword");

  const correct = keywordState.ownerId === guessedParticipantId;
  const newGuessCount = keywordState.guessCount + 1;
  const newDeactivated = correct || newGuessCount >= 2;

  const updatedKeywords = [...group.keywords];
  updatedKeywords[keywordIndex] = {
    ...keywordState,
    guessCount: newGuessCount,
    correctlyGuessed: correct,
    deactivated: newDeactivated,
  };

  const updatedParticipants = state.participants.map((p) =>
    p.id === guesserParticipantId && correct
      ? { ...p, score: p.score + 1 }
      : p
  );

  const nextTurnIndex = (group.currentTurnIndex + 1) % group.turnOrder.length;
  const groupFinished = updatedKeywords.every((k) => k.deactivated);

  const guesser = state.participants.find((p) => p.id === guesserParticipantId);
  const guessedP = state.participants.find((p) => p.id === guessedParticipantId);

  const updatedGroup: GroupState = {
    ...group,
    keywords: updatedKeywords,
    currentTurnIndex: nextTurnIndex,
    finished: groupFinished,
    lastGuess: {
      guesser: guesserParticipantId,
      guesserName: guesser?.name ?? "",
      keyword,
      guessedParticipantId,
      guessedParticipantName: guessedP?.name ?? "",
      correct,
      timestamp: Date.now(),
    },
  };

  const updatedGroups = [...currentRound.groups];
  updatedGroups[groupIndex] = updatedGroup;

  const newState: GameState = {
    ...state,
    participants: updatedParticipants,
    rounds: [
      ...state.rounds.filter((r) => r.round !== state.currentRound),
      { ...currentRound, groups: updatedGroups },
    ],
  };

  return { newState, correct };
}
