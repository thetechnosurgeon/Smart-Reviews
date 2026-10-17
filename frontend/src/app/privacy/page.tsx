import type { ReactNode } from "react";

import Footer from "../components/Footer";
import SiteNav from "../components/SiteNav";
import { CONTACT_EMAIL } from "../lib/config";

export const metadata = {
  title: "Privacy Policy | Smart Repute",
  description:
    "How Smart Repute accesses, uses, stores, shares and protects your Google user data, how long we keep it, and how to have it deleted.",
};

// Who runs the service. Edit these two lines if the operator changes.
const OPERATOR = "Dr. Abhinav Rao";
const LOCATION = "Chennai, Tamil Nadu, India";
const LAST_UPDATED = "17 October 2026";

const GOOGLE_POLICY =
  "https://developers.google.com/terms/api-services-user-data-policy";
const GOOGLE_PERMISSIONS = "https://myaccount.google.com/permissions";
const BUSINESS_SCOPE = "https://www.googleapis.com/auth/business.manage";

type Block =
  | { p: string }
  | { ul: string[] }
  | { table: { head: string[]; rows: string[][] } }
  | { link: { before: string; text: string; href: string; after?: string } };

type Section = { id: string; title: string; blocks: Block[] };

const SUMMARY: string[] = [
  "Smart Repute reads the Google reviews of the business profiles you connect, helps you draft replies with AI, and publishes a reply only after you approve it.",
  "We access your Google name, email address and profile picture to sign you in, and your Google Business Profile data (the businesses you manage, their reviews and rating) to provide the app. We request no other Google data.",
  "We never sell your data, never use it for advertising, and never use it to train AI models.",
  "Your customers' reviews are read from Google when you use the app. We do not keep a copy in our database.",
  "You can disconnect Smart Repute at any time, in the app or in your Google Account, and you can ask us to delete your data.",
];

