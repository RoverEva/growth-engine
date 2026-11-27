-- Hatchelite AI SEO Engine — Phase 1 schema
-- Every table belongs to a project. Access is granted through project_members
-- and enforced with row-level security (RLS). Roles: owner > editor > viewer.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.member_role as enum ('owner', 'editor', 'viewer');
create type public.search_intent as enum ('informational', 'navigational', 'commercial', 'transactional', 'unknown');
create type public.keyword_status as enum ('new', 'shortlisted', 'planned', 'in_use', 'ignored');
create type public.brief_status as enum ('draft', 'ready', 'used');
create type public.article_status as enum ('draft', 'in_review', 'approved', 'rejected', 'pr_open', 'published');
create type public.run_status as enum ('queued', 'running', 'succeeded', 'failed');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Projects and membership
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  site_url text not null check (site_url ~ '^https://[^/]+/?$'),
  -- Where approved articles are published (GitHub repo + folder of Markdown posts).
  github_repo text check (github_repo is null or github_repo ~ '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$'),
  github_base_branch text not null default 'v2-latest',
  blog_content_path text not null default 'hatchelite-v2-clean/src/content/blog',
  default_location_code integer not null default 2840,  -- United States
  default_language_code text not null default 'en',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members(user_id);

-- Role checks used by every policy. SECURITY DEFINER so they can read
-- project_members without recursive RLS evaluation.
create or replace function public.project_role(p_project uuid) returns public.member_role
language sql stable security definer set search_path = public as $$
  select role from public.project_members where project_id = p_project and user_id = auth.uid()
$$;

create or replace function public.has_project_role(p_project uuid, p_min public.member_role) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case p_min
       when 'viewer' then true
       when 'editor' then role in ('owner', 'editor')
       when 'owner' then role = 'owner'
     end
     from public.project_members where project_id = p_project and user_id = auth.uid()),
    false)
$$;

-- Creates a project and makes the caller its owner in one step.
create or replace function public.create_project(p_name text, p_site_url text, p_github_repo text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.projects (name, site_url, github_repo, created_by)
  values (p_name, p_site_url, nullif(p_github_repo, ''), auth.uid())
  returning id into v_id;
  insert into public.project_members (project_id, user_id, role) values (v_id, auth.uid(), 'owner');
  insert into public.brand_profiles (project_id) values (v_id);
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Brand profile (one per project)
-- ---------------------------------------------------------------------------
create table public.brand_profiles (
  project_id uuid primary key references public.projects(id) on delete cascade,
  brand_name text not null default 'HatchElite',
  audience text not null default 'Parents of students in Grades 2–12 preparing for ISEE, SSAT and SAT',
  voice text not null default 'Warm, practical, specific. Plain English. No hype.',
  products text not null default 'Vocabulary programs for Grades 2–12, ISEE, SSAT and SAT. Free Set 1; All-Access $19.99/month or $129.99/year per student with a 7-day free trial.',
  topics_to_avoid text not null default '',
  author_name text not null default 'HatchElite Team',
  -- Articles must reach this quality score before they can be submitted for review.
  min_quality_score integer not null default 70 check (min_quality_score between 0 and 100),
  -- Phase 1 always requires a human approval; automatic publishing is a later, opt-in phase.
  auto_publish boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Research
-- ---------------------------------------------------------------------------
create table public.topic_clusters (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  description text not null default '',
  pillar_keyword_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, name)
);

create table public.keywords (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  keyword text not null check (char_length(keyword) between 1 and 200),
  keyword_normalized text generated always as (lower(regexp_replace(btrim(keyword), '\s+', ' ', 'g'))) stored,
  location_code integer not null default 2840,
  language_code text not null default 'en',
  search_volume integer,
  keyword_difficulty integer check (keyword_difficulty is null or keyword_difficulty between 0 and 100),
  cpc numeric(10, 2),
  competition numeric(5, 4),
  intent public.search_intent not null default 'unknown',
  -- 0–100: how well the keyword fits HatchElite (set by the opportunity scorer).
  business_relevance integer check (business_relevance is null or business_relevance between 0 and 100),
  opportunity_score integer check (opportunity_score is null or opportunity_score between 0 and 100),
  status public.keyword_status not null default 'new',
  cluster_id uuid references public.topic_clusters(id) on delete set null,
  seed_keyword text,
  source text not null default 'manual',          -- 'dataforseo' | 'manual' | 'gsc'
  metrics_fetched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, keyword_normalized, location_code, language_code)
);
create index keywords_project_status_idx on public.keywords(project_id, status);
create index keywords_project_opportunity_idx on public.keywords(project_id, opportunity_score desc nulls last);

alter table public.topic_clusters
  add constraint topic_clusters_pillar_fk foreign key (pillar_keyword_id) references public.keywords(id) on delete set null;

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  domain text not null check (domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  name text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (project_id, domain)
);

