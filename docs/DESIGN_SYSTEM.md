# Mohasib interface system

Mohasib uses one precise visual language across the authenticated workspace and
the public website. Marketing pages may use a larger type scale, but they share
the same color, geometry, border, and elevation rules.

## Geometry

| Element | Radius |
| --- | ---: |
| Cards, tables, forms, dialogs | `0px` |
| Standard controls | `2px` |
| Compact controls | `4px` |
| Status pills, avatars, toggles | `9999px` |

Use `ui-control` for links that behave like buttons and `ui-circle` for intentional
identity or status circles.

## Elevation

Normal cards and tables use borders without shadows. Restrained elevation is used
for small raised controls; strong elevation is reserved for dialogs, dropdowns,
and floating surfaces.

## Spacing and controls

- Standard control height: `40px`
- Mobile control height: `42px`
- Compact control height: `32px`
- Primary card padding: `24px`
- Section rhythm: `28px`

## Color hierarchy

- Gold: primary action, active navigation, focus, and key totals
- Navy: strong secondary actions and primary text
- Neutral outlines: utility actions
- Red: destructive actions and errors only
- Green/amber/red pills: semantic status only

## Page headers

Authenticated pages use the Factures header pattern:

- `36px` gold-tinted icon block with an `18px` icon
- `18px` bold title with tight line height
- `11px` muted subtitle
- `20px` space below the header
- Actions aligned on the right

Use `PageHeader` for new screens. Set `iconBare` when the leading element is a
back-navigation control. Dashboard headers are intentionally exempt.

## Application top bar

The business workspace uses a `64px` top bar above page content:

- Global navigation search on the left (`⌘/Ctrl + K`)
- Desktop sidebar toggle immediately before search
- Notifications and Mohasib Agent actions on the right
- Profile avatar and account menu at the far right
- Account details, Settings, and sign-out inside the profile menu
- Neutral borders and backgrounds; gold is reserved for focus and hover emphasis

Use `AppTopBar` rather than recreating search or profile menus inside individual
pages.

## Public website

Wrap public routes in `public-site`. Reuse these variants instead of recreating
hardcoded marketing cards and buttons:

- `public-page-hero`: cream page introduction with a neutral bottom border
- `public-eyebrow`: compact gold uppercase section label
- `public-surface`: white, square, neutral-bordered content surface
- `public-interactive-surface`: gold border feedback for clickable surfaces
- `public-accent-surface`: `2px` gold top rule for featured surfaces
- `public-dashed-surface`: dashed neutral border for empty states
- `public-icon-tile`: gold-tinted bordered icon container
- `public-primary-action`: filled gold primary CTA
- `public-secondary-action`: white, neutral-outlined secondary CTA

Public cards do not use decorative shadows. Navy panels are reserved for a
single strong narrative or CTA section; multicolor category treatments should
use the standard gold tint unless the color communicates a real status.

### Marketing system

The homepage is the source of truth for Mohasib marketing pages. New public
marketing routes should use the `--marketing-*` tokens and `marketing-*`
primitives defined in `src/app/globals.css` instead of copying hardcoded values.

Core palette: warm canvas `#FDFBF6`, soft surface `#FCFBFA`, muted section
`#F3F0EE`, ink `#141413`, navy ink `#0D1526`, copper `#976224`, body copy
`#626A77`, and dividers `#E4E1D9`.

Reusable primitives:

- `marketing-container`: centered `1180px` content boundary.
- `marketing-eyebrow`: compact copper uppercase section label.
- `marketing-display`: balanced, editorial marketing display heading.
- `marketing-lede`: standard public-page introduction copy.
- `marketing-action`: shared CTA geometry, motion, and focus treatment.
- `marketing-action-primary` and `marketing-action-secondary`: gradient primary
  and white outlined action variants.

Marketing cards use thin dividers, no decorative outer shadow, and only the
`6px` control or `8px` card radius tokens. Headings use restrained weight
(`600`) and tight tracking. Copper is an accent for one phrase, eyebrow, icon,
or interaction cue rather than a large background fill. All interactions keep
the shared visible copper focus ring and `150ms` motion timing.

## Section tabs

Page-level section and status selectors use the notification-page underline
pattern:

- Wrap the controls in `tabs`.
- Apply `tab` to every control and `active` to the selected control.
- Keep the background transparent with a neutral bottom divider.
- Use gold text and a `2px` gold underline for the active tab.
- Allow horizontal scrolling on narrow screens instead of wrapping labels.

Compact status filters may use the neutral filter-toolbar pattern: search and
date controls on the left, square filters on the right, and a gray active state.
Pills remain appropriate for semantic statuses and modal-only switches.

Mohasib Agent opens as a fixed bottom-right dock. It stays within the viewport,
clears the mobile bottom navigation, and uses an internal slide-over for
conversation history instead of navigating away from the current page.

## Feedback states

Use `loading-state` for block loading, `loading-cell` inside tables, `empty-state`
for empty panels, and `empty-cell` for empty table bodies. Empty-state copy should
explain the next useful action whenever one exists.

Success states use Lucide `Check`, `CheckCircle`, or `CheckCircle2` icons. Do not
use Unicode checkmarks or checkmark emoji in labels, buttons, badges, or empty
states. `toast.success` already provides its own icon, so its message stays
text-only.

## Accessibility

- Interactive controls receive a visible gold focus outline.
- Touch controls are at least `40px` high (`42px` on mobile).
- Color is not the only status cue; labels or icons must accompany it.
