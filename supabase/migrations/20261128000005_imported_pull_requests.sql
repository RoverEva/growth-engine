-- Growth Engine: articles that arrive as pull requests (the daily blog task) and one-click approval (additive).
alter table public.articles
  add column source text not null default 'engine' check (source in ('engine', 'github_pr')),
  add column pr_head_sha text check (pr_head_sha is null or pr_head_sha ~ '^[0-9a-f]{40}$'),
  add column pr_merged_at timestamptz;
create unique index articles_pr_number_unique on public.articles(project_id, pr_number) where pr_number is not null;

-- An imported article already has its pull request: once approved, an owner can move it straight to pr_open
-- (the existing rule only allows approved -> pr_open, which still holds). Nothing else changes in the gate.
comment on column public.articles.source is 'engine: written in the engine, published by opening a PR. github_pr: imported from an open blog/ PR in the site repo.';
