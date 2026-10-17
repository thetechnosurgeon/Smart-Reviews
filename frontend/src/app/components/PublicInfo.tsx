// Everything here is visible to anyone, without signing in. Google's app
// verification requires the homepage to explain what the app does and why it
// asks for each Google permission. Keep this text consistent with /privacy.

const FEATURES: { title: string; text: string }[] = [
  {
    title: "AI-drafted replies",
    text: "Get a first draft for every review, written in a warm, professional tone. Add your own greeting and sign-off with reply templates, and teach the AI your style with saved examples.",
  },
  {
    title: "You approve every reply",
    text: "Nothing is ever published to Google until you have read, edited if you like, and approved that reply yourself.",
  },
  {
    title: "Your Google rating at a glance",
    text: "See your business name, the rating Google shows for it, your review count and a star-by-star breakdown in one place.",
  },
  {
    title: "A rating goal you choose",
    text: "Pick a target such as 4.7 and see how many 5-star reviews it would take to reach it, and why lower-rated reviews cannot get you there.",
  },
  {
    title: "Pages of 25 reviews",
    text: "Large profiles stay manageable: work through your reviews 25 at a time, generating and approving one page before moving to the next.",
  },
  {
    title: "Your Google review link",
    text: "Get your Google review link and a QR code to share with every customer, so asking for a review is easy.",
  },
];

const PERMISSIONS: { title: string; scope: string; text: string }[] = [
  {
    title: "Sign in with Google",
    scope: "openid, email, profile",
    text: "We use your Google name, email address and profile picture to create and recognise your Smart Repute account and to show who is signed in. Nothing else about your Google account is read.",
  },
  {
    title: "Manage your Business Profile",
    scope: "business.manage",
    text: "We use this to list the businesses you manage, read their reviews and rating, and publish a reply to a review only when you have approved it. Smart Repute does not change your business information, opening hours, photos or posts.",
  },
];

const COMMITMENTS: string[] = [
  "Nothing is published to Google without your approval.",
  "We never sell your data and never use it for advertising.",
  "Your Google data is never used to train AI models. Review text is sent to an AI service only to write the draft you asked for.",
  "Your reviews are not stored on our servers. They are read from Google when you open the app.",
  "You can disconnect at any time, in the app or in your Google Account permissions, and ask us to delete your data.",
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Does Smart Repute post replies automatically?",
    a: "No. It drafts replies and shows them to you. A reply is published to Google only after you approve it, and only when you choose to post your approved replies.",
  },
  {
    q: "Who is Smart Repute for?",
    a: "Anyone who manages a Google Business Profile and wants to answer customer reviews faster and more consistently, such as clinics, restaurants, salons, shops and other local businesses.",
  },
  {
    q: "Which Google permissions does it ask for, and why?",
    a: "Your name, email and profile picture to sign you in, and access to your Business Profile to read your reviews and rating and to publish replies you approve. The section above explains each one.",
  },
  {
    q: "Does Smart Repute keep a copy of my reviews?",
    a: "No. Reviews are fetched from Google each time you open the app and are held in your browser while you work. We keep only your account details, settings, reply templates and saved style examples.",
  },
  {
    q: "How do I disconnect or delete my data?",
    a: "Use Disconnect in the app to revoke our access straight away, or remove Smart Repute in your Google Account permissions. To delete your account and data, email us using the contact details in our Privacy Policy.",
  },
];

export function AboutSection() {
  return (
      <section
        id="about"
        className="mx-auto max-w-7xl scroll-mt-8 px-6 pb-4 md:px-10"
      >
        <h2 className="text-center text-2xl font-bold tracking-[-0.02em] md:text-3xl">
          Reply to every Google review, faster and in your own voice
        </h2>

        <p className="mx-auto mt-4 max-w-3xl text-center text-base leading-7 text-[#5A6B86]">
          Smart Repute is a web application for business owners who manage a
          Google Business Profile. It reads the reviews on your profile,
          drafts a reply to each one with AI, lets you edit and approve it,
          and then publishes your approved replies to Google for you.
        </p>

        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
            >
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5A6B86]">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>
  );
}

export function GoogleDataSection() {
  return (
      <section
        id="google-data"
        className="mx-auto max-w-7xl scroll-mt-8 px-6 py-16 md:px-10"
      >
        <div className="rounded-3xl border border-[#1957C9]/15 bg-white p-6 shadow-sm md:p-10">
          <h2 className="text-2xl font-bold tracking-[-0.02em] md:text-3xl">
            Why Smart Repute asks for access to your Google account
          </h2>

          <p className="mt-3 max-w-3xl text-base leading-7 text-[#5A6B86]">
            When you click Connect, Google asks you to approve the
            permissions below. We request only what the features above need,
            and we use your Google data only to provide them.
          </p>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {PERMISSIONS.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-black/10 p-6"
                style={{ borderTop: "4px solid #1957C9" }}
              >
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="mt-1 font-mono text-xs text-[#5A6B86]">
                  {p.scope}
                </p>
                <p className="mt-3 text-sm leading-6">{p.text}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-10 text-lg font-semibold">Our commitments</h3>

          <ul className="mt-3 list-disc space-y-2 pl-6 text-sm leading-6">
            {COMMITMENTS.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>

          <p className="mt-8 text-sm leading-6 text-[#5A6B86]">
            Smart Repute&apos;s use and transfer to any other app of
            information received from Google APIs adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-[#1957C9] underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. Read the full{" "}
            <a
              href="/privacy"
              className="font-medium text-[#1957C9] underline"
            >
              Privacy Policy
            </a>{" "}
            and{" "}
            <a href="/terms" className="font-medium text-[#1957C9] underline">
              Terms of Service
            </a>
            .
          </p>
        </div>
      </section>
  );
}

export function FaqSection() {
  return (
      <section
        id="faq"
        className="mx-auto max-w-4xl scroll-mt-8 px-6 pb-8 md:px-10"
      >
        <h2 className="text-center text-2xl font-bold tracking-[-0.02em] md:text-3xl">
          Frequently asked questions
        </h2>

        <div className="mt-8 flex flex-col gap-4">
          {FAQ.map((item) => (
            <div
              key={item.q}
              className="rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
            >
              <h3 className="text-base font-semibold">{item.q}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5A6B86]">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </section>
  );
}
