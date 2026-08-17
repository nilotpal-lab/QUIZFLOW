# Landing Page Simplification Spec

## 1. Request Summary

> "For the landing page I need only the student login button and admin login button. I don't want all the scrollable animation — just the front page, nothing else."

The marketing landing page must be reduced to a **single-screen, non-scrolling front page** whose only purpose is to route users to one of two places:

1. **Student Login** → `/quizflow/student/login`
2. **Admin Login** → `/quizflow/auth`

All scrollable marketing sections (marquee ticker, feature bento grid, "How It Works", FAQ, full footer) are removed from the visible page. The remaining content (header, centered hero, two CTA cards, minimal footer) fits within one viewport with no scrolling on desktop.

## 2. Files in Scope

| File | Role | Change |
| :--- | :--- | :--- |
| `src/app/quizflow/page.tsx` | The landing page component (`MarketingHomepage`) | **Rewrite** — strip to single-screen layout |
| `src/app/page.tsx` | Root `/` — re-exports `MarketingHomepage` | **No change** (inherits new design automatically) |
| `src/quizflow/JsonLd.tsx` | JSON-LD schema injected globally via `layout.tsx` | **Trim FAQPage block** (see §6) |
| `src/app/layout.tsx` | Global layout rendering `<QuizFlowJsonLd />` | **No change** |
| `src/app/quizflow/student/login/page.tsx` | Student login destination | **No change** (verify link target only) |
| `src/app/quizflow/auth/page.tsx` | Admin login destination | **No change** (verify link target only) |

> Note: `/quizflow` and `/` share the exact same component (`src/app/quizflow/page.tsx`), so the new minimal design applies to **both** URLs with a single edit. Confirmed with user.

## 3. Current State (Before)

The current page (2,173 lines of JSX in `src/app/quizflow/page.tsx`) contains, top to bottom:

1. **Sticky top nav** — QuizFlow logo (clickable → `/quizflow`), "Student Login" pill button (yellow, → `/quizflow/student/login`), and either "Admin Login" pill button (white, → `/quizflow/auth`) or the logged-in admin's name chip (🛡️ + name → `/quizflow/dashboard`).
2. **Hero section** — decorative floating Memphis shapes (cherry rectangle, mint circle, yellow triangle, sky circle, small triangle, rotated rectangle) with hover animations, black pill badge "⚡ Classroom Engagement Redefined", huge title "THE CLASSROOM BATTLE ARENA" with underline accent, tagline paragraph, and a 2-card CTA grid (purple **Admin** card "Organizer · Create & host" with 🛡️ icon; yellow **Student** card "Contestant · Play on the day" with 🎮 icon).
3. **Marquee ticker** — infinitely scrolling black bar: "Live Multiplayer Battles · Thinking-Level AI · Co-Op Boss Raids · …".
4. **Feature bento grid** — "FEATURES / Next-Gen Learning Tools" + 4 cards (Live Battles, AI Studio, Quiz Library, Boss Raids).
5. **How It Works** — "GUIDE" + 3 numbered steps (Create → Host → Battle).
6. **FAQ** — "FAQ" + 5 `<details>` accordions that mirror the FAQPage JSON-LD schema.
7. **Footer** — logo, tagline, nav links (Student Login, Quiz Library, AI Studio, Admin Dashboard, Admin Login), copyright.

## 4. Decisions (Gathered via Interview)

### 4.1 What stays visible
- **Top nav**: keep as-is (logo + Student Login button + Admin Login button / name chip when logged in).
- **Hero content**: centered QuizFlow logo (new — currently only in nav/footer) **above** the title, the pill badge, the big hero title, and a shortened tagline.
- **CTA cards**: keep the two big colored cards (purple **Admin** with 🛡️, yellow **Student** with 🎮) — exact current markup, labels "Student Login" / "Admin Login".
- **Decorations**: keep the dotted-grid background texture and the floating colored Memphis shapes **with** their hover animations (they are decorative, not scrollable).
- **Minimal footer**: keep only logo + copyright line ("© {year} QuizFlow Technologies. All rights reserved."). All footer nav links are removed.

### 4.2 What is removed from view
- Marquee ticker (Section 2)
- Feature bento grid (Section 3)
- How It Works (Section 4)
- FAQ accordions (Section 5)
- Footer link row + tagline

### 4.3 Copy changes
- Hero tagline becomes: **"Join the live quiz battle arena"** (replacing the current 2-line paragraph).
- All other copy (title, badge, card labels, nav labels) stays unchanged.

### 4.4 Layout / scroll behavior
- **Desktop**: fixed one-screen layout — `min-h-screen` with content vertically centered; no scrolling.
- **Mobile**: content may scroll if it can't fit (`min-h-screen` + natural flow rather than a hard `h-screen` + `overflow-hidden`), so small phones never get cramped content. Spacing/font sizes may use existing responsive utilities (`md:` variants) to help fit.
- Decorations keep their existing `hidden md:block` / `hidden lg:block` responsive visibility classes so they don't crowd small screens.

### 4.5 Logged-in state
- Preserve current behavior: if `getHostUser()` returns a user, the nav shows the name chip (→ `/quizflow/dashboard`) instead of the "Admin Login" button. The hero Admin card stays visible regardless (it simply routes to `/quizflow/auth`).

