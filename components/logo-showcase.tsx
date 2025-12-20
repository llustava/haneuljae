"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import AuroraLens from "@/content/aurora-lens.mdx";
import SolsticeMarket from "@/content/solstice-market.mdx";
import NebulaLab from "@/content/nebula-lab.mdx";
import VotePanel from "@/components/vote-panel";

const studios = [
  {
    slug: "aurora-lens",
    name: "Aurora Lens",
    tagline: "Polar field studio",
    summary:
      "빙설 원정과 실시간 내러티브를 결합한 필드 스튜디오. 드론, 레이더, 인터렉션 로그를 하나의 MDX 노트로 묶어 팀과 공유합니다.",
    category: "FIELD DOCS",
    accent: "from-sky-400/70 to-cyan-300/70",
    logo: "/logos/aurora.svg",
    Content: AuroraLens,
  },
  {
    slug: "solstice-market",
    name: "Solstice Market",
    tagline: "Traveling sensory shop",
    summary:
      "계절형 팝업과 투어링 마켓을 동시에 설계해 관람객 피드백을 즉각 반영합니다. 현장에서 큐레이션 노트를 스트리밍합니다.",
    category: "POP-UP",
    accent: "from-amber-300/80 to-orange-500/60",
    logo: "/logos/solstice.svg",
    Content: SolsticeMarket,
  },
  {
    slug: "nebula-lab",
    name: "Nebula Lab",
    tagline: "Sensorial data theater",
    summary:
      "도시 센서 데이터를 전시 환경으로 전환하는 실험실. 냄새, 빛, 소리를 데이터 인터페이스에 맞춰 재구성합니다.",
    category: "DATA SPACE",
    accent: "from-fuchsia-400/70 to-indigo-500/60",
    logo: "/logos/nebula.svg",
    Content: NebulaLab,
  },
];

export default function LogoShowcase() {
  const [activeSlug, setActiveSlug] = useState(studios[0].slug);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeStudio = useMemo(() => studios.find((studio) => studio.slug === activeSlug)!, [activeSlug]);
  const Content = activeStudio.Content;

  return (
    <section className="flex w-full flex-col gap-8">
      <div className="relative flex min-h-[32rem] overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 shadow-[0_35px_120px_rgba(15,23,42,0.7)]">
        <aside
          className={`relative flex flex-col border-r border-white/5 bg-slate-950/60 transition-[width] duration-500 ${
            sidebarOpen ? "w-80" : "w-24"
          }`}
        >
          <div className="flex items-center justify-between px-5 py-6">
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
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-6">
            {studios.map((studio) => {
              const isActive = studio.slug === activeSlug;
              return (
                <button
                  key={studio.slug}
                  onClick={() => setActiveSlug(studio.slug)}
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
          <div className="border-t border-white/5 px-5 py-6 text-xs text-white/50">
            {sidebarOpen ? "로고를 선택해 스토리를 불러오세요" : "탭"}
          </div>
        </aside>
        <div className="flex flex-1 flex-col gap-6 p-8">
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
    </section>
  );
}
