# Design system in code

How the "Limay" spec in [DESIGN.md](DESIGN.md) is implemented in `frontend/`. Decision record:
ADR-0021 in `docs/DECISIONS.md`. Living style guide: run the app and open `/design-system`
(screenshots in `docs/screenshots/t20/`).

## Where things live

| What | File |
|---|---|
| Tokens (color, type, radius, shadow, motion), dark mode, focus, reduced motion | `frontend/src/index.css` |
| Token contrast test (WCAG AA, light and dark) | `frontend/src/design-tokens.test.ts` |
| `cn()` with the product type scale registered in tailwind-merge | `frontend/src/lib/utils.ts` |
| Theme provider, hook and toggle | `frontend/src/components/theme/` |
| Base components (shadcn style) | `frontend/src/components/ui/` |
| Hearing status badge and status catalog | `frontend/src/components/hearing/` |
| "Cálculo asistido" disclaimer | `frontend/src/components/legal/assisted-calculation-note.tsx` |
| Style guide page | `frontend/src/pages/design-system-page.tsx`, `src/pages/design-system/` |

## Tokens

### Color

Every color is a CSS variable in `:root` (light) and `.dark`, with the hex values of DESIGN.md,
and a Tailwind color of the same name (`--detained-soft` → `bg-detained-soft`,
`text-detained-soft`, `border-detained-soft`).

| CSS variable | Tailwind name | Use |
|---|---|---|
| `--background`, `--foreground` | `bg-background`, `text-foreground` | Page and body text |
| `--card`, `--card-foreground` | `bg-card`, `text-card-foreground` | Cards, specimens |
| `--popover`, `--popover-foreground` | `bg-popover`... | Dialogs, menus |
| `--primary`, `--primary-hover`, `--primary-foreground` | `bg-primary`, `hover:bg-primary-hover`... | Main action, links, focus |
| `--secondary`, `--secondary-foreground` | `bg-secondary`... | Segmented tracks, secondary buttons |
| `--muted`, `--muted-foreground` | `bg-muted`, `text-muted-foreground` | Subtle fills, metadata |
| `--accent`, `--accent-foreground` | `bg-accent`... | Hover and selected rows, active nav |
| `--destructive`, `--destructive-foreground` | `text-destructive`... | Form errors, rare irreversible actions |
| `--border`, `--input` | `border-border`, `border-input` | Card borders, dividers |
| `--border-strong` | `border-border-strong` | Field borders, rail dots (3:1) |
| `--ring` | `outline-ring` | Focus outline |
| `--detained`, `-soft`, `-edge` | `text-detained`, `bg-detained-soft`, `border-detained-edge` | A client deprived of liberty, only |
| `--deadline`, `-soft`, `-edge` | `text-deadline`, `bg-deadline-soft`, `border-deadline-edge` | Deadlines, only |
| `--status-{programada,reprogramada,efectiva,suspendida}` and `-soft` | `text-status-efectiva`, `bg-status-efectiva-soft`... | Hearing status badges |
| `--sidebar-*` | `bg-sidebar`... | Desktop sidebar (later tasks) |
| `--chart-1` … `--chart-5` | `fill-chart-1`... | Charts (no red) |
| `--overlay` | `bg-overlay` | Dialog scrim (added in T20) |

To change a color: edit DESIGN.md, `index.css` and `scripts/contrast.mjs` together, then run
`npm test` (the token test fails if a pair drops below AA or a dark value is missing).

### Typography

One family, Atkinson Hyperlegible Next (`font-sans`, self-hosted with Fontsource). Tailwind's
size scale is **removed**; only these exist, so nothing smaller than 15 px can be written:

| Class | Mobile | ≥ 768 px | Use |
|---|---|---|---|
| `text-display` | 28/34 px | 32/38 px | Screen title (pair with `font-bold`) |
| `text-title` | 20/26 px | same | Section titles |
| `text-time` | 18 px | 21 px | Hearing time on the rail |
| `text-card-title` | 18/24 px | same | Hearing type |
| `text-body` | 17/25 px | same | Body (default on `<body>`) |
| `text-meta` | 16/24 px | same | Room, judge, legajo, labels, buttons |
| `text-small` | 15/22 px | same | Badges, CPP article, disclaimers. The floor. |

