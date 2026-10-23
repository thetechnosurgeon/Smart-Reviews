import type { ReactNode } from "react";

// Transparent over the landing hero, solid black everywhere else.
export default function SiteNav({
  children,
  solid = false,
}: {
  children?: ReactNode;
  solid?: boolean;
}) {
  return (
    <header className={solid ? "nav nav--solid" : "nav"}>
      <div className="wrap">
        <a href="/" aria-label="Smart Repute home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-dark.png" alt="Smart Repute" />
        </a>

        <nav className="nav-links">{children}</nav>
      </div>
    </header>
  );
}
