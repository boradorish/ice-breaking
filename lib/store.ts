import { GameState } from "./types";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const GAME_KEY = "icebreak:game";
const DEV_STATE_FILE = join(process.cwd(), ".ice-break-dev-state.json");

function createInitialState(): GameState {
  return {
    status: "setup",
    currentRound: 0,
    participants: [],
    roundConfigs: [],
    rounds: [],
  };
}

function useKV(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function readFromFile(): GameState | null {
  try {
    if (existsSync(DEV_STATE_FILE)) {
      return JSON.parse(readFileSync(DEV_STATE_FILE, "utf-8"));
    }
  } catch {
    // ignore parse errors
  }
  return null;
}

function writeToFile(state: GameState): void {
  try {
    writeFileSync(DEV_STATE_FILE, JSON.stringify(state));
  } catch {
    // ignore write errors
  }
}

export async function getGameState(): Promise<GameState> {
  if (useKV()) {
    const { kv } = await import("@vercel/kv");
    const state = await kv.get<GameState>(GAME_KEY);
    return state ?? createInitialState();
  }
  return readFromFile() ?? createInitialState();
}

export async function setGameState(state: GameState): Promise<void> {
  if (useKV()) {
    const { kv } = await import("@vercel/kv");
    await kv.set(GAME_KEY, state);
    return;
  }
  writeToFile(state);
}

export async function updateGameState(
  updater: (state: GameState) => GameState
): Promise<GameState> {
  const state = await getGameState();
  const newState = updater(state);
  await setGameState(newState);
  return newState;
}
