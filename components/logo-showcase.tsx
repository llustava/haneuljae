"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";

import { studios } from "@/lib/studios";
import VotePanel from "@/components/vote-panel";
import CommentPanel from "@/components/comment-panel";

const isValidStudioSlug = (slug: string | undefined): slug is string =>
  Boolean(slug && studios.some((studio) => studio.slug === slug));

const getHashSlugSnapshot = () => {
  if (typeof window === "undefined") {
    return studios[0].slug;
  }

  const hash = window.location.hash.replace("#", "");
  return isValidStudioSlug(hash) ? hash : studios[0].slug;
};

const subscribeToStudioSlug = (onStoreChange: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStudioSelect = (event: Event) => {
    const detail = (event as CustomEvent<string | undefined>).detail;
    if (isValidStudioSlug(detail)) {
      onStoreChange();
    }
  };

  window.addEventListener("hashchange", onStoreChange);
  window.addEventListener("studio:select", handleStudioSelect);

  return () => {
    window.removeEventListener("hashchange", onStoreChange);
    window.removeEventListener("studio:select", handleStudioSelect);
  };
};

export default function LogoShowcase() {
  const activeSlug = useSyncExternalStore(
    subscribeToStudioSlug,
    getHashSlugSnapshot,
    () => studios[0].slug
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const logoRailRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  const activeStudio = useMemo(
    () => studios.find((studio) => studio.slug === activeSlug) ?? studios[0],
    [activeSlug]
  );
  const Content = activeStudio.Content;

  const focusStudioContent = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const target = contentRef.current ?? document.getElementById("logo-showcase");
    if (!target) {
      return;
    }

    const shouldCenter = window.innerWidth >= 1024;
    target.scrollIntoView({ behavior: "smooth", block: shouldCenter ? "center" : "start" });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleStudioSelect = (event: Event) => {
      const detail = (event as CustomEvent<string | undefined>).detail;
      if (!isValidStudioSlug(detail)) {
        return;
      }

      setSidebarOpen(true);
      focusStudioContent();
    };

    window.addEventListener("studio:select", handleStudioSelect);

    return () => {
      window.removeEventListener("studio:select", handleStudioSelect);
    };
  }, [focusStudioContent]);

  useEffect(() => {
    const rail = logoRailRef.current;
    if (!rail) {
      return undefined;
    }

    const isDragEnabled = () =>
      typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches;

    let isPointerDown = false;
    let startX = 0;
    let scrollStart = 0;
    let pointerId: number | null = null;

    const handlePointerDown = (event: PointerEvent) => {
      if (!isDragEnabled()) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.closest("button")) {
        return;
      }
      isPointerDown = true;
      startX = event.clientX;
      scrollStart = rail.scrollLeft;
      pointerId = event.pointerId;
      rail.style.cursor = "grabbing";
      rail.style.userSelect = "none";
      rail.setPointerCapture(pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isPointerDown) {
        return;
      }
      event.preventDefault();
      rail.scrollLeft = scrollStart - (event.clientX - startX);
    };

    const handlePointerUp = () => {
      if (!isPointerDown) {
        return;
      }
      isPointerDown = false;
      rail.style.cursor = "";
      rail.style.userSelect = "";
      if (pointerId !== null) {
        try {
          rail.releasePointerCapture(pointerId);
        } catch {
          // ignore pointer release failures
        }
        pointerId = null;
      }
    };

    rail.addEventListener("pointerdown", handlePointerDown);
    rail.addEventListener("pointermove", handlePointerMove);
    rail.addEventListener("pointerleave", handlePointerUp);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      rail.removeEventListener("pointerdown", handlePointerDown);
      rail.removeEventListener("pointermove", handlePointerMove);
      rail.removeEventListener("pointerleave", handlePointerUp);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  const updateGlobalSlug = (nextSlug: string) => {
    if (!isValidStudioSlug(nextSlug) || typeof window === "undefined") {
      return;
    }

    setSidebarOpen(true);

    const nextUrl = new URL(window.location.href);
    nextUrl.hash = nextSlug;
    window.history.replaceState(null, "", nextUrl);
    window.dispatchEvent(new CustomEvent("studio:select", { detail: nextSlug }));
    focusStudioContent();
  };

  return (
    <section id="logo-showcase" className="flex w-full flex-col gap-6 sm:gap-8 lg:gap-10">
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-4 shadow-[0_25px_70px_rgba(15,23,42,0.6)] sm:p-5 lg:p-6">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.4em] text-white/40">studio tabs</p>
          <span className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40">
            drag to explore
          </span>
        </div>
        <div
          ref={logoRailRef}
          className="no-scrollbar flex gap-3 overflow-x-auto rounded-2xl border border-white/5 bg-white/5 px-3 py-3 text-sm text-white/80 touch-pan-x cursor-grab"
          aria-label="스튜디오 목록"
        >
          {studios.map((studio) => {
            const isActive = studio.slug === activeSlug;
            return (
              <button
                key={`rail-${studio.slug}`}
                type="button"
                onClick={() => updateGlobalSlug(studio.slug)}
                aria-pressed={isActive}
                aria-label={studio.name}
                className={`flex h-20 w-20 items-center justify-center rounded-2xl border text-left transition sm:h-auto sm:w-auto sm:min-w-[11rem] sm:flex-shrink-0 sm:flex-row sm:gap-3 sm:px-4 sm:py-3 ${
                  isActive
                    ? "border-white/80 bg-white/20 text-white"
                    : "border-white/10 text-white/70 hover:border-white/40"
                }`}
              >
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${studio.accent} sm:h-11 sm:w-11`}
                >
                  <Image
                    src={studio.logo}
                    alt=""
                    aria-hidden="true"
                    width={36}
                    height={36}
                    className="h-7 w-7"
                  />
                </span>
                <span className="hidden sm:sr-only">{studio.name}</span>
                <span className="hidden flex-col sm:flex">
                  <strong className="text-sm font-semibold leading-tight text-white">{studio.name}</strong>
                  <span className="text-xs text-white/60">{studio.tagline}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div
        ref={contentRef}
        className="relative flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-[0_35px_120px_rgba(15,23,42,0.7)] lg:min-h-[32rem] lg:flex-row"
      >
        <aside
          className={`relative hidden flex-col border-b border-white/5 bg-slate-950/60 transition-all duration-500 lg:flex lg:border-b-0 lg:border-r ${
            sidebarOpen ? "lg:w-80" : "lg:w-24"
          }`}
        >
          <div className="flex items-center justify-between px-4 py-4 sm:px-5 sm:py-6">
            {sidebarOpen ? (
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-white/40">brand wall</p>
                <h2 className="text-lg font-semibold text-white">로고 스택</h2>
              </div>
            ) : (
              <p className="text-xs uppercase tracking-[0.4em] text-white/40">logos</p>
            )}
            <button
              aria-label="사이드바 밀기"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="group flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            >
              <span className={`text-sm transition-transform duration-500 ${sidebarOpen ? "rotate-0" : "rotate-180"}`}>
                ⇤
              </span>
            </button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-3 pb-4 sm:px-4 sm:pb-6">
            {studios.map((studio) => {
              const isActive = studio.slug === activeSlug;
              return (
                <button
                  key={studio.slug}
                  onClick={() => updateGlobalSlug(studio.slug)}
                  className={`flex items-center gap-4 rounded-2xl px-3 py-2 text-left transition ${
                    isActive ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${studio.accent}`}
                  >
                    <Image
                      src={studio.logo}
                      alt={`${studio.name} logo`}
                      width={44}
                      height={44}
                      className="h-9 w-9"
                    />
                  </span>
                  {sidebarOpen ? (
                    <span className="flex flex-col">
                      <strong className="text-sm text-white">{studio.name}</strong>
                      <span className="text-xs text-white/60">{studio.tagline}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="border-t border-white/5 px-4 py-4 text-center text-xs text-white/50 lg:text-left">
            {sidebarOpen ? "로고를 선택해 스토리를 불러오세요" : "탭"}
          </div>
        </aside>
        <div className="flex flex-1 flex-col gap-6 p-6 sm:p-8">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.5em] text-white/50">{activeStudio.category}</p>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-4xl font-semibold text-white">{activeStudio.name}</h2>
              <span className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/60">
                {activeStudio.tagline}
              </span>
            </div>
            <p className="max-w-3xl text-base text-white/70">{activeStudio.summary}</p>
          </div>
          <div className="mdx-content max-w-4xl">
            <Content />
          </div>
        </div>
      </div>
      <VotePanel slug={activeStudio.slug} title={activeStudio.name} />
      <CommentPanel slug={activeStudio.slug} title={activeStudio.name} />
    </section>
  );
}
