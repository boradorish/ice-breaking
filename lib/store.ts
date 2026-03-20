import { GameState } from "./types";
import { join } from "path";

const GAME_KEY = "icebreak:game";
const DEV_STATE_FILE = join(process.cwd(), ".ice-break-dev-state.json");
const DEV_STATE_BACKUP = join(process.cwd(), ".ice-break-dev-state.backup.json");
const DEV_STATE_TMP = join(process.cwd(), ".ice-break-dev-state.tmp.json");

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
  // eslint-disable-next-line no-var
  var __gameMutex: Promise<void>;
}

function useKV(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

function tryParseFile(path: string): GameState | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    if (!fs.existsSync(path)) return null;
    const raw = fs.readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw) as GameState;
    // Basic sanity check — must have a valid status field
    if (!parsed.status || !Array.isArray(parsed.participants)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readFromFile(): GameState | null {
  // Try main file first, fall back to backup if corrupted
  const main = tryParseFile(DEV_STATE_FILE);
  if (main) return main;

  const backup = tryParseFile(DEV_STATE_BACKUP);
  if (backup) {
    console.warn("[store] Main state file corrupted, restoring from backup");
    return backup;
  }

  return null;
}

function writeToFile(state: GameState): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("fs");
    const json = JSON.stringify(state);

    // Atomic write: write to temp → rename (prevents partial-write corruption)
    fs.writeFileSync(DEV_STATE_TMP, json, { flush: true });
    fs.renameSync(DEV_STATE_TMP, DEV_STATE_FILE);

    // Keep a backup of the last known good state
    fs.writeFileSync(DEV_STATE_BACKUP, json);
  } catch (e) {
    console.error("[store] writeToFile error:", e);
  }
}

// Simple mutex — works within a single Node.js thread
async function withLock<T>(fn: () => Promise<T>): Promise<T> {
  await (global.__gameMutex ?? Promise.resolve());
  let release!: () => void;
  global.__gameMutex = new Promise((r) => {
    release = r;
  });
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function getGameState(): Promise<GameState> {
  if (useKV()) {
    const { kv } = await import("@vercel/kv");
    const state = await kv.get<GameState>(GAME_KEY);
    return state ?? createInitialState();
  }

  // Memory cache — fast path
  if (global.__gameStore) {
    return JSON.parse(JSON.stringify(global.__gameStore));
  }

  // File fallback — survives hot reloads and server restarts
  const fromFile = readFromFile();
  if (fromFile) {
    console.log(`[store] Loaded state from file (status: ${fromFile.status})`);
    global.__gameStore = fromFile;
    return JSON.parse(JSON.stringify(fromFile));
  }

  console.log("[store] No saved state found, starting fresh");
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
  global.__gameStore = JSON.parse(JSON.stringify(state));
  writeToFile(state);
}

export async function updateGameState(
  updater: (state: GameState) => GameState
): Promise<GameState> {
  return withLock(async () => {
    // Always read from file when entering the lock — guards against
    // stale memory in case another worker thread wrote a newer state
    const fileState = readFromFile();
    const state =
      fileState && fileState !== global.__gameStore
        ? fileState
        : await getGameState();

    const newState = updater(state);
    await setGameState(newState);
    return newState;
  });
}
