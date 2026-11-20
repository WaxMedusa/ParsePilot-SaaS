import styles from './Dashboard.module.css';

type Provider = {
  id: string;
  name: string;
  note: string;
  link: string;
  linkLabel: string;
  steps: string[];
  settings: string;
};

const PROVIDERS: Provider[] = [
  {
    id: 'ai-studio',
    name: 'Google AI Studio',
    note: 'Fastest · free tier while you trial it',
    link: 'https://aistudio.google.com/apikey',
    linkLabel: 'aistudio.google.com/apikey',
    steps: [
      'Open the link and sign in with the Google account that should own this workspace’s billing.',
      'Choose “Create API key”, then pick (or create) the Google Cloud project this workspace belongs to. The key is issued against that project.',
      'Copy the key — it starts with AIza — and paste it into the API key field above.',
      'Set Provider URL to https://generativelanguage.googleapis.com/v1beta/openai/ and Model to a Gemini model such as gemini-2.5-flash. Gemini only answers on that OpenAI-compatible path.',
    ],
    settings: 'Provider URL https://generativelanguage.googleapis.com/v1beta/openai/ · Model gemini-2.5-flash',
  },
  {
    id: 'cloud-console',
    name: 'Google Cloud Console',
    note: 'Same key, created and scoped in your own project',
    link: 'https://console.cloud.google.com/apis/credentials',
    linkLabel: 'console.cloud.google.com → APIs & Services → Credentials',
    steps: [
      'Open the Google Cloud Console and use the project picker at the top to create a project, for example parsepilot-extraction.',
      'Go to APIs & Services → Library, search for “Generative Language API” and choose Enable.',
      'Go to APIs & Services → Credentials → Create credentials → API key.',
      'Choose Restrict key, then limit API restrictions to the Generative Language API so the key cannot be spent on other Google services.',
      'Copy the key and paste it above with the same Provider URL and model. If this is a shared project, add a budget alert under Billing.',
    ],
    settings: 'An AI Studio key and a Cloud Console key are the same key for the same project — create it wherever you already work.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    note: 'The default this app ships with',
    link: 'https://platform.openai.com/api-keys',
    linkLabel: 'platform.openai.com/api-keys',
    steps: [
      'Open the link and sign in.',
      'Choose “Create new secret key” and scope it to the project for this workspace rather than an account-wide personal key.',
      'Copy it now — OpenAI shows it once — and paste it above. Keep Provider URL at https://api.openai.com/v1 and use a small model such as gpt-4.1-mini.',
      'Set a monthly budget under Billing → Limits so a retry storm cannot surprise you.',
    ],
    settings: 'Provider URL https://api.openai.com/v1 · Model gpt-4.1-mini',
  },
];

const BEFORE_PASTE = [
  'The provider bills your account directly. ParsePilot does not mark the key up, resell model calls or take a cut of usage.',
  'A small, low-cost model is usually enough. A reasoning model reads damaged scans and unusual layouts better if that is what your post arrives in.',
  'Keys are per workspace. Try one on a test workspace first, then add a separate key to the one finance actually uses.',
  'Nothing is stored until you press Save settings, and Remove key deletes the stored key immediately.',
];

export function AiKeyGuide() {
  return (
    <section className={styles.card} id="provider-key" aria-labelledby="provider-key-title">
      <div className={styles.cardHead}>
        <span className={styles.cardTitle} id="provider-key-title">
          Create a provider key
        </span>
        <span className={styles.cardHint}>about 2 minutes</span>
      </div>
      <div className={styles.cardBody}>
        <div className={`${styles.notice} ${styles.noticeInfo}`} role="note">
          <div>
            <span className={styles.noticeTitle}>
              Bring your own key — it is a privacy control, not a formality.
            </span>
            <p className={styles.noticeBody}>
              The key belongs to your provider account, not to an account ParsePilot holds on your behalf. Document
              text goes from the extraction worker straight to the provider you name, under your agreement with them,
              and you can revoke the key there at any time without touching another workspace.
            </p>
            <p className={styles.noticeBody}>
              We keep it encrypted at rest, show only its last four characters, keep it out of exports, audit entries,
              API responses and logs, and hand it only to the worker running your jobs. From the moment you save it,
              this workspace uses your key and nothing else.
            </p>
            <p className={styles.noticeBody}>
              The honest limit: a key does not stop document text from leaving this deployment. The provider still
              receives the text extracted from each document so it can return structured fields — what changes is
              whose account and whose data terms that text travels under. Ask your administrator whether this
              deployment has a fallback provider key; where it has none, a workspace without a key extracts with the
              rules alone and sends nothing to a third party.
            </p>
          </div>
        </div>

        <div className={styles.guide}>
          {PROVIDERS.map((provider, index) => (
            <details key={provider.id} className={styles.guideDetails} open={index === 0}>
              <summary className={styles.guideSummary}>
                <span className={styles.guideTitle}>{provider.name}</span>
                <span className={styles.guideNote}>{provider.note}</span>
              </summary>
              <div className={styles.guideBody}>
                <ol className={styles.guideSteps}>
                  {provider.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className={styles.guideSettings}>{provider.settings}</p>
                <a
                  className={styles.guideLink}
                  href={provider.link}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {provider.linkLabel} ↗
                </a>
              </div>
            </details>
          ))}
        </div>

        <div className={styles.divider} />

        <span className={styles.sectionTitle}>Before you paste</span>
        <ul className={styles.guideSteps}>
          {BEFORE_PASTE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