### 4.6 Preservation of removed UI
- Removed sections are **commented out in the file** (not deleted) so they can be restored later. Wrap them in a clearly marked block:
  ```tsx
  {/* ================================================================
      REMOVED MARKETING SECTIONS (Oct 2026) — restore by uncommenting
      Marquee ticker · Feature bento · How It Works · FAQ · footer links
      ================================================================ */}
  ```

## 5. Target Structure (After)

```
┌──────────────────────────────────────────────┐
│  [sticky top nav: logo | Student Login | (Admin Login | name chip)] │
├──────────────────────────────────────────────┤
│                                              │
│          (dotted grid bg + floating shapes)  │
│              [QuizFlowLogo centered]         │
│          [⚡ Classroom Engagement Redefined] │
│            THE CLASSROOM BATTLE ARENA        │
│           Join the live quiz battle arena    │
│                                              │
│     ┌──────────────┐  ┌──────────────┐       │
│     │  ADMIN  🛡️    │  │ STUDENT  🎮   │       │
│     │ Student Login │  │ Student Login│       │
│     └──────────────┘  └──────────────┘       │
│                                              │
│  vertically centered, min-h-screen, no scroll│
├──────────────────────────────────────────────┤
│  [minimal footer: logo · © QuizFlow ...]      │
└──────────────────────────────────────────────┘
```

- Page wrapper: `min-h-screen w-full bg-[var(--paper)] ... flex flex-col overflow-x-hidden` (existing).
- `<main>` becomes `flex-1 flex flex-col items-center justify-center` (existing pattern) so hero centers in the remaining space between nav and footer.
- Hero section: `py-16 md:py-24`, centered column; CTA grid unchanged (`landing-cta-grid` classes stay).
- Add centered logo above the pill badge:
  ```tsx
  <QuizFlowLogo size={96} className="mb-6 md:w-[120px] md:h-[120px]" alt="QuizFlow" />
  ```

## 6. JSON-LD Recommendation (user chose "advise me")

**Recommendation: remove the `FAQPage` block from `src/quizflow/JsonLd.tsx`, keep the rest.**

Rationale:
- Google's structured-data guidelines require FAQ rich-result markup to describe content **visible on the page**. Once the FAQ accordions are removed, an FAQPage schema describing them is invisible markup and can trigger a "Spammy structured markup" manual action or simply never qualify for rich results.
- The remaining schema in `JsonLd.tsx` (WebSite/Organization/WebApplication-style entries) describes the product and is independent of the FAQ section, so it stays.
- Verify the FAQ questions/answers in `JsonLd.tsx` match only the (removed) visible FAQ content; if any entries are product-level rather than FAQ-level, keep those.

Decision recorded in spec; implementer may flag if the user later wants to retain FAQ markup anyway.

## 7. Edge Cases & Constraints

1. **Root URL parity**: `/` and `/quizflow` both show the new page (shared component). No separate work needed.
2. **Logged-in admin**: nav shows name chip; hero Admin card still visible. Don't accidentally drop the `user` state effect (`getHostUser` + `initAuthSync`) — it's still needed for the nav.
3. **Mobile overflow**: `min-h-screen` (not `h-screen`) + no `overflow-hidden` on the main container (only `overflow-x-hidden`), so phones can scroll vertically if needed.
4. **Sticky nav**: keep `sticky top-0 z-50` classes so the header remains accessible; harmless on a one-screen page.
5. **External links removed**: the old footer linked to `/quizflow/practice` and `/quizflow/studio`. Those routes still exist and are reachable via the admin dashboard; no 404s introduced, but no direct landing-page links remain (intended).
6. **Marquee keyframes**: `animate-[marquee_30s_linear_infinite]` CSS only matters if the marquee is restored; leaving it commented is fine.
7. **E2E impact**: `e2e/tests/quizflow.e2e.ts` navigates to `/host/new`, `/quizflow/join` — not the landing page — so no test changes expected. Check `admin-student.e2e.ts` / `liveplay.e2e.ts` for landing-page dependencies before finalizing (likely none, but verify).
8. **SEO metadata**: `src/quizflow/metadata.ts` (title/description/OG) is untouched — page still ranks for the same keywords; only the on-page content changes. This is intended per user request.

## 8. Acceptance Criteria

- [ ] `/` and `/quizflow` render a single-screen page: sticky nav, centered hero (logo → badge → title → short tagline → 2 CTA cards), minimal footer.
- [ ] Exactly **two** primary CTAs: Student Login (→ `/quizflow/student/login`) and Admin Login (→ `/quizflow/auth`); hero cards keep current styling.
- [ ] No marquee, features grid, How It Works, or FAQ content visible; removed markup preserved as commented blocks in the same file.
- [ ] No vertical scrolling on a desktop viewport (1280×800+).
- [ ] Dotted grid background and floating shapes with hover animations still present.
- [ ] Logged-in admin still sees the name chip in the nav.
- [ ] `FAQPage` block removed from `src/quizflow/JsonLd.tsx`; other JSON-LD intact.
- [ ] `npm run build` (or `tsc --noEmit`) passes; no unused-import lint errors.

## 9. Open Items / Follow-ups

- Exact size/placement of the centered hero logo (proposed: ~96–120px, above the badge) — confirm visually after implementation.
- Whether the JSON-LD `FAQPage` removal should also delete the commented FAQ JSX or keep both in sync for future restore.
- Confirm no e2e test references landing-page sections (quick grep for `marquee` / `FAQ` / `FEATURES` in `e2e/` before coding).
