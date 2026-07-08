-- 0016: vendors.instagram — bare Instagram handle (no @, no URL), rendered as
-- an "Instagram" link next to "Visit website" on the vendor page. Populated by
-- the launch/enrich pipelines (research-sourced); there is no user-facing
-- input path. Public read is already covered by the existing vendors policy.

alter table public.vendors add column if not exists instagram text;

comment on column public.vendors.instagram is
  'Bare Instagram handle (no @ or URL). Research-sourced by launch/enrich pipelines.';
