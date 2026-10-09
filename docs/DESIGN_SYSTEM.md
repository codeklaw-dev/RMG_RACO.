# Design System

Premium editorial meets design software. Garments first, chrome second.

## Colour tokens (`src/app/globals.css`)
| Token | Value | Use |
|---|---|---|
| `--paper` | `#F7F5F1` | App background |
| `--paper-2` | `#EFEBE4` | Image wells, muted fills |
| `--ink` | `#171717` | Text, primary buttons |
| `--charcoal` | `#3A3835` | Secondary text, nav |
| `--stone` | `#8A857D` | Tertiary text, icons |
| `--hairline` | `#E2DDD5` | All borders (1px) |
| `--oxblood` | `#8C2F37` | Focus ring, active nav, Simulated badge, sparing accents |

Tailwind utilities: `bg-paper`, `text-ink`, `border-hairline`, `text-oxblood`, etc. shadcn semantic tokens map onto these.

## Typography
- Display: Instrument Serif (`.t-display`, `.t-title`, `font-display`)
- UI: Geist Sans (`.t-heading` 15/600, `.t-body` 14/1.55)
- Metadata: Geist Mono uppercase, tracked (`.t-meta` 11px)

## Geometry & spacing
Radius 4px max (2px on badges). Hairline borders over shadows. 4px spacing base; page gutter 16px mobile / 32px desktop; section rhythm 48px; max width 1440px.

## Motion (GSAP)
`<Reveal>` staggers children in (y 12px, 0.5s, `power2.out`). All GSAP runs inside `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`; CSS transitions are also neutralised under reduced motion. Animate transforms/opacity only.

## Components
StatusBadge (Live / Simulated / Planned) · GarmentPlaceholder · ConceptCard · JobRow · PageHeader · Section · EmptyState · ModulePlaceholder · shadcn Button, Badge, Dialog, Sheet, Tooltip, Skeleton, Input, Textarea, Sonner.

## Accessibility
Skip link, `aria-current` on nav and breadcrumb, visible oxblood focus rings, `aria-pressed` toggles, `aria-live` on job activity, labelled image placeholders.