const SECTIONS: Section[] = [
  {
    id: "who-we-are",
    title: "1. Who we are and what this policy covers",
    blocks: [
      {
        p: `Smart Repute (www.smartrepute.com) is a web application operated by ${OPERATOR}, ${LOCATION} ("Smart Repute", "we", "us"). It helps people who manage a Google Business Profile to read their Google reviews, draft replies with the help of AI, approve those replies, and publish them to Google.`,
      },
      {
        p: "This policy explains what information we collect, including the Google user data the app accesses, how we use, store, share and protect it, how long we keep it, and how you can have it deleted. It applies to the Smart Repute website and app at www.smartrepute.com.",
      },
    ],
  },
  {
    id: "google-data",
    title: "2. Google user data we access",
    blocks: [
      {
        p: "When you click Connect, Google asks you to approve the permissions below. Smart Repute accesses the following Google user data:",
      },
      {
        table: {
          head: ["What we access", "Google permission", "Why we need it"],
          rows: [
            [
              "Your Google account ID, email address, name and profile picture",
              "openid, email, profile",
              "To create and recognise your Smart Repute account, sign you in, and show who is signed in.",
            ],
            [
              "The Google Business Profile accounts and locations you manage, including each location's name, address and Google review link",
              BUSINESS_SCOPE,
              "To let you choose which business to work on, and to give you the link customers use to leave a Google review.",
            ],
            [
              "The reviews of the location you select: the reviewer's display name, star rating, comment, date and any existing reply, plus the location's average rating and total number of reviews",
              BUSINESS_SCOPE,
              "To show your reviews and rating, to draft replies, and to work out how many reviews it would take to reach your rating goal.",
            ],
            [
              "Permission to publish replies to reviews on your behalf",
              BUSINESS_SCOPE,
              "To post a reply to Google, only for replies you have reviewed and approved yourself.",
            ],
          ],
        },
      },
      {
        p: "We use these permissions only for the features described in this policy. Smart Repute does not edit your business information, opening hours, photos or posts, and does not access Gmail, Drive, Calendar or any other Google service. Google does not give us your reviewers' email addresses or contact details.",
      },
    ],
  },
  {
    id: "other-data",
    title: "3. Other information we keep",
    blocks: [
      {
        ul: [
          "Account and consent records: your account ID, when you first and last signed in, and the date and version of the terms you accepted.",
          "Your sign-in credential: an encrypted Google refresh token, which lets Smart Repute keep working for you without asking you to sign in again for every action.",
          "Your settings: the business you last selected, the reply templates you write, and up to 10 reviews-and-replies that you choose to save as style examples for future drafts (these contain review text and your reply text).",
          "Usage counts: how many replies were generated and posted each day, used to apply fair-use limits and to understand how the service is used.",
          "Technical information: standard server logs kept by our hosting provider (such as IP address, browser type and pages requested) for security and troubleshooting.",
        ],
      },
    ],
  },
  {
    id: "how-we-use",
    title: "4. How we use Google user data",
    blocks: [
      {
        p: "We use Google user data only to provide and improve the user-facing features of Smart Repute that you ask for:",
      },
      {
        ul: [
          "to sign you in and show your business, reviews, rating and rating goal;",
          "to generate draft replies to your reviews and show them to you for editing and approval;",
          "to publish a reply to Google when, and only when, you approve it;",
          "to protect the service and your account from misuse, and to apply fair-use limits.",
        ],
      },
      {
        p: "We do not use Google user data for advertising of any kind, including personalised, retargeted or interest-based advertising. We do not sell it or provide it to data brokers or information resellers, we do not use it to determine credit-worthiness or for lending, and we do not build databases of it for any other purpose.",
      },
      {
        p: "We do not use Google user data to develop, improve or train any artificial-intelligence or machine-learning model, whether generalised or personalised. Review text is sent to an AI service only to produce the draft reply you asked for (see section 5).",
      },
      {
        link: {
          before:
            "Smart Repute's use and transfer to any other app of information received from Google APIs will adhere to the ",
          text: "Google API Services User Data Policy",
          href: GOOGLE_POLICY,
          after: ", including the Limited Use requirements.",
        },
      },
    ],
  },
  {
    id: "ai",
    title: "5. AI-generated replies",
    blocks: [
      {
        p: "To draft a reply, Smart Repute sends the following to our AI service provider, Groq (Groq, Inc.): the review text, its star rating, the reviewer's display name, up to two of your saved style examples for that kind of review, and written instructions about tone and content. We do not send your email address, your Google credentials or any other account information.",
      },
      {
        p: "The AI service processes this only to return a draft to you. Under Groq's published terms, inputs and outputs are not retained by default, may be logged temporarily only to investigate service faults or abuse, and may not be used to train or fine-tune AI models without the customer's instruction. We give no such instruction. Groq may process requests on infrastructure in the United States.",
      },
      {
        p: "Drafts are suggestions only. Smart Repute never publishes an AI-written reply unless you have reviewed and approved it.",
      },
      {
        p: "Reviews can contain personal or health-related details written by your customers. Our drafting instructions tell the AI not to repeat personal details in a reply, but you remain responsible for checking every reply before you approve it.",
      },
    ],
  },
  {
    id: "sharing",
    title: "6. Who we share Google user data with",
    blocks: [
      {
        p: "We share Google user data only with the service providers that help us run the app, and only as needed to provide the features above:",
      },
      {
        ul: [
          "Google, to read your reviews and publish your approved replies through the Google Business Profile API;",
          "Groq, to generate draft replies (see section 5);",
          "Render (Render Services, Inc.), which hosts our website, servers and database.",
        ],
      },
      {
        p: "We do not sell, rent or trade your data. We do not transfer or disclose Google user data to anyone else, except: with your explicit consent; where required by law, legal process or a valid government request; to protect the security of the service or investigate abuse; or as part of a merger, acquisition or sale of assets, and then only with your prior consent.",
      },
      {
        p: 'When you open the "Get more reviews" pop-up, the QR code image is generated by a third-party service (api.qrserver.com), which receives your public Google review link and your device\'s IP address. It receives no other information from us.',
      },
    ],
  },
  {
    id: "human-access",
    title: "7. Who can see your data at Smart Repute",
    blocks: [
      {
        p: "Our team does not read the content of your Google user data, such as your reviews and replies, except: when you ask for support and give us permission; where needed for security purposes or to investigate abuse; or to comply with the law. To run the service, the operator can see an overview of accounts showing each account's email address, selected business name, whether it is connected, and daily usage counts.",
      },
    ],
  },
  {
    id: "security",
    title: "8. How we protect your data",
    blocks: [
      {
        ul: [
          "All traffic between your browser, our servers and Google is encrypted with HTTPS (TLS).",
          "Your Google refresh token is encrypted before it is stored (Fernet authenticated encryption), using a key held in our server configuration and not in the database.",
          "Sign-in sessions use signed, HttpOnly, Secure cookies, and the Google sign-in flow is protected against cross-site request forgery.",
          "Every request for data is tied to the signed-in account. One customer's information is never available to another.",
          "We do not keep your reviews. They are fetched from Google when you open the app and held in your browser's memory while you work. This also keeps us within Google's limit on storing review content.",
          "Access to our production systems is restricted to the operator.",
        ],
      },
    ],
  },
  {
    id: "retention",
    title: "9. How long we keep data, and how to delete it",
    blocks: [
      {
        ul: [
          "Reviews and ratings from Google: not stored by us.",
          "Google sign-in credential: kept until you disconnect or Google revokes it. When you click Disconnect in the app, we revoke the token at Google and delete it from our database straight away.",
          "Account details, settings, templates, saved style examples and usage counts: kept while your account is active, and deleted when you ask us to delete your account.",
        ],
      },
      {
        p: "To delete your account and the data we hold, email us at the address in section 16 from the email address you signed in with. We will confirm and complete the deletion within 30 days. Copies in our hosting provider's routine backups are overwritten as those backups expire.",
      },
      {
        link: {
          before:
            "You can also withdraw Smart Repute's access to your Google account at any time in your ",
          text: "Google Account permissions",
          href: GOOGLE_PERMISSIONS,
          after:
            ". This immediately stops Smart Repute from reading or posting anything on your behalf.",
        },
      },
    ],
  },
  {
    id: "cookies",
    title: "10. Cookies and local storage",
    blocks: [
      {
        ul: [
          "sr_session: keeps you signed in. Signed, HttpOnly and Secure; lasts up to 30 days. Essential.",
          "sr_oauth_state: a short-lived security token used only while you sign in with Google. Essential.",
          "smartrepute:target:... (browser local storage): remembers the rating goal you choose for each business. It stays in your browser and is not sent to us.",
        ],
      },
      {
        p: "We do not use advertising or analytics cookies, and we do not run third-party trackers.",
      },
    ],
  },
  {
    id: "rights",
    title: "11. Your choices and rights",
    blocks: [
      {
        p: "You can disconnect Smart Repute at any time using Disconnect in the app, or in your Google Account permissions. You can ask us what we hold about you, ask us to correct it or delete it, and withdraw your consent at any time. Depending on where you live you may have further rights, for example under India's Digital Personal Data Protection Act, 2023, or the EU and UK GDPR. We handle requests from everyone in the same way. Write to the contact address in section 16 and we will reply within 30 days.",
      },
    ],
  },
  {
    id: "reviewers",
    title: "12. Information about your customers",
    blocks: [
      {
        p: "Reviews contain information written by your customers, such as their public Google display name and whatever they chose to write. We process it on your behalf, only to show it to you and help you reply. We do not contact reviewers, do not build profiles of them and do not use their reviews for any other purpose.",
      },
    ],
  },
  {
    id: "international",
    title: "13. International processing",
    blocks: [
      {
        p: "Our hosting provider and AI provider may process data in countries other than India, including the United States. We choose providers that commit to protecting customer data by contract.",
      },
    ],
  },
  {
    id: "children",
    title: "14. Children",
    blocks: [
      {
        p: "Smart Repute is a business tool and is not intended for anyone under 18.",
      },
    ],
  },
  {
    id: "changes",
    title: "15. Changes to this policy",
    blocks: [
      {
        p: "If we change how we use Google user data, we will update this policy and the date above, and ask you to accept the updated terms in the app before you continue. We will not use Google user data for a new purpose without your consent.",
      },
    ],
  },
];

