"use client";

import { useEffect, useState } from "react";

import Footer from "../components/Footer";
import SiteNav from "../components/SiteNav";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://smart-reviews.onrender.com";

type AdminAccount = {
  email: string;
  name: string | null;
  business: string | null;
  created_at: string;
  last_login_at: string | null;
  connected: boolean;
  consented: boolean;
  generated: number;
  posted: number;
};

type Overview = {
  days: number;
  daily_limit: number;
  totals: {
    accounts: number;
    connected: number;
    consented: number;
    generated: number;
    posted: number;
  };
  accounts: AdminAccount[];
};

type ViewState = "loading" | "signin" | "denied" | "error" | "ready";

function formatDate(iso: string | null): string {
  if (!iso) {
    return "\u2013";
  }

  const d = new Date(iso);

  return Number.isNaN(d.getTime())
    ? "\u2013"
    : d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

export default function AdminPage() {
  const [state, setState] = useState<ViewState>("loading");
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch(`${API_URL}/admin/overview`, {
          credentials: "include",
        });

        if (response.status === 401) {
          setState("signin");
          return;
        }

        if (response.status === 403) {
          setState("denied");
          return;
        }

        if (!response.ok) {
          setState("error");
          return;
        }

        setData(await response.json());
        setState("ready");
      } catch {
        setState("error");
      }
    }

    load();
  }, []);

  const totals = data?.totals;

  return (
    <main className="min-h-screen bg-[#F4F7FC] text-[#0B0C10]">
      <SiteNav>
        <a
          href="/"
          className="rounded-lg px-3 py-2 transition hover:text-white"
        >
          Back to app
        </a>
      </SiteNav>

      <div className="mx-auto max-w-7xl px-6 py-12 md:px-10">
        <h1 className="text-3xl font-bold tracking-[-0.02em]">
          Admin overview
        </h1>

        {state === "loading" && (
          <p className="mt-6 text-sm text-[#5A6B86]">Loading...</p>
        )}

        {state === "signin" && (
          <p className="mt-6 text-sm text-[#5A6B86]">
            Please sign in on the main page first, then come back here.
          </p>
        )}

        {state === "denied" && (
          <p className="mt-6 text-sm text-[#5A6B86]">
            This page is only available to the account owner.
          </p>
        )}

        {state === "error" && (
          <p className="mt-6 text-sm text-red-600">
            Could not load the overview. Please try again.
          </p>
        )}

        {state === "ready" && data && totals && (
          <>
            <p className="mt-2 text-sm text-[#5A6B86]">
              Usage covers the last {data.days} days. Daily generation limit
              per business: {data.daily_limit}.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-5">
              {[
                { label: "Accounts", value: totals.accounts, accent: "#1957C9" },
                { label: "Connected", value: totals.connected, accent: "#2F7DE1" },
                { label: "Accepted terms", value: totals.consented, accent: "#16A34A" },
                { label: "Replies generated", value: totals.generated, accent: "#F2A100" },
                { label: "Replies posted", value: totals.posted, accent: "#0B0C10" },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className="rounded-xl border border-black/10 bg-white px-5 py-4 shadow-sm"
                  style={{ borderTop: `3px solid ${tile.accent}` }}
                >
                  <div className="text-3xl font-bold">{tile.value}</div>
                  <div className="mt-1 text-sm text-[#5A6B86]">{tile.label}</div>
                </div>
              ))}
            </div>

            <div className="mt-8 overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-sm">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-[#0B0C10] text-xs text-white/80">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Business</th>
                    <th className="px-4 py-3 font-semibold">Connected</th>
                    <th className="px-4 py-3 font-semibold">Terms</th>
                    <th className="px-4 py-3 text-right font-semibold">Generated</th>
                    <th className="px-4 py-3 text-right font-semibold">Posted</th>
                    <th className="px-4 py-3 font-semibold">Last login</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((a) => (
                    <tr key={a.email} className="border-t border-black/5">
                      <td className="px-4 py-3 font-medium">{a.email}</td>
                      <td className="px-4 py-3 text-[#5A6B86]">{a.business || "\u2013"}</td>
                      <td className="px-4 py-3">{a.connected ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">{a.consented ? "Accepted" : "Pending"}</td>
                      <td className="px-4 py-3 text-right">{a.generated}</td>
                      <td className="px-4 py-3 text-right">{a.posted}</td>
                      <td className="px-4 py-3 text-[#5A6B86]">{formatDate(a.last_login_at)}</td>
                      <td className="px-4 py-3 text-[#5A6B86]">{formatDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Footer signedIn={state === "ready"} isAdmin />
    </main>
  );
}
