import { NextRequest, NextResponse } from "next/server";
import { getGameState } from "@/lib/store";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";

export async function GET(req: NextRequest) {
  const password = req.nextUrl.searchParams.get("password");
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getGameState();

  // Compute statistics
  const keywordStats: Record<
    string,
    { word: string; ownerName: string; timesGuessed: number; timesCorrect: number }
  > = {};

  for (const round of state.rounds) {
    for (const group of round.groups) {
      for (const kw of group.keywords) {
        const key = `${kw.word}::${kw.ownerId}`;
        if (!keywordStats[key]) {
          const owner = state.participants.find((p) => p.id === kw.ownerId);
          keywordStats[key] = {
            word: kw.word,
            ownerName: owner?.name ?? "",
            timesGuessed: 0,
            timesCorrect: 0,
          };
        }
        keywordStats[key].timesGuessed += kw.guessCount;
        if (kw.correctlyGuessed) keywordStats[key].timesCorrect += 1;
      }
    }
  }

  return NextResponse.json({
    state,
    stats: {
      participants: state.participants
        .slice()
        .sort((a, b) => b.score - a.score)
        .map((p) => ({ id: p.id, name: p.name, score: p.score })),
      keywords: Object.values(keywordStats).sort(
        (a, b) => b.timesCorrect - a.timesCorrect
      ),
    },
  });
}
