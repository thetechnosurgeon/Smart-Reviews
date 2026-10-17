"use client";

import { CONTACT_EMAIL } from "../lib/config";

type FooterProps = {
  signedIn?: boolean;
  connected?: boolean;
  isAdmin?: boolean;
  canOpenReviewLink?: boolean;
  onConnect?: () => void;
  onSignOut?: () => void;
  onDisconnect?: () => void;
  onOpenTemplates?: () => void;
  onOpenReviewLink?: () => void;
};

const linkCls =
  "text-left text-sm text-white/60 transition hover:text-white";

function Column({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-[#FFD84D]">
        {title}
      </p>
      <ul className="mt-4 flex flex-col gap-2.5">{children}</ul>
    </div>
  );
}

export default function Footer({
  signedIn = false,
  connected = false,
  isAdmin = false,
  canOpenReviewLink = false,
  onConnect,
  onSignOut,
  onDisconnect,
  onOpenTemplates,
  onOpenReviewLink,
}: FooterProps) {
  return (
    <footer className="mt-20 bg-[#0B0C10] text-white">
      <div className="h-1 w-full bg-[linear-gradient(90deg,#1957C9,#FFD84D,#16A34A)]" />

      <div className="mx-auto max-w-7xl px-6 py-14 md:px-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo-horizontal-dark.png"
              alt="Smart Repute"
              className="h-12 w-auto md:h-16"
            />
            <p className="mt-5 max-w-xs text-sm leading-6 text-white/60">
              AI Replies &amp; Reputation Growth. Reply to every Google review
              in your own voice, and approve each reply before it goes live.
            </p>
          </div>

          <Column title="Quick links">
            <li>
              <a href="/#reviews" className={linkCls}>
                Reviews
              </a>
            </li>
            {connected && onOpenTemplates && (
              <li>
                <button onClick={onOpenTemplates} className={linkCls}>
                  Reply templates
                </button>
              </li>
            )}
            {connected && canOpenReviewLink && onOpenReviewLink && (
              <li>
                <button onClick={onOpenReviewLink} className={linkCls}>
                  Get more reviews
                </button>
              </li>
            )}
            {CONTACT_EMAIL && (
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className={linkCls}>
                  Contact us
                </a>
              </li>
            )}
            <li>
              <a
                href="https://business.google.com"
                target="_blank"
                rel="noreferrer"
                className={linkCls}
              >
                Google Business Profile
              </a>
            </li>
          </Column>

          <Column title="Legal">
            <li>
              <a href="/privacy" className={linkCls}>
                Privacy Policy
              </a>
            </li>
            <li>
              <a href="/terms" className={linkCls}>
                Terms of Service
              </a>
            </li>
          </Column>

          <Column title="Account">
            {!signedIn && (
              <li>
                {onConnect ? (
                  <button onClick={onConnect} className={linkCls}>
                    Connect Google Business Profile
                  </button>
                ) : (
                  <a href="/" className={linkCls}>
                    Open the app
                  </a>
                )}
              </li>
            )}
            {signedIn && onSignOut && (
              <li>
                <button onClick={onSignOut} className={linkCls}>
                  Sign out
                </button>
              </li>
            )}
            {signedIn && onDisconnect && (
              <li>
                <button onClick={onDisconnect} className={linkCls}>
                  Disconnect Google account
                </button>
              </li>
            )}
            {isAdmin && (
              <li>
                <a href="/admin" className={linkCls}>
                  Admin overview
                </a>
              </li>
            )}
          </Column>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-white/40 md:flex-row md:items-center md:justify-between">
          <p>&copy; {new Date().getFullYear()} Smart Repute. All rights reserved.</p>
          <p>
            Google and Google Business Profile are trademarks of Google LLC.
            Smart Repute is not affiliated with or endorsed by Google.
          </p>
        </div>
      </div>
    </footer>
  );
}
