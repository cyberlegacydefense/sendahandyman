# Claude Code Prompt — SendAHandyman → ResidentSteward Rebrand

## Role and operating mode

You are working as a senior frontend engineer on a brand migration for an active production codebase that you originally helped build. This is a **high-stakes, brand-defining refactor** — the visual identity must land precisely or the entire luxury repositioning fails.

Operate in **step-by-step approval mode**: show me a diff and pause for confirmation before each phase. Do not chain phases autonomously.

Before touching any code, read this entire prompt end-to-end. Then execute Phase 0 (discovery and audit) and produce a written migration plan that I will approve before you begin Phase 1.

---

## Project context

### Current state

- The codebase powers **SendAHandyman**, a South Florida on-demand handyman marketplace
- Primary domain: `sendahandyman.com` (active, will 301-redirect post-migration)
- Known infrastructure layers: Netlify serverless functions, Supabase backend, Stripe payment processing (with auth holds), Twilio SMS, GPS check-in flow
- Frontend stack and styling system: **detect in Phase 0** and report back as part of the audit
- Current visual identity: tool-belt / handyman aesthetic — bright primary colors, casual sans-serif, action-driven photography
- Three active luxury building partnerships with custom landing pages: Lumaire (West Palm Beach), 10X Boca Raton, Wynwood Haus (Miami)
- Three ICPs being served through this site: general consumers, portfolio property managers, luxury high-rise property managers

### Target state

- New brand: **ResidentSteward**
- New primary domain: `residentsteward.com` (already registered)
- Positioning: concierge platform for residential buildings, not a handyman marketplace
- Aesthetic: *"a private estate, not an app"* — refined, restrained, hospitality-coded
- All booking, Stripe, Twilio, Supabase, GPS check-in, and handyman dashboard functionality must remain identical — this is a **visual + brand migration only, not a re-platform**

### Non-goals (do not touch)

- Booking flow logic
- Stripe auth-hold mechanics or webhook handlers (only update display strings and product metadata references)
- Supabase schema, RLS policies, or table structures (only update env vars and any brand-string references)
- Handyman dashboard backend logic
- GPS check-in functionality
- The 9-step handyman onboarding wizard logic (only update copy and visuals)

---

## Brand specification

### Identity

- **Brand name:** ResidentSteward (one word in URL and code, two words in display: "Resident Steward")
- **Wordmark treatment:** `RESIDENT` in roman caps + `Steward` in italic — always pair this way in logo lockups
- **Domain:** residentsteward.com (production), sendahandyman.com (301-redirect source)
- **Brand essence:** *"Where every resident is cared for. Every detail, tended."*

### Color tokens

Establish these as the canonical design tokens. Use these names everywhere — do not invent variants:

```css
--color-forest:       #1A3D2E   /* Primary — deep forest green */
--color-forest-deep:  #0F2A1F   /* Forest at higher elevation / dark mode bg */
--color-brass:        #C9A961   /* Accent — warm brass / muted gold */
--color-brass-soft:   #D4B97A   /* Brass at lower emphasis */
--color-cream:        #F5F0E6   /* Neutral background — never pure white */
--color-cream-deep:   #EBE4D4   /* Cream for cards / elevated surfaces on cream bg */
--color-ink:          #1A1A1A   /* Body text only where forest is unreadable */
--color-mist:         #8A9991   /* Muted forest for secondary text on cream */
```

If the brand-spec PDF specifies different hex values, the PDF wins — ask me to clarify before proceeding.

### Pairing rules (enforce in components)

- **Forest on Cream** → primary text on body backgrounds
- **Brass on Forest** → headlines, accent elements, borders, icons on dark — this is the signature pairing, use deliberately
- **Cream backgrounds** everywhere by default — never pure white (`#FFFFFF` is banned outside SVG transparency)
- **Brass** is for accent only — never use it as a large background fill

### Color rules to enforce

- ❌ No bright blues, electric greens, or pure greys anywhere
- ❌ No gradients on backgrounds — exception: subtle radial depth overlays only
- ❌ No drop shadows — use 1px brass or forest borders instead
- ❌ No pure white (`#FFFFFF`) anywhere except SVG transparency
- ❌ No pure black (`#000000`) for text — use `--color-forest` or `--color-ink`

### Typography

**Display / headlines — Cormorant Garamond**

- Load via Google Fonts: `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,500&display=swap`
- Hero display: 96px, weight 300 (Light)
- Section titles: 68px, weight 500, italic
- Card headlines: 44px, weight 500
- Use italic deliberately — it carries the brand warmth

**Body / UI — Jost**

- Load via Google Fonts: `https://fonts.googleapis.com/css2?family=Jost:wght@300;500;600&display=swap`
- Body copy: weight 300 (Light)
- Labels / tags / metadata: weight 500 (Medium), often UPPERCASE with letter-spacing
- CTAs / buttons: weight 600 (SemiBold)

