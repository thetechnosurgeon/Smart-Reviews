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
    text: "Pick a target such as 4.7 and see how many 5-star reviews it would take to reach it, based on the mix of ratings your business really gets.",
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

const STEPS: { n: string; title: string; text: string }[] = [
  {
    n: "01",
    title: "Connect",
    text: "Sign in with Google and pick your business. We never see your password.",
  },
  {
    n: "02",
    title: "Generate",
    text: "Get a reply drafted for every review, 25 at a time, written to sound like you.",
  },
  {
    n: "03",
    title: "Approve and post",
    text: "Edit if you like, approve each reply, then publish them all in one click.",
  },
];

export function AboutSection() {
  return (
    <section id="about" className="sec">
      <div className="wrap">
        <div className="sec-head">
          <p className="eyebrow">What it does</p>

          <h2 className="h2">
            Reply to every Google review, faster and in your own voice
          </h2>

          <p className="lead">
            Smart Repute is a web application for business owners who
            manage a Google Business Profile. It reads the reviews on your
            profile, drafts a reply to each one with AI, lets you edit and
            approve it, and then publishes your approved replies to Google
            for you.
          </p>
        </div>

        <div className="spec">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="spec-row">
              <span className="n">{String(i + 1).padStart(2, "0")}</span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function StepsSection() {
  return (
    <section id="how-it-works" className="sec sec--mist">
      <div className="wrap">
        <div className="sec-head">
          <p className="eyebrow">How it works</p>
          <h2 className="h2">Three steps from review to reply</h2>
        </div>

        <div className="steps">
          {STEPS.map((step) => (
            <div key={step.n} className="step">
              <div className="num">{step.n}</div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function GoogleDataSection() {
  return (
    <section id="google-data" className="sec dark">
      <div className="wrap">
        <div className="data-grid">
          <div>
            <p className="eyebrow">Your Google data</p>

            <h2 className="h2">
              Why Smart Repute asks for access to your Google account
            </h2>

            <p className="lead">
              When you click Connect, Google asks you to approve the
              permissions on this page. We request only what the features
              above need, and we use your Google data only to provide them.
            </p>

            <p className="fine">
              Smart Repute&apos;s use and transfer to any other app of
              information received from Google APIs adheres to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements. Read the full{" "}
              <a href="/privacy">Privacy Policy</a> and{" "}
              <a href="/terms">Terms of Service</a>.
            </p>
          </div>

          <div>
            {PERMISSIONS.map((p) => (
              <div key={p.title} className="perm">
                <h3>{p.title}</h3>
                <code>{p.scope}</code>
                <p>{p.text}</p>
              </div>
            ))}

            <h3
              style={{
                margin: "48px 0 20px",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.55)",
              }}
            >
              Our commitments
            </h3>

            <ul className="pledges">
              {COMMITMENTS.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="sec">
      <div className="wrap">
        <div className="sec-head">
          <p className="eyebrow">Questions</p>
          <h2 className="h2">Frequently asked questions</h2>
        </div>

        <div className="faq">
          {FAQ.map((item) => (
            <div key={item.q} className="faq-item">
              <h3>{item.q}</h3>
              <p>{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
