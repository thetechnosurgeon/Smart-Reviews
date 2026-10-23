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
    <footer className="foot">
      <div className="wrap">
        <div className="foot-top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-horizontal-dark.png" alt="Smart Repute" />

          <ul className="foot-links">
            <li>
              <a href="/#reviews">Reviews</a>
            </li>

            {connected && onOpenTemplates && (
              <li>
                <button className="textbtn" onClick={onOpenTemplates}>
                  Reply templates
                </button>
              </li>
            )}

            {connected && canOpenReviewLink && onOpenReviewLink && (
              <li>
                <button className="textbtn" onClick={onOpenReviewLink}>
                  Get more reviews
                </button>
              </li>
            )}

            <li>
              <a href="/privacy">Privacy Policy</a>
            </li>

            <li>
              <a href="/terms">Terms of Service</a>
            </li>

            {CONTACT_EMAIL && (
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`}>Contact</a>
              </li>
            )}

            <li>
              <a
                href="https://business.google.com"
                target="_blank"
                rel="noreferrer"
              >
                Google Business Profile
              </a>
            </li>

            {!signedIn && (
              <li>
                {onConnect ? (
                  <button className="textbtn" onClick={onConnect}>
                    Connect Google Business Profile
                  </button>
                ) : (
                  <a href="/">Open the app</a>
                )}
              </li>
            )}

            {signedIn && onSignOut && (
              <li>
                <button className="textbtn" onClick={onSignOut}>
                  Sign out
                </button>
              </li>
            )}

            {signedIn && onDisconnect && (
              <li>
                <button className="textbtn" onClick={onDisconnect}>
                  Disconnect Google account
                </button>
              </li>
            )}

            {isAdmin && (
              <li>
                <a href="/admin">Admin overview</a>
              </li>
            )}
          </ul>
        </div>

        <div className="foot-bottom">
          <p>
            &copy; {new Date().getFullYear()} Smart Repute. AI Replies
            &amp; Reputation Growth.
          </p>
          <p>
            Google and Google Business Profile are trademarks of Google
            LLC. Smart Repute is not affiliated with or endorsed by
            Google.
          </p>
        </div>
      </div>
    </footer>
  );
}