**Type tokens to establish:**

```css
--font-display: "Cormorant Garamond", Georgia, serif;
--font-body: "Jost", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;

--text-hero: 96px;
--text-section: 68px;
--text-card: 44px;
--text-body: 17px;
--text-label: 12px;
--text-cta: 15px;
```

### Motion

- All transitions: 600–900ms eases, never faster
- Default easing: `cubic-bezier(0.16, 1, 0.3, 1)` (slow ease-out)
- Text reveals: fade + 8px upward drift
- Section transitions: horizontal wipes, never bouncing
- Never use spring physics or energetic motion
- `prefers-reduced-motion` must be honored — collapse all motion to instant

### Iconography

- Line weight: 1–1.5px stroke
- No filled icons
- 2px corner radius
- Architectural-drawing aesthetic — feel like blueprints, not material icons
- Color: brass on forest, forest on cream
- If existing icons don't fit, replace with Lucide Icons at `strokeWidth={1.25}` as a stand-in

### Graphic elements

- Thin brass rules (1px) as dividers
- Corner ornaments (small brass diamonds or serifs) at section starts
- Borders over fills as the default emphasis mechanism
- Generous whitespace — restraint is the luxury signal

---

## Tagline architecture

Implement these in the specified locations — do not interchange them:

| Slot | Tagline |
|---|---|
| Homepage hero (residentsteward.com root) | "Every resident. Every detail. Tended." |
| B2B / PM outreach landing pages | "Your residents deserve a steward, not a contractor." |
| Consumer landing page | "Maintenance that respects your home." |
| App store metadata / OG description / footer | "Trusted hands. On time. Every time." |
| Supporting taglines (rotate in marketing modules) | "The standard your building deserves." / "Precision care. No excuses." / "Where service meets discretion." / "Because great buildings need great care." / "Your building. Our responsibility." |

---

## Migration phases — execute in this exact order

### Phase 0 — Discovery, audit, and migration plan (no code changes)

Before any edits, perform a complete repo audit and produce a written migration plan. Do not modify any files in this phase.

**Step 1 — Detect and report the tech stack:**

- Frontend framework (from `package.json` dependencies)
- Styling system (Tailwind, CSS modules, styled-components, plain CSS, or hybrid)
- Build tooling and bundler
- Routing approach (file-based / react-router / other)
- State management (if any)
- Testing setup (if any)

**Step 2 — Map the route/page inventory:**

- List every page or route, with file path and current title/purpose
- Flag which pages correspond to the three ICPs (consumer, portfolio PM, luxury PM)
- Flag the three building partnership pages (Lumaire, 10X Boca, Wynwood Haus)
- Flag the booking flow and handyman dashboard routes

**Step 3 — Audit the existing design system:**

- Current color tokens / variables (produce old → new mapping table)
- Current font references and weights
- Current motion / transition values
- Current iconography source (Material, FontAwesome, Lucide, custom SVG)
- Current shadow / border patterns

**Step 4 — Find every brand string:**

Search the codebase (case-insensitive) for: `sendahandyman`, `send a handyman`, `handyman`, `SAH`, `sendahandyman.com`. Produce a complete list with file paths and line numbers, grouped by:

- Display strings (visible to users)
- URL / domain references
- Email / transactional content
- Code comments and internal docs
- Environment variable defaults

**Step 5 — Locate transactional surfaces:**

- Email templates (file paths)
- Stripe product / metadata references (file paths + which are code-level vs dashboard-only)
- Twilio SMS templates and sender configuration (file paths)
- Receipt or PDF generation logic (if any)

**Step 6 — Produce the written migration plan:**

- Phase order with estimated diff size per phase
- Risk flags (anything that could break booking, Stripe, Supabase, or Twilio)
- Open questions you need me to answer before proceeding

**Pause here. Wait for my approval before Phase 1.**

---

### Phase 1 — Design token foundation

1. Create or update the central design token file (`tailwind.config.js`, `tokens.css`, `theme.ts`, or equivalent for the detected stack)
2. Add color, typography, motion, and spacing tokens per the brand spec above
3. Add Google Fonts imports for Cormorant Garamond and Jost — preload critical weights
4. Establish a CSS reset rule that defaults `body` to `background: var(--color-cream); color: var(--color-forest); font-family: var(--font-body);`
5. Add a `prefers-reduced-motion` media query that disables transitions globally

**Show me the diff. Wait for approval before Phase 2.**

---

### Phase 2 — Core component refactor

Refactor in this order — highest visual impact first:

1. **Buttons** — primary (forest fill, cream text, brass border on hover), secondary (cream fill, forest border, forest text), tertiary (text-only, brass underline on hover)
2. **Navigation header** — forest background, brass logo, cream nav links, brass underline on active
3. **Footer** — forest background, cream text, brass dividers
4. **Form inputs** — cream background, forest border, brass focus ring, forest label text in Jost 500
5. **Cards** — cream-deep background, forest border (1px), no shadows
6. **Modal / overlay** — forest with cream text, brass accents
7. **Typography components (H1–H6, body, label)** — apply Cormorant for headlines, Jost for body

