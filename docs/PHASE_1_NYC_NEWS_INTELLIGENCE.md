# TONY Studio — Phase 1: NYC News Intelligence Engine

## Product decisions
- Geographic scope: New York City only.
- Scheduled ingestion: every three hours.
- Image generation: manual selection only; no image generation in this phase.
- Preferred image provider for Phase 2: Google Gemini / Nano Banana.
- Publication: always requires a human editor; no automatic Instagram publishing.

## Existing architecture reused
- Supabase Edge Function: `supabase/functions/tony-news-radar/index.ts`
- Private queue: `public.tony_newsroom_items`
- Scheduler: existing Supabase pg_cron job `tony-news-radar-10-minutes`
- UI: `assets/breaking-radar.js`

## Phase 1 changes
1. Extend the source set with the New York Times New York-region and NY1 local-news RSS feeds.
2. Add six transparent scoring dimensions: impact (25), recency (20), public interest (20), source support (15), visual potential (10), discussion potential (10).
3. Keep source eligibility as a hard gate: only explicitly configured publishers with a trust weight of at least 7 enter the queue.
4. Persist score components in `score_breakdown` and publisher trust index in `source_confidence` (not factual verification confidence).
5. Recalculate source-support score when distinct publishers corroborate the same event.
6. Preserve all items as review-required; ranking is editorial prioritization, not factual certainty.
7. Run ingestion every three hours. Browser refreshes may retrieve the existing queue more often without triggering ingestion.
8. Do not invoke Gemini or image search from ingestion. Editors select a story and start visual work manually in Phase 2.

## Scheduler timezone note
The existing pg_cron instance currently uses GMT. The schedule `0 */3 * * *` preserves a three-hour interval, but wall-clock run times will not remain fixed to New York local clock across daylight-saving transitions. If fixed local clock slots become a requirement, configure the scheduler timezone explicitly or move to a timezone-aware scheduler.

## Database migration
Apply `supabase/migrations/202611250001_phase1_news_intelligence.sql` to add the scoring fields and update the existing cron job. The migration fails closed if the expected existing job is missing, rather than creating a duplicate schedule.

## Validation checklist
- Confirm NYT and NY1 feeds remain reachable from Supabase Edge.
- Confirm only NYC-relevant items pass the local relevance filter.
- Confirm a single publisher never counts as multi-source corroboration.
- Confirm distinct publishers update source count and source-support score.
- Confirm score breakdown sums to the displayed score.
- Confirm sensitive items remain review-required.
- Confirm ingestion does not call image-generation or publishing endpoints.
