# TONY Studio — REA benchmark: Canva + Buffer (research, not a production release)

> **Evidence hygiene:** External functional claims below come from each vendor's **public official Help Center**, not from an authenticated editor session. The separate GitHub Actions workflow `.github/workflows/rea-public-ux.yml` runs **REA 6.7.0+** against public, logged-out Chrome targets and preserves its actual evidence/limitations as an Actions artifact. Do not relabel Help Center information as a REA runtime finding.

## A. REA observation method

- Target software: Canva public photo-editor entry/help page and Buffer public Publish entry/help page.
- Environment: ephemeral GitHub Actions Ubuntu runner, official `rea-agents` npm package, headless Chrome with non-default dedicated temporary profile.
- REA access: local-only CDP endpoint `127.0.0.1:9222`, browser observation explicitly enabled, exact approved origins limited to `https://www.canva.com`, `https://buffer.com`, `https://support.buffer.com`.
- Procedure: open only those public pages, call `rea list-browser-targets` and `rea inspect-web-page`, save raw evidence, log observed URLs and limitations; do not authenticate, harvest user/session data, evade bot checks, scrape code, or republish captured assets.
- Important boundary: REA's web observer is **passive**; it does not navigate, click, invoke JavaScript or simulate an editor workflow. A URL landing on login, an anti-bot check or a marketing page does **not** prove the protected editor's UX.
- REA run results and evidence: see the `REA public UX evidence` Actions run associated with the current research branch.

## B. Verified public product behavior (vendor documentation)

### Canva

1. A photo is selected, cropped and repositioned within its frame, with preserved hidden pixels. Crop is reversible; photo resizing is separate from cropping. Source: https://www.canva.com/help/resize-and-crop/
2. The Layers panel lets editors select elements, view groups/background and reorder layers by dragging. Source: https://www.canva.com/help/finding-and-arranging-layers/
3. Canva can lock either full element editing or its position/appearance while leaving text editable. Source: https://www.canva.com/help/lock-and-unlock-elements/
4. Smart Crop is a separately available automatic best-area suggestion, not a requirement for manual crop. Source: https://www.canva.com/help/crop-photos-instantly/

### Buffer

1. A post can be saved as a draft, optionally with a date/time. Pre-scheduling a draft **does not publish it** until moved to the queue by someone with posting permission. Source: https://support.buffer.com/articles/saving-and-scheduling-draft-posts-CBLXg1yFXp
2. The Team approval workflow separates Drafts, Awaiting Approval and approved queued posts. Editors can request approval; authorized reviewers can approve or reject. Source: https://support.buffer.com/articles/managing-and-approving-draft-posts-57li7M8tDA
3. Instagram professional profiles can automatically publish supported multi-image carousels; personal profiles and unsupported formats may require notification-based manual publishing. Source: https://support.buffer.com/articles/using-instagram-with-buffer-YSjg2dXFV8

These are documented UX/product behaviors. They are **not verified by logged-in REA browser captures**.

## C. TONY-specific design decisions

| Observed/documented pattern | TONY Studio choice | State |
| --- | --- | --- |
| Canva crop / reposition | Persistent X/Y focal crop, manual zoom and drag, independent per-carousel-slide photo controls | Implemented on Creative Suite development branch |
| Canva layer/position locks | Protect TONY logo, source/date, disclosure and article provenance as non-draggable brand layers; expose only editorial fields | Proposal |
| Canva Smart Crop | Optional subject-aware focus suggestion only if clearly disclosed; always allow manual correction | Not implemented |
| Buffer draft vs queue | Preserve separate **Draft**, **In Review**, **Ready** and **Published** states; add an explicit preflight/approval step without claiming a real Buffer-style multi-user backend | Recommended |
| Buffer scheduling | Do not equate an entered timestamp with automatic publishing; actual scheduler needs durable backend and revocable authorization | Not implemented |
| Buffer Instagram carousel | TONY currently exports carousel PNGs + credit sheet locally. Integrating Meta carousel API, media hosting and status polling is a distinct later step | Not implemented |

## D. Engineering acceptance criteria

- The carousel must preserve source text and reversible photo focus while changing design templates.
- A post must never silently move from Draft to Published; a manual review status or a timestamp is not proof it was published.
- A draft with incomplete article verification, image rights or required photo credit may be edited and saved, but must not become **Ready**.
- If the cover or a slide is flagged as AI-generated, the exported graphic must visibly disclose it.
- Stored drafts must not retain upload bytes, third-party account credentials, or unverified image-use confirmations.
- Manual test scenarios: 1:1 and 4:5; 2–6 slides; mobile touch; long headlines; recovered local draft without original image; failed photo permissions; export and open ZIP on iOS.

## E. Release controls

- Research branch: `research/rea-canva-buffer` (derived from `feat/creative-suite-carousel`).
- No merges to `main`, no Instagram auto-posts, no production / preview Vercel deployments until user specifically says **yayınla**.
- A completed official REA browser capture must preserve its Evidence and limitations before runtime behavior can be claimed.