`<time>` gets tabular figures automatically; add `tabular-nums` to dates and legajo numbers.
Keep legajo numbers on one line (`whitespace-nowrap`): they break at the hyphen otherwise.

### Layout (app shell, T21)

| Token | Tailwind | Value | Use |
|---|---|---|---|
| `--spacing-sidebar` | `w-sidebar`, `lg:pl-sidebar` | 248 px | Desktop sidebar width |
| `--spacing-top-bar` | `h-top-bar` | 60 px | Mobile top bar, sidebar brand row |
| `--spacing-bottom-nav` | `h-bottom-nav` | 64 px | Bottom nav items |
| `--container-content` | `max-w-content` | 1180 px | Content column |
| utilities | `pt-safe`, `pb-safe`, `pb-bottom-nav-safe` | `env(safe-area-inset-*)` | Notch, home bar, room under the bottom nav |
| utility (T22) | `top-below-top-bar` | top bar + safe-area inset | `sticky` headers that stay under the mobile top bar (agenda day headers); pair with `lg:static` |
| `--spacing-aside` (T23) | `xl:grid-cols-with-aside` | 340 px | Main column plus the right column of a two-column screen (case detail) |

### Radius, elevation, motion

- `rounded-md` 8 px (segments), `rounded-lg` 10 px (buttons, fields, alerts), `rounded-xl` 14 px
  (cards), `rounded-full` (badges, floating button).
- Flat by default. `shadow-fab` for the floating button, `shadow-segment` for the selected
  segment, `shadow-lg`/`shadow-md` for dialogs and tooltips.
- `duration-fast` (120 ms) for hover and color changes, `duration-base` (200 ms) for dialogs;
  always `ease-out`. Under `prefers-reduced-motion: reduce` every transition and animation is
  near-instant (index.css).
- Focus: one global `:focus-visible` rule (3 px ring, 2 px offset). Do not add `outline-none`.

## Dark mode

- Class-based: `.dark` on `<html>`; variant `dark:` is `&:where(.dark, .dark *)`.
- `ThemeProvider` (in `App`) holds the choice: `"light"`, `"dark"` or `"system"` (default). With
  `"system"` it follows `prefers-color-scheme` live. The choice is saved in localStorage under
  `theme` (try/catch: blocked storage only means it is not remembered).
- `index.html` has an inline script that applies the same rule before first paint, so there is
  no light flash. Keep it in sync with `theme-context.ts`.
- `useTheme()` returns `{ theme, resolvedTheme, setTheme }`. `<ThemeToggle />` is the ready-made
  control: a radio group named "Tema" with "Claro", "Oscuro" and "Según el sistema".
- Never hardcode a color for one theme: use tokens, they switch by themselves.

## Components

All follow shadcn/ui conventions (`data-slot`, `className` merged with `cn`, Radix primitives
from `radix-ui`) and keep a 44 px touch target.

