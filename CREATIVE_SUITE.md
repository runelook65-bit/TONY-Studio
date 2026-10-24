# TONY Creative Suite — unpublished development branch

**Release hold:** Do not merge this feature branch into `main` or deploy to Vercel until the owner explicitly says **“yayınla”**. Vercel Preview deployments have been disabled at the project level to respect that requirement.

## 1. Original TONY layouts

- **Classic News:** the existing TONY look.
- **Metro Dispatch:** transit-map-inspired yellow rule and dark editorial panel.
- **City Bulletin:** front-page-inspired inset border.

Layouts are new canvas drawing code, not third-party copied templates.

## 2. Photo framing

The main story image uses bounded cover scaling, manual X/Y focal-point sliders and drag-to-pan. Empty crop margins are prevented by geometry clamps.

## 3. Per-slide carousel editor

1. Enter the source URL, editorial verification and cover image rights in **Story / Editorial Review**.
2. Enter the main story headline, supporting summary and select a cover photograph.
3. In **Design > Instagram Carousel Builder**, click **Add page** to create up to five follow-up slides (six pages including the cover).
4. Choose each page to edit its headline and supporting facts.
5. For an individual follow-up slide, optionally **upload a JPG/PNG/WEBP** (15 MB maximum), change its design template, adjust horizontal/vertical focus and photo zoom independently.
6. For each independent photo, confirm image rights and supply photographer/license credits where appropriate. If the image is synthetic, select **AI-generated illustration**; an explicit AI label is drawn into that slide.
7. Move follow-up pages earlier/later; the cover remains first.
8. **Download carousel ZIP** to export ordered 1080-pixel square or portrait PNG slides plus `TONY-image-credits.txt`. The ZIP is a locally downloaded publication draft and is **not** posted to Instagram.

Export is blocked if the source URL is missing or not HTTPS, verification is not marked cross-checked/official, cover rights are unreviewed, or independent page photos lack rights review / required photographer-credit details. These declarations are editorial input, not automated fact-checking or proof of license ownership.

## 4. Draft limitations and memory

- Source text, slide order, designs and focus/zoom settings persist in browser drafts.
- **Image files are memory-only.** They are not persisted in localStorage and must be re-uploaded after a reload or draft restoration.
- Restored drafts omit uploaded images and prior photo-rights confirmations; the page safely falls back to the cover photo until an editor adds a new image.
- The page ZIP contains a credit/reference note, but attribution must still comply with the actual image license and be added to the final published Instagram caption as needed.
- The Instagram connector remains single-image only; there is no carousel API autopublishing.

## 5. Checks and release gates

- `npm run check` syntax-checks the new modules.
- `npm test` includes crop-boundary, image registry, rights, editor isolation, archive metadata and mobile interaction tests.
- Manual QA still required on real mobile browsers and desktop; verify separate photo upload, square/portrait exports and ZIP extraction before release.
- **Do not merge the draft pull request or re-enable Vercel Preview deployments before the owner's publish instruction.**
