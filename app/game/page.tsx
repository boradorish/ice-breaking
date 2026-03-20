"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

interface KeywordCard {
  word: string;
  isOwn: boolean;
  ownerName: string;
  guessCount: number;
  correctlyGuessed: boolean;
  deactivated: boolean;
}

interface ParticipantInfo {
  id: string;
  name: string;
  score: number;
}

interface TurnParticipant {
  id: string;
  name: string;
}

interface LastGuess {
  guesserName: string;
  keyword: string;
  guessedParticipantName: string;
  correct: boolean;
  timestamp: number;
}

interface GroupState {
  id: string;
  keywords: KeywordCard[];
  participants: ParticipantInfo[];
  turnOrder: TurnParticipant[];
  currentTurnIndex: number;
  currentTurnParticipantId: string;
  finished: boolean;
  lastGuess: LastGuess | null;
}

interface MyParticipant {
  id: string;
  name: string;
  keywords: string[];
  score: number;
}

interface StateData {
  status: string;
  currentRound: number;
  totalRounds: number;
  participant: MyParticipant | null;
  group: GroupState | null;
}

function GameBoard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const participantId = searchParams.get("participantId");

  const [stateData, setStateData] = useState<StateData | null>(null);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [guessResult, setGuessResult] = useState<{ correct: boolean; shown: boolean } | null>(null);

  const fetchState = useCallback(async () => {
    if (!participantId) return;
    const res = await fetch(`/api/state?participantId=${participantId}`);
    if (!res.ok) return;
    const data = await res.json();
    setStateData(data);

    if (data.status === "keyword_entry") {
      router.push("/");
    }
  }, [participantId, router]);

  useEffect(() => {
    if (!participantId) {
      router.push("/");
      return;
    }
    fetchState();
  }, [participantId, fetchState, router]);

  useEffect(() => {
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [fetchState]);

  async function submitGuess() {
    if (!selectedKeyword || !selectedTarget || !participantId) return;
    setSubmitting(true);
    const res = await fetch("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participantId,
        keyword: selectedKeyword,
        guessedParticipantId: selectedTarget,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (res.ok) {
      setGuessResult({ correct: data.correct, shown: true });
      setSelectedKeyword(null);
      setSelectedTarget("");
      setTimeout(() => {
        setGuessResult(null);
        fetchState();
      }, 2500);
    }
  }

  if (!stateData || !stateData.participant) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-400">로딩 중...</p>
      </div>
    );
  }

  const { currentRound, totalRounds, participant, group } = stateData;

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-4xl font-bold text-indigo-400">🧊 Ice Break</h1>
        <p className="text-slate-400">
          {stateData.status === "finished"
            ? "게임이 종료되었습니다."
            : "조 배정을 기다리는 중..."}
        </p>
        <Link href="/" className="text-indigo-400 text-sm hover:underline">
          홈으로
        </Link>
      </div>
    );
  }

  const isMyTurn = group.currentTurnParticipantId === participantId;
  const currentTurnName = group.turnOrder[group.currentTurnIndex]?.name ?? "";

  const activeKeywords = group.keywords.filter((k) => !k.deactivated);
  const selectableKeywords = activeKeywords.filter((k) => !k.isOwn);
  const guessTargets = group.participants.filter((p) => p.id !== participantId);

  return (
    <div className="min-h-screen p-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-indigo-400">🧊 Ice Break</h1>
          <p className="text-slate-400 text-sm">
            Round {currentRound} / {totalRounds} &nbsp;|&nbsp; 조 {group.id}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">내 점수</p>
          <p className="text-2xl font-bold text-yellow-400">{participant.score}점</p>
        </div>
      </div>

      {/* Score board */}
      <div className="bg-slate-800 rounded-xl p-4 mb-4">
        <h2 className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">점수판</h2>
        <div className="flex flex-wrap gap-3">
          {[...group.participants]
            .sort((a, b) => b.score - a.score)
            .map((p) => (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${
                  p.id === participantId
                    ? "bg-indigo-800 text-indigo-200"
                    : "bg-slate-700 text-slate-300"
                }`}
              >
                <span>{p.name}</span>
                <span className="font-bold text-yellow-400">{p.score}pt</span>
              </div>
            ))}
        </div>
      </div>

      {/* Turn indicator */}
      <div
        className={`rounded-xl p-4 mb-4 text-center ${
          isMyTurn
            ? "bg-indigo-900 border border-indigo-500"
            : "bg-slate-800"
        }`}
      >
        {group.finished ? (
          <p className="text-green-400 font-semibold">이 라운드가 완료되었습니다!</p>
        ) : isMyTurn ? (
          <p className="text-indigo-300 font-semibold text-lg">
            내 차례입니다! 키워드를 선택해 추리하세요.
          </p>
        ) : (
          <p className="text-slate-300">
            <span className="font-semibold text-white">{currentTurnName}</span>님의 차례
          </p>
        )}
      </div>

      {/* Last guess result */}
      {group.lastGuess && (
        <div
          className={`rounded-xl p-4 mb-4 text-sm ${
            group.lastGuess.correct
              ? "bg-green-900 border border-green-600"
              : "bg-red-900 border border-red-700"
          }`}
        >
          <p>
            <span className="font-semibold">{group.lastGuess.guesserName}</span>님이{" "}
            <span className="font-semibold text-yellow-300">
              &quot;{group.lastGuess.keyword}&quot;
            </span>
            {" "}→{" "}
            <span className="font-semibold">{group.lastGuess.guessedParticipantName}</span>님 추리{" "}
            <span className={group.lastGuess.correct ? "text-green-300 font-bold" : "text-red-300 font-bold"}>
              {group.lastGuess.correct ? "✓ 성공!" : "✗ 실패"}
            </span>
          </p>
        </div>
      )}

      {/* Guess result overlay */}
      {guessResult?.shown && (
        <div
          className={`fixed inset-0 flex items-center justify-center z-50 bg-black/60`}
        >
          <div
            className={`text-6xl font-black rounded-3xl px-12 py-8 ${
              guessResult.correct
                ? "bg-green-600 text-white"
                : "bg-red-700 text-white"
            }`}
          >
            {guessResult.correct ? "🎉 정답!" : "❌ 오답"}
          </div>
        </div>
      )}

      {/* Keyword grid */}
      <div className="mb-4">
        <h2 className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">
          키워드 카드 ({activeKeywords.length}/{group.keywords.length} 활성)
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {group.keywords.map((kw, i) => {
            const isSelected = selectedKeyword === kw.word;
            const isSelectable = isMyTurn && !kw.deactivated && !kw.isOwn;

            return (
              <button
                key={i}
                onClick={() => {
                  if (!isSelectable) return;
                  setSelectedKeyword(isSelected ? null : kw.word);
                  setSelectedTarget("");
                }}
                disabled={!isSelectable}
                className={`relative rounded-xl p-3 text-sm font-medium transition-all min-h-[80px] flex flex-col items-center justify-center gap-1 ${
                  kw.deactivated
                    ? "bg-slate-800 text-slate-600 line-through"
                    : kw.isOwn
                    ? "bg-indigo-950 border border-indigo-700 text-indigo-300 cursor-default"
                    : isSelected
                    ? "bg-indigo-500 text-white scale-105 shadow-lg shadow-indigo-500/30"
                    : isSelectable
                    ? "bg-slate-700 hover:bg-slate-600 text-white cursor-pointer"
                    : "bg-slate-700 text-slate-300 cursor-default"
                }`}
              >
                <span>{kw.word}</span>
                {kw.isOwn && (
                  <span className="text-xs text-indigo-400">내 키워드</span>
                )}
                {kw.deactivated && kw.ownerName && (
                  <span className="text-xs text-slate-500">{kw.ownerName}</span>
                )}
                {kw.deactivated && kw.correctlyGuessed && (
                  <span className="text-xs text-green-600">✓</span>
                )}
                {!kw.isOwn && !kw.deactivated && kw.guessCount > 0 && (
                  <span className="text-xs text-yellow-600">
                    {kw.guessCount}/2 시도
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Guess panel — shown when keyword selected on my turn */}
      {isMyTurn && selectedKeyword && !group.finished && (
        <div className="bg-slate-800 rounded-xl p-4 border border-indigo-600">
          <p className="text-sm text-slate-400 mb-3">
            선택한 키워드:{" "}
            <span className="text-white font-semibold">&quot;{selectedKeyword}&quot;</span> 를 누가 가지고 있을까요?
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {guessTargets.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedTarget(p.id)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  selectedTarget === p.id
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-700 hover:bg-slate-600 text-slate-300"
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setSelectedKeyword(null);
                setSelectedTarget("");
              }}
              className="flex-1 py-2 rounded-lg text-sm bg-slate-700 hover:bg-slate-600 transition-colors"
            >
              취소
            </button>
            <button
              onClick={submitGuess}
              disabled={!selectedTarget || submitting}
              className="flex-2 py-2 px-6 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 transition-colors"
            >
              {submitting ? "제출 중..." : "추리하기!"}
            </button>
          </div>
        </div>
      )}

      {/* Turn order */}
      <div className="mt-4 bg-slate-800 rounded-xl p-4">
        <h2 className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">
          순서
        </h2>
        <div className="flex flex-wrap gap-2">
          {group.turnOrder.map((p, i) => (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                i === group.currentTurnIndex && !group.finished
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-700 text-slate-400"
              }`}
            >
              <span>{i + 1}.</span>
              <span>{p.name}</span>
              {p.id === participantId && <span className="text-xs">(나)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GamePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-slate-400">로딩 중...</p></div>}>
      <GameBoard />
    </Suspense>
  );
}