| Component | Variants / props | Notes |
|---|---|---|
| `Button` | `variant`: `default`, `secondary`, `outline`, `ghost`, `link`, `destructive`. `size`: `default` (44 px), `lg` (52 px), `icon` (44×44), `fab` (52 px pill with shadow). `asChild` | Defaults to `type="button"`. Icon-only buttons need `aria-label`. |
| `Input`, `Textarea` | native props | `aria-invalid="true"` draws the error border. Textarea grows with content. |
| `Select` | native `<select>` props and `<option>` children | Uses the device picker on phones. |
| `Label` | Radix label | Always visible; `htmlFor` the control. |
| `Field`, `FieldDescription`, `FieldError` | | Link help and errors with `aria-describedby`. `FieldError` adds the icon. |
| `Checkbox`, `Switch` | Radix props | Hit area extended to 44 px; put them in a `min-h-11` row with their `Label`. |
| `Card`, `CardHeader`, `CardTitle` (`as` h2/h3/h4), `CardDescription`, `CardContent`, `CardFooter` | `edge`: `none`, `detained`, `deadline`. `asChild` on `Card` and `CardContent` | Use `<article>` for a hearing and `<dl>` for its metadata. |
| `Badge` | `variant`: `neutral`, `outline`, `programada`, `reprogramada`, `efectiva`, `suspendida`, `detained`, `deadline` | Status variants draw a dot; the word is always there. |
| `HearingStatusBadge` | `status`: catalog code (`solicitada` … `cancelada`, `cuarto-intermedio`) | Maps code → label and tone. Prefer it over picking a tone by hand. |
| `Alert`, `AlertTitle`, `AlertDescription` | `variant`: `info`, `detained`, `deadline`, `error`, `disclaimer` | First child: a lucide icon with `aria-hidden`. No role by default; add `role="alert"` only for messages that appear after an action. |
| `AssistedCalculationNote` | | "Cálculo asistido: verificá con la norma." Goes with every computed deadline, next to its legal source. |
| `Dialog` + `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`, `DialogTrigger` | | Always a `DialogTitle`. Close button is labeled "Cerrar". Footer stacks on phones. |
| `Tooltip`, `TooltipTrigger`, `TooltipContent` | | `TooltipProvider` is in `App`. Extra context only, never the only copy (touch has no hover). |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | | Segmented look; give `TabsList` an `aria-label`. |
| `DropdownMenu` + `DropdownMenuTrigger`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuSeparator` | | Action menus (firm switcher, account). 44 px items; give a radio group an `aria-label`. |
| Shell (`components/shell/`): `AppShell`, `Sidebar`, `TopBar`, `BottomNav`, `FirmSwitcher`, `UserMenu`, `PageHeader`, `BrandMark` | | Signed-in layout (T21). Pages render inside `<main id="contenido">`: start with `PageHeader` (the only `h1`), never another `<main>`. |
| Agenda (`features/agenda/`, T22): `HearingCard`, `HearingRow`, `AgendaStatusBadge`, `DayRail`, `WeekList`, `DetaineeAlerts`, `AgendaToolbar`, `AgendaSkeleton`, `AgendaEmpty`, `AgendaError` | `HearingCard` `finished` starts collapsed | `HearingCard` is the full card on the day rail (`h2` title); `HearingRow` the week row (`h3`), a card on phones and a table-like row from 768 px. `AgendaStatusBadge` falls back to a neutral badge with the firm's own status name. The "Día / Semana" switch uses toggle buttons (`aria-pressed`) because it changes the URL, not a tab panel. ADR-0023. |
| Cases (`features/cases/`, T23): `CaseCards`, `CaseTable`, `DefendantCard`, `CaseHearings`, `ReservedBadge`, `ArchivedBadge`, `DetaineeBadge`, `CaseListSkeleton`, `CaseDetailSkeleton`, `CasesEmpty`, `LoadError`, `CaseNotFound` | `DetaineeBadge` `count` | Cards below 1024 px, a semantic table from 1024 px (both rendered, CSS shows one). A case or defendant deprived of liberty gets the red edge and the lock badge. The case caption is a stretched link on cards. Read only (ADR-0024). |
| `Separator` | `orientation`, `decorative` | Decorative by default. |
| `Skeleton` | | `aria-hidden`; wrap a group in `role="status" aria-busy="true" aria-label="Cargando …"`. |

## Do and don't

| Do | Don't |
|---|---|
| Use the product type classes (`text-body`, `text-meta`, `text-small`...) | Reach for `text-sm`/`text-xs` (they do not exist) or arbitrary `text-[13px]` |
| Use token colors (`bg-card`, `text-muted-foreground`) | Use palette colors (`bg-slate-100`) or hex values in components |
| Use `detained` only for a client deprived of liberty, `deadline` only for deadlines | Paint error pages red, color archive buttons red or use red for emphasis |
| Pair every color with a word and an icon | Use a colored dot or edge as the only signal |
| Use `Button` with a verb in "vos": "Guardá", "Archivá el caso" | Use "Enviar", "Submit" or an icon-only primary action |
| Keep focus visible (global ring) | Add `outline-none` or remove focus styles |
| Use `Select` (native) for lists of options | Build a custom dropdown for a simple choice |
| Add a new token in `index.css` (and DESIGN.md) when a screen needs one | Write a one-off color, shadow or spacing in a screen |