function renderBlock(block: Block, key: number): ReactNode {
  if ("p" in block) {
    return (
      <p key={key} className="mt-3">
        {block.p}
      </p>
    );
  }

  if ("ul" in block) {
    return (
      <ul key={key} className="mt-3 list-disc space-y-2 pl-6">
        {block.ul.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if ("table" in block) {
    return (
      <div
        key={key}
        className="mt-4 overflow-x-auto rounded-xl border border-black/10 bg-white"
      >
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-[#0B0C10] text-xs text-white/85">
            <tr>
              {block.table.head.map((h) => (
                <th key={h} className="px-4 py-3 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.table.rows.map((row) => (
              <tr
                key={row[0] + row[2]}
                className="border-t border-black/5 align-top"
              >
                {row.map((cell, i) => (
                  <td
                    key={i}
                    className={`px-4 py-3 ${
                      i === 1 ? "break-all font-mono text-xs" : ""
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <p key={key} className="mt-3">
      {block.link.before}
      <a
        href={block.link.href}
        target="_blank"
        rel="noreferrer"
        className="font-medium text-[#1957C9] underline"
      >
        {block.link.text}
      </a>
      {block.link.after}
    </p>
  );
}

export default function PrivacyPolicy() {
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

      <div className="mx-auto max-w-3xl px-6 py-14 md:px-10 md:py-20">
        <h1 className="text-3xl font-bold tracking-[-0.02em] md:text-4xl">
          Privacy Policy
        </h1>

        <p className="mt-2 text-sm text-[#5A6B86]">
          Smart Repute &middot; Last updated: {LAST_UPDATED}
        </p>

        <div className="mt-8 rounded-2xl border border-[#1957C9]/20 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">In short</h2>

          <ul className="mt-3 list-disc space-y-2 pl-6 text-[15px] leading-7">
            {SUMMARY.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <nav aria-label="Contents" className="mt-8 text-sm text-[#5A6B86]">
          <p className="font-semibold text-[#0B0C10]">Contents</p>

          <ul className="mt-2 grid gap-x-8 gap-y-1 sm:grid-cols-2">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="hover:text-[#1957C9] hover:underline"
                >
                  {s.title}
                </a>
              </li>
            ))}
            <li>
              <a
                href="#contact"
                className="hover:text-[#1957C9] hover:underline"
              >
                16. Contact us
              </a>
            </li>
          </ul>
        </nav>

        <div className="mt-10 flex flex-col gap-10 text-[15px] leading-7 text-[#0B0C10]/90">
          {SECTIONS.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-8">
              <h2 className="text-xl font-semibold text-[#0B0C10]">
                {section.title}
              </h2>

              {section.blocks.map((block, i) => renderBlock(block, i))}
            </section>
          ))}

          <section id="contact" className="scroll-mt-8">
            <h2 className="text-xl font-semibold text-[#0B0C10]">
              16. Contact us
            </h2>

            <p className="mt-3">
              Smart Repute is operated by {OPERATOR}, {LOCATION}. For any
              question about this policy, to exercise your rights, or to ask
              for your data to be deleted, contact us at{" "}
              {CONTACT_EMAIL ? (
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="font-medium text-[#1957C9] underline"
                >
                  {CONTACT_EMAIL}
                </a>
              ) : (
                "drabhinavrao2000@gmail.com"
              )}
              .
            </p>

            <p className="mt-3">
              See also our{" "}
              <a
                href="/terms"
                className="font-medium text-[#1957C9] underline"
              >
                Terms of Service
              </a>
              .
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </main>
  );
}
