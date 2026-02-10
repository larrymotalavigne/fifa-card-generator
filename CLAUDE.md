# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install --legacy-peer-deps   # Install dependencies (--legacy-peer-deps required)
npm start                        # Dev server (ng serve)
npm run build                    # Production build (output: dist/fifa-card-generator/)
npm test                         # Run unit tests (ng test)
npm run lint                     # Lint
npm run e2e                      # End-to-end tests
```

**Node.js requirement:** 20.19+ or 22.12+

## Architecture

Single-page Angular 17 app that generates FIFA-style player cards for IT teams. Runs entirely client-side with no backend (the `backend/` directory is empty). Uses standalone components (no NgModules).

### Single-component app

The entire UI lives in `src/app/app.component.ts` as one standalone component with an inline template. It contains the card builder form (left panel), live card preview (center), and batch/history tabs (right panel). The template uses `*ngFor` and `*ngIf` directives with Tailwind CSS utility classes.

### Service layer (all `providedIn: 'root'`)

- **CardService** (`src/app/services/card.service.ts`): Core state management via RxJS `BehaviorSubject`. Holds `currentPlayer$` and `availableTemplates$` observables. Handles stat randomization (Box-Muller normal distribution with seeded RNG), overall rating calculation (rounded mean of 6 stats), input sanitization, and template definitions.
- **ExportService** (`src/app/services/export.service.ts`): PNG export via `html-to-image`, PDF contact sheets via `pdf-lib` (A4 with crop marks), ZIP archives via `jszip`. Three PNG sizes: transparent 1024x1536, web 512x768, social 1080x1080.
- **BatchService** (`src/app/services/batch.service.ts`): CSV and JSON import with validation. Processes photo ZIPs matching filenames to player names. Exposes `batchProgress$`, `batchCards$`, and `photoLibrary$` observables.
- **StorageService** (`src/app/services/storage.service.ts`): Persistence layer using localStorage (last 20 cards) with IndexedDB fallback. Handles project file import/export (`.fifacard.json`), data migration from old formats, and backup/restore.

### Data model

Defined in `src/app/models/player.model.ts`:
- `PlayerData`: Core entity with name, position (`ITPosition`), nationality (ISO code), rating (1-99), 6 stats, theme, optional photo (base64)
- `PlayerStats`: 6 IT-focused skills: technical, leadership, creativity, reliability, collaboration, adaptability
- `CardTemplate`: Theme definition with gradients, color schemes, mask shapes (shield/circle/hexagon), metallic effects
- Two built-in themes: `gold-classic` and `dark-mode-it`
- Eight IT positions: DEV, OPS, DATA, PM, QA, UX, SEC, ARCH

### Rendering pipeline

Card preview is a styled `<div>` with CSS classes from `src/styles.scss`. The `.fifa-card` base class has theme variants (`.gold-classic`, `.dark-mode`) with pseudo-element overlays for noise/grain textures. Export captures the DOM element using `html-to-image` with 2x pixel ratio.

### Styling

- Tailwind CSS 3 with `@tailwindcss/forms` and `@tailwindcss/typography` plugins
- Custom theme extensions in `tailwind.config.js`: `fifa-gold`, `fifa-silver`, `fifa-bronze` colors; `card` and `inner-gold` shadows; metallic gradient backgrounds
- SCSS for card template styles in `src/styles.scss`
- Google Fonts: Roboto Condensed (card text), Inter (UI), Poppins (loaded but unused)

### State flow

Form changes -> `cardForm.valueChanges` -> `CardService.updatePlayer()` -> `currentPlayerSubject.next()` -> component subscription updates `currentPlayer` -> template re-renders card preview. The `takeUntil(destroy$)` pattern is used for subscription cleanup.

## Incomplete features (TODO stubs in app.component.ts)

- PDF export (`exportPDF()`)
- Batch CSV/JSON import UI (`onBatchImport()`)
- Photo ZIP import UI (`onPhotoZipImport()`)
- History management UI (`clearHistory()`)
