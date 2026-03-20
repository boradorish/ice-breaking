"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ParticipantInfo {
  id: string;
  name: string;
  keywords: string[];
  score: number;
  joined: boolean;
}

interface ParticipantStatus {
  id: string;
  name: string;
  score: number;
  joined: boolean;
  keywordsSubmitted: boolean;
}

interface StateData {
  status: string;
  participants: ParticipantStatus[];
  participant: ParticipantInfo | null;
  allKeywordsSubmitted: boolean;
}

export default function Home() {
  const router = useRouter();
  const [stateData, setStateData] = useState<StateData | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [keywords, setKeywords] = useState(["", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchState = useCallback(async (pid: string | null) => {
    const url = pid ? `/api/state?participantId=${pid}` : "/api/state";
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    setStateData(data);

    // Auto-redirect when game starts
    if (data.status === "playing" && pid) {
      router.push(`/game?participantId=${pid}`);
    }
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem("participantId");
    if (saved) setParticipantId(saved);
    fetchState(saved);
  }, [fetchState]);

  useEffect(() => {
    const interval = setInterval(() => fetchState(participantId), 2000);
    return () => clearInterval(interval);
  }, [participantId, fetchState]);

  async function handleJoin(id: string) {
    setError("");
    const res = await fetch("/api/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "참여 실패");
      return;
    }
    localStorage.setItem("participantId", id);
    setParticipantId(id);
    fetchState(id);
  }

  async function handleKeywordsSubmit() {
    if (!participantId) return;
    if (keywords.some((k) => !k.trim())) {
      setError("키워드를 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError("");
    const res = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId, keywords }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "제출 실패");
      return;
    }
    fetchState(participantId);
  }

  if (!stateData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-400">로딩 중...</p>
      </div>
    );
  }

  const { status, participants, participant } = stateData;

  // Game hasn't opened for registration yet
  if (status === "setup") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <h1 className="text-4xl font-bold text-indigo-400">🧊 Ice Break</h1>
        <p className="text-slate-400">관리자가 게임을 준비 중입니다...</p>
        <Link href="/admin" className="text-xs text-slate-600 hover:text-slate-400 mt-8">
          관리자 페이지
        </Link>
      </div>
    );
  }

  if (status === "finished") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6">
        <h1 className="text-4xl font-bold text-indigo-400">🧊 Ice Break</h1>
        <p className="text-2xl text-yellow-400 font-bold">게임 종료!</p>
        <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm">
          <h2 className="text-lg font-semibold mb-3 text-center">최종 순위</h2>
          {[...participants]
            .sort((a, b) => b.score - a.score)
            .map((p, i) => (
              <div key={p.id} className="flex justify-between py-1">
                <span>
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}{" "}
                  {p.name}
                </span>
              </div>
            ))}
        </div>
      </div>
    );
  }

  // keyword_entry or playing phase

  // Already joined & submitted keywords → waiting
  if (participant?.keywords.length === 3) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
        <h1 className="text-4xl font-bold text-indigo-400">🧊 Ice Break</h1>
        <div className="text-center">
          <p className="text-xl text-green-400 font-semibold">
            키워드 제출 완료!
          </p>
          <p className="text-slate-400 mt-1">게임 시작을 기다리는 중...</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm">
          <h2 className="text-sm font-semibold text-slate-400 mb-3">참여자 현황</h2>
          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <span className="text-sm">{p.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    p.keywordsSubmitted
                      ? "bg-green-900 text-green-300"
                      : p.joined
                      ? "bg-yellow-900 text-yellow-300"
                      : "bg-slate-700 text-slate-400"
                  }`}
                >
                  {p.keywordsSubmitted ? "완료" : p.joined ? "입력중" : "대기"}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-600">내 키워드: {participant.keywords.join(", ")}</p>
      </div>
    );
  }

  // Already joined but hasn't submitted keywords
  if (participant) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
        <h1 className="text-4xl font-bold text-indigo-400">🧊 Ice Break</h1>
        <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm">
          <h2 className="text-lg font-semibold mb-1">
            안녕하세요, {participant.name}님!
          </h2>
          <p className="text-slate-400 text-sm mb-4">나를 표현하는 키워드 3개를 입력하세요.</p>
          <div className="space-y-3">
            {keywords.map((kw, i) => (
              <input
                key={i}
                type="text"
                value={kw}
                onChange={(e) => {
                  const next = [...keywords];
                  next[i] = e.target.value;
                  setKeywords(next);
                }}
                placeholder={`키워드 ${i + 1}`}
                maxLength={20}
                className="w-full bg-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ))}
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          <button
            onClick={handleKeywordsSubmit}
            disabled={submitting}
            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg py-2 font-semibold transition-colors"
          >
            {submitting ? "제출 중..." : "키워드 제출"}
          </button>
        </div>
      </div>
    );
  }

  // Not joined yet — show name selector
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
      <h1 className="text-4xl font-bold text-indigo-400">🧊 Ice Break</h1>
      <p className="text-slate-400">팀 아이스브레이킹 게임</p>
      <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-4">게임 참여</h2>
        {participants.length === 0 ? (
          <p className="text-slate-400 text-sm text-center py-4">
            관리자가 참여자를 설정 중입니다...
          </p>
        ) : (
          <div className="space-y-2">
            {participants.map((p) => (
              <button
                key={p.id}
                onClick={() => handleJoin(p.id)}
                disabled={p.joined}
                className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  p.joined
                    ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-slate-700 hover:bg-indigo-600 text-white"
                }`}
              >
                {p.name}
                {p.joined && (
                  <span className="ml-2 text-xs text-slate-400">(참여중)</span>
                )}
              </button>
            ))}
          </div>
        )}
        {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
      </div>
      <Link href="/admin" className="text-xs text-slate-600 hover:text-slate-400">
        관리자 페이지
      </Link>
    </div>
  );
}
