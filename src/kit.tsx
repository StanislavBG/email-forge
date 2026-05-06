// Slim kit: ToolHero, CrossPromo, and track().
// Local copies of `~/Projects/Bilko/src/components/tool-page/*` with EmailForge's amber
// theme baked in. Mirrors the AdScorer/HeadlineGrader/ThreadGrader pattern, minus
// the scoring components — EmailForge generates a 5-email sequence with custom
// per-email cards rendered inline in the page.

import { type ReactNode } from 'react';

// ─────────────────────────────────────────────────────────────
// Analytics — same wire format as the host's usePageView.track().
// Calls bilko.run/api/analytics/event same-origin once deployed.

const HOST = 'https://bilko.run';
const API = `${HOST}/api`;

let visitorId: string | null = null;
function getVisitorId(): string {
  if (visitorId) return visitorId;
  try {
    let v = localStorage.getItem('bilko_vid');
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem('bilko_vid', v);
    }
    visitorId = v;
    return v;
  } catch {
    return 'anon';
  }
}

let sessionId: string | null = null;
function getSessionId(): string {
  if (sessionId) return sessionId;
  try {
    sessionId = sessionStorage.getItem('bilko_sid') ?? crypto.randomUUID();
    sessionStorage.setItem('bilko_sid', sessionId);
    return sessionId;
  } catch {
    return 'anon';
  }
}

export function track(event: string, props?: { tool?: string; metadata?: unknown }): void {
  try {
    const body = JSON.stringify({
      event,
      tool: props?.tool ?? 'email-forge',
      path: typeof window !== 'undefined' ? window.location.pathname : null,
      metadata: props?.metadata ?? null,
      visitor_id: getVisitorId(),
      session_id: getSessionId(),
    });
    const url = `${API}/analytics/event`;
    if (typeof navigator?.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(url, blob)) return;
    }
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // analytics never breaks the app
  }
}

// ─────────────────────────────────────────────────────────────
// ToolHero — amber theme baked in (was: getToolTheme('email-forge')).
// EmailForge's page renders its own 2-tab toggle (Score / Compare)
// inside the children slot, so we don't expose tab/onTabChange/hasCompare here.

export function ToolHero({ title, tagline, children }: {
  title: string;
  tagline: string;
  children: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#1f1a0d] via-[#15100a] to-[#1f1a0d]" />
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, rgba(245,158,11,0.14), transparent 70%)' }}
      />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

      <div className="relative max-w-3xl mx-auto px-6 py-16 md:py-24 text-center">
        <h1 className="text-display-lg text-white animate-slide-up">{title}</h1>
        <p
          className="mt-4 text-base md:text-lg text-warm-400 max-w-lg mx-auto leading-relaxed animate-slide-up"
          style={{ animationDelay: '60ms' }}
        >
          {tagline}
        </p>
        <div className="mt-6 animate-slide-up" style={{ animationDelay: '160ms' }}>
          {children}
        </div>
        <p className="mt-4 text-xs text-warm-500 flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Free to try &middot; Results in ~15 seconds &middot; No credit card
        </p>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// CrossPromo — hardcoded list. Targets are full URLs back to bilko.run so the
// click triggers a full page load (host MaybeStandaloneRedirect resolves the
// canonical product/project URL based on each target's host kind).

const CROSS_PROMO: { name: string; href: string; hook: string }[] = [
  {
    name: 'AdScorer',
    href: 'https://bilko.run/products/ad-scorer',
    hook: 'Emails done. Now score the ad that fills the top of funnel.',
  },
  {
    name: 'AudienceDecoder',
    href: 'https://bilko.run/products/audience-decoder',
    hook: "Know who you're emailing. Decode your audience first.",
  },
];

export function CrossPromo() {
  return (
    <div className="max-w-2xl mx-auto px-6 pb-12">
      <div className="bg-warm-50/80 rounded-2xl shadow-elevation-1 p-6">
        <h3 className="text-label text-warm-400 mb-4">Next up</h3>
        <div className="space-y-3">
          {CROSS_PROMO.map(p => (
            <a
              key={p.name}
              href={p.href}
              className="group flex items-center gap-3 p-3 rounded-xl bg-white shadow-elevation-1 hover:shadow-elevation-2 hover:-translate-y-0.5 transition-all"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold text-warm-800 group-hover:text-warm-900 transition-colors">
                  {p.name}
                </span>
                <p className="text-xs text-warm-500 mt-0.5">{p.hook}</p>
              </div>
              <svg
                className="w-4 h-4 text-warm-400 group-hover:text-fire-500 group-hover:translate-x-0.5 transition-all flex-shrink-0"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
