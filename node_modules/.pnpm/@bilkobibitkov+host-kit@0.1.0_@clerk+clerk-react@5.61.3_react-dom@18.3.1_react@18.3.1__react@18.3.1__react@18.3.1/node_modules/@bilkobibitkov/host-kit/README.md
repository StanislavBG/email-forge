# @bilkobibitkov/host-kit

Shared React component kit used by bilko.run sibling apps.

## Install

```
pnpm add @bilkobibitkov/host-kit
# peer deps:
pnpm add react @clerk/clerk-react
```

## Components

- `ToolHero` — dark gradient hero section
- `ScoreCard` — score + grade + verdict
- `SectionBreakdown` — per-pillar score bars
- `CompareLayout` — A/B side-by-side with winner banner
- `Rewrites` — AI rewrite suggestions with copy buttons
- `CrossPromo` — sibling-app cross-promo links
- `track()` — analytics event helper (POSTs to bilko.run/api/analytics/event)

Each themable component accepts a `theme` prop:

```ts
interface Theme {
  heroGradient: string;     // tailwind classes, e.g. "from-[#1a1530] via-[#0f0d1a] to-[#1a1530]"
  glowColor: string;        // CSS color, e.g. "rgba(99,102,241,0.14)"
  accentText: string;       // tailwind class for dark-on-light, e.g. "text-indigo-700"
  accentTextLight: string;  // tailwind class for light-on-dark, e.g. "text-indigo-400"
}
```

Pass your tool's theme; the kit assumes no defaults.
