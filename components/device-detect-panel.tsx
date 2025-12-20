"use client";

import { useEffect, useState } from "react";
import { isMobile as detectMobileOnClient } from "react-device-detect";

type Props = {
  initialIsMobile: boolean;
  userAgent: string;
};

export default function DeviceDetectPanel({
  initialIsMobile,
  userAgent,
}: Props) {
  const [resolvedIsMobile, setResolvedIsMobile] = useState(initialIsMobile);
  const [detectionSource, setDetectionSource] = useState<"server" | "client">(
    "server",
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      setResolvedIsMobile(detectMobileOnClient);
      setDetectionSource("client");
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-950 px-6 py-16 text-slate-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_50%)]" />
      <div className="relative z-10 max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-10 text-center backdrop-blur">
        <p className="text-sm uppercase tracking-[0.35em] text-sky-300">Use Detect</p>
        <h1 className="mt-6 text-4xl font-semibold sm:text-5xl">
          {resolvedIsMobile ? "mobile detect" : "desktop detect"}
        </h1>
        <p className="mt-4 text-base text-slate-200">
          The first load relies on the request user-agent, while subsequent
          client-side transitions lean on react-device-detect to keep the value
          accurate.
        </p>
        <dl className="mt-8 grid grid-cols-1 gap-4 text-left text-sm text-slate-300 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <dt className="text-xs uppercase tracking-[0.25em] text-slate-400">
              현재 판별 소스
            </dt>
            <dd className="mt-2 text-lg font-medium capitalize text-white">
              {detectionSource}
            </dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <dt className="text-xs uppercase tracking-[0.25em] text-slate-400">
              서버 초기 판별 값
            </dt>
            <dd className="mt-2 text-lg font-medium text-white">
              {initialIsMobile ? "mobile" : "desktop"}
            </dd>
          </div>
          <div className="col-span-full rounded-2xl border border-white/10 bg-black/40 p-4">
            <dt className="text-xs uppercase tracking-[0.25em] text-slate-400">
              User-Agent
            </dt>
            <dd className="mt-2 break-words font-mono text-xs text-slate-200">
              {userAgent || "(no user-agent)"}
            </dd>
          </div>
        </dl>
      </div>
    </main>
  );
}
