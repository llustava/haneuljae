"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
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

/* =======================
   Types
======================= */

type BannerMessage = {
  id: string;
  label: string;
  message: string;
  slug: string;
  order?: number;
};

type BannerDraft = Pick<BannerMessage, "label" | "message" | "slug">;

/* =======================
   Constants
======================= */

const MOBILE_TICKER_DURATION = 24;
const LONG_MESSAGE_THRESHOLD = 50;
const LONG_TICKER_DURATION = 28;
const MARQUEE_PIXELS_PER_SECOND = 60;
const MARQUEE_MIN_DURATION = 14;
const MARQUEE_MAX_DURATION = 45;

/* =======================
   Utils
======================= */

const normalizeSlug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const renderBannerMessage = (message: string): ReactNode => {
  if (!message) return message;

  const nodes: ReactNode[] = [];
  const pattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(message))) {
    if (match.index > lastIndex) {
      nodes.push(message.slice(lastIndex, match.index));
    }

    nodes.push(
      <a
        key={`banner-link-${key++}`}
        href={match[2]}
        target="_blank"
        rel="noreferrer"
        className="text-sky-200 underline decoration-dotted underline-offset-4 transition hover:text-white"
      >
        {match[1]}
      </a>,
    );

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < message.length) {
    nodes.push(message.slice(lastIndex));
  }

  return nodes.length ? nodes : message;
};

/* =======================
   Component
======================= */

