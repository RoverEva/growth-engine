-- Growth Engine: images, titles and Pinterest boards for social posts (additive).
-- Buffer takes images as public https URLs (no upload endpoint), so posts store the URL.
alter table public.social_posts
  add column image_url text check (image_url is null or image_url ~ '^https://'),
  add column title text check (title is null or char_length(title) <= 100),
  add column source_ref text check (source_ref is null or char_length(source_ref) <= 300);   -- e.g. "hatchelite#10:how-to-study-ssat-analogies:pinterest"
create unique index social_posts_source_ref_unique on public.social_posts(project_id, source_ref) where source_ref is not null;

-- Default Pinterest board per linked channel (Buffer's PinterestBoard.serviceId).
alter table public.social_channels
  add column board_service_id text check (board_service_id is null or char_length(board_service_id) <= 100),
  add column board_name text check (board_name is null or char_length(board_name) <= 200);

-- Changing the image or title of an approved post sends it back to review, like text changes.
create or replace function public.social_post_media_changed() returns trigger
language plpgsql as $$
begin
  if (new.image_url is distinct from old.image_url or new.title is distinct from old.title)
     and old.status in ('approved', 'failed') and new.status = old.status then
    new.status := 'in_review'; new.approved_by := null; new.approved_at := null;
  end if;
  if (new.image_url is distinct from old.image_url or new.title is distinct from old.title) and old.status = 'queued' then
    raise exception 'This post is already in the publishing queue. Remove it there before editing.';
  end if;
  return new;
end $$;
create trigger social_posts_media_changed before update on public.social_posts
  for each row execute function public.social_post_media_changed();
