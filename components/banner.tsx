"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, orderBy, query, setDoc } from "firebase/firestore";
import type { FirebaseClient } from "@/lib/firebase/client";
import { getFirebaseClient } from "@/lib/firebase/client";
import {
  BLOCK_COLLECTION,
  formatBlockMessage,
  isAdminEmail,
  isEmailAllowed,
  genericDomainRejectMessage,
  shouldEnforceDomain,
} from "@/lib/auth/policies";

type BannerMessage = {
  id: string;
  label: string;
  message: string;
  slug: string;
  order?: number;
};

const fallbackQueue: BannerMessage[] = [
  {
    id: "aurora-lens",
    label: "Aurora Lens",
    message: "빙설 로케이션 생중계 : 팀 피드백 루프 7분 → 90초",
    slug: "aurora-lens",
    order: 0,
  },
  {
    id: "solstice-market",
    label: "Solstice Market",
    message: "계절형 팝업 설계 키트 무료 배포 중",
    slug: "solstice-market",
    order: 1,
  },
  {
    id: "nebula-lab",
    label: "Nebula Lab",
    message: "데이터 시어터 가이드라인 실시간 Q&A",
    slug: "nebula-lab",
    order: 2,
  },
];

export default function ExperienceBanner() {
  const [client, setClient] = useState<FirebaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [queue, setQueue] = useState<BannerMessage[]>(fallbackQueue);
  const [activeIndex, setActiveIndex] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => ({
    label: fallbackQueue[0].label,
    message: fallbackQueue[0].message,
    slug: fallbackQueue[0].slug,
  }));
  const [isSaving, setIsSaving] = useState(false);

  const bannerData = queue.length ? queue : fallbackQueue;
  const bannerCount = bannerData.length;
  const activeBanner = bannerData[activeIndex] ?? bannerData[0] ?? fallbackQueue[0];
  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    try {
      setClient(getFirebaseClient());
    } catch (error) {
      console.error("Firebase 초기화 실패", error);
      setAuthError(error instanceof Error ? error.message : "Firebase 초기화 실패");
    }
  }, []);

  useEffect(() => {
    if (!client) {
      return undefined;
    }

    const unsubscribe = onAuthStateChanged(client.auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        return;
      }

      if (shouldEnforceDomain && !isEmailAllowed(nextUser.email)) {
        setAuthError(genericDomainRejectMessage);
        await signOut(client.auth);
        return;
      }

      const blockDoc = await getDoc(doc(client.db, BLOCK_COLLECTION, nextUser.uid));
      if (blockDoc.exists()) {
        const blockData = blockDoc.data() as { reason?: string } | undefined;
        setAuthError(formatBlockMessage(blockData?.reason));
        await signOut(client.auth);
        return;
      }

      setAuthError(null);
      setUser(nextUser);
    });

    return unsubscribe;
  }, [client]);

  useEffect(() => {
    if (!client) {
      setQueue(fallbackQueue);
      return undefined;
    }

    const bannerQuery = query(collection(client.db, "banners"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(bannerQuery, (snapshot) => {
      const remoteEntries: BannerMessage[] = snapshot.docs.map((docSnapshot, index) => {
        const data = docSnapshot.data() as Partial<BannerMessage>;
        return {
          id: docSnapshot.id,
          label: data.label ?? docSnapshot.id,
          message: data.message ?? "",
          slug: data.slug ?? docSnapshot.id,
          order: data.order ?? index,
        };
      });

      if (!remoteEntries.length) {
        setQueue(fallbackQueue);
        return;
      }

      const merged = [...remoteEntries];
      const remoteIds = new Set(remoteEntries.map((entry) => entry.id));

      fallbackQueue.forEach((item) => {
        if (remoteIds.has(item.id)) {
          return;
        }

        merged.push(item);
      });

      merged.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      setQueue(merged);
    });

    return unsubscribe;
  }, [client]);

  useEffect(() => {
    if (activeIndex >= bannerCount) {
      setActiveIndex(0);
    }
  }, [activeIndex, bannerCount]);

  useEffect(() => {
    if (!activeBanner) {
      return;
    }

    setDraft({
      label: activeBanner.label,
      message: activeBanner.message,
      slug: activeBanner.slug,
    });
  }, [activeBanner]);

  const queuePreview = useMemo(() => {
    return bannerData.map((item, index) => ({
      item,
      isActive: index === activeIndex,
      position: (index - activeIndex + bannerCount) % bannerCount,
    }));
  }, [activeIndex, bannerCount, bannerData]);

  const handleSkip = () => {
    if (!bannerCount) {
      return;
    }

    setActiveIndex((previous) => (previous + 1) % bannerCount);
  };

  const handleNavigateToStudio = (slug: string) => {
    if (!slug || typeof window === "undefined") {
      return;
    }

    window.dispatchEvent(new CustomEvent("studio:select", { detail: slug }));
    const showcaseSection = document.getElementById("logo-showcase");
    showcaseSection?.scrollIntoView({ behavior: "smooth", block: "start" });

    const nextUrl = new URL(window.location.href);
    nextUrl.hash = slug;
    window.history.replaceState(null, "", nextUrl);
  };

  const handleLogout = async () => {
    if (!client) {
      return;
    }

    await signOut(client.auth);
  };

  const handleAdminSave = async () => {
    if (!client || !isAdmin || !activeBanner) {
      return;
    }

    const nextLabel = draft.label.trim();
    const nextMessage = draft.message.trim();
    const nextSlug = (draft.slug || activeBanner.slug).trim();
    const normalizedSlug = nextSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const finalSlug = normalizedSlug || activeBanner.slug;

    if (!nextLabel || !nextMessage || !finalSlug) {
      setAuthError("모든 필드를 채워주세요.");
      return;
    }

    setIsSaving(true);

    try {
      await setDoc(doc(client.db, "banners", activeBanner.id), {
        label: nextLabel,
        message: nextMessage,
        slug: finalSlug,
        order: activeBanner.order ?? activeIndex,
      });
      setAuthError(null);
    } catch (error) {
      console.error("배너 저장 실패", error);
      setAuthError("배너를 저장하는 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-3 text-white shadow-[0_12px_45px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="rounded-full border border-white/20 px-3 py-1 text-[0.65rem] uppercase tracking-[0.4em] text-white/70">
            live
          </span>
          <p className="flex-1 truncate text-sm text-white/80">
            <button
              type="button"
              onClick={() => handleNavigateToStudio(activeBanner.slug)}
              className="mr-2 inline-flex items-center rounded-full border border-dashed border-white/30 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white"
            >
              {activeBanner.label}
            </button>
            {activeBanner.message}
          </p>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={handleSkip}
              className="rounded-full border border-white/20 px-2.5 py-1 text-white/70 transition hover:border-white hover:text-white"
            >
              다음
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.4em] text-white/40">
          queue
          <div className="relative flex flex-1 gap-2 overflow-hidden">
            {queuePreview.map(({ item, isActive, position }, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`min-w-[120px] rounded-full border px-3 py-1 text-[0.7rem] tracking-normal transition ${
                  isActive
                    ? "border-sky-300/80 bg-sky-400/10 text-white"
                    : position === 1
                      ? "border-white/30 text-white/80"
                      : "border-white/10 text-white/40"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {authError ? (
        <p className="mt-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-100">
          {authError}
        </p>
      ) : null}

      {isAdmin ? (
        <div className="mt-3 space-y-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/60">
            <span>관리자 배너 편집</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/20 px-3 py-1 text-[0.65rem] text-white/70 transition hover:border-white hover:text-white"
            >
              로그아웃
            </button>
          </div>
          <label className="space-y-1 text-white/80">
            <span className="text-xs uppercase tracking-[0.3em] text-white/40">Label</span>
            <input
              value={draft.label}
              onChange={(event) => setDraft((prev) => ({ ...prev, label: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-300 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-white/80">
            <span className="text-xs uppercase tracking-[0.3em] text-white/40">Message</span>
            <textarea
              value={draft.message}
              onChange={(event) => setDraft((prev) => ({ ...prev, message: event.target.value }))}
              className="h-20 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-300 focus:outline-none"
            />
          </label>
          <label className="space-y-1 text-white/80">
            <span className="text-xs uppercase tracking-[0.3em] text-white/40">Slug</span>
            <input
              value={draft.slug}
              onChange={(event) => setDraft((prev) => ({ ...prev, slug: event.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-300 focus:outline-none"
            />
          </label>
          <button
            type="button"
            onClick={handleAdminSave}
            disabled={isSaving}
            className="w-full rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "저장 중..." : "배너 저장"}
          </button>
        </div>
      ) : null}

      {!isAdmin && user ? (
        <p className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/60">
          관리자 권한이 없는 계정입니다.
        </p>
      ) : null}

    </div>
  );
}
