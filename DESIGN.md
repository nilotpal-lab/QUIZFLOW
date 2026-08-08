# Design System: QuizFlow Classroom Arena

## 1. Visual Theme & Atmosphere
A refined, high-agency interactive learning canvas combining bold typographic hierarchy with fluid micro-motion. The design language avoids cheap SaaS template tropes, preferring asymmetric card sizes, a subtle dot grid texture background, and spring-physics interactions. The atmosphere feels clean, highly technical, yet engaging for both educators and students.

- **DESIGN_VARIANCE:** 8 (asymmetric layouts, offset buttons, mixed structural heights)
- **MOTION_INTENSITY:** 7 (spring physics hover, magnetic tilt simulation, smooth scroll reveals)
- **VISUAL_DENSITY:** 3 (generous padding, airy spacing, clear breathing room for copy)

## 2. Color Palette & Roles
- **Canvas Cream** (`#FFFCF5`) — Primary page background surface
- **Ink Charcoal** (`#10100F`) — Dark contrast accent, primary text, buttons, card borders
- **Royal Violet** (`#7C4DFF`) — Primary interaction accent for student CTAs and focus rings
- **Sky Blue** (`#40C4FF`) — Secondary action brand accents
- **Sun Yellow** (`#FFE57F`) — Attention pills, highlights, and warning states
- **Mint Green** (`#00E676`) — Status indicators, success messages, and co-op victory alerts
- **Borders** — `3px solid #10100F` (heavy comic outline)
- **Shadows** — `4px 4px 0px #10100F` (hard tactile drop-shadow offsets)

## 3. Typography Rules
- **Display Headlines:** Space Grotesk (`font-display`) — heavy weight (`font-[900]`), letter-spacing tight (`tracking-tighter`), line-height tight (`leading-[0.9]`), uppercase for premium impact.
- **Body copy:** Outfit or Cabinet Grotesk (`font-body`) — light/medium weight (`font-[500]`), leading relaxed (`leading-relaxed`), max-width `65ch` for perfect readability.
- **Micro-labels / Stats:** Monospace (`font-mono`) — all capitals, letter-spacing wide (`tracking-widest`).

## 4. Component Stylings
- **Action Buttons:** Tactile feedback on click (`active:translate-y-[3px] active:translate-x-[3px] active:shadow-[1px_1px_0px_#10100F]`). Solid colors for CTAs, clear outline states for secondary commands.
- **Bento Cells:** Cards are strictly structured without round pill buttons inside sharp layouts (consistent border-radius `16px`). Tinted borders for highlighted features.
- **Spotlight Banner:** Prominent selected state featuring a 1px border highlight and crisp checkmarks.

## 5. Layout Principles
- **Asymmetric Grid Split:** Left column for game-join configuration forms; right column for visual previews and horizontal scrolling arrays.
- **Rhythmic Alternation:** Breaking monotone rows with horizontal scrolling marquees.
- **Mobile Fallback:** Auto-collapsing multi-column layouts to single-column at `< 1024px` breakpoint.

## 6. Motion & Interaction
- Spring-physics transformations on card hover state (`hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[7px_7px_0px_#10100F]`).
- Continuous marquee scrolling animations with fading mask edges.

## 7. Anti-Patterns (Banned)
- No emojis inside marketing text rows.
- No generic serif fonts (Times New Roman, Georgia).
- No pure black (`#000000`) for text.
- No blurry drop-shadows or neon glows.
- No AI copywriting clichés ("unleash", "seamless", "next-gen").
- No filler UI text ("scroll to explore").
