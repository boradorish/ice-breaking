import { NextRequest, NextResponse } from "next/server";
import { updateGameState } from "@/lib/store";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin1234";

export async function POST(req: NextRequest) {
  const { password, roundConfigs } = await req.json();

  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!Array.isArray(roundConfigs) || roundConfigs.length === 0) {
    return NextResponse.json({ error: "roundConfigs array required" }, { status: 400 });
  }

  const newState = await updateGameState((state) => {
    if (state.status === "playing" || state.status === "finished") {
      throw new Error("게임이 진행 중이어서 조 편성을 변경할 수 없습니다");
    }

    const validIds = new Set(state.participants.map((p) => p.id));

    for (const rc of roundConfigs) {
      for (const group of rc.groups) {
        // Check all participant IDs are valid
        const invalid = group.participantIds.filter((id: string) => !validIds.has(id));
        if (invalid.length > 0) {
          throw new Error(`유효하지 않은 참여자 ID: ${invalid.join(", ")}`);
        }

        // Check no duplicates within a group
        const seen = new Set<string>();
        for (const id of group.participantIds) {
          if (seen.has(id)) throw new Error(`조 안에 중복된 참여자가 있습니다 (조 ${group.id})`);
          seen.add(id);
        }
      }

      // Check no participant appears in multiple groups in the same round
      const allIds = rc.groups.flatMap((g: { participantIds: string[] }) => g.participantIds);
      const allSet = new Set<string>();
      for (const id of allIds) {
        if (allSet.has(id)) {
          const p = state.participants.find((p) => p.id === id);
          throw new Error(`Round ${rc.round}에 중복 배정된 참여자: ${p?.name ?? id}`);
        }
        allSet.add(id);
      }
    }

    return { ...state, roundConfigs };
  });

  return NextResponse.json({ ok: true, roundConfigs: newState.roundConfigs });
}
