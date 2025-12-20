export default function ExperienceBanner() {
  return (
    <div className="relative mb-10 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-sky-500/20 via-indigo-500/20 to-fuchsia-500/20 p-[1px]">
      <div className="relative flex flex-col gap-6 rounded-[calc(1.5rem-2px)] bg-slate-950/60 p-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.5em] text-white/60">
            live template
          </p>
          <h1 className="text-3xl font-semibold text-white">
            Sidebar Logos + MDX 블로그 템플릿
          </h1>
          <p className="max-w-2xl text-sm text-white/70">
            브랜드 로고를 선택하고, MDX 글과 이미지를 한 화면에서 미리보기하세요.
            상단 배너는 공지나 캠페인을 노출하도록 디자인했습니다.
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm sm:flex-row">
          <button className="rounded-full border border-white/30 px-6 py-3 text-white transition hover:border-sky-300 hover:text-sky-100">
            배너 문구 편집
          </button>
          <button className="rounded-full bg-white/90 px-6 py-3 font-semibold text-slate-900 transition hover:bg-white">
            바로 적용하기
          </button>
        </div>
        <span className="pointer-events-none absolute -top-10 right-32 h-32 w-32 rounded-full bg-sky-400/30 blur-3xl" />
        <span className="pointer-events-none absolute -bottom-12 left-12 h-24 w-24 rounded-full bg-fuchsia-400/30 blur-3xl" />
      </div>
    </div>
  );
}
