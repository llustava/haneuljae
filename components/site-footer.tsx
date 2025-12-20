import Link from "next/link";
import type { SVGProps } from "react";

const instagramUrl = process.env.NEXT_PUBLIC_INSTAGRAM_LINK?.trim() || "https://instagram.com/llustava";

export default function SiteFooter() {
  return (
    <footer className="relative mt-16 border-t border-white/5 bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-900/70">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.4em] text-white/60">field transmissions</p>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="text-2xl font-semibold text-white">현장을 잇는 채널</h4>
              <p className="text-sm text-white/60">
                실험 노트를 가장 먼저 전하는 인스타그램에서 비하인드를 만나보세요.
              </p>
            </div>
            <Link
              href={instagramUrl}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/60 hover:bg-white/20"
            >
              <span className="sr-only">Instagram 계정으로 이동</span>
              <InstagramIcon className="h-5 w-5 text-white transition group-hover:scale-110" />
              <span className="tracking-wide">Follow on Instagram</span>
            </Link>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-5 text-sm text-white/70 sm:flex-row sm:items-center sm:justify-between">
          <p>Special Thanks to BSAu_star (J. H. Yoon), fracpa (M. S. Kim)</p>
          <p className="text-white/50">© 2025 llustava. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

type IconProps = SVGProps<SVGSVGElement>;

function InstagramIcon({ className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}
