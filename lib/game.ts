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

    // Validate all assigned participants exist and have submitted keywords
    const missing = groupConfig.participantIds.filter(
      (id) => !state.participants.find((p) => p.id === id)
    );
    if (missing.length > 0) {
      throw new Error(`참여자를 찾을 수 없습니다: ${missing.join(", ")}`);
    }

    const noKeywords = participants.filter((p) => p.keywords.length !== 3);
    if (noKeywords.length > 0) {
      throw new Error(
        `키워드를 입력하지 않은 참여자가 있습니다: ${noKeywords.map((p) => p.name).join(", ")}`
      );
    }

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
  if (!currentRound) throw new Error("진행 중인 라운드가 없습니다");

  const groupIndex = currentRound.groups.findIndex((g) =>
    g.participantIds.includes(guesserParticipantId)
  );
  if (groupIndex === -1) throw new Error("해당 참여자가 조에 배정되지 않았습니다");

  const group = currentRound.groups[groupIndex];

  if (group.finished) throw new Error("이미 완료된 조입니다");

  // Bounds check for turnOrder
  if (group.currentTurnIndex >= group.turnOrder.length) {
    throw new Error("턴 순서 오류");
  }

  const currentTurnId = group.turnOrder[group.currentTurnIndex];
  if (currentTurnId !== guesserParticipantId) throw new Error("지금은 내 차례가 아닙니다");

  // Validate guessedParticipant is in this group (not an outsider)
  if (!group.participantIds.includes(guessedParticipantId)) {
    throw new Error("같은 조의 참여자만 선택할 수 있습니다");
  }

  const keywordIndex = group.keywords.findIndex(
    (k) => k.word === keyword && !k.deactivated
  );
  if (keywordIndex === -1) throw new Error("유효하지 않거나 이미 비활성화된 키워드입니다");

  const keywordState = group.keywords[keywordIndex];
  if (keywordState.ownerId === guesserParticipantId) {
    throw new Error("자신의 키워드는 추리할 수 없습니다");
  }

  // Cannot guess yourself as the owner
  if (guessedParticipantId === guesserParticipantId) {
    throw new Error("자기 자신을 선택할 수 없습니다");
  }

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
