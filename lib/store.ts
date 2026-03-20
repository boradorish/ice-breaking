import { GameState } from "./types";
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

declare global {
  // eslint-disable-next-line no-var
  var __gameStore: GameState | undefined;
}

function useKV(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

// Use require() to avoid Next.js static bundling issues with fs
function readFromFile(): GameState | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    if (fs.existsSync(DEV_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(DEV_STATE_FILE, "utf-8")) as GameState;
    }
  } catch (e) {
    console.error("[store] readFromFile error:", e);
  }
  return null;
}

function writeToFile(state: GameState): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    fs.writeFileSync(DEV_STATE_FILE, JSON.stringify(state));
  } catch (e) {
    console.error("[store] writeToFile error:", e);
  }
}

export async function getGameState(): Promise<GameState> {
  if (useKV()) {
    const { kv } = await import("@vercel/kv");
    const state = await kv.get<GameState>(GAME_KEY);
    return state ?? createInitialState();
  }

  // Memory cache — fast, but lost on hot reload
  if (global.__gameStore) {
    return JSON.parse(JSON.stringify(global.__gameStore));
  }

  // File fallback — persists across hot reloads
  const fromFile = readFromFile();
  if (fromFile) {
    global.__gameStore = fromFile;
    return JSON.parse(JSON.stringify(fromFile));
  }

  const initial = createInitialState();
  global.__gameStore = initial;
  return JSON.parse(JSON.stringify(initial));
}

export async function setGameState(state: GameState): Promise<void> {
  if (useKV()) {
    const { kv } = await import("@vercel/kv");
    await kv.set(GAME_KEY, state);
    return;
  }

  // Write to both memory and file
  global.__gameStore = JSON.parse(JSON.stringify(state));
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
