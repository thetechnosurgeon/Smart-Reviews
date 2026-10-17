import type { ReactNode } from "react";

export default function SiteNav({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B0C10]/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 md:px-10">
        <a href="/" aria-label="Smart Repute home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-horizontal-dark.png"
            alt="Smart Repute"
            className="h-10 w-auto"
          />
        </a>

        <nav className="flex items-center gap-1 text-sm text-white/70 md:gap-3">
          {children}
        </nav>
      </div>
    </header>
  );
}
