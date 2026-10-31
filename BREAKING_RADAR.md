# TONY Breaking News Radar

This is TONY Studio's BPT-style **near-real-time NYC news discovery and editorial preparation** workflow. It does not automatically publish unverified news.

## Live infrastructure (31 October 2026)

- Supabase project: `newyorker-prod` (`cdyffufhgqsggkieyakk`)
- Edge Function: `tony-news-radar`
- Database table: `public.tony_newsroom_items`
- Cron job: `tony-news-radar-10-minutes`
- Interval: **every 10 minutes** through Supabase pg_cron + pg_net (not Vercel Hobby Cron).
- Successful manual smoke tests returned HTTP 200, with 15 and then 19 queued submissions. This is a sampling check, not a guarantee all future sources will be available.
- Radar read endpoint: `https://cdyffufhgqsggkieyakk.supabase.co/functions/v1/tony-news-radar`
- Radar panel is included in `assets/breaking-radar.js` and appears in the Story stage on mobile / the primary newsroom on desktop.

## Sources

Gothamist, THE CITY, City Limits, Hell Gate, PIX11, and amNewYork. Each source is checked with an approximately 10-second request limit. A failed or blocked source does not stop other sources. The ingestion parser only accepts articles no more than 48 hours old and NYC-relevant items. Up to **five fresh items per source** are used on each run. Presentation is also capped at five stories per source to prevent Gothamist monopolizing the feed.

THE CITY may not contribute on every cycle if its most recent items are stale, unavailable, or filtered by NYC relevance. No source has privileged editorial truth status.

## Ranking

Rankings are heuristic editorial *urgency*, not likelihood of truth:

- Source weight, how recently published, NYC borough relevance and city institutions
- Extra priority for urgent keywords such as closures, evacuations and significant disruption
- Cross-source similarity grouping; sources displayed when available
- Sensitive topics are not automatically designated as breaking
- Article URLs are canonicalized and stored with a unique key to prevent duplicates
- New records are inserted without overwriting already edited ones

Editorial safeguards:

- News source RSS titles and summaries are **claims from the original publisher**, not an independently fact-checked TONY report.
- The system never republishes entire source articles and never auto-copies source imagery.
- Every item is marked as needing verification and photo rights review.
- A click on **Prepare TONY Post** fills headline, summary, source link, category, borough and NYC date. It deliberately clears any prior image, resets rights to unknown and marks the new draft as under review.
- Instagram publication still requires the existing Meta configuration, a professional account and a human confirmation. **No automatic Instagram posting** is enabled in this phase.

## Operations

Check SQL:

```sql
select source_name,count(*) from public.tony_newsroom_items group by source_name;
select jobname,schedule,active from cron.job where jobname='tony-news-radar-10-minutes';
select status,return_message,start_time,end_time
from cron.job_run_details where jobid=(select jobid from cron.job where jobname='tony-news-radar-10-minutes')
order by start_time desc limit 10;
```

To pause:

```sql
select cron.unschedule('tony-news-radar-10-minutes');
```

Never commit or display the ingestion token. It is stored in Supabase Vault as `tony_news_ingest_token`; only its SHA-256 digest is recorded in `tony_automation_config`. The Edge Function requires the token for POST and exposes only safe public headline suggestions via GET. The prepublication queue and config tables have RLS enabled and no anon/authenticated grants.

## Limitations / next release

- 10-minute polling is **near-real-time**, not a guaranteed instantaneous breaking-news alert.
- RSS availability and publication lag depend on news providers.
- Similarity is keyword-based; it can fail to merge differently worded stories about the same event.
- Headline/summary are imported from feeds and need editorial fact-checking and rewrite before posting.
- No licensed editorial image provider or automated picture licensing is included; use Visual Intelligence manually.
- No unattended scheduling or Instagram publication until a robust approval workflow, audit log, licensed image selection and Meta permissions are configured.
- Database editorial statuses are currently a persistent ingestion queue; using Prepare TONY Post fills the local editor and does not mutate the server-side editorial status.
- The browser refreshes its suggestions while visible (every 90 seconds); the server polls every 10 minutes.

## Automatic image suggestions (visual bridge)

When an editor selects **Prepare Post + Find Images** in Breaking News Radar:

1. The article headline, summary and borough are transferred to the TONY editor, and any previous image is cleared.
2. The Design stage opens and Visual Intelligence automatically searches Wikimedia Commons for relevant reuse-eligible *archive* photography using geography, subject and category. A broader NYC query is attempted if the first search yields no results.
3. The publisher's original image is displayed in a separate **SOURCE PHOTO — REFERENCE ONLY** area, when metadata is available. This is **not** imported into the post canvas; an editorial license/permission is required before reusing it.
4. The editor can pick a verified-license Commons result (with source/author attribution), use an authorized upload, optionally browse Pexels, or generate a disclosed Gemini conceptual illustration when enabled.
5. The existing TONY photo filters, crop, typography and logo are then applied to the resulting canvas, followed by human verification and publication consent.

Importantly, these are **suggestions**, not auto-selected documentary evidence. A keyword-match cannot prove a photo depicts the reported event. Gemini's paid generation is never triggered without the user's explicit confirmation, and unknown image rights stay unapproved.
