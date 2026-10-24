# TONY Creative Suite — staging-only feature

**Status:** GitHub feature branch only. Do not merge to main or deploy to Vercel before the owner explicitly requests **publish**.

## Original layouts
- **Classic News:** the existing TONY look.
- **Metro Dispatch:** NYC transit-inspired yellow rule and dark news panel.
- **City Bulletin:** editorial inset border and denser front-page treatment.

The layouts are native canvas overlays, not copied Canva code or reverse-engineered protected assets. Changing a layout never edits the underlying source headline or its verification status.

## Manual photo focus
The horizontal/vertical focus sliders choose the crop's focal point. Cover scaling always fills the canvas and bounds the photo coordinates so blank margins cannot appear. The editor can still drag the photo; pan is constrained by the final paint geometry. Changing or importing a new image centers the focus again. This feature does not include machine-learning subject detection.

## Carousel drafts
1. Fill the main Story tab with sourced headline and summary.
2. In **Design > Instagram Carousel Builder**, choose **+ Add page** and write an additional headline and factual summary.
3. Add up to five follow-up slides (six slides including the cover); review each via **Preview page**.
4. Choose **Download carousel ZIP**. The browser creates separate 1080px PNGs using the current square/portrait ratio and selected TONY styling. Every slide has an explicit page index.
5. Review factual accuracy and image permission before posting. Instagram API carousel publication **is not part of this feature**. The ZIP is a local export, not a published post.

The editor uses the cover's current background image on follow-up pages; per-slide media management is a future feature. Page text and layout selections are saved in browser drafts, but uploaded image bytes are intentionally **not** saved. Restored drafts require a fresh photo import and rights review.

## QA
- `npm run check` — syntax validation including both new browser modules.
- `npm test` — existing regression tests plus template/crop/ZIP/carousel/draft integration tests.
- Manual browser review on desktop and mobile is still required before production, particularly for the 1:1 and 4:5 canvases, long headlines, logo and AI disclosures.

No Meta credentials, Instagram publishing endpoint or photo-license guardrails are changed in this feature.
