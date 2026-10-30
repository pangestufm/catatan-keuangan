# Visual Remake: Buku Kas Spidol

Ando asked for a full visual remake of the dashboard on desktop and mobile, keeping every function and leaving all stored financial data untouched. References: the Marker-Doodle Brand Studio and Summary Line Chart skills on skillry.dev, a Three.js scroll-animation short (a wireframe structure that becomes a solid scene on scroll), and a 3D isometric room portfolio short.

## Direction

A personal ledger written in marker. The app stays a working tool (Operate mode): tables, forms and numbers keep their structure and tabular figures. The identity comes from three places:

- **Paper and marker.** A warm paper ground, ink text, cobalt for income and the primary action, tomato for expense, and sunflower used only as a highlighter swipe behind the figure that matters (the period balance) and as the fill of category rails. Hand-drawn SVG marks (an underline under the active nav item and section titles, a circle around the daily peak, a small arrow to an annotation) are drawn in, once, when they enter.
- **Type.** Bricolage Grotesque for everything people read and operate; Kalam (handwriting) only for short annotations written about the data ("puncak", the month note on the stage). Both are self-hosted under `vendor/fonts` (OFL) so the offline mode keeps its look.
- **Meja kas (the Three.js stage).** An isometric desk with one pair of banknote stacks per month (cobalt for income, tomato for expense) for the last six months of real data. Stack height follows the amounts. On entering, each stack is drawn as an ink wireframe that fills into solid paper-clay bundles; scrolling turns the camera; the pointer tilts it slightly; each month is a real button that opens that month. It renders only while visible and while something moves, falls back to an SVG drawing without WebGL, and shows the final pose under reduced motion.

## Boundaries

Presentation only. No change to storage keys, Netlify functions, the database, authentication, AI parsing, reconciliation, import/export, or any calculation. `app.js` gets two read-only hooks: pass the monthly totals it already computes to the stage, and draw the peak annotation in the daily chart. All element IDs and classes that scripts and tests use are kept. Codex's uncommitted motion work in the main checkout is left untouched; this branch starts from the live `origin/main`.

## Verification

Full test suite and production build; real browser screenshots at 320/390/768/1440 in light and dark on the local fixture preview (`tests/preview-server.cjs`, sample data only); keyboard pass; contrast checked with the antislop checker; stage checked for non-blank pixels, fallback and reduced motion. Nothing is pushed or deployed until Ando approves the preview.
