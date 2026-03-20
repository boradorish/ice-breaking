import { GameState } from "./types";

const GAME_KEY = "icebreak:game";

function createInitialState(): GameState {
  return {
    status: "setup",
    currentRound: 0,
    participants: [],
    roundConfigs: [],
    rounds: [],
  };
}

declare global {
  // eslint-disable-next-line no-var
  var __gameStore: GameState | undefined;
}

function useKV(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

export async function getGameState(): Promise<GameState> {
  if (useKV()) {
    const { kv } = await import("@vercel/kv");
    const state = await kv.get<GameState>(GAME_KEY);
    return state ?? createInitialState();
  }
  if (!global.__gameStore) {
    global.__gameStore = createInitialState();
  }
  return JSON.parse(JSON.stringify(global.__gameStore));
}

export async function setGameState(state: GameState): Promise<void> {
  if (useKV()) {
    const { kv } = await import("@vercel/kv");
    await kv.set(GAME_KEY, state);
    return;
  }
  global.__gameStore = JSON.parse(JSON.stringify(state));
}

export async function updateGameState(
  updater: (state: GameState) => GameState
): Promise<GameState> {
  const state = await getGameState();
  const newState = updater(state);
  await setGameState(newState);
  return newState;
}
