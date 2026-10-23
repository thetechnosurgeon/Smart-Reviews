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
    <main>
      <SiteNav solid>
        <a href="/">Back to app</a>
      </SiteNav>

      <div className="doc" style={{ maxWidth: 1240 }}>
        <p className="eyebrow">Owner only</p>

        <h1>Admin overview</h1>

        {state === "loading" && <p>Loading...</p>}

        {state === "signin" && (
          <p>Please sign in on the main page first, then come back here.</p>
        )}

        {state === "denied" && (
          <p>This page is only available to the account owner.</p>
        )}

        {state === "error" && (
          <p style={{ color: "#b9473f" }}>
            Could not load the overview. Please try again.
          </p>
        )}

        {state === "ready" && data && totals && (
          <>
            <p className="meta">
              Usage covers the last {data.days} days. Daily generation limit
              per business: {data.daily_limit}.
            </p>

            <div className="admin-stats">
              {[
                { label: "Accounts", value: totals.accounts },
                { label: "Connected", value: totals.connected },
                { label: "Accepted terms", value: totals.consented },
                { label: "Replies generated", value: totals.generated },
                { label: "Replies posted", value: totals.posted },
              ].map((tile) => (
                <div key={tile.label}>
                  <b>{tile.value}</b>
                  <span>{tile.label}</span>
                </div>
              ))}
            </div>

            <div className="tablewrap" style={{ marginTop: 48 }}>
              <table style={{ minWidth: 820 }}>
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Business</th>
                    <th>Connected</th>
                    <th>Terms</th>
                    <th>Generated</th>
                    <th>Posted</th>
                    <th>Last login</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accounts.map((a) => (
                    <tr key={a.email}>
                      <td>{a.email}</td>
                      <td>{a.business || "\u2013"}</td>
                      <td>{a.connected ? "Yes" : "No"}</td>
                      <td>{a.consented ? "Accepted" : "Pending"}</td>
                      <td>{a.generated}</td>
                      <td>{a.posted}</td>
                      <td>{formatDate(a.last_login_at)}</td>
                      <td>{formatDate(a.created_at)}</td>
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