create table public.content_briefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  keyword_id uuid references public.keywords(id) on delete set null,
  cluster_id uuid references public.topic_clusters(id) on delete set null,
  title text not null,
  search_intent public.search_intent not null default 'informational',
  audience_notes text not null default '',
  outline jsonb not null default '[]'::jsonb,
  questions jsonb not null default '[]'::jsonb,
  competitor_urls jsonb not null default '[]'::jsonb,
  status public.brief_status not null default 'draft',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Articles
-- ---------------------------------------------------------------------------
create table public.articles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  brief_id uuid references public.content_briefs(id) on delete set null,
  keyword_id uuid references public.keywords(id) on delete set null,
  target_keyword text not null check (char_length(target_keyword) between 1 and 200),
  target_keyword_normalized text generated always as (lower(regexp_replace(btrim(target_keyword), '\s+', ' ', 'g'))) stored,
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  title text not null check (char_length(title) between 1 and 200),
  meta_title text,
  meta_description text,
  body_markdown text not null default '',
  tags text[] not null default '{}',
  faq jsonb not null default '[]'::jsonb,
  author_name text not null default 'HatchElite Team',
  status public.article_status not null default 'draft',
  quality_score integer check (quality_score is null or quality_score between 0 and 100),
  quality_checked_at timestamptz,
  generated_by text not null default 'human',      -- 'human' | 'openai' (Phase 2)
  scheduled_for date,                                -- publish date written into the post's front matter
  submitted_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejection_reason text,
  pr_url text,
  pr_number integer,
  published_url text,
  published_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Duplicate protection: one article per slug, and one per target keyword.
  unique (project_id, slug),
  unique (project_id, target_keyword_normalized)
);
create index articles_project_status_idx on public.articles(project_id, status);

create table public.article_sources (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null check (url ~ '^https?://'),
  title text not null default '',
  publisher text not null default '',
  claim text not null default '',                   -- which statement this source supports
  verified boolean not null default false,
  http_status integer,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (article_id, url)
);

