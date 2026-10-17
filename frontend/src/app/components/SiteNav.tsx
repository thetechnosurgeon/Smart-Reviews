import type { ReactNode } from "react";

export default function SiteNav({ children }: { children?: ReactNode }) {
  return (
    <header className="border-b border-white/10 bg-[#0B0C10]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4 md:px-10 md:py-5">
        <a href="/" aria-label="Smart Repute home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-horizontal-dark.png"
            alt="Smart Repute"
            className="h-10 w-auto sm:h-14 lg:h-[72px]"
          />
        </a>

        <nav className="flex items-center gap-1 text-sm text-white/70 md:gap-3">
          {children}
        </nav>
      </div>
    </header>
  );
}
