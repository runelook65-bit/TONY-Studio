-- TONY Studio Phase 1: editorial score transparency and three-hour ingestion cadence.
-- Safe additive schema change; existing editorial decisions and queued stories are preserved.
alter table public.tony_newsroom_items
  add column if not exists score_breakdown jsonb not null default '{}'::jsonb,
  add column if not exists source_confidence smallint not null default 0;

do $$
declare target_job_id bigint;
begin
  select jobid into target_job_id from cron.job
  where jobname = 'tony-news-radar-10-minutes'
  order by jobid desc limit 1;
  if target_job_id is null then
    raise exception 'Expected TONY news radar cron job was not found; refusing to create a duplicate schedule.';
  end if;
  perform cron.alter_job(target_job_id, schedule := '0 */3 * * *');
end
$$;

create index if not exists tony_newsroom_items_score_published_idx
  on public.tony_newsroom_items (score desc, source_published_at desc);