After each component, show the diff. Wait for approval before moving to the next.

---

### Phase 3 — Page-level migration

Migrate in the order surfaced in Phase 0's route inventory, prioritized as follows:

1. **Homepage** (`/` or `/index`) — hero with master tagline, section structure refactored to match estate-not-app aesthetic (generous whitespace, italic section titles, brass rules)
2. **Consumer landing page** — tagline: "Maintenance that respects your home."
3. **Portfolio PM landing page** — tagline: "Your residents deserve a steward, not a contractor."
4. **Luxury PM landing page** — tagline: "Your residents deserve a steward, not a contractor." + estate-grade imagery treatment
5. **Three building partnership pages** (Lumaire, 10X Boca, Wynwood Haus) — preserve building-specific content, apply new visual system, update QR-code-target metadata
6. **Booking flow screens** — visual refresh only, zero logic changes
7. **Handyman dashboard** — visual refresh only, zero logic changes
8. **9-step onboarding wizard** — visual refresh only, copy refresh for tone (steward-coded language)

For each page, show me a before/after diff plus a screenshot description of what the new page should look like. Wait for my approval before the next page.

---

### Phase 4 — Brand string and URL migration

Replace across the entire codebase:

- `sendahandyman.com` → `residentsteward.com` (production URLs)
- `SendAHandyman` → `ResidentSteward` (display strings)
- `Send A Handyman` → `Resident Steward` (display strings)
- Email "From" names and addresses
- Stripe product names and metadata references
- Twilio SMS sender alphanumeric ID → `Steward` (11-char limit)
- OpenGraph title, description, image references
- Favicon and app manifest icons
- `robots.txt` and `sitemap.xml`
- Internal documentation strings in comments
- Any hardcoded references in environment variable defaults

Preserve `sendahandyman.com` references only in: (a) the redirect-source configuration, (b) any historical migration logs, (c) git history (don't rewrite history).

Set up the 301 redirect from sendahandyman.com → residentsteward.com via Netlify `_redirects` file or `netlify.toml`. The redirect should preserve path structure where possible (`sendahandyman.com/booking` → `residentsteward.com/booking`).

---

### Phase 5 — Transactional surfaces

Update these specifically:

1. **Stripe** — update product names and statement descriptors in code-level references; flag every dashboard-only setting that needs manual update
2. **Twilio SMS templates** — update sender ID to `Steward`, refresh template copy to steward-coded voice
3. **Transactional emails** — update header logo, color scheme, signature block, footer to new brand
4. **Receipt PDFs** (if generated programmatically) — update letterhead

---

### Phase 6 — Acceptance verification

Before declaring complete, verify:

- [ ] No occurrences of `sendahandyman`, `Send A Handyman`, or `SendAHandyman` remain except in the redirect configuration
- [ ] No occurrences of `#FFFFFF` (pure white) anywhere except SVG transparency
- [ ] No occurrences of `#000000` (pure black) anywhere outside icon defs
- [ ] No `box-shadow` properties anywhere (replaced with borders)
- [ ] No `linear-gradient` on backgrounds (radial overlays only)
- [ ] All transitions are 600ms or longer
- [ ] `prefers-reduced-motion` honored correctly
- [ ] Cormorant Garamond and Jost both load and render
- [ ] All three ICP landing pages have correct tagline
- [ ] sendahandyman.com 301-redirects to residentsteward.com
- [ ] Stripe payment flow completes end-to-end with no logic regression
- [ ] Twilio SMS sends with new sender ID
- [ ] Booking → payment → confirmation flow works identically to pre-migration
- [ ] Handyman dashboard loads and renders correctly

Produce a written acceptance report against this checklist.

---

## Working rules

- **Step-by-step approval mode:** never chain phases without my confirmation
- **Diff-first:** show me what you're about to change before changing it on anything brand-defining
- **Preserve git history:** make commits at phase boundaries with clear messages (e.g. `feat(brand): Phase 1 — design tokens`)
- **Never modify production data:** Stripe, Supabase, Twilio production configs are out of scope — only code-level references
- **Ask, don't assume:** if a brand decision is ambiguous (e.g. which shade of brass to use, or which tagline to apply on an undocumented page), ask me before deciding
- **Quote the source:** when proposing copy changes, quote the source tagline from this prompt verbatim — do not paraphrase brand language
- **No off-brand additions:** do not add features, components, or content that aren't specified here. This is a brand migration, not a redesign-plus-expansion

---

## First action

Start with **Phase 0**. Detect the stack, audit the repo, surface the migration plan. Pause for my approval before any code changes.
