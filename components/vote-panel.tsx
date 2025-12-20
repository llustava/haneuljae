"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import type { FirebaseClient } from "@/lib/firebase/client";
import { getFirebaseClient } from "@/lib/firebase/client";
import {
  BLOCK_COLLECTION,
  domainErrorMessage,
  formatBlockMessage,
  isEmailAllowed,
  shouldEnforceDomain,
} from "@/lib/auth/policies";

type VotePanelProps = {
  slug: string;
  title: string;
};

type VoteChoice = "up" | "down";

type VoteEntry = {
  id: string;
  userId: string;
  displayName: string;
  choice: VoteChoice;
  updatedAt?: Timestamp | null;
};

export default function VotePanel({ slug, title }: VotePanelProps) {
  const [client, setClient] = useState<FirebaseClient | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [counts, setCounts] = useState({ up: 0, down: 0 });
  const [entriesByChoice, setEntriesByChoice] = useState<{ up: VoteEntry[]; down: VoteEntry[] }>(
    {
      up: [],
      down: [],
    }
  );
  const [visibleList, setVisibleList] = useState<VoteChoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userChoice, setUserChoice] = useState<VoteChoice | null>(null);
  const [userVoteId, setUserVoteId] = useState<string | null>(null);
  const blockUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    try {
      setClient(getFirebaseClient());
    } catch (error) {
      setClientError(
        error instanceof Error ? error.message : "Firebase 구성이 필요합니다."
      );
    }
  }, []);

  useEffect(() => {
    if (!client) {
      return undefined;
    }

    const cleanupBlockListener = () => {
      if (blockUnsubscribeRef.current) {
        blockUnsubscribeRef.current();
        blockUnsubscribeRef.current = null;
      }
    };

    let voteUnsubscribe: (() => void) | null = null;
    const cleanupVoteListener = () => {
      if (voteUnsubscribe) {
        voteUnsubscribe();
        voteUnsubscribe = null;
      }
    };

    const unsubscribe = onAuthStateChanged(client.auth, async (nextUser) => {
      cleanupBlockListener();
      cleanupVoteListener();

      if (!nextUser) {
        setUser(null);
        setCounts({ up: 0, down: 0 });
        setEntriesByChoice({ up: [], down: [] });
        setUserChoice(null);
        setUserVoteId(null);
        setVisibleList(null);
        return;
      }

      if (shouldEnforceDomain && !isEmailAllowed(nextUser.email)) {
        setClientError(domainErrorMessage);
        setUser(null);
        await signOut(client.auth);
        return;
      }

      const blockRef = doc(client.db, BLOCK_COLLECTION, nextUser.uid);
      const blockSnapshot = await getDoc(blockRef);
      if (blockSnapshot.exists()) {
        const blockData = blockSnapshot.data() as { reason?: string } | undefined;
        setClientError(formatBlockMessage(blockData?.reason));
        setUser(null);
        await signOut(client.auth);
        return;
      }

      blockUnsubscribeRef.current = onSnapshot(blockRef, (blockDoc) => {
        if (!blockDoc.exists()) {
          return;
        }
        const blockData = blockDoc.data() as { reason?: string } | undefined;
        setClientError(formatBlockMessage(blockData?.reason));
        signOut(client.auth);
      });

      setClientError(null);
      setUser(nextUser);

      const votesQuery = query(collection(client.db, "logoVotes"), where("slug", "==", slug));
      const currentUserId = nextUser.uid;

      voteUnsubscribe = onSnapshot(votesQuery, (snapshot) => {
      const latestByUser = new Map<string, VoteEntry>();

      snapshot.forEach((voteDoc) => {
        const data = voteDoc.data() as {
          displayName?: string;
          choice?: VoteChoice;
          updatedAt?: Timestamp | null;
          userId?: string;
        };

        const fallbackUserId = data.userId ?? (voteDoc.id.includes("_") ? voteDoc.id.split("_").pop() ?? "" : "");
        const userId = fallbackUserId;

        if (!userId) {
          return;
        }

        const entry: VoteEntry = {
          id: voteDoc.id,
          userId,
          displayName: data.displayName ?? "익명",
          choice: data.choice === "down" ? "down" : "up",
          updatedAt: data.updatedAt ?? null,
        };

        const previous = latestByUser.get(userId);
        const previousTime = previous?.updatedAt ? previous.updatedAt.toMillis() : 0;
        const currentTime = entry.updatedAt ? entry.updatedAt.toMillis() : 0;

        if (!previous || currentTime >= previousTime) {
          latestByUser.set(userId, entry);
        }
      });

      const sortDesc = (a: VoteEntry, b: VoteEntry) => {
        const aTime = a.updatedAt ? a.updatedAt.toMillis() : 0;
        const bTime = b.updatedAt ? b.updatedAt.toMillis() : 0;
        return bTime - aTime;
      };

      const upEntries: VoteEntry[] = [];
      const downEntries: VoteEntry[] = [];

      latestByUser.forEach((entry) => {
        if (entry.choice === "up") {
          upEntries.push(entry);
        } else {
          downEntries.push(entry);
        }
      });

      upEntries.sort(sortDesc);
      downEntries.sort(sortDesc);

      setCounts({ up: upEntries.length, down: downEntries.length });
      setEntriesByChoice({ up: upEntries, down: downEntries });

        const myEntry = latestByUser.get(currentUserId);
        setUserChoice(myEntry?.choice ?? null);
        setUserVoteId(myEntry?.id ?? null);
      });
    });

    return () => {
      unsubscribe();
      cleanupBlockListener();
      cleanupVoteListener();
    };
  }, [client, slug]);

  const totalVotes = counts.up + counts.down;
  const approval = totalVotes === 0 ? 0 : Math.round((counts.up / totalVotes) * 100);

  const statusCopy = useMemo(() => {
    if (!totalVotes) {
      return "아직 반응이 없습니다";
    }

    return approval >= 50
      ? `${approval}%가 이 경험을 추천합니다`
      : `${100 - approval}%가 개선을 제안했습니다`;
  }, [approval, totalVotes]);

  const removeVote = async () => {
    if (!client || !user || !userVoteId) {
      setClientError("취소할 투표를 찾을 수 없습니다.");
      return;
    }

    setIsSubmitting(true);

    try {
      await deleteDoc(doc(client.db, "logoVotes", userVoteId));
      setClientError(null);
    } catch (error) {
      console.error("투표 삭제 실패", error);
      setClientError("투표를 취소하는 중 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (choice: VoteChoice) => {
    if (!client || !user) {
      return;
    }

    if (userChoice === choice) {
      await removeVote();
      return;
    }

    setIsSubmitting(true);

    const payload = {
      slug,
      userId: user.uid,
      displayName: user.displayName ?? user.email ?? "익명",
      choice,
      updatedAt: serverTimestamp(),
    };

    try {
      const voteDoc = doc(client.db, "logoVotes", `${slug}_${user.uid}`);

      try {
        await setDoc(voteDoc, payload);
        setClientError(null);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("missing or insufficient permissions")) {
          await addDoc(collection(client.db, "logoVotes"), payload);
          setClientError(null);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("투표 저장 실패", error);
      setClientError("투표를 저장하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async () => {
    if (!client) {
      return;
    }

    try {
      const credential = await signInWithPopup(client.auth, client.provider);

      if (shouldEnforceDomain && !isEmailAllowed(credential.user.email)) {
        setClientError(domainErrorMessage);
        await signOut(client.auth);
        return;
      }

      const blockDoc = await getDoc(doc(client.db, BLOCK_COLLECTION, credential.user.uid));
      if (blockDoc.exists()) {
        const blockData = blockDoc.data() as { reason?: string } | undefined;
        setClientError(formatBlockMessage(blockData?.reason));
        await signOut(client.auth);
        return;
      }

      setClientError(null);
    } catch (error) {
      console.error("로그인 실패", error);
    }
  };

  const handleLogout = async () => {
    if (!client) {
      return;
    }

    await signOut(client.auth);
  };

  const toggleList = (choice: VoteChoice) => {
    setVisibleList((current) => (current === choice ? null : choice));
  };

  const isUpSelected = userChoice === "up";
  const isDownSelected = userChoice === "down";

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4 shadow-2xl sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-white/50">실명제 반응</p>
          <h3 className="text-2xl font-semibold text-white">{title} 추천 현황</h3>
          <p className="text-sm text-white/60">Firebase 로그인 후 추천 또는 비추천을 남겨주세요.</p>
        </div>
        <div className="flex flex-col items-start gap-2 text-sm text-white/70">
          {user ? (
            <>
              <span className="text-white/80">{user.displayName ?? user.email}</span>
              <button
                onClick={handleLogout}
                className="rounded-full border border-white/30 px-5 py-2 text-xs uppercase tracking-widest text-white transition hover:border-white hover:text-white"
              >
                로그아웃
              </button>
            </>
          ) : (
            <button
              onClick={handleLogin}
              className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Google 실명 로그인
            </button>
          )}
        </div>
      </div>

      {clientError ? (
        <p className="mt-6 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          {clientError}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-stretch md:gap-4">
            <div className="flex flex-1 flex-col gap-3">
              <button
                disabled={!user || isSubmitting}
                onClick={() => handleVote("up")}
                aria-pressed={isUpSelected}
                className={`flex flex-1 items-center justify-between rounded-2xl px-5 py-4 text-left text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isUpSelected
                    ? "bg-emerald-400/40 ring-2 ring-emerald-200/70"
                    : "bg-emerald-500/20 hover:bg-emerald-400/30"
                }`}
              >
                <span>
                  <strong className="text-3xl font-semibold text-white">{counts.up}</strong>
                  <p className="text-sm text-white/70">추천</p>
                </span>
                <span className="text-4xl">👍</span>
              </button>
              <button
                type="button"
                onClick={() => toggleList("up")}
                className={`rounded-2xl border px-4 py-2 text-sm transition ${
                  visibleList === "up"
                    ? "border-emerald-300/60 bg-emerald-400/10 text-white"
                    : "border-white/20 text-white/80 hover:border-white/40"
                }`}
              >
                추천 명단 보기
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-3">
              <button
                disabled={!user || isSubmitting}
                onClick={() => handleVote("down")}
                aria-pressed={isDownSelected}
                className={`flex flex-1 items-center justify-between rounded-2xl px-5 py-4 text-left text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDownSelected
                    ? "bg-rose-400/40 ring-2 ring-rose-100/70"
                    : "bg-rose-500/20 hover:bg-rose-400/30"
                }`}
              >
                <span>
                  <strong className="text-3xl font-semibold text-white">{counts.down}</strong>
                  <p className="text-sm text-white/70">비추천</p>
                </span>
                <span className="text-4xl">👎</span>
              </button>
              <button
                type="button"
                onClick={() => toggleList("down")}
                className={`rounded-2xl border px-4 py-2 text-sm transition ${
                  visibleList === "down"
                    ? "border-rose-300/60 bg-rose-400/10 text-white"
                    : "border-white/20 text-white/80 hover:border-white/40"
                }`}
              >
                비추천 명단 보기
              </button>
            </div>
          </div>
          <p className="text-sm text-white/70">{statusCopy}</p>
        </div>

        {visibleList ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/80">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-[0.4em] text-white/60">
                {visibleList === "up" ? "추천 명단" : "비추천 명단"}
              </p>
              <button
                type="button"
                onClick={() => setVisibleList(null)}
                className="text-xs uppercase tracking-[0.3em] text-white/60 transition hover:text-white"
              >
                닫기
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {entriesByChoice[visibleList].length ? (
                entriesByChoice[visibleList].map((vote) => (
                  <li key={vote.id} className="flex items-center justify-between">
                    <span>{vote.displayName}</span>
                    <span className="text-xs text-white/50">
                      {vote.updatedAt ? new Date(vote.updatedAt.toMillis()).toLocaleString() : "방금"}
                    </span>
                  </li>
                ))
              ) : (
                <li className="text-white/50">아직 기록이 없습니다.</li>
              )}
            </ul>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-white/20 px-5 py-4 text-xs text-white/60">
            명단을 보려면 위 버튼을 선택하세요.
          </p>
        )}
      </div>
    </div>
  );
}