create table public.internal_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  from_article_id uuid references public.articles(id) on delete cascade,
  to_path text not null check (to_path ~ '^/'),
  anchor_text text not null,
  status text not null default 'suggested' check (status in ('suggested', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (from_article_id, to_path, anchor_text)
);

create table public.seo_audits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  article_id uuid references public.articles(id) on delete cascade,
  audit_type text not null default 'article_quality',
  score integer not null check (score between 0 and 100),
  passed boolean not null,
  checks jsonb not null default '[]'::jsonb,         -- [{id, category, points, max, passed, message}]
  engine_version text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index seo_audits_article_idx on public.seo_audits(article_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Analytics (filled from Google Search Console in Phase 3)
-- ---------------------------------------------------------------------------
create table public.search_performance (
  id bigint generated always as identity primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  date date not null,
  page text not null,
  query text not null default '',                    -- '' = page total
  clicks integer not null default 0,
  impressions integer not null default 0,
  ctr numeric(6, 5),
  position numeric(6, 2),
  article_id uuid references public.articles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (project_id, date, page, query)
);
create index search_performance_project_date_idx on public.search_performance(project_id, date desc);

-- ---------------------------------------------------------------------------
-- Automation runs: one row per external call or background job
-- ---------------------------------------------------------------------------
create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null,                                 -- e.g. 'keyword_research', 'publish_article'
  status public.run_status not null default 'queued',
  -- Same key while a run is queued/running = duplicate request, rejected.
  idempotency_key text,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  attempts integer not null default 0,
  cost_usd numeric(10, 4),
  log jsonb not null default '[]'::jsonb,             -- [{at, level, message}]
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index automation_runs_inflight_uidx
  on public.automation_runs(project_id, kind, idempotency_key)
  where idempotency_key is not null and status in ('queued', 'running');
create index automation_runs_project_created_idx on public.automation_runs(project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create trigger projects_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger brand_profiles_updated_at before update on public.brand_profiles for each row execute function public.set_updated_at();
create trigger topic_clusters_updated_at before update on public.topic_clusters for each row execute function public.set_updated_at();
create trigger keywords_updated_at before update on public.keywords for each row execute function public.set_updated_at();
create trigger content_briefs_updated_at before update on public.content_briefs for each row execute function public.set_updated_at();
create trigger articles_updated_at before update on public.articles for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Approval gate, enforced in the database (not only in the UI)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_article_workflow() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role public.member_role := public.project_role(new.project_id);
  v_min integer;
begin
  -- Service-role / migrations (no JWT user) are not restricted here.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'new articles must start as draft';
    end if;
    return new;
  end if;

  -- Published or in-flight articles are frozen except for owner status updates.
  if old.status in ('pr_open', 'published') and v_role <> 'owner' then
    raise exception 'only an owner can change an article that is being or has been published';
  end if;

  if new.status is distinct from old.status then
    select min_quality_score into v_min from public.brand_profiles where project_id = new.project_id;
    case new.status
      when 'in_review' then
        if old.status not in ('draft', 'rejected') then
          raise exception 'only drafts can be submitted for review';
        end if;
        if new.quality_score is null or new.quality_score < coalesce(v_min, 70) then
          raise exception 'quality score % is below the minimum %', coalesce(new.quality_score, 0), coalesce(v_min, 70);
        end if;
        new.submitted_by := auth.uid();
      when 'approved' then
        if v_role <> 'owner' then raise exception 'only an owner can approve articles'; end if;
        if old.status <> 'in_review' then raise exception 'only articles in review can be approved'; end if;
        new.approved_by := auth.uid();
        new.approved_at := now();
      when 'rejected' then
        if v_role <> 'owner' then raise exception 'only an owner can reject articles'; end if;
      when 'pr_open' then
        if v_role <> 'owner' then raise exception 'only an owner can publish'; end if;
        if old.status <> 'approved' then raise exception 'only approved articles can be published'; end if;
      when 'published' then
        if v_role <> 'owner' then raise exception 'only an owner can mark articles published'; end if;
        if old.status <> 'pr_open' then raise exception 'an article is published only after its pull request'; end if;
      when 'draft' then
        null; -- editors may pull an article back to draft from review/rejected/approved
      else
        null;
    end case;
  end if;

  -- Editing the content of an approved article sends it back to draft.
  if old.status = 'approved' and new.status = 'approved'
     and (new.body_markdown, new.title, new.slug, new.meta_description)
         is distinct from (old.body_markdown, old.title, old.slug, old.meta_description) then
    new.status := 'draft';
    new.approved_by := null;
    new.approved_at := null;
  end if;
  return new;
end $$;

create trigger articles_workflow before insert or update on public.articles
  for each row execute function public.enforce_article_workflow();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.brand_profiles enable row level security;
alter table public.topic_clusters enable row level security;
alter table public.keywords enable row level security;
alter table public.competitors enable row level security;
alter table public.content_briefs enable row level security;
alter table public.articles enable row level security;
alter table public.article_sources enable row level security;
alter table public.internal_links enable row level security;
alter table public.seo_audits enable row level security;
alter table public.search_performance enable row level security;
alter table public.automation_runs enable row level security;

-- projects: members read; owners update/delete; creation goes through create_project().
create policy projects_select on public.projects for select using (public.has_project_role(id, 'viewer'));
create policy projects_update on public.projects for update using (public.has_project_role(id, 'owner')) with check (public.has_project_role(id, 'owner'));
create policy projects_delete on public.projects for delete using (public.has_project_role(id, 'owner'));

-- members: members see the member list; owners manage it.
create policy members_select on public.project_members for select using (public.has_project_role(project_id, 'viewer'));
create policy members_insert on public.project_members for insert with check (public.has_project_role(project_id, 'owner'));
create policy members_update on public.project_members for update using (public.has_project_role(project_id, 'owner')) with check (public.has_project_role(project_id, 'owner'));
create policy members_delete on public.project_members for delete using (public.has_project_role(project_id, 'owner') and user_id <> auth.uid());

-- brand profile: members read; owners edit.
create policy brand_select on public.brand_profiles for select using (public.has_project_role(project_id, 'viewer'));
create policy brand_update on public.brand_profiles for update using (public.has_project_role(project_id, 'owner')) with check (public.has_project_role(project_id, 'owner'));

-- Content tables: members read; editors write.
do $$
declare
  t text;
begin
  foreach t in array array['topic_clusters', 'keywords', 'competitors', 'content_briefs', 'articles',
                           'article_sources', 'internal_links', 'seo_audits', 'automation_runs']
  loop
    execute format('create policy %1$s_select on public.%1$s for select using (public.has_project_role(project_id, ''viewer''))', t);
    execute format('create policy %1$s_insert on public.%1$s for insert with check (public.has_project_role(project_id, ''editor''))', t);
    execute format('create policy %1$s_update on public.%1$s for update using (public.has_project_role(project_id, ''editor'')) with check (public.has_project_role(project_id, ''editor''))', t);
    execute format('create policy %1$s_delete on public.%1$s for delete using (public.has_project_role(project_id, ''editor''))', t);
  end loop;
end $$;

-- Only owners delete articles; editors may delete drafts only.
drop policy articles_delete on public.articles;
create policy articles_delete on public.articles for delete using (
  public.has_project_role(project_id, 'owner')
  or (public.has_project_role(project_id, 'editor') and status in ('draft', 'rejected'))
);

-- Search performance is written by the server (service role) in Phase 3; members read.
create policy search_performance_select on public.search_performance for select using (public.has_project_role(project_id, 'viewer'));

-- Child rows must belong to the same project as their article.
create or replace function public.check_article_project() returns trigger
language plpgsql as $$
begin
  if new.article_id is not null and not exists (
    select 1 from public.articles a where a.id = new.article_id and a.project_id = new.project_id
  ) then
    raise exception 'article does not belong to this project';
  end if;
  return new;
end $$;
create trigger article_sources_project before insert or update on public.article_sources for each row execute function public.check_article_project();
create trigger seo_audits_project before insert or update on public.seo_audits for each row execute function public.check_article_project();

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on function public.create_project(text, text, text) to authenticated;
grant execute on function public.has_project_role(uuid, public.member_role) to authenticated;
grant execute on function public.project_role(uuid) to authenticated;
