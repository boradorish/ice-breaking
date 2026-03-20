"use client";

import { useState, useEffect, useCallback } from "react";

interface Participant {
  id: string;
  name: string;
  score: number;
  joined: boolean;
  keywords: string[];
}

interface RoundConfig {
  round: number;
  groups: { id: string; participantIds: string[] }[];
}

interface KeywordStat {
  word: string;
  ownerName: string;
  timesGuessed: number;
  timesCorrect: number;
}

interface GroupKeyword {
  deactivated: boolean;
  correctlyGuessed: boolean;
}

interface AdminGroupState {
  id: string;
  keywords: GroupKeyword[];
  finished: boolean;
}

interface AdminRound {
  round: number;
  groups: AdminGroupState[];
}

interface AdminState {
  status: string;
  currentRound: number;
  participants: Participant[];
  roundConfigs: RoundConfig[];
  rounds: AdminRound[];
}

interface AdminData {
  state: AdminState;
  stats: {
    participants: { id: string; name: string; score: number }[];
    keywords: KeywordStat[];
  };
}

const TABS = ["설정", "제어", "통계"] as const;
type Tab = (typeof TABS)[number];

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [tab, setTab] = useState<Tab>("설정");
  const [adminData, setAdminData] = useState<AdminData | null>(null);
  const [msg, setMsg] = useState("");

  // Setup state
  const [participantNames, setParticipantNames] = useState("");
  const [roundConfigs, setRoundConfigs] = useState<RoundConfig[]>([
    { round: 1, groups: [] },
  ]);

  const fetchAdmin = useCallback(async (pw: string) => {
    const res = await fetch(`/api/admin/state?password=${encodeURIComponent(pw)}`);
    if (!res.ok) return;
    const data = await res.json();
    setAdminData(data);
    // Sync roundConfigs from server
    if (data.state.roundConfigs.length > 0) {
      setRoundConfigs(data.state.roundConfigs);
    }
    if (data.state.participants.length > 0 && !participantNames) {
      setParticipantNames(data.state.participants.map((p: Participant) => p.name).join("\n"));
    }
  }, [participantNames]);

  useEffect(() => {
    if (!authed) return;
    fetchAdmin(password);
    const interval = setInterval(() => fetchAdmin(password), 3000);
    return () => clearInterval(interval);
  }, [authed, password, fetchAdmin]);

  async function handleAuth() {
    setAuthError("");
    const res = await fetch(`/api/admin/state?password=${encodeURIComponent(password)}`);
    if (!res.ok) {
      setAuthError("비밀번호가 올바르지 않습니다.");
      return;
    }
    const data = await res.json();
    setAdminData(data);
    setAuthed(true);
    if (data.state.participants.length > 0) {
      setParticipantNames(data.state.participants.map((p: Participant) => p.name).join("\n"));
    }
    if (data.state.roundConfigs.length > 0) {
      setRoundConfigs(data.state.roundConfigs);
    }
  }

  async function apiPost(path: string, body: object) {
    setMsg("");
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password, ...body }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg("오류: " + (data.error ?? "알 수 없는 오류"));
      return false;
    }
    setMsg("완료!");
    setTimeout(() => setMsg(""), 2000);
    fetchAdmin(password);
    return true;
  }

  async function saveParticipants() {
    const names = participantNames
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    await apiPost("/api/admin/participants", { names });
  }

  async function saveGroups() {
    await apiPost("/api/admin/groups", { roundConfigs });
  }

  async function control(action: string) {
    await apiPost("/api/admin/control", { action });
  }

  async function reset() {
    if (!confirm("게임을 초기화하시겠습니까?")) return;
    await apiPost("/api/admin/reset", {});
    setAdminData(null);
    setParticipantNames("");
    setRoundConfigs([{ round: 1, groups: [] }]);
  }

  function addRound() {
    const next = roundConfigs.length + 1;
    setRoundConfigs([...roundConfigs, { round: next, groups: [] }]);
  }

  function removeRound(roundIdx: number) {
    const updated = roundConfigs
      .filter((_, i) => i !== roundIdx)
      .map((r, i) => ({ ...r, round: i + 1 }));
    setRoundConfigs(updated);
  }

  function addGroup(roundIdx: number) {
    const updated = [...roundConfigs];
    const groupNum = updated[roundIdx].groups.length + 1;
    updated[roundIdx] = {
      ...updated[roundIdx],
      groups: [
        ...updated[roundIdx].groups,
        { id: `${roundIdx + 1}-${groupNum}`, participantIds: [] },
      ],
    };
    setRoundConfigs(updated);
  }

  function removeGroup(roundIdx: number, groupIdx: number) {
    const updated = [...roundConfigs];
    updated[roundIdx] = {
      ...updated[roundIdx],
      groups: updated[roundIdx].groups.filter((_, i) => i !== groupIdx),
    };
    setRoundConfigs(updated);
  }

  function toggleParticipantInGroup(
    roundIdx: number,
    groupIdx: number,
    participantId: string
  ) {
    const updated = JSON.parse(JSON.stringify(roundConfigs)) as RoundConfig[];
    const group = updated[roundIdx].groups[groupIdx];
    if (group.participantIds.includes(participantId)) {
      group.participantIds = group.participantIds.filter((id) => id !== participantId);
    } else {
      group.participantIds.push(participantId);
    }
    setRoundConfigs(updated);
  }

  function isParticipantInOtherGroup(
    roundIdx: number,
    groupIdx: number,
    participantId: string
  ): boolean {
    return roundConfigs[roundIdx].groups.some(
      (g, i) => i !== groupIdx && g.participantIds.includes(participantId)
    );
  }

  // Login screen
  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-6">
        <h1 className="text-3xl font-bold text-indigo-400">🔐 관리자</h1>
        <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAuth()}
            placeholder="관리자 비밀번호"
            className="w-full bg-slate-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
          />
          {authError && <p className="text-red-400 text-sm mb-2">{authError}</p>}
          <button
            onClick={handleAuth}
            className="w-full bg-indigo-600 hover:bg-indigo-500 rounded-lg py-2 font-semibold transition-colors"
          >
            로그인
          </button>
        </div>
      </div>
    );
  }

  const state = adminData?.state;
  const stats = adminData?.stats;
  const participants = state?.participants ?? [];

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-indigo-400">🧊 Ice Break 관리자</h1>
          {state && (
            <p className="text-slate-400 text-sm">
              상태:{" "}
              <span className="text-white font-medium">
                {state.status === "setup" && "준비 중"}
                {state.status === "keyword_entry" && "키워드 입력 중"}
                {state.status === "playing" && `Round ${state.currentRound} 진행 중`}
                {state.status === "finished" && "게임 종료"}
              </span>
            </p>
          )}
        </div>
        <button
          onClick={reset}
          className="text-xs text-red-500 hover:text-red-400 border border-red-800 hover:border-red-600 px-3 py-1.5 rounded-lg transition-colors"
        >
          초기화
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-800 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t
                ? "bg-indigo-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-2 rounded-lg text-sm ${msg.startsWith("오류") ? "bg-red-900 text-red-300" : "bg-green-900 text-green-300"}`}>
          {msg}
        </div>
      )}

      {/* Setup Tab */}
      {tab === "설정" && (
        <div className="space-y-6">
          {/* Participants */}
          <div className="bg-slate-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold mb-3">참여자 목록</h2>
            <p className="text-slate-400 text-sm mb-3">
              참여자 이름을 한 줄에 하나씩 입력하세요.
            </p>
            <textarea
              value={participantNames}
              onChange={(e) => setParticipantNames(e.target.value)}
              rows={8}
              placeholder={"홍길동\n김철수\n이영희\n..."}
              className="w-full bg-slate-700 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
            />
            <button
              onClick={saveParticipants}
              className="mt-3 bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              참여자 저장
            </button>
            {participants.length > 0 && (
              <p className="text-slate-400 text-xs mt-2">
                현재 {participants.length}명 등록됨
              </p>
            )}
          </div>

          {/* Round Configurations */}
          <div className="bg-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">조 편성</h2>
              <button
                onClick={addRound}
                className="text-sm text-indigo-400 hover:text-indigo-300 border border-indigo-700 px-3 py-1 rounded-lg transition-colors"
              >
                + 라운드 추가
              </button>
            </div>
            <p className="text-slate-400 text-sm mb-4">
              라운드별로 조를 설정하세요. 참여자를 체크해 조에 배정하세요.
            </p>

            {roundConfigs.map((rc, roundIdx) => (
              <div key={roundIdx} className="mb-6 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-indigo-300">Round {rc.round}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => addGroup(roundIdx)}
                      className="text-xs text-slate-400 hover:text-white border border-slate-600 px-2 py-1 rounded transition-colors"
                    >
                      + 조 추가
                    </button>
                    {roundConfigs.length > 1 && (
                      <button
                        onClick={() => removeRound(roundIdx)}
                        className="text-xs text-red-500 hover:text-red-400 border border-red-800 px-2 py-1 rounded transition-colors"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>

                {rc.groups.length === 0 ? (
                  <p className="text-slate-500 text-sm">조를 추가하세요.</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {rc.groups.map((group, groupIdx) => (
                      <div key={groupIdx} className="bg-slate-900 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium">
                            {rc.round}조{groupIdx + 1}
                            <span className="text-slate-500 ml-1 text-xs">
                              ({group.participantIds.length}명)
                            </span>
                          </span>
                          <button
                            onClick={() => removeGroup(roundIdx, groupIdx)}
                            className="text-xs text-red-600 hover:text-red-400"
                          >
                            제거
                          </button>
                        </div>
                        <div className="space-y-1">
                          {participants.length === 0 ? (
                            <p className="text-slate-500 text-xs">참여자를 먼저 저장하세요</p>
                          ) : (
                            participants.map((p) => {
                              const inThisGroup = group.participantIds.includes(p.id);
                              const inOther = isParticipantInOtherGroup(
                                roundIdx,
                                groupIdx,
                                p.id
                              );
                              return (
                                <label
                                  key={p.id}
                                  className={`flex items-center gap-2 text-sm px-2 py-1 rounded cursor-pointer ${
                                    inOther && !inThisGroup
                                      ? "opacity-40 cursor-not-allowed"
                                      : "hover:bg-slate-800"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={inThisGroup}
                                    disabled={inOther && !inThisGroup}
                                    onChange={() =>
                                      toggleParticipantInGroup(roundIdx, groupIdx, p.id)
                                    }
                                    className="accent-indigo-500"
                                  />
                                  <span>{p.name}</span>
                                  {inOther && !inThisGroup && (
                                    <span className="text-xs text-slate-600">
                                      (다른 조)
                                    </span>
                                  )}
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <button
              onClick={saveGroups}
              className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            >
              조 편성 저장
            </button>
          </div>
        </div>
      )}

      {/* Control Tab */}
      {tab === "제어" && (
        <div className="space-y-4">
          {/* Participant keyword status */}
          {participants.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-3">참여자 현황</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {participants.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg text-sm"
                  >
                    <span>{p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 font-bold">{p.score}pt</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          p.keywords.length === 3
                            ? "bg-green-900 text-green-300"
                            : p.joined
                            ? "bg-yellow-900 text-yellow-300"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        {p.keywords.length === 3
                          ? "완료"
                          : p.joined
                          ? "입력중"
                          : "미참여"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Game controls */}
          <div className="bg-slate-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold mb-4">게임 제어</h2>
            <div className="space-y-3">
              {state?.status === "setup" && (
                <div>
                  <p className="text-slate-400 text-sm mb-2">
                    참여자를 설정하고 조 편성을 완료한 후 등록을 시작하세요.
                  </p>
                  <button
                    onClick={() => control("open_registration")}
                    className="bg-blue-600 hover:bg-blue-500 px-6 py-2.5 rounded-lg font-semibold transition-colors"
                  >
                    키워드 입력 시작
                  </button>
                </div>
              )}

              {state?.status === "keyword_entry" && (
                <div>
                  <p className="text-slate-400 text-sm mb-2">
                    모든 참여자가 키워드를 입력하면 라운드를 시작하세요.
                  </p>
                  <button
                    onClick={() => control("start_round")}
                    className="bg-green-600 hover:bg-green-500 px-6 py-2.5 rounded-lg font-semibold transition-colors"
                  >
                    Round 1 시작
                  </button>
                </div>
              )}

              {state?.status === "playing" && (
                <div className="space-y-3">
                  {state.currentRound < (state.roundConfigs?.length ?? 0) && (
                    <div>
                      <p className="text-slate-400 text-sm mb-2">
                        다음 라운드로 진행합니다. (Round {state.currentRound + 1})
                      </p>
                      <button
                        onClick={() => control("start_round")}
                        className="bg-green-600 hover:bg-green-500 px-6 py-2.5 rounded-lg font-semibold transition-colors"
                      >
                        Round {state.currentRound + 1} 시작
                      </button>
                    </div>
                  )}
                  <div>
                    <button
                      onClick={() => control("end_game")}
                      className="bg-red-700 hover:bg-red-600 px-6 py-2.5 rounded-lg font-semibold transition-colors"
                    >
                      게임 종료
                    </button>
                  </div>
                </div>
              )}

              {state?.status === "finished" && (
                <p className="text-green-400 font-semibold">게임이 종료되었습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {tab === "통계" && (
        <div className="space-y-6">
          {/* Score ranking */}
          <div className="bg-slate-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold mb-3">점수 순위</h2>
            {!stats || stats.participants.length === 0 ? (
              <p className="text-slate-400 text-sm">아직 데이터가 없습니다.</p>
            ) : (
              <div className="space-y-2">
                {stats.participants.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between bg-slate-900 px-4 py-3 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`}
                      </span>
                      <span className="font-medium">{p.name}</span>
                    </div>
                    <span className="text-yellow-400 font-bold text-lg">{p.score}점</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Keyword stats */}
          <div className="bg-slate-800 rounded-xl p-5">
            <h2 className="text-lg font-semibold mb-3">키워드 통계</h2>
            <p className="text-slate-400 text-sm mb-3">많이 맞춰진 키워드 순</p>
            {!stats || stats.keywords.length === 0 ? (
              <p className="text-slate-400 text-sm">아직 데이터가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left py-2 pr-4">키워드</th>
                      <th className="text-left py-2 pr-4">소유자</th>
                      <th className="text-right py-2 pr-4">시도</th>
                      <th className="text-right py-2">정답</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.keywords.map((kw, i) => (
                      <tr key={i} className="border-b border-slate-800">
                        <td className="py-2 pr-4 font-medium">{kw.word}</td>
                        <td className="py-2 pr-4 text-slate-400">{kw.ownerName}</td>
                        <td className="py-2 pr-4 text-right text-slate-400">
                          {kw.timesGuessed}
                        </td>
                        <td className="py-2 text-right">
                          <span className={kw.timesCorrect > 0 ? "text-green-400 font-bold" : "text-slate-500"}>
                            {kw.timesCorrect}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Current round group progress */}
          {state?.status === "playing" && adminData?.state.rounds && (
            <div className="bg-slate-800 rounded-xl p-5">
              <h2 className="text-lg font-semibold mb-3">
                Round {state.currentRound} 진행 현황
              </h2>
              {adminData.state.rounds
                .find((r) => r.round === state.currentRound)
                ?.groups.map((group) => {
                  const total = group.keywords.length;
                  const deactivated = group.keywords.filter((k) => k.deactivated).length;
                  const correct = group.keywords.filter((k) => k.correctlyGuessed).length;
                  return (
                    <div key={group.id} className="mb-3 bg-slate-900 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">조 {group.id}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            group.finished
                              ? "bg-green-900 text-green-300"
                              : "bg-blue-900 text-blue-300"
                          }`}
                        >
                          {group.finished ? "완료" : "진행중"}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400">
                        <span className="text-green-400">{correct}개 정답</span>
                        {" / "}
                        <span>{deactivated}개 비활성</span>
                        {" / "}
                        <span>{total}개 전체</span>
                      </div>
                      <div className="mt-2 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full transition-all"
                          style={{ width: `${(deactivated / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
