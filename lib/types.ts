export interface Participant {
  id: string;
  name: string;
  keywords: string[];
  score: number;
  joined: boolean;
}

export interface KeywordState {
  word: string;
  ownerId: string;
  guessCount: number;
  correctlyGuessed: boolean;
  deactivated: boolean;
}

export interface GuessResult {
  guesser: string;      // participantId
  guesserName: string;
  keyword: string;
  guessedParticipantId: string;
  guessedParticipantName: string;
  correct: boolean;
  timestamp: number;
}

export interface GroupState {
  id: string;
  participantIds: string[];
  turnOrder: string[];        // participantId[]
  currentTurnIndex: number;
  keywords: KeywordState[];   // 18 shuffled keywords
  finished: boolean;
  lastGuess?: GuessResult;
}

export interface RoundConfig {
  round: number;
  groups: { id: string; participantIds: string[] }[];
}

export interface Round {
  round: number;
  groups: GroupState[];
}

export interface GameState {
  status: "setup" | "keyword_entry" | "playing" | "finished";
  currentRound: number;
  participants: Participant[];
  roundConfigs: RoundConfig[];
  rounds: Round[];
}
