import { NextRequest, NextResponse } from "next/server";
import { updateGameState } from "@/lib/store";
import { initializeRound } from "@/lib/game";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";

export async function POST(req: NextRequest) {
  const { password, action } = await req.json();

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const newState = await updateGameState((state) => {
      switch (action) {
        case "open_registration":
          return { ...state, status: "keyword_entry" as const };

        case "start_round": {
          const nextRound = state.currentRound + 1;
          if (!state.roundConfigs.find((r) => r.round === nextRound)) {
            throw new Error(`Round ${nextRound} not configured`);
          }
          return initializeRound(state, nextRound);
        }

        case "end_game":
          return { ...state, status: "finished" as const };

        default:
          throw new Error(`Unknown action: ${action}`);
      }
    });

    return NextResponse.json({ ok: true, status: newState.status, currentRound: newState.currentRound });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
