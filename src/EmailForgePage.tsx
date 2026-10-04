import { useState, useEffect, useRef } from 'react';
import { SignInButton } from '@clerk/clerk-react';
import { useToolApi } from './useToolApi.js';
import { ToolHero, CrossPromo, track } from 'host-kit';

const EMAIL_FORGE_THEME = {
  heroGradient: 'from-[#1f1a0d] via-[#15100a] to-[#1f1a0d]',
  glowColor: 'rgba(245,158,11,0.14)',
  accentText: 'text-amber-400',
  accentTextLight: 'text-amber-500',
};

const CROSS_PROMO_ITEMS = [
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

interface EmailItem {
  position: number;
  subject_line: string;
  preview_text: string;
  body: string;
  cta: string;
  framework_used: string;
  framework_explanation: string;
  estimated_open_rate: string;
  estimated_click_rate: string;
}

interface SequenceResult {
  emails: EmailItem[];
  sequence_strategy: string;
  overall_score: number;
  grade: string;
}

interface TemplateEntry { product: string; audience: string; goal: string; tone: string; score: number; grade: string; date: string; }
const TEMPLATES_KEY = 'bilko_email_templates';
function loadTemplates(): TemplateEntry[] { try { return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]'); } catch { return []; } }

const SPAM_TRIGGERS = ['free', 'act now', 'limited time', 'click here', 'buy now', 'order now', 'urgent', '!!!', 'CAPS', '$$$', 'winner', 'congratulations'];

function checkDeliverability(text: string): string[] {
  return SPAM_TRIGGERS.filter(t => text.toLowerCase().includes(t.toLowerCase()));
}

function computeDeliverabilityScore(emails: EmailItem[]): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];
  for (const e of emails) {
    const text = `${e.subject_line} ${e.body} ${e.cta}`;
    const upper = (text.match(/[A-Z]{3,}/g) || []).length;
    if (upper > 2) { score -= 10; issues.push('Excessive caps in email ' + e.position); }
    const excl = (text.match(/!/g) || []).length;
    if (excl > 3) { score -= 5; issues.push('Too many exclamation marks in email ' + e.position); }
    if (e.subject_line.length > 60) { score -= 5; issues.push('Subject line too long in email ' + e.position); }
    const triggers = SPAM_TRIGGERS.filter(t => text.toLowerCase().includes(t.toLowerCase()));
    score -= triggers.length * 3;
    if (triggers.length > 0) issues.push(`Spam words in email ${e.position}: ${triggers.join(', ')}`);
  }
  return { score: Math.max(0, Math.min(100, score)), issues };
}

const GOALS = ['cold_outreach', 'nurture', 'launch', 're-engagement', 'win_back'] as const;
const GOAL_LABELS: Record<string, string> = { cold_outreach: 'Cold Outreach', nurture: 'Nurture', launch: 'Launch', 're-engagement': 'Re-engagement', win_back: 'Win-back' };
const TONES = ['professional', 'casual', 'urgent', 'storytelling'] as const;
const TONE_LABELS: Record<string, string> = { professional: 'Professional', casual: 'Casual', urgent: 'Urgent', storytelling: 'Storytelling' };

const FRAMEWORK_COLORS: Record<string, string> = {
  AIDA: 'bg-blue-100 text-blue-700',
  PAS: 'bg-orange-100 text-orange-700',
  Hormozi: 'bg-fire-100 text-fire-700',
  'Hormozi Value': 'bg-fire-100 text-fire-700',
  Cialdini: 'bg-green-100 text-green-700',
  'Cialdini Reciprocity': 'bg-green-100 text-green-700',
  'Storytelling Arc': 'bg-purple-100 text-purple-700',
  Storytelling: 'bg-purple-100 text-purple-700',
};

function frameworkBadge(fw: string) {
  const key = Object.keys(FRAMEWORK_COLORS).find(k => fw.toLowerCase().includes(k.toLowerCase()));
  const color = key ? FRAMEWORK_COLORS[key] : 'bg-warm-100 text-warm-600';
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${color}`}>{fw}</span>;
}

function gradeColor(grade: string): string {
  if (grade.startsWith('A')) return 'text-green-600';
  if (grade.startsWith('B')) return 'text-blue-600';
  if (grade.startsWith('C')) return 'text-yellow-600';
  if (grade === 'D') return 'text-orange-600';
  return 'text-red-600';
}

function OptionPills<T extends string>({ options, labels, value, onChange }: {
  options: readonly T[]; labels: Record<string, string>; value: T; onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} onClick={() => onChange(o)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            value === o ? 'bg-white text-warm-900 shadow-sm' : 'bg-white/10 text-warm-400 hover:text-white'
          }`}>{labels[o]}</button>
      ))}
    </div>
  );
}