export default function ExperienceBanner() {
  /* ---------- Core State ---------- */
  const [client, setClient] = useState<FirebaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [queue, setQueue] = useState<BannerMessage[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  /* ---------- Draft / Admin ---------- */
  const [draft, setDraft] = useState<BannerDraft>({ label: "", message: "", slug: "" });
  const [newBanner, setNewBanner] = useState<BannerDraft>({ label: "", message: "", slug: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  /* ---------- Preview / Ticker ---------- */
  const [previewBanner, setPreviewBanner] = useState<BannerMessage | null>(null);
  const [tickerVariant, setTickerVariant] = useState<"none" | "overflow" | "long">("none");
  const [tickerDuration, setTickerDuration] = useState<number>(MOBILE_TICKER_DURATION);

  const messageViewportRef = useRef<HTMLDivElement | null>(null);
  const messageMeasureRef = useRef<HTMLSpanElement | null>(null);
  const titleRailRef = useRef<HTMLDivElement | null>(null);
  const titleScrollRafRef = useRef<number | null>(null);
  const titleScrollUserTimeoutRef = useRef<number | null>(null);
  const isUserScrollingTitlesRef = useRef(false);
  const activeIndexRef = useRef(activeIndex);

  /* ---------- Derived ---------- */
  const bannerCount = queue.length;
  const selectedBanner = queue[activeIndex] ?? null;
  const activeBanner = previewBanner ?? selectedBanner;

  const normalizedMessageLength = activeBanner?.message?.trim().length ?? 0;
  const isLongMessage = normalizedMessageLength >= LONG_MESSAGE_THRESHOLD;
  const shouldAnimateTicker = tickerVariant !== "none";
  const tickerClassName =
    tickerVariant === "long" ? "banner-ticker-track-long" : "banner-ticker-track";

  const isPreviewing = Boolean(previewBanner);
  const isAdmin = isAdminEmail(user?.email);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  /* =======================
     Firebase Init
  ======================= */

  useEffect(() => {
    try {
      setClient(getFirebaseClient());
    } catch (error) {
      console.error("Firebase 초기화 실패", error);
      setAuthError(error instanceof Error ? error.message : "Firebase 초기화 실패");
    }
  }, []);

  /* =======================
     Auth State
  ======================= */

  useEffect(() => {
    if (!client) return;

    const unsubscribe = onAuthStateChanged(client.auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        return;
      }

      if (shouldEnforceDomain && !isEmailAllowed(nextUser.email)) {
        setAuthError(genericDomainRejectMessage);
        setUser(null);
        await signOut(client.auth);
        return;
      }

      const blockDoc = await getDoc(doc(client.db, BLOCK_COLLECTION, nextUser.uid));
      if (blockDoc.exists()) {
        const blockData = blockDoc.data() as { reason?: string } | undefined;
        setAuthError(formatBlockMessage(blockData?.reason));
        setUser(null);
        await signOut(client.auth);
        return;
      }

      setAuthError(null);
      setUser(nextUser);
    });

    return () => unsubscribe();
  }, [client]);

  /* =======================
     Banner Snapshot
  ======================= */

  useEffect(() => {
    if (!client) {
      setQueue([]);
      return;
    }

    const bannerQuery = query(collection(client.db, "banners"), orderBy("order", "asc"));

    const unsubscribe = onSnapshot(
      bannerQuery,
      (snapshot) => {
        const items: BannerMessage[] = snapshot.docs.map((docSnapshot, index) => {
          const data = docSnapshot.data() as Partial<BannerMessage>;
          return {
            id: docSnapshot.id,
            label: data.label ?? docSnapshot.id,
            message: data.message ?? "",
            slug: data.slug ?? docSnapshot.id,
            order: data.order ?? index,
          };
        });

        items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setQueue(items);
        setAuthError(null);
      },
      (error) => {
        console.error("배너 데이터를 불러오지 못했습니다", error);
        setQueue([]);
        setAuthError(isAdmin ? "배너 데이터를 불러오지 못했습니다. 잠시 후 다시 시도하세요." : null);
      },
    );

    return () => unsubscribe();
  }, [client, isAdmin]);

  /* =======================
     Sync Draft
  ======================= */

  useEffect(() => {
    if (!selectedBanner) {
      setDraft({ label: "", message: "", slug: "" });
      return;
    }

    setDraft({
      label: selectedBanner.label,
      message: selectedBanner.message,
      slug: selectedBanner.slug,
    });
  }, [selectedBanner]);

  /* =======================
     Index Guard
  ======================= */

  useEffect(() => {
    if (!bannerCount) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex >= bannerCount) {
      setActiveIndex(0);
    }
  }, [activeIndex, bannerCount]);

  useEffect(() => {
    const rail = titleRailRef.current;
    if (!rail || !queue.length) {
      return undefined;
    }

    const markUserScroll = () => {
      isUserScrollingTitlesRef.current = true;
      if (titleScrollUserTimeoutRef.current) {
        window.clearTimeout(titleScrollUserTimeoutRef.current);
      }
      titleScrollUserTimeoutRef.current = window.setTimeout(() => {
        isUserScrollingTitlesRef.current = false;
        titleScrollUserTimeoutRef.current = null;
      }, 400);
    };

    const handleScroll = () => {
      markUserScroll();
      if (titleScrollRafRef.current) {
        window.cancelAnimationFrame(titleScrollRafRef.current);
      }

      titleScrollRafRef.current = window.requestAnimationFrame(() => {
        if (!titleRailRef.current) {
          return;
        }

        const containerRect = titleRailRef.current.getBoundingClientRect();
        const midpoint = containerRect.left + containerRect.width / 2;
        let closestIndex = activeIndexRef.current;
        let minDistance = Number.POSITIVE_INFINITY;

        queue.forEach((_, index) => {
          const button = titleRailRef.current?.querySelector<HTMLElement>(
            `[data-banner-index="${index}"]`,
          );
          if (!button) {
            return;
          }

          const rect = button.getBoundingClientRect();
          const center = rect.left + rect.width / 2;
          const distance = Math.abs(center - midpoint);

          if (distance < minDistance) {
            minDistance = distance;
            closestIndex = index;
          }
        });

        if (closestIndex !== activeIndexRef.current) {
          setActiveIndex(closestIndex);
        }
      });
    };

    rail.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      rail.removeEventListener("scroll", handleScroll);
      if (titleScrollRafRef.current) {
        window.cancelAnimationFrame(titleScrollRafRef.current);
        titleScrollRafRef.current = null;
      }
      if (titleScrollUserTimeoutRef.current) {
        window.clearTimeout(titleScrollUserTimeoutRef.current);
        titleScrollUserTimeoutRef.current = null;
      }
    };
  }, [queue]);

  useEffect(() => {
    if (isUserScrollingTitlesRef.current) {
      return;
    }

    const rail = titleRailRef.current;
    if (!rail) {
      return;
    }

    const button = rail.querySelector<HTMLElement>(`[data-banner-index="${activeIndex}"]`);
    button?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeIndex, queue.length]);

  /* =======================
     Ticker Logic
  ======================= */

  useEffect(() => {
    if (!activeBanner?.message) {
      setTickerVariant("none");
      return;
    }

    setTickerVariant(isLongMessage ? "long" : "overflow");
  }, [activeBanner?.message, isLongMessage]);

  useEffect(() => {
    if (!activeBanner?.message) {
      setTickerDuration(MOBILE_TICKER_DURATION);
      return;
    }

    const measureDuration = () => {
      if (!messageMeasureRef.current) {
        return;
      }

      const contentWidth = messageMeasureRef.current.scrollWidth || 0;
      const travelDistance = Math.max(contentWidth * 2, 1);
      const rawDuration = travelDistance / MARQUEE_PIXELS_PER_SECOND;
      const clampedDuration = Math.min(
        MARQUEE_MAX_DURATION,
        Math.max(MARQUEE_MIN_DURATION, rawDuration),
      );

      setTickerDuration(
        tickerVariant === "long" ? Math.max(clampedDuration, LONG_TICKER_DURATION) : clampedDuration,
      );
    };

    if (typeof window === "undefined") {
      measureDuration();
      return;
    }

    const rafId = window.requestAnimationFrame(measureDuration);
    window.addEventListener("resize", measureDuration);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", measureDuration);
    };
  }, [activeBanner?.message, tickerVariant]);

  /* =======================
     Actions
  ======================= */

  const handleSkip = () => {
    if (previewBanner) {
      setPreviewBanner(null);
      return;
    }

    if (bannerCount) {
      setActiveIndex((prev) => (prev + 1) % bannerCount);
    }
  };

  const handleLogout = async () => {
    if (client) {
      await signOut(client.auth);
    }
  };

  const applyPreviewFrom = (source: BannerDraft, fallbackId: string) => {
    const label = source.label.trim() || "미리보기 배너";
    const message = source.message.trim() || "배너 문구를 입력하세요.";
    const slug = normalizeSlug(source.slug.trim()) || `${fallbackId}-preview`;

    setPreviewBanner({
      id: `${fallbackId}-preview`,
      label,
      message,
      slug,
      order: -1,
    });
  };

  const exitPreview = () => setPreviewBanner(null);

  const handleAdminSave = async () => {
    if (!client || !isAdmin || !selectedBanner) {
      return;
    }

    const nextLabel = draft.label.trim();
    const nextMessage = draft.message.trim();
    const nextSlug = (draft.slug || selectedBanner.slug).trim();
    const normalizedSlug = normalizeSlug(nextSlug);
    const finalSlug = normalizedSlug || selectedBanner.slug;

    if (!nextLabel || !nextMessage || !finalSlug) {
      setAuthError("모든 필드를 채워주세요.");
      return;
    }

    setIsSaving(true);

    try {
      await setDoc(doc(client.db, "banners", selectedBanner.id), {
        label: nextLabel,
        message: nextMessage,
        slug: finalSlug,
        order: selectedBanner.order ?? activeIndex,
      });
      setAuthError(null);
    } catch (error) {
      console.error("배너 저장 실패", error);
      setAuthError("배너를 저장하는 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateBanner = async () => {
    if (!client || !isAdmin) {
      return;
    }

    const label = newBanner.label.trim();
    const message = newBanner.message.trim();
    const slugValue = newBanner.slug.trim();
    const normalizedSlug = normalizeSlug(slugValue);

    if (!label || !message || !normalizedSlug) {
      setAuthError("모든 필드를 채워주세요.");
      return;
    }

    setIsCreating(true);

    try {
      const nextOrder = queue.reduce((max, item) => Math.max(max, item.order ?? 0), -1) + 1;
      await setDoc(doc(client.db, "banners", normalizedSlug), {
        label,
        message,
        slug: normalizedSlug,
        order: nextOrder,
      });
      setNewBanner({ label: "", message: "", slug: "" });
      setAuthError(null);
    } catch (error) {
      console.error("배너 생성 실패", error);
      setAuthError("배너를 생성하는 중 오류가 발생했습니다.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteBanner = async () => {
    if (!client || !isAdmin || !selectedBanner) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteDoc(doc(client.db, "banners", selectedBanner.id));
      setAuthError(null);
      setActiveIndex(0);
    } catch (error) {
      console.error("배너 삭제 실패", error);
      setAuthError("배너를 삭제하는 중 오류가 발생했습니다.");
    } finally {
      setIsDeleting(false);
    }
  };

  /* =======================
     JSX
  ======================= */

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-white/15 bg-white/5 p-4 text-white shadow-[0_12px_45px_rgba(15,23,42,0.45)] sm:p-5 lg:p-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 items-center rounded-full border border-white/25 bg-white/10 px-3 text-[0.65rem] uppercase tracking-[0.35em] text-white/80">
              live
            </span>
            {isPreviewing ? (
              <span className="inline-flex h-8 items-center rounded-full border border-amber-200/40 bg-amber-400/10 px-3 text-[0.65rem] uppercase tracking-[0.35em] text-amber-100">
                preview
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-xs text-white/60">
            <span className="hidden rounded-full border border-white/10 px-2 py-1 text-[0.65rem] uppercase tracking-[0.3em] sm:inline-flex">
              banner
            </span>
            <button
              type="button"
              onClick={handleSkip}
              disabled={!bannerCount}
              className="inline-flex h-8 items-center rounded-full border border-white/20 px-2.5 text-white/70 transition hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>

        {activeBanner ? (
          <div className="text-sm text-white/80">
            <div
              ref={messageViewportRef}
              className={`relative flex-1 min-w-0 ${
                shouldAnimateTicker
                  ? "banner-ticker-mask"
                  : "overflow-hidden whitespace-nowrap text-ellipsis"
              }`}
            >
              <span
                className={`inline-flex items-center gap-2 align-middle leading-tight ${
                  shouldAnimateTicker ? tickerClassName : ""
                }`}
                style={
                  shouldAnimateTicker
                    ? { animationDuration: `${tickerDuration}s` }
                    : undefined
                }
              >
                {renderBannerMessage(activeBanner.message)}
              </span>
              {shouldAnimateTicker ? (
                <span
                  aria-hidden="true"
                  className={tickerClassName}
                  style={
                    tickerVariant === "long"
                      ? { animationDuration: `${tickerDuration}s`, position: "absolute", left: "100%", top: 0 }
                      : {
                          animationDuration: `${tickerDuration}s`,
                          animationDelay: `${tickerDuration / 2}s`,
                          position: "absolute",
                          left: "100%",
                          top: 0,
                        }
                  }
                >
                  {renderBannerMessage(activeBanner.message)}
                </span>
              ) : null}
              <span
                aria-hidden="true"
                ref={messageMeasureRef}
                className="pointer-events-none absolute left-0 top-0 inline-flex whitespace-nowrap opacity-0"
              >
                {renderBannerMessage(activeBanner.message)}
              </span>
            </div>
          </div>
        ) : (
          <p className="flex-1 rounded-2xl border border-dashed border-white/20 px-3 py-2 text-sm text-white/60">
            등록된 배너가 없습니다. 관리자에서 새 항목을 추가하세요.
          </p>
        )}

        <div className="flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.4em] text-white/40">
          <div
            ref={titleRailRef}
            className="relative flex flex-1 gap-2 overflow-x-auto pr-2 no-scrollbar scroll-smooth snap-x snap-mandatory"
            aria-label="다른 배너 선택"
          >
            {queue.length ? (
              queue.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  data-banner-index={index}
                  onClick={() => setActiveIndex(index)}
                  className={`snap-center min-w-[140px] shrink-0 rounded-full border px-4 py-2 text-[0.7rem] tracking-[0.15em] transition ${
                    index === activeIndex
                      ? "border-sky-300/80 bg-sky-400/10 text-white"
                      : "border-white/15 text-white/50 hover:border-white/30 hover:text-white/80"
                  }`}
                >
                  {item.label}
                </button>
              ))
            ) : (
              <span className="w-full rounded-full border border-dashed border-white/15 px-3 py-2 text-[0.7rem] text-white/50 tracking-[0.1em]">
                다른 공지가 없습니다.
              </span>
            )}
          </div>
        </div>
      </div>

      {authError ? (
        <p className="mt-3 rounded-2xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-100">
          {authError}
        </p>
      ) : null}

      {isAdmin ? (
        <div className="mt-3 space-y-4 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm">
          <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/60">
            <span>관리자 배너 패널</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-white/20 px-3 py-1 text-[0.65rem] text-white/70 transition hover:border-white hover:text-white"
            >
              로그아웃
            </button>
          </div>

          {isPreviewing ? (
            <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-xs text-amber-100">
              프리뷰 모드가 활성화되었습니다. 아래 버튼으로 사용자 시점을 종료할 수 있습니다.
              <button
                type="button"
                onClick={exitPreview}
                className="ml-2 rounded-full border border-amber-200/60 px-3 py-1 text-[0.6rem] uppercase tracking-[0.3em] text-amber-100 transition hover:border-amber-100"
              >
                프리뷰 종료
              </button>
            </div>
          ) : null}

          {selectedBanner ? (
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">선택한 배너 편집</p>
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
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={handleAdminSave}
                  disabled={isSaving}
                  className="flex-1 rounded-xl bg-white/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? "저장 중..." : "배너 저장"}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBanner}
                  disabled={isDeleting}
                  className="flex-1 rounded-xl border border-white/20 px-4 py-2 text-sm text-white/80 transition hover:border-rose-400 hover:text-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? "삭제 중..." : "배너 삭제"}
                </button>
              </div>
              <button
                type="button"
                onClick={() => applyPreviewFrom(draft, selectedBanner.slug || "current")}
                className="w-full rounded-xl border border-amber-200/40 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-amber-100 transition hover:border-amber-200"
              >
                사용자 프리뷰 보기
              </button>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-white/20 px-4 py-3 text-xs text-white/60">
              선택된 배너가 없습니다. 새 항목을 추가한 뒤 편집하세요.
            </p>
          )}

          <div className="space-y-3 border-t border-white/10 pt-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/40">새 배너 추가</p>
            <label className="space-y-1 text-white/80">
              <span className="text-xs uppercase tracking-[0.3em] text-white/40">Label</span>
              <input
                value={newBanner.label}
                onChange={(event) => setNewBanner((prev) => ({ ...prev, label: event.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-300 focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-white/80">
              <span className="text-xs uppercase tracking-[0.3em] text-white/40">Message</span>
              <textarea
                value={newBanner.message}
                onChange={(event) => setNewBanner((prev) => ({ ...prev, message: event.target.value }))}
                className="h-20 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-300 focus:outline-none"
              />
            </label>
            <label className="space-y-1 text-white/80">
              <span className="text-xs uppercase tracking-[0.3em] text-white/40">Slug</span>
              <input
                value={newBanner.slug}
                onChange={(event) => setNewBanner((prev) => ({ ...prev, slug: event.target.value }))}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white focus:border-sky-300 focus:outline-none"
              />
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={handleCreateBanner}
                disabled={isCreating}
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? "생성 중..." : "새 배너 생성"}
              </button>
              <button
                type="button"
                onClick={() => applyPreviewFrom(newBanner, "new")}
                className="flex-1 rounded-xl border border-amber-200/40 bg-amber-400/10 px-4 py-2 text-xs uppercase tracking-[0.3em] text-amber-100 transition hover:border-amber-200"
              >
                새 배너 프리뷰
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
