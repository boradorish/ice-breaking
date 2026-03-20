import { NextRequest, NextResponse } from "next/server";
import { getGameState } from "@/lib/store";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";

export async function GET(req: NextRequest) {
  const password = req.nextUrl.searchParams.get("password");
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const state = await getGameState();

  // Compute per-keyword statistics
  const keywordStats: Record<
    string,
    { word: string; ownerName: string; ownerId: string; timesGuessed: number; timesCorrect: number }
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
            ownerId: kw.ownerId,
            timesGuessed: 0,
            timesCorrect: 0,
          };
        }
        keywordStats[key].timesGuessed += kw.guessCount;
        if (kw.correctlyGuessed) keywordStats[key].timesCorrect += 1;
      }
    }
  }

  // Aggregate correct guesses per person (whose keywords were guessed)
  const guessedByPerson: Record<string, { name: string; totalCorrect: number }> = {};
  for (const stat of Object.values(keywordStats)) {
    if (!guessedByPerson[stat.ownerId]) {
      guessedByPerson[stat.ownerId] = { name: stat.ownerName, totalCorrect: 0 };
    }
    guessedByPerson[stat.ownerId].totalCorrect += stat.timesCorrect;
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
      mostGuessed: Object.entries(guessedByPerson)
        .map(([id, v]) => ({ id, name: v.name, totalCorrect: v.totalCorrect }))
        .sort((a, b) => b.totalCorrect - a.totalCorrect),
    },
  });
}