function EmailCard({ email, defaultOpen }: { email: EmailItem; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);

  const fullText = `Subject: ${email.subject_line}\n\n${email.body}\n\n${email.cta}`;

  return (
    <div className="bg-white rounded-2xl border border-warm-200/60 overflow-hidden animate-slide-up">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 p-5 text-left hover:bg-warm-50 transition-colors">
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center text-sm font-black">{email.position}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-warm-900 truncate">{email.subject_line}</span>
            {email.subject_line.length > 40 && (
              <span className="text-[9px] font-bold text-yellow-600 bg-yellow-100 px-1.5 py-0.5 rounded ml-1 flex-shrink-0">
                {email.subject_line.length}ch — truncated on mobile
              </span>
            )}
            {frameworkBadge(email.framework_used)}
          </div>
          <p className="text-xs text-warm-500 italic truncate mt-0.5">{email.preview_text}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">{email.estimated_open_rate} open</span>
          <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{email.estimated_click_rate} click</span>
          <svg className={`w-4 h-4 text-warm-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-warm-100">
          <div className="bg-warm-50 rounded-xl p-4 mt-4 mb-3">
            <p className="text-xs font-bold text-warm-400 uppercase tracking-wider mb-1">Framework</p>
            <p className="text-sm text-warm-600">{email.framework_explanation}</p>
          </div>
          <div className="bg-white border border-warm-100 rounded-xl p-4 mb-3">
            <p className="text-sm text-warm-800 leading-relaxed whitespace-pre-line">{email.body}</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="bg-fire-500 text-white text-sm font-bold px-4 py-2 rounded-lg inline-block">{email.cta}</div>
            <button onClick={() => { navigator.clipboard.writeText(fullText); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="text-xs text-warm-400 hover:text-fire-500 font-semibold transition-colors">
              {copied ? 'Copied!' : 'Copy email'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tutorial content block ──────────────────────────────────────────────────

const EF_PROMPTS: Array<{ category: string; label: string; text: string }> = [
  { category: 'SaaS', label: 'Cold outreach to HR ops', text: 'Product: B2B onboarding platform that cuts new-hire admin from 8 hours to 40 minutes. Audience: HR ops leaders at 50–500 person companies who just hired 10+ people this quarter. Goal: book a 20-min demo. Tone: casual professional.' },
  { category: 'SaaS', label: 'Newsletter intro series', text: 'Product: a weekly newsletter on product analytics for PMs at Series A–C startups. Audience: growth PMs managing a funnel they didn\'t build. Goal: 5-email welcome sequence that teaches + retains. Tone: conversational, nerdy.' },
  { category: 'E-commerce', label: 'Re-engagement for lapsed buyers', text: 'Product: $48 premium pour-over coffee kit, 3-month subscription. Audience: past customers who cancelled after 2 shipments. Goal: win them back with a 15% returning-customer offer. Tone: warm and specific.' },
  { category: 'E-commerce', label: 'Launch sequence for new product', text: 'Product: launching a $129 minimalist leather wallet with RFID blocking. Audience: existing email list that bought bags from us in the last 12 months. Goal: drive first 500 pre-orders. Tone: confident, no fluff.' },
  { category: 'Local biz', label: 'New client welcome', text: 'Product: 4-chair barbershop offering $35 cuts and $50 fade + beard combos. Audience: first-time clients who just booked their first appointment online. Goal: 5-email welcome that turns them into monthly regulars. Tone: friendly neighborhood.' },
  { category: 'Local biz', label: 'Seasonal promo', text: 'Product: house cleaning service, $180 for standard 3-bedroom. Audience: past clients within 5 miles who haven\'t booked in 90+ days. Goal: fill 20 open slots in the next 2 weeks. Tone: warm, urgency without pressure.' },
  { category: 'B2B', label: 'Sales follow-up after demo', text: 'Product: sales enablement platform, $12K ACV. Audience: RevOps directors who took a demo 10 days ago and went silent. Goal: revive the deal with a tailored 5-touch sequence. Tone: helpful, not needy.' },
  { category: 'B2B', label: 'Partnership outreach', text: 'Product: API for fraud detection. Audience: Head of Partnerships at fintech startups we don\'t compete with. Goal: 15-min intro call to explore referral partnership. Tone: peer-to-peer, specific.' },
  { category: 'Creator', label: 'Course launch sequence', text: 'Product: $297 self-paced course on cold email copywriting. Audience: email list of 4,000 freelance marketers who opted in for a free template. Goal: 300 enrollments in 7-day launch. Tone: Hormozi-style value stacking.' },
  { category: 'Creator', label: 'Free tool upsell to paid', text: 'Product: paid tier of a free resume scoring tool, $19/mo. Audience: users who scored their resume free 2+ weeks ago. Goal: convert 5% to paid. Tone: helpful with a clear ask.' },
];

const EF_MISTAKES: Array<{ mistake: string; fix: string }> = [
  { mistake: 'Product description is too vague ("software for teams")', fix: 'Describe the specific job it does and who does that job today. "Replaces the 14-tab HR onboarding spreadsheet" beats "onboarding software."' },
  { mistake: 'Audience is too broad ("small businesses")', fix: 'Narrow to role + stage + trigger. "HR ops leads at 50–500-person companies who hired 10+ last quarter" produces sequences 3x sharper.' },
  { mistake: 'Sending the full 5-email sequence in 5 days', fix: 'Space them over 10–14 days. Day 1, 3, 6, 10, 14 is a well-tested cadence. Back-to-back emails feel like a siege.' },
  { mistake: 'Leaving merge fields as {{placeholder}}', fix: 'Personalize at least 2 fields per email before sending. Raw merge tags scream "blast" and tank reply rates.' },
  { mistake: 'Using the same subject style across all 5 emails', fix: 'Rotate subject formats: question, stat, short, curiosity, direct. The sequence was built with variety on purpose.' },
  { mistake: 'Ignoring deliverability warnings', fix: 'Fix every flagged spam word and subject-length warning before loading into your sender. One flagged email drags the whole sequence.' },
  { mistake: 'Shipping without A/B testing the opener', fix: 'Use Compare mode to test two different opening emails. Ship the winner as email 1. 10 seconds of work, measurable lift.' },
];

const EF_FAQ: Array<{ q: string; a: string }> = [
  { q: 'How is EmailForge different from ChatGPT?', a: 'ChatGPT writes one email at a time. EmailForge generates a full 5-email sequence using 5 different frameworks (AIDA, PAS, Hormozi, Cialdini, Storytelling), then scores each for subject strength, opener, CTA, and deliverability.' },
  { q: 'How much does one sequence cost?', a: '$1 per sequence (1 credit). $5 buys 7 credits. 2 credits for Compare mode. Credits never expire and work across all 10 bilko.run tools. First sequence is free.' },
  { q: 'Are the open-rate estimates accurate?', a: 'They\'re directional estimates based on subject-line patterns, length, and personalization signals — useful for comparing emails within a sequence. Real open rates depend on list quality, sender reputation, and send time.' },
  { q: 'Is my product/audience data private?', a: 'Your inputs are sent to Gemini to generate the sequence, then discarded. We don\'t store your product info or train on it. Only anonymous usage metrics are kept.' },
  { q: 'Does it work for B2C and B2B?', a: 'Both. Tone + goal combinations handle B2B cold outreach, B2C launches, newsletters, and win-back equally well. The framework rotation adapts to context.' },
  { q: 'Can I edit the emails?', a: 'Yes — they\'re a starting point. Copy, paste, rewrite anything. The sweet spot is 80% template, 20% personalization per recipient.' },
  { q: 'What goal should I pick for cold outreach?', a: 'Pick "Cold Outreach." It builds trust from zero — light first touch, value in the middle, direct ask last. The framework order is optimized for strangers.' },
  { q: 'Will these avoid spam filters?', a: 'Every email gets a deliverability score with specific issues flagged — spam triggers, excessive caps, too many exclamation marks, subject-line length. Fix flags before sending.' },
  { q: 'Does it work for non-English campaigns?', a: 'Yes — English, Spanish, Portuguese, German, French, and Italian. State the target language in the product description field.' },
  { q: 'Can I save sequences for later?', a: 'Yes. Every generated sequence saves to your Templates library automatically with its score and grade. Re-generate any template with one click.' },
];

const EF_TIPS: Array<{ tip: string; why: string }> = [
  { tip: 'Be ruthlessly specific about audience', why: 'The quality of your sequence rises and falls on the audience line. "VP Sales at 200-person SaaS" gives 3x sharper emails than "sales leaders."' },
  { tip: 'State the desired action explicitly', why: 'Goal = book demo, reply, click, buy? State it in the prompt. Vague goals produce vague CTAs.' },
  { tip: 'Run Compare mode before shipping', why: 'Two sequences, side by side, for 2 credits. You will often ship the opposite of what you planned.' },
  { tip: 'Rotate subject-line formats', why: 'Open-rate lift comes from variety. Stat → question → short → curiosity → direct keeps the reader guessing.' },
  { tip: 'Add a concrete number or example per email', why: 'Specificity is trust. "Cut onboarding from 8 hours to 40 minutes" beats "save time onboarding."' },
  { tip: 'Send at the right cadence', why: 'Day 1, 3, 6, 10, 14. Back-to-back emails feel desperate; weekly cadence loses momentum. The 2-week sequence is the sweet spot.' },
  { tip: 'Personalize 2+ fields per email', why: 'One personalized field reads templated. Two fields reads bespoke. Replies jump with every additional signal.' },
  { tip: 'Save wins to your Templates library', why: 'Every 80+ sequence is a reusable asset. Your best cold opener becomes the baseline for your next 10 campaigns.' },
];

function EmailForgeTutorial() {
  const [copied, setCopied] = useState<number | null>(null);

  async function copyPrompt(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(idx);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      /* noop */
    }
  }

  return (
    <>
      {/* Step-by-step guide */}
      <section className="bg-warm-100/40 border-y border-warm-200/40">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Step by step</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">How to use EmailForge — step by step</h2>
            <p className="mt-3 text-base text-warm-600">Five steps from blank page to ready-to-send sequence.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { n: 1, emoji: '🎯', title: 'Describe the product', desc: 'One sentence on what it is and who does the job today.', example: '"Onboarding platform that cuts new-hire admin from 8 hours to 40 minutes."' },
              { n: 2, emoji: '👥', title: 'Nail the audience', desc: 'Role + stage + recent trigger. Be ruthless.', example: '"HR ops leads at 50–500 person companies who hired 10+ last quarter."' },
              { n: 3, emoji: '⚙️', title: 'Pick goal + tone', desc: 'Each goal reshapes the 5-email arc entirely.', example: 'Goal: book demo. Tone: casual professional.' },
              { n: 4, emoji: '🔥', title: 'Forge the sequence', desc: 'Get 5 emails in ~15 seconds with scores + deliverability flags.', example: 'Overall 84/100 · subject: 18/25 · opener: 22/25 · CTA: 20/25' },
              { n: 5, emoji: '✉️', title: 'Personalize and send', desc: 'Swap merge fields, fix any deliverability flags, load into sender.', example: 'Day 1, 3, 6, 10, 14 cadence.' },
            ].map(step => (
              <div key={step.n} className="bg-white rounded-2xl border border-warm-200/60 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="w-8 h-8 rounded-full bg-fire-500 text-white flex items-center justify-center text-sm font-black">{step.n}</span>
                  <span className="text-2xl" aria-hidden="true" aria-label={step.title}>{step.emoji}</span>
                </div>
                <h3 className="text-sm font-black text-warm-900 mb-1">{step.title}</h3>
                <p className="text-xs text-warm-600 leading-relaxed mb-3">{step.desc}</p>
                <div className="bg-warm-50 border border-warm-200/60 rounded-lg px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-warm-400 mb-1">Example</p>
                  <p className="text-xs text-warm-700 font-mono whitespace-pre-wrap leading-snug">{step.example}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Worked examples */}
      <section className="bg-white border-b border-warm-200/40">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Worked examples</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Three real sequences, input to output</h2>
            <p className="mt-3 text-base text-warm-600">What you paste, what EmailForge returns, and why the score landed where it did.</p>
          </div>
          <div className="space-y-8">
            {[
              {
                title: 'Cold outreach — B2B SaaS → HR ops',
                input: 'Product: onboarding platform that cuts new-hire admin from 8 hours to 40 minutes.\nAudience: HR ops leads at 50–500 person companies who hired 10+ people last quarter.\nGoal: book a 20-minute demo.\nTone: casual professional.',
                output: 'Overall: 87/100 (A)\n\nEmail 1 — Subject: "40 min vs 8 hours (onboarding)"\n  Subject: 24/25 · Opener: 23/25 · CTA: 21/25\nEmail 2 (PAS) — Subject: "Is your Q2 onboarding already behind?"\n  Subject: 22/25 · Opener: 24/25 · CTA: 22/25\nEmail 3 (Hormozi) — Subject: "7 HR leads said this fixed Q1"\n  Subject: 23/25 · Opener: 22/25 · CTA: 23/25\nEmail 4 (Cialdini) — Subject: "Used by the HR team at [similar co]"\n  Subject: 21/25 · Opener: 23/25 · CTA: 24/25\nEmail 5 (Story) — Subject: "The week we almost missed 12 start dates"\n  Subject: 25/25 · Opener: 24/25 · CTA: 22/25\n\nDeliverability: 94/100 · 0 spam triggers',
                takeaway: 'Tight audience + specific product claim produced an A-grade sequence with strong subject variety across all 5 emails. Ship as-is after 2 personalization fields.',
              },
              {
                title: 'Re-engagement — DTC coffee subscription',
                input: 'Product: $48 premium pour-over coffee kit, 3-month subscription.\nAudience: past customers who cancelled after 2 shipments.\nGoal: win them back with a 15% returning-customer offer.\nTone: warm and specific.',
                output: 'Overall: 78/100 (B+)\n\nEmail 1 — Subject: "we noticed you left (and we get it)"\n  Subject: 21/25 · Opener: 24/25 · CTA: 18/25\nEmail 2 (PAS) — Subject: "what your cup tastes like now"\n  Subject: 22/25 · Opener: 22/25 · CTA: 19/25\nEmail 3 (Hormozi) — Subject: "15% off + the two bags you haven\'t tried"\n  Subject: 24/25 · Opener: 20/25 · CTA: 23/25\nEmail 4 (Cialdini) — Subject: "3,200 returners last month said:"\n  Subject: 22/25 · Opener: 21/25 · CTA: 22/25\nEmail 5 (Story) — Subject: "the farmer who asked about you"\n  Subject: 25/25 · Opener: 24/25 · CTA: 20/25\n\nDeliverability: 91/100 · 1 flag (email 3: "15%")',
                takeaway: 'Solid B+ sequence. Email 1 CTA is too soft ("come see what\'s new") — tighten to "take 15% back" and overall score jumps to 84.',
              },
              {
                title: 'Launch — DTC leather wallet',
                input: 'Product: $129 minimalist leather wallet with RFID blocking.\nAudience: existing list that bought bags from us in last 12 months.\nGoal: drive first 500 pre-orders.\nTone: confident, no fluff.',
                output: 'Overall: 82/100 (B+)\n\nEmail 1 — Subject: "500 pre-orders. 7 days. The wallet."\n  Subject: 25/25 · Opener: 23/25 · CTA: 22/25\nEmail 2 (PAS) — Subject: "your wallet is the thing you touch 40x a day"\n  Subject: 22/25 · Opener: 24/25 · CTA: 20/25\nEmail 3 (Hormozi) — Subject: "Pre-order = $20 off + free monogram"\n  Subject: 24/25 · Opener: 21/25 · CTA: 24/25\nEmail 4 (Cialdini) — Subject: "312 pre-ordered. 188 left."\n  Subject: 25/25 · Opener: 22/25 · CTA: 23/25\nEmail 5 (Story) — Subject: "the leather I rejected 11 times"\n  Subject: 24/25 · Opener: 25/25 · CTA: 19/25\n\nDeliverability: 96/100',
                takeaway: 'Strong subjects, strong story. Email 5 CTA was too reflective — adding "reserve yours before midnight" would add ~4 points.',
              },
            ].map((ex) => (
              <div key={ex.title} className="bg-warm-50/60 rounded-2xl border border-warm-200/60 overflow-hidden">
                <div className="px-6 py-4 bg-white border-b border-warm-200/60">
                  <h3 className="text-base font-black text-warm-900">{ex.title}</h3>
                </div>
                <div className="grid md:grid-cols-2 gap-0 border-b border-warm-200/60">
                  <div className="p-5 md:border-r border-warm-200/60">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-warm-400 mb-2">Input</p>
                    <pre className="text-xs text-warm-700 font-mono whitespace-pre-wrap leading-relaxed">{ex.input}</pre>
                  </div>
                  <div className="p-5 bg-white">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-fire-500 mb-2">EmailForge output</p>
                    <pre className="text-xs text-warm-700 font-mono whitespace-pre-wrap leading-relaxed">{ex.output}</pre>
                  </div>
                </div>
                <div className="p-5 bg-green-50/60">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-green-600 mb-1">Takeaway</p>
                  <p className="text-sm text-warm-800 leading-relaxed">{ex.takeaway}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Try these prompts */}
      <section className="bg-warm-100/40 border-b border-warm-200/40">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Starter pack</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Try these prompts</h2>
            <p className="mt-3 text-base text-warm-600">Ten copy-ready inputs by use case. Click to copy, paste into the tool.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {EF_PROMPTS.map((p, i) => (
              <button
                key={i}
                onClick={() => copyPrompt(p.text, i)}
                className="group text-left bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 p-5 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-fire-600 bg-fire-50 px-2 py-0.5 rounded-full">{p.category}</span>
                  <span className={`text-xs font-bold transition-colors ${copied === i ? 'text-green-600' : 'text-warm-400 group-hover:text-fire-500'}`}>
                    {copied === i ? 'Copied!' : 'Copy'}
                  </span>
                </div>
                <p className="text-sm font-bold text-warm-900 mb-2">{p.label}</p>
                <p className="text-xs text-warm-600 font-mono whitespace-pre-wrap leading-relaxed line-clamp-4">{p.text}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* What great output looks like */}
      <section className="bg-white border-b border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Calibrate your expectations</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">What great output looks like</h2>
            <p className="mt-3 text-base text-warm-600">A sample sequence result, annotated.</p>
          </div>
          <div className="bg-warm-50/60 rounded-2xl border border-warm-200/60 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-warm-200/60">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-warm-400">Sequence Score</p>
                <p className="text-4xl font-black text-warm-900">84<span className="text-base text-warm-500">/100</span></p>
              </div>
              <span className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-green-100 text-green-700 text-2xl font-black">A-</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <span className="inline-block w-24 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-fire-500 mt-1">Subjects</span>
                <div className="flex-1">
                  <p className="font-bold text-warm-900">Avg 23/25 — strong variety</p>
                  <p className="text-warm-600 text-xs mt-0.5">Each subject uses a different format: stat, question, short, curiosity, direct. No repeats.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-block w-24 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-fire-500 mt-1">Openers</span>
                <div className="flex-1">
                  <p className="font-bold text-warm-900">Avg 22/25 — personalized feel</p>
                  <p className="text-warm-600 text-xs mt-0.5">First line mentions a trigger event or recent move. No "Hope this email finds you well."</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-block w-24 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-fire-500 mt-1">CTAs</span>
                <div className="flex-1">
                  <p className="font-bold text-warm-900">Avg 21/25 — specific actions</p>
                  <p className="text-warm-600 text-xs mt-0.5">Every CTA names a concrete action and timeframe. "Book 15 min Thursday" beats "let me know."</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="inline-block w-24 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-fire-500 mt-1">Deliverability</span>
                <div className="flex-1">
                  <p className="font-bold text-warm-900">94/100 — 0 spam triggers</p>
                  <p className="text-warm-600 text-xs mt-0.5">No spam words, subject lengths under 50 chars, acceptable punctuation density.</p>
                </div>
              </div>
            </div>
            <div className="pt-3 border-t border-warm-200/60">
              <p className="text-[11px] font-bold uppercase tracking-wider text-warm-400 mb-1">Verdict</p>
              <p className="text-sm text-warm-700 leading-relaxed">"Ship-ready sequence. Personalize 2 fields per email and load into your sender."</p>
            </div>
          </div>
          <p className="text-xs text-warm-500 mt-4 text-center italic">Read sub-scores before the total. A 78 with strong CTAs converts better than an 88 with vague ones.</p>
        </div>
      </section>

      {/* Common mistakes + fixes */}
      <section className="bg-warm-100/40 border-b border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Common mistakes</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Common mistakes + fixes</h2>
            <p className="mt-3 text-base text-warm-600">The seven errors that tank sequence performance most often.</p>
          </div>
          <div className="space-y-3">
            {EF_MISTAKES.map((m, i) => (
              <details key={i} className="group bg-white rounded-xl border border-warm-200/60 open:border-fire-200">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none">
                  <span className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50 text-red-600 text-xs font-black">{i + 1}</span>
                    <span className="text-sm font-bold text-warm-900">{m.mistake}</span>
                  </span>
                  <svg className="w-4 h-4 flex-shrink-0 text-warm-500 transition-transform group-open:rotate-180 group-open:text-fire-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </summary>
                <div className="px-5 pb-4 -mt-1">
                  <p className="text-sm text-warm-600 leading-relaxed"><span className="font-bold text-green-700">Fix: </span>{m.fix}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-white border-b border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">FAQ</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">EmailForge FAQ</h2>
            <p className="mt-3 text-base text-warm-600">Pricing, privacy, accuracy, and how it differs from ChatGPT.</p>
          </div>
          <div className="space-y-3">
            {EF_FAQ.map((f, i) => (
              <details key={i} className="group bg-warm-50/60 rounded-xl border border-warm-200/60 open:bg-white open:border-fire-200">
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none">
                  <span className="text-sm font-bold text-warm-900">{f.q}</span>
                  <svg className="w-4 h-4 flex-shrink-0 text-warm-500 transition-transform group-open:rotate-180 group-open:text-fire-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </summary>
                <div className="px-5 pb-4 -mt-1">
                  <p className="text-sm text-warm-600 leading-relaxed">{f.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases by role */}
      <section className="bg-warm-100/40 border-b border-warm-200/40">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Who uses it</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Use cases by role</h2>
            <p className="mt-3 text-base text-warm-600">Four roles, four workflows, same tool.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: '🚀', role: 'Founder', use: 'Write cold outreach that does not sound like cold outreach. Five angles in 15 seconds means you stop rewriting for 40 minutes.' },
              { icon: '📣', role: 'Marketer', use: 'Generate launch, win-back, and nurture sequences in one afternoon. Compare variants, ship the winners into your sender.' },
              { icon: '✍️', role: 'Freelancer', use: 'Deliver email sequences with deliverability scores attached. Clients pay more when they see the receipts.' },
              { icon: '🏢', role: 'Agency', use: 'Spin up client sequences across industries without hiring more copywriters. Same credits, any vertical.' },
            ].map(p => (
              <div key={p.role} className="bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 p-5 transition-all">
                <div className="text-3xl mb-3" aria-hidden="true">{p.icon}</div>
                <h3 className="text-base font-black text-warm-900 mb-2">{p.role}</h3>
                <p className="text-sm text-warm-600 leading-relaxed">{p.use}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tips */}
      <section className="bg-white border-b border-warm-200/40">
        <div className="max-w-3xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Pro tips</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Tips to get better results</h2>
            <p className="mt-3 text-base text-warm-600">Eight moves that raise sequence scores fast.</p>
          </div>
          <ol className="space-y-4">
            {EF_TIPS.map((t, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center font-black text-sm">{i + 1}</span>
                <div>
                  <p className="text-sm font-bold text-warm-900">{t.tip}</p>
                  <p className="text-sm text-warm-600 leading-relaxed mt-0.5">{t.why}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Related tools */}
      <section className="bg-warm-100/40 border-b border-warm-200/40">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="max-w-2xl mx-auto text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest text-fire-500 mb-2">Related tools</p>
            <h2 className="text-2xl md:text-3xl font-black text-warm-900 leading-tight">Pair EmailForge with these</h2>
            <p className="mt-3 text-base text-warm-600">Four sibling bilko.run tools that stack naturally with email writing.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { slug: 'headline-grader', emoji: '📰', name: 'HeadlineGrader', desc: 'Grade every subject line before you ship. Tight subjects lift open rates 20–40%.' },
              { slug: 'audience-decoder', emoji: '🎯', name: 'AudienceDecoder', desc: 'Decode your list before you write to it. Better archetype = better tone.' },
              { slug: 'thread-grader', emoji: '🧵', name: 'ThreadGrader', desc: 'Turn your top-performing thread into an email sequence. Same angle, different channel.' },
              { slug: 'page-roast', emoji: '🔥', name: 'PageRoast', desc: 'Where your email sends traffic matters. Roast the landing page before you blast 5,000 opens at it.' },
            ].map(t => (
              <a key={t.slug} href={`https://bilko.run/products/${t.slug}`} className="group bg-white rounded-2xl border border-warm-200/60 hover:border-fire-300 hover:shadow-md p-5 transition-all">
                <div className="text-3xl mb-3" aria-hidden="true">{t.emoji}</div>
                <h3 className="text-base font-black text-warm-900 mb-1 group-hover:text-fire-600 transition-colors">{t.name}</h3>
                <p className="text-sm text-warm-600 leading-relaxed">{t.desc}</p>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export function EmailForgePage() {
  const { result, compareResult, loading, error, needsTokens, submit, submitCompare, reset, signInRef } = useToolApi<SequenceResult>('email-forge');

  const [tab, setTab] = useState<'score' | 'compare'>('score');
  const [product, setProduct] = useState('');
  const [audience, setAudience] = useState('');
  const [goal, setGoal] = useState<typeof GOALS[number]>('cold_outreach');
  const [tone, setTone] = useState<typeof TONES[number]>('professional');
  // Compare fields
  const [productB, setProductB] = useState('');
  const [audienceB, setAudienceB] = useState('');
  const [goalB, setGoalB] = useState<typeof GOALS[number]>('cold_outreach');
  const [toneB, setToneB] = useState<typeof TONES[number]>('professional');
  const [allCopied, setAllCopied] = useState(false);
  const [templates, setTemplates] = useState<TemplateEntry[]>(loadTemplates);

  function saveTemplate() {
    if (!result) return;
    const entry: TemplateEntry = { product, audience, goal, tone, score: result.overall_score, grade: result.grade, date: new Date().toISOString() };
    const updated = [entry, ...templates.filter(t => t.product !== product || t.audience !== audience)].slice(0, 10);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(updated));
    setTemplates(updated);
  }

  function loadTemplate(t: TemplateEntry) {
    setProduct(t.product);
    setAudience(t.audience);
    setGoal(t.goal as typeof goal);
    setTone(t.tone as typeof tone);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'EmailForge — AI Email Sequence Generator';
    track('view_tool', { tool: 'email-forge' });
    return () => { document.title = 'Bilko.run — Tools for Makers Who Ship'; };
  }, []);

  useEffect(() => {
    if ((result || compareResult) && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [result, compareResult]);

  function copyAll() {
    if (!result?.emails) return;
    const text = result.emails.map(e => `Email ${e.position} — ${e.framework_used}\nSubject: ${e.subject_line}\n\n${e.body}\n\nCTA: ${e.cta}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  }

  return (
    <>
      <SignInButton mode="modal" forceRedirectUrl={window.location.pathname}>
        <button ref={signInRef} className="hidden" aria-hidden="true" />
      </SignInButton>

      <ToolHero
        theme={EMAIL_FORGE_THEME}
        title="Forge your email sequence"
        tagline="AI generates a 5-email sequence using proven persuasion frameworks"
      >
        {/* 2-way tab toggle */}
        <div className="flex gap-1 bg-white/10 backdrop-blur-sm rounded-xl p-1 mb-5 w-fit mx-auto">
          {(['score', 'compare'] as const).map(t => (
            <button key={t} onClick={() => { setTab(t); reset(); }}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize ${
                tab === t ? 'bg-white text-warm-900 shadow-sm' : 'text-warm-400 hover:text-white'
              }`}>
              {t === 'compare' ? 'A/B Compare' : 'Generate'}
            </button>
          ))}
        </div>

        {tab === 'score' ? (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-2xl mx-auto">
            <textarea value={product} onChange={e => setProduct(e.target.value)} placeholder="Describe your product or service..."
              rows={3} className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none mb-3" />
            <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Who are you targeting?"
              className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner mb-3" />
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Goal</label>
                <OptionPills options={GOALS} labels={GOAL_LABELS} value={goal} onChange={setGoal} />
              </div>
              <div className="flex-1">
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Tone</label>
                <OptionPills options={TONES} labels={TONE_LABELS} value={tone} onChange={setTone} />
              </div>
            </div>
            <button onClick={() => submit({ product, audience, goal, tone })}
              disabled={loading || product.trim().length < 10 || audience.trim().length < 5}
              className="w-full py-3.5 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black rounded-xl shadow-lg transition-all disabled:shadow-none">
              {loading ? 'Forging...' : 'Generate Sequence'}
            </button>
          </div>
        ) : (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-4 md:p-5 shadow-2xl max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-4 mb-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Sequence A</label>
                <textarea value={product} onChange={e => setProduct(e.target.value)} placeholder="Product A..." rows={2} className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none mb-2" />
                <input value={audience} onChange={e => setAudience(e.target.value)} placeholder="Audience A..." className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner mb-2" />
                <OptionPills options={GOALS} labels={GOAL_LABELS} value={goal} onChange={setGoal} />
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-warm-400 mb-1.5 block text-left">Sequence B</label>
                <textarea value={productB} onChange={e => setProductB(e.target.value)} placeholder="Product B..." rows={2} className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner resize-none mb-2" />
                <input value={audienceB} onChange={e => setAudienceB(e.target.value)} placeholder="Audience B..." className="w-full px-4 py-3 rounded-xl border-0 bg-white text-warm-900 placeholder:text-warm-400 focus:outline-none focus:ring-2 focus:ring-fire-400 shadow-inner mb-2" />
                <OptionPills options={GOALS} labels={GOAL_LABELS} value={goalB} onChange={setGoalB} />
              </div>
            </div>
            <button onClick={() => submitCompare({ product_a: product, audience_a: audience, goal_a: goal, tone_a: tone, product_b: productB, audience_b: audienceB, goal_b: goalB, tone_b: toneB })}
              disabled={loading || product.trim().length < 10 || productB.trim().length < 10}
              className="w-full py-3.5 bg-gradient-to-r from-fire-500 to-fire-600 hover:from-fire-600 hover:to-fire-700 disabled:from-warm-500 disabled:to-warm-600 text-white font-black rounded-xl shadow-lg transition-all disabled:shadow-none">
              {loading ? 'Comparing...' : 'Compare Sequences'}
            </button>
          </div>
        )}
      </ToolHero>

      {error && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        </div>
      )}

      {needsTokens && (
        <div className="max-w-2xl mx-auto px-6 mb-6">
          <div className="bg-fire-50 border border-fire-200 rounded-2xl p-6 text-center">
            <p className="text-warm-800 font-semibold mb-1">Out of free credits</p>
            <p className="text-sm text-warm-600"><a href="/pricing" className="text-fire-500 hover:underline font-bold">Grab tokens</a> to keep forging.</p>
          </div>
        </div>
      )}

      {result && (
        <div ref={resultRef} className="max-w-2xl mx-auto px-6 pt-10 space-y-4 pb-16">
          {/* Strategy banner */}
          <div className="bg-gradient-to-r from-fire-50 to-warm-50 rounded-2xl border border-fire-200 p-6 text-center animate-slide-up">
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-3xl font-black text-warm-900">{result.overall_score}</span>
              <span className={`text-2xl font-black ${gradeColor(result.grade)}`}>{result.grade}</span>
            </div>
            <p className="text-sm text-warm-600">{result.sequence_strategy}</p>
          </div>

          {/* Deliverability score */}
          {(() => {
            const d = computeDeliverabilityScore(result.emails);
            const color = d.score >= 80 ? 'bg-green-50 border-green-200 text-green-700' : d.score >= 60 ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-red-50 border-red-200 text-red-700';
            return (
              <div className={`rounded-xl border p-4 text-center ${color} animate-slide-up`}>
                <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">Deliverability Score</p>
                <p className="text-2xl font-black">{d.score}/100</p>
                {d.issues.length > 0 && <p className="text-xs mt-1 opacity-80">{d.issues.length} issue{d.issues.length !== 1 ? 's' : ''} found</p>}
              </div>
            );
          })()}

          <div className="bg-warm-50 rounded-xl border border-warm-100 p-4 animate-slide-up">
            <p className="text-xs font-bold text-warm-700 mb-1">Personalization tip</p>
            <p className="text-xs text-warm-500">Replace generic greetings with merge fields: <code className="bg-warm-200 px-1 rounded text-fire-700">{'{{first_name}}'}</code>, <code className="bg-warm-200 px-1 rounded text-fire-700">{'{{company}}'}</code>, <code className="bg-warm-200 px-1 rounded text-fire-700">{'{{pain_point}}'}</code>. Emails with 2+ custom fields get 142% more replies.</p>
          </div>

          <div className="bg-warm-50 rounded-xl border border-warm-100 p-3 text-center text-xs text-warm-500 animate-slide-up">
            2026 benchmark: 2-4 word subjects = 46% open rate &middot; Personalized subjects = +26% opens &middot; Mobile truncates at 40 chars
          </div>

          {/* Deliverability warning */}
          {(() => {
            const flagged = result.emails.filter(e => checkDeliverability(`${e.subject_line} ${e.body}`).length > 0);
            const words = [...new Set(flagged.flatMap(e => checkDeliverability(`${e.subject_line} ${e.body}`)))];
            return flagged.length > 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
                <span className="font-bold">Deliverability note:</span> {flagged.length} email(s) contain spam trigger words ({words.join(', ')}). Consider rephrasing to avoid spam filters.
              </div>
            ) : null;
          })()}

          {/* Email cards */}
          {result.emails.map((email, i) => (
            <EmailCard key={email.position} email={email} defaultOpen={i === 0} />
          ))}

          {/* Copy all */}
          <div className="text-center pt-2">
            <button onClick={copyAll}
              className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-warm-300 hover:border-fire-300 text-warm-700 text-sm font-semibold rounded-lg transition-colors">
              {allCopied ? 'All emails copied!' : 'Copy full sequence'}
            </button>
            <button onClick={saveTemplate}
              className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-fire-200 hover:border-fire-400 text-fire-600 text-sm font-semibold rounded-lg transition-colors">
              Save as Template
            </button>
          </div>

          <div className="text-center pt-2">
            <button
              onClick={() => { reset(); setProduct(''); setAudience(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl shadow-md shadow-fire-500/20 transition-all"
            >
              Generate Another Sequence
            </button>
          </div>
        </div>
      )}

      {result && <CrossPromo items={CROSS_PROMO_ITEMS} />}

      {compareResult && (
        <div ref={resultRef} className="max-w-4xl mx-auto px-6 pt-10 space-y-6 pb-16">
          <div className="bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center animate-slide-up">
            <p className="text-2xl font-black text-green-700">Sequence {compareResult.comparison.winner} wins</p>
            <p className="text-sm text-green-600 mt-1">+{compareResult.comparison.margin} points ahead</p>
            <p className="text-sm text-warm-600 mt-3">{compareResult.comparison.reasoning}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {['sequence_a', 'sequence_b'].map((key, idx) => {
              const seq = compareResult[key] as SequenceResult;
              if (!seq) return null;
              const label = idx === 0 ? 'A' : 'B';
              const isWinner = compareResult.comparison.winner === label;
              return (
                <div key={key} className={`rounded-2xl border-2 p-5 ${isWinner ? 'border-green-300 shadow-lg' : 'border-warm-200 opacity-70'}`}>
                  <div className="text-center mb-3">
                    <span className="text-xs uppercase tracking-wider font-bold text-warm-400">Sequence {label}</span>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      <span className="text-2xl font-black text-warm-900">{seq.overall_score}</span>
                      <span className={`text-lg font-black ${gradeColor(seq.grade)}`}>{seq.grade}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {seq.emails.map(e => (
                      <div key={e.position} className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-warm-500">#{e.position}</span>
                        {frameworkBadge(e.framework_used)}
                        <span className="text-warm-600 truncate">{e.subject_line}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Long-form below-fold content ──────────────────────────── */}
      {!result && !compareResult && !loading && (
        <>
          {/* 1. Example result — show what they'll get */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 text-center mb-2">Here's what you'll get</h2>
              <p className="text-center text-warm-500 mb-8 text-sm">Real output from a real sequence. Yours will be different.</p>
              <div className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900 rounded-2xl p-6 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(255,107,26,0.12),transparent_60%)]" />
                <div className="relative">
                  <p className="text-xs font-bold uppercase tracking-widest text-fire-400 mb-3">Sample Email Card</p>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <span className="text-5xl font-black text-white">82</span>
                    <div className="text-left">
                      <div className="text-2xl font-black text-blue-400">B+</div>
                      <div className="text-xs text-warm-500">/100</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100/20 text-blue-300">AIDA</span>
                    <span className="text-[10px] font-semibold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">42% est. open</span>
                  </div>
                  <p className="text-fire-300 font-bold italic text-sm max-w-sm mx-auto">
                    &ldquo;Strong hook and clear value prop. Adding a specific number in the subject would push open rates higher.&rdquo;
                  </p>
                  <p className="text-xs text-warm-600 mt-3 font-mono">"Quick question about [company]'s Q2 pipeline"</p>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Five frameworks explained */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 mb-3">Five frameworks. Five angles of attack.</h2>
              <p className="text-warm-500 mb-8 text-sm">Each email in your sequence uses a different persuasion framework. No repeating yourself. No one-trick pony.</p>
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">1</span>
                    <h3 className="font-bold text-warm-900">AIDA</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed"><strong>What it does:</strong> Attention-Interest-Desire-Action. The classic funnel in a single email. Grabs them, builds curiosity, creates want, then asks for the click.</p>
                  <p className="text-sm text-warm-600 mt-1"><strong>When to use it:</strong> Email #1 in any sequence. The opener. Sets the tone before the reader has any context about you.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Example subject: "The 3-minute fix for [pain point] that 2,000 founders missed"</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-black text-sm">2</span>
                    <h3 className="font-bold text-warm-900">PAS</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed"><strong>What it does:</strong> Problem-Agitate-Solve. Find the wound, pour salt on it, then hand them the bandaid. The most reliable cold email framework in existence.</p>
                  <p className="text-sm text-warm-600 mt-1"><strong>When to use it:</strong> When your reader doesn't know they have a problem yet. Or knows but hasn't felt the urgency.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Example subject: "Your competitors are doing this. You're not."</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-fire-100 text-fire-700 flex items-center justify-center font-black text-sm">3</span>
                    <h3 className="font-bold text-warm-900">Hormozi Value</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed"><strong>What it does:</strong> Dream Outcome x Perceived Likelihood / Time x Effort. Math that makes people buy. Maximize the numerator, minimize the denominator.</p>
                  <p className="text-sm text-warm-600 mt-1"><strong>When to use it:</strong> Mid-sequence when the reader is considering options. This email makes your offer feel like a no-brainer.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Example subject: "40% more pipeline in 14 days (no new hires)"</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-black text-sm">4</span>
                    <h3 className="font-bold text-warm-900">Cialdini Reciprocity</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed"><strong>What it does:</strong> Give massive free value first. Then ask. Reciprocity is a hell of a drug. The reader feels they owe you before you even pitch.</p>
                  <p className="text-sm text-warm-600 mt-1"><strong>When to use it:</strong> Email #3 or #4. After you've established the problem, give them something genuinely useful for free.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Example subject: "Free: the exact template we used for [result]"</p>
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-sm">5</span>
                    <h3 className="font-bold text-warm-900">Storytelling Arc</h3>
                  </div>
                  <p className="text-sm text-warm-600 leading-relaxed"><strong>What it does:</strong> Setup, Conflict, Resolution, CTA. Humans are wired for stories, not sales pitches. This email reads like a mini-case study.</p>
                  <p className="text-sm text-warm-600 mt-1"><strong>When to use it:</strong> The closer. Email #5. By now they've seen data, value, and proof. The story makes it personal.</p>
                  <p className="text-xs text-warm-400 mt-2 italic">Example subject: "How [name] went from 2 replies to 47 in one week"</p>
                </div>
              </div>
            </div>
          </section>

          {/* 3. Four goals — when to pick each */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-3">Pick the right goal</h2>
            <p className="text-center text-warm-500 mb-8 text-sm">Different goals produce different sequences. Here's when to use each one.</p>
            <div className="space-y-4">
              {[
                { goal: 'Cold Outreach', desc: 'You\'re emailing strangers. The sequence builds trust from zero — light first touch, value in the middle, direct ask at the end. Expect 15-25% open rates if your subject lines are tight.', color: 'bg-blue-50 border-blue-200' },
                { goal: 'Nurture', desc: 'They already know you. The sequence deepens the relationship — educational content, case studies, gentle CTAs. No hard sells. Think weekly drip, not daily bombardment.', color: 'bg-green-50 border-green-200' },
                { goal: 'Launch', desc: 'You\'re shipping something. The sequence builds anticipation — tease, reveal, social proof, urgency, last call. Compressed timeline. Higher energy.', color: 'bg-fire-50 border-fire-200' },
                { goal: 'Re-engagement', desc: 'They went quiet. The sequence re-activates — "miss you" opener, value bomb, what\'s new, final ultimatum. If they don\'t respond after 5, clean your list.', color: 'bg-yellow-50 border-yellow-200' },
                { goal: 'Win-back', desc: 'They cancelled or churned. The sequence acknowledges the breakup, shows what\'s changed, offers a comeback incentive. Honest, not desperate.', color: 'bg-purple-50 border-purple-200' },
              ].map(({ goal, desc, color }) => (
                <div key={goal} className={`rounded-xl border p-4 ${color}`}>
                  <h3 className="font-bold text-warm-900 text-sm">{goal}</h3>
                  <p className="text-sm text-warm-600 mt-1 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Deliverability guide */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 mb-3">Don't land in spam</h2>
              <p className="text-warm-500 mb-8 text-sm">The best email in the world is useless if it hits the promotions tab. Here's what to watch.</p>
              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-warm-900 text-sm mb-2">Spam trigger words to avoid</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {['free', 'act now', 'limited time', 'click here', 'buy now', 'order now', 'urgent', '!!!', 'ALL CAPS', '$$$', 'winner', 'congratulations', 'guarantee', 'no obligation'].map(w => (
                      <span key={w} className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-semibold">{w}</span>
                    ))}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-warm-50 rounded-xl border border-warm-100 p-4">
                    <h4 className="font-bold text-warm-900 text-sm mb-1">Subject line length</h4>
                    <p className="text-sm text-warm-600">Mobile truncates at <strong>40 characters</strong>. Desktop shows ~60. Aim for 4-7 words. 2-4 word subjects hit 46% open rates in 2026 data.</p>
                  </div>
                  <div className="bg-warm-50 rounded-xl border border-warm-100 p-4">
                    <h4 className="font-bold text-warm-900 text-sm mb-1">Personalization stats</h4>
                    <p className="text-sm text-warm-600">Emails with <strong>2+ merge fields</strong> get 142% more replies. Use <code className="bg-warm-200 px-1 rounded text-fire-700 text-xs">{'{{first_name}}'}</code>, <code className="bg-warm-200 px-1 rounded text-fire-700 text-xs">{'{{company}}'}</code>, <code className="bg-warm-200 px-1 rounded text-fire-700 text-xs">{'{{pain_point}}'}</code>.</p>
                  </div>
                </div>
                <div className="bg-green-50 rounded-xl border border-green-200 p-4">
                  <p className="text-sm text-warm-700"><strong>Pro tip:</strong> Personalized subjects get +26% opens. But don't fake it — "Hey {'{{first_name}}'}, quick question" only works if the rest of the email is actually personalized too.</p>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Who uses this */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14">
              <h2 className="text-2xl font-black text-warm-900 text-center mb-8">Who uses EmailForge</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { role: 'Founders doing outreach', desc: 'You\'re emailing prospects yourself. No sales team, no SDR. You need sequences that sound human and convert — not templates that scream "I bought a list."' },
                  { role: 'Sales teams', desc: 'A/B test framework combinations before loading into your sequencer. Generate 5 emails in 10 seconds instead of 2 hours of copywriting.' },
                  { role: 'Newsletter creators', desc: 'Welcome sequences, re-engagement flows, launch announcements. Every subscriber touchpoint is an email sequence problem.' },
                  { role: 'Product launchers', desc: 'Pre-launch hype, launch day blast, post-launch follow-up. The Launch goal generates sequences built for compressed timelines.' },
                ].map(({ role, desc }) => (
                  <div key={role} className="flex items-start gap-3">
                    <span className="w-8 h-8 rounded-lg bg-fire-100 text-fire-700 flex items-center justify-center text-xs font-black flex-shrink-0">&#x2713;</span>
                    <div>
                      <h3 className="font-bold text-warm-900 text-sm">{role}</h3>
                      <p className="text-sm text-warm-500 mt-0.5">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 6. vs Alternatives */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-xl font-black text-warm-900 text-center mb-8">Why not just use Instantly or Reply.io?</h2>
            <div className="space-y-4">
              {[
                { them: 'Instantly ($30/mo) — sends emails at scale', us: 'EmailForge generates the emails. Use Instantly to send them. We\'re the copywriter, they\'re the mailman.' },
                { them: 'Reply.io ($49/mo) — sequence automation + AI writer', us: 'We use 5 proven persuasion frameworks, not generic AI rewrites. Each email has a different angle. Plus we score deliverability.' },
                { them: 'Smartlead ($39/mo) — multi-inbox warmup + sending', us: '$1 per sequence vs $39/month. Generate sequences on demand, load them into any tool. No subscription lock-in.' },
                { them: 'ChatGPT — "write me 5 cold emails"', us: 'ChatGPT gives you 5 variations of the same email. We give you 5 different frameworks with scoring, open rate estimates, and deliverability checks.' },
              ].map(({ them, us }, i) => (
                <div key={i} className="grid grid-cols-2 gap-3">
                  <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                    <p className="text-[10px] font-bold uppercase text-warm-400 mb-1">Others</p>
                    <p className="text-sm text-warm-600">{them}</p>
                  </div>
                  <div className="bg-fire-50 rounded-xl p-4 border border-fire-200">
                    <p className="text-[10px] font-bold uppercase text-fire-500 mb-1">EmailForge</p>
                    <p className="text-sm text-warm-700">{us}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 7. Stats bar */}
          <section className="bg-warm-900">
            <div className="max-w-3xl mx-auto px-6 py-14 text-center">
              <p className="text-warm-400 text-sm mb-6">Built for people who take their outreach seriously</p>
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <p className="text-3xl font-black text-white">5</p>
                  <p className="text-xs text-warm-500 mt-1">Persuasion frameworks</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">5</p>
                  <p className="text-xs text-warm-500 mt-1">Email sequences</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">Est.</p>
                  <p className="text-xs text-warm-500 mt-1">Open rates per email</p>
                </div>
                <div>
                  <p className="text-3xl font-black text-white">$1</p>
                  <p className="text-xs text-warm-500 mt-1">Per sequence</p>
                </div>
              </div>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="mt-8 px-6 py-3 bg-fire-500 hover:bg-fire-600 text-white font-bold rounded-xl transition-colors text-sm">
                Forge your sequence
              </button>
            </div>
          </section>

          {/* 8. How it works — 5 steps */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-10">How it works</h2>
            <div className="space-y-8">
              {[
                { step: '1', title: 'Describe your product', desc: 'Tell us what you sell and who you\'re selling to. The more specific, the better the emails. "B2B SaaS for HR teams" beats "software."' },
                { step: '2', title: 'Pick your goal and tone', desc: 'Cold outreach? Launch? Win-back? Each goal produces a different sequence structure. Tone adjusts the voice — professional, casual, urgent, or storytelling.' },
                { step: '3', title: 'Get 5 emails in ~15 seconds', desc: 'AI generates a full sequence using AIDA, PAS, Hormozi, Cialdini, and Storytelling frameworks. Each email has a unique angle.' },
                { step: '4', title: 'Review scores and deliverability', desc: 'Overall sequence score, per-email open rate estimates, subject line length warnings, and spam trigger detection. Fix issues before sending.' },
                { step: '5', title: 'Copy, customize, send', desc: 'Copy individual emails or the full sequence. Replace merge fields with real data. Load into your email tool and start sending.' },
              ].map(({ step, title, desc }) => (
                <div key={step} className="flex items-start gap-4">
                  <span className="flex-shrink-0 w-10 h-10 rounded-full bg-fire-100 text-fire-700 flex items-center justify-center font-black">{step}</span>
                  <div>
                    <h3 className="font-bold text-warm-900">{title}</h3>
                    <p className="text-sm text-warm-500 mt-1 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 9. Pricing */}
          <section className="bg-white border-y border-warm-200/40">
            <div className="max-w-2xl mx-auto px-6 py-14 text-center">
              <h2 className="text-2xl font-black text-warm-900 mb-2">Simple pricing</h2>
              <p className="text-warm-500 mb-6 text-sm">No subscription. No monthly fee. Pay for what you use.</p>
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                  <p className="text-2xl font-black text-warm-900">Free</p>
                  <p className="text-xs text-warm-500 mt-1">First sequence</p>
                </div>
                <div className="bg-fire-50 rounded-xl p-4 border-2 border-fire-300">
                  <p className="text-2xl font-black text-warm-900">$1</p>
                  <p className="text-xs text-warm-500 mt-1">Per credit</p>
                </div>
                <div className="bg-warm-50 rounded-xl p-4 border border-warm-100">
                  <p className="text-2xl font-black text-warm-900">$5</p>
                  <p className="text-xs text-warm-500 mt-1">7 credits</p>
                </div>
              </div>
              <p className="text-xs text-warm-400 mt-4">1 credit per sequence, 2 for A/B compare. Same credits work across all 10 bilko.run tools. Credits never expire.</p>
            </div>
          </section>

          {/* 10. FAQ — 8 questions */}
          <section className="max-w-2xl mx-auto px-6 py-14">
            <h2 className="text-2xl font-black text-warm-900 text-center mb-8">Frequently asked questions</h2>
            <div className="space-y-5">
              {[
                { q: 'Can I edit the emails?', a: 'Copy them, paste them, change everything. They\'re a starting point, not a straitjacket. The best cold emails are 80% template, 20% personal touch.' },
                { q: 'Why 5 emails?', a: 'Research says 5-7 touchpoints to convert a cold lead. We give you 5 with different frameworks so you\'re not repeating yourself. Each email has a unique psychological angle.' },
                { q: 'Are open rate estimates accurate?', a: 'They\'re AI estimates based on subject line patterns, length, and personalization signals. Useful for comparing emails within a sequence — not as gospel truth. Real open rates depend on your list quality, sender reputation, and send time.' },
                { q: 'What\'s the best goal for cold outreach?', a: 'Use "Cold Outreach." It generates sequences that build trust from zero — light first touch, value in the middle, direct ask at the end. The tone and framework order are optimized for strangers who have no idea who you are.' },
                { q: 'How do I personalize?', a: 'Replace generic greetings with merge fields: {{first_name}}, {{company}}, {{pain_point}}. The emails include placeholder markers where personalization fits naturally. Emails with 2+ custom fields get 142% more replies.' },
                { q: 'Can I compare two sequences?', a: 'Yes. Switch to Compare mode, enter two different product/audience combos, and we\'ll generate both sequences and pick a winner. Costs 2 credits.' },
                { q: 'Do credits work across tools?', a: '1 credit = 1 sequence. Same credits work on PageRoast, HeadlineGrader, AdScorer, ThreadGrader, AudienceDecoder, LaunchGrader, StackAudit, and Stepproof. LocalScore is free.' },
                { q: 'What about deliverability scoring?', a: 'We check every email for spam trigger words, excessive caps, too many exclamation marks, and subject line length. You get a deliverability score out of 100 with specific issues flagged. Fix them before loading into your sequencer.' },
              ].map(({ q, a }) => (
                <div key={q}>
                  <h3 className="font-bold text-warm-900 text-sm">{q}</h3>
                  <p className="text-sm text-warm-600 mt-1 leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </section>

          <EmailForgeTutorial />

          {/* 11. Final CTA */}
          <section className="bg-gradient-to-br from-warm-900 via-warm-950 to-warm-900">
            <div className="max-w-2xl mx-auto px-6 py-16 text-center">
              <h2 className="text-2xl font-black text-white mb-3">Your next email sequence is one prompt away.</h2>
              <p className="text-warm-400 mb-6 text-sm">Five frameworks. Five emails. Deliverability checked. First one's free.</p>
              <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="px-8 py-4 bg-fire-500 hover:bg-fire-600 text-white font-black rounded-xl shadow-lg shadow-fire-600/30 transition-all text-base">
                Forge Your Sequence
              </button>
              <p className="text-xs text-warm-600 mt-4">No signup required. Results in ~15 seconds.</p>
            </div>
          </section>
        </>
      )}

      {/* Template Library */}
      {templates.length > 0 && (
        <div className="max-w-2xl mx-auto px-6 pb-12">
          <div className="bg-white rounded-2xl border border-warm-200/60 p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-warm-400 mb-4">My Templates ({templates.length})</h3>
            <div className="space-y-2">
              {templates.map((t, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-warm-50 last:border-0">
                  <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${
                    t.grade.startsWith('A') ? 'bg-green-100 text-green-700' :
                    t.grade.startsWith('B') ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>{t.grade}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-warm-800 truncate">{t.product}</p>
                    <p className="text-xs text-warm-400">{GOAL_LABELS[t.goal]} &middot; {TONE_LABELS[t.tone]} &middot; {t.score}/100</p>
                  </div>
                  <button onClick={() => loadTemplate(t)} className="text-xs text-fire-500 hover:text-fire-600 font-semibold flex-shrink-0">Re-generate</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
