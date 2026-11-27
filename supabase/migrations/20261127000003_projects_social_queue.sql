-- Growth Engine — multi-project step 2 (additive).
-- 1. Projects get a stable slug (matches projects/<slug>/ in this repo and the __<SLUG> suffix of their secrets).
-- 2. Cross-project safeguards: a website repo and a social channel can belong to one project only.
-- 3. Social posts with the same approval gate as articles: only an owner approves, and only approved posts can be
--    sent to Buffer or Postiz. A post can only use a channel of its own project (composite foreign key).

-- ---------------------------------------------------------------------------
-- 1. Project slug; no more HatchElite defaults for new projects
-- ---------------------------------------------------------------------------
alter table public.projects add column slug text;
update public.projects set slug = left(trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g')), 40)
  where slug is null;
alter table public.projects
  alter column slug set not null,
  add constraint projects_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 40),
  add constraint projects_slug_key unique (slug);
alter table public.projects alter column github_base_branch drop default;
alter table public.projects alter column github_base_branch drop not null;
alter table public.projects alter column blog_content_path drop default;
alter table public.projects alter column blog_content_path drop not null;
alter table public.brand_profiles
  alter column brand_name drop default,
  alter column audience set default '',
  alter column voice set default '',
  alter column products set default '',
  alter column author_name drop default;

-- create_project now takes the slug and names the brand after the project. Nothing defaults to HatchElite.
drop function public.create_project(text, text, text);
create function public.create_project(p_name text, p_site_url text, p_slug text, p_github_repo text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  insert into public.projects (name, site_url, slug, github_repo, created_by)
  values (p_name, p_site_url, p_slug, nullif(p_github_repo, ''), auth.uid())
  returning id into v_id;
  insert into public.project_members (project_id, user_id, role) values (v_id, auth.uid(), 'owner');
  insert into public.brand_profiles (project_id, brand_name, author_name) values (v_id, p_name, p_name || ' Team');
  return v_id;
end $$;
grant execute on function public.create_project(text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. One website repo per project
-- ---------------------------------------------------------------------------
create unique index projects_github_repo_unique on public.projects (lower(github_repo)) where github_repo is not null;

-- ---------------------------------------------------------------------------
-- 3. Social channels and posts
-- ---------------------------------------------------------------------------
create type public.social_provider as enum ('buffer', 'postiz');
create type public.social_post_status as enum ('draft', 'in_review', 'approved', 'rejected', 'queued', 'failed');

create table public.social_channels (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  provider public.social_provider not null,
  external_id text not null check (char_length(external_id) between 1 and 200),
  service text not null default '' check (char_length(service) <= 40),     -- e.g. linkedin, instagram, facebook
  display_name text not null default '' check (char_length(display_name) <= 200),
  created_at timestamptz not null default now(),
  -- A provider channel belongs to exactly one project, so one brand's account can never post for another.
  constraint social_channels_provider_external_key unique (provider, external_id),
  constraint social_channels_id_project_key unique (id, project_id)
);
create index social_channels_project_idx on public.social_channels(project_id);

create table public.social_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  channel_id uuid not null,
  body text not null check (char_length(body) between 1 and 3000),
  link_url text check (link_url is null or link_url ~ '^https://'),
  article_id uuid references public.articles(id) on delete set null,
  scheduled_for timestamptz,                                  -- null: next free slot in the provider's queue
  status public.social_post_status not null default 'draft',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  review_note text,
  external_post_id text,
  last_error text,
  sent_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The channel must belong to the same project as the post.
  constraint social_posts_channel_same_project foreign key (channel_id, project_id)
    references public.social_channels (id, project_id) on delete cascade
);
create index social_posts_queue_idx on public.social_posts(project_id, status);
create trigger social_posts_updated_at before update on public.social_posts
  for each row execute function public.set_updated_at();

-- Approval gate (mirrors enforce_article_workflow):
--  * only an owner may move a post to approved or rejected;
--  * queued requires approved first, and is set by the sending code (editor or owner);
--  * editing an approved, queued or failed post's text, link, time or channel sends it back to review;
--  * a queued post cannot be edited (cancel it in Buffer/Postiz first).
create or replace function public.enforce_social_post_workflow() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  content_changed boolean;
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'in_review') then
      raise exception 'New social posts start as draft or in_review.';
    end if;
    new.approved_by := null; new.approved_at := null; new.external_post_id := null; new.sent_at := null;
    return new;
  end if;

  if new.project_id <> old.project_id then
    raise exception 'A social post cannot move to another project.';
  end if;

  content_changed := new.body is distinct from old.body or new.link_url is distinct from old.link_url
    or new.scheduled_for is distinct from old.scheduled_for or new.channel_id is distinct from old.channel_id;

  if content_changed and old.status = 'queued' then
    raise exception 'This post is already in the publishing queue. Remove it there before editing.';
  end if;

  if content_changed and old.status in ('approved', 'failed') and new.status = old.status then
    new.status := 'in_review';
  end if;

  if new.status is distinct from old.status then
    if new.status in ('approved', 'rejected') then
      if not public.has_project_role(new.project_id, 'owner') then
        raise exception 'Only a project owner can approve or reject social posts.';
      end if;
      if old.status <> 'in_review' and not (old.status = 'failed' and new.status = 'approved') then
        raise exception 'Only posts in review can be approved or rejected.';
      end if;
      if new.status = 'approved' then
        new.approved_by := auth.uid(); new.approved_at := now();
      end if;
    elsif new.status = 'queued' then
      if old.status <> 'approved' then
        raise exception 'Only approved posts can be sent to the publishing queue.';
      end if;
      new.sent_at := now();
    elsif new.status = 'failed' then
      if old.status not in ('approved', 'queued') then
        raise exception 'Only approved or queued posts can be marked failed.';
      end if;
    elsif new.status in ('draft', 'in_review') then
      if old.status = 'queued' then
        raise exception 'This post is already in the publishing queue.';
      end if;
    end if;
  end if;

  if new.status in ('draft', 'in_review', 'rejected') then
    new.approved_by := null; new.approved_at := null;
  end if;
  return new;
end $$;

create trigger social_posts_workflow before insert or update on public.social_posts
  for each row execute function public.enforce_social_post_workflow();

alter table public.social_channels enable row level security;
alter table public.social_posts enable row level security;

-- Channels: anyone in the project can see them; only owners link or unlink accounts.
create policy social_channels_select on public.social_channels for select using (public.has_project_role(project_id, 'viewer'));
create policy social_channels_insert on public.social_channels for insert with check (public.has_project_role(project_id, 'owner'));
create policy social_channels_update on public.social_channels for update using (public.has_project_role(project_id, 'owner')) with check (public.has_project_role(project_id, 'owner'));
create policy social_channels_delete on public.social_channels for delete using (public.has_project_role(project_id, 'owner'));

create policy social_posts_select on public.social_posts for select using (public.has_project_role(project_id, 'viewer'));
create policy social_posts_insert on public.social_posts for insert with check (public.has_project_role(project_id, 'editor'));
create policy social_posts_update on public.social_posts for update using (public.has_project_role(project_id, 'editor')) with check (public.has_project_role(project_id, 'editor'));
create policy social_posts_delete on public.social_posts for delete using (
  public.has_project_role(project_id, 'owner') or (public.has_project_role(project_id, 'editor') and status in ('draft', 'rejected'))
);

grant select, insert, update, delete on public.social_channels, public.social_posts to authenticated;
