// Database tests: apply the real migrations to a throwaway Postgres database
// (with tests/db/supabase-shim.sql standing in for Supabase's auth schema)
// and check row-level security, duplicate protection and the approval gate.
//
// Runs only when TEST_DATABASE_URL points at an empty Postgres database you can drop,
// e.g. TEST_DATABASE_URL=postgres://postgres@localhost:5432/seo_test npm run test:db
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const root = resolve(__dirname, "../..");

const owner = randomUUID();
const editor = randomUUID();
const viewer = randomUUID();
const stranger = randomUUID();

let db: Client;
let projectId: string;

async function as<T>(userId: string | null, fn: (c: Client) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    if (userId) {
      await db.query("set local role authenticated");
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    }
    const result = await fn(db);
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

describe.skipIf(!url)("database: RLS, duplicates and approval gate", () => {
  beforeAll(async () => {
    db = new Client({ connectionString: url });
    await db.connect();
    await db.query("drop schema if exists public cascade; create schema public; drop schema if exists auth cascade;");
    await db.query("drop type if exists public.member_role cascade");
    await db.query(readFileSync(resolve(root, "tests/db/supabase-shim.sql"), "utf8"));
    const dir = resolve(root, "supabase/migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      await db.query(readFileSync(resolve(dir, file), "utf8"));
    }
    for (const id of [owner, editor, viewer, stranger]) {
      await db.query("insert into auth.users (id, email) values ($1, $2)", [id, `${id}@test.local`]);
    }
    projectId = await as(owner, async (c) => {
      const { rows } = await c.query("select public.create_project('HatchElite', 'https://hatchelite.com', 'hatchelite', 'RoverEva/hatchelite') as id");
      await c.query("insert into public.project_members (project_id, user_id, role) values ($1, $2, 'editor'), ($1, $3, 'viewer')", [rows[0].id, editor, viewer]);
      return rows[0].id as string;
    });
  });

  afterAll(async () => {
    await db?.end();
  });

  it("create_project makes the caller owner and adds a brand profile", async () => {
    const rows = await as(owner, async (c) => (await c.query("select role from public.project_members where project_id = $1 and user_id = $2", [projectId, owner])).rows);
    expect(rows[0].role).toBe("owner");
    const brand = await as(owner, async (c) => (await c.query("select min_quality_score from public.brand_profiles where project_id = $1", [projectId])).rows);
    expect(brand[0].min_quality_score).toBe(70);
  });

  it("hides projects from non-members", async () => {
    const rows = await as(stranger, async (c) => (await c.query("select id from public.projects")).rows);
    expect(rows).toHaveLength(0);
  });

  it("lets viewers read but not write", async () => {
    const rows = await as(viewer, async (c) => (await c.query("select id from public.projects")).rows);
    expect(rows).toHaveLength(1);
    await expect(as(viewer, (c) => c.query("insert into public.keywords (project_id, keyword) values ($1, 'isee vocabulary')", [projectId])))
      .rejects.toThrow(/row-level security/);
  });

  it("stops non-owners from changing project settings or members", async () => {
    const updated = await as(editor, async (c) => (await c.query("update public.projects set name = 'x' where id = $1 returning id", [projectId])).rowCount);
    expect(updated).toBe(0);
    await expect(as(editor, (c) => c.query("insert into public.project_members (project_id, user_id, role) values ($1, $2, 'owner')", [projectId, stranger])))
      .rejects.toThrow(/row-level security/);
  });

  it("treats keywords that differ only in case and spacing as duplicates", async () => {
    await as(editor, (c) => c.query("insert into public.keywords (project_id, keyword) values ($1, 'ISEE  Vocabulary List')", [projectId]));
    await expect(as(editor, (c) => c.query("insert into public.keywords (project_id, keyword) values ($1, 'isee vocabulary list')", [projectId])))
      .rejects.toThrow(/duplicate key/);
  });

  it("blocks a second article for the same target keyword or slug", async () => {
    await as(editor, (c) => c.query("insert into public.articles (project_id, target_keyword, slug, title) values ($1, 'ssat analogies', 'ssat-analogies', 'SSAT analogies')", [projectId]));
    await expect(as(editor, (c) => c.query("insert into public.articles (project_id, target_keyword, slug, title) values ($1, 'SSAT Analogies', 'ssat-analogies-guide', 'Another')", [projectId])))
      .rejects.toThrow(/duplicate key/);
    await expect(as(editor, (c) => c.query("insert into public.articles (project_id, target_keyword, slug, title) values ($1, 'other keyword', 'ssat-analogies', 'Another')", [projectId])))
      .rejects.toThrow(/duplicate key/);
  });

  it("enforces the approval gate", async () => {
    const id = await as(editor, async (c) => (await c.query(
      "insert into public.articles (project_id, target_keyword, slug, title, body_markdown) values ($1, 'isee lower level vocabulary', 'isee-lower-level-vocabulary', 'ISEE Lower Level vocabulary', 'Body') returning id",
      [projectId])).rows[0].id as string);

    // Low score cannot be submitted.
    await expect(as(editor, (c) => c.query("update public.articles set status = 'in_review', quality_score = 60 where id = $1", [id])))
      .rejects.toThrow(/below the minimum/);
    await as(editor, (c) => c.query("update public.articles set status = 'in_review', quality_score = 82 where id = $1", [id]));

    // Editors cannot approve; owners can.
    await expect(as(editor, (c) => c.query("update public.articles set status = 'approved' where id = $1", [id])))
      .rejects.toThrow(/only an owner can approve/);
    await as(owner, (c) => c.query("update public.articles set status = 'approved' where id = $1", [id]));

    // Editing an approved article sends it back to draft.
    const status = await as(editor, async (c) => (await c.query("update public.articles set body_markdown = 'Changed' where id = $1 returning status, approved_by", [id])).rows[0]);
    expect(status.status).toBe("draft");
    expect(status.approved_by).toBeNull();

    // Cannot jump from draft to publishing.
    await expect(as(owner, (c) => c.query("update public.articles set status = 'pr_open' where id = $1", [id])))
      .rejects.toThrow(/only approved articles can be published/);

    // Full path: review -> approve -> PR -> published.
    await as(editor, (c) => c.query("update public.articles set status = 'in_review' where id = $1", [id]));
    await as(owner, (c) => c.query("update public.articles set status = 'approved' where id = $1", [id]));
    await expect(as(editor, (c) => c.query("update public.articles set status = 'pr_open' where id = $1", [id])))
      .rejects.toThrow(/only an owner can publish/);
    await as(owner, (c) => c.query("update public.articles set status = 'pr_open', pr_number = 7 where id = $1", [id]));
    await expect(as(editor, (c) => c.query("update public.articles set title = 'Edited' where id = $1", [id])))
      .rejects.toThrow(/only an owner can change/);
    await as(owner, (c) => c.query("update public.articles set status = 'published', published_at = now() where id = $1", [id]));
  });

  it("new articles must start as drafts", async () => {
    await expect(as(editor, (c) => c.query("insert into public.articles (project_id, target_keyword, slug, title, status) values ($1, 'kw draft test', 'kw-draft-test', 'T', 'approved')", [projectId])))
      .rejects.toThrow(/must start as draft/);
  });

  it("rejects a second in-flight run with the same idempotency key", async () => {
    await as(editor, (c) => c.query("insert into public.automation_runs (project_id, kind, idempotency_key, status) values ($1, 'keyword_research', 'seed:isee', 'running')", [projectId]));
    await expect(as(editor, (c) => c.query("insert into public.automation_runs (project_id, kind, idempotency_key, status) values ($1, 'keyword_research', 'seed:isee', 'queued')", [projectId])))
      .rejects.toThrow(/duplicate key/);
    // Once finished, the same key can run again.
    await as(editor, (c) => c.query("update public.automation_runs set status = 'succeeded' where idempotency_key = 'seed:isee'"));
    await as(editor, (c) => c.query("insert into public.automation_runs (project_id, kind, idempotency_key, status) values ($1, 'keyword_research', 'seed:isee', 'queued')", [projectId]));
  });

  it("keeps child rows inside their article's project", async () => {
    const other = await as(stranger, async (c) => (await c.query("select public.create_project('Other', 'https://example.com', 'other', null) as id")).rows[0].id as string);
    const articleId = await as(editor, async (c) => (await c.query("select id from public.articles where project_id = $1 limit 1", [projectId])).rows[0].id as string);
    await expect(as(stranger, (c) => c.query("insert into public.article_sources (article_id, project_id, url) values ($1, $2, 'https://example.com')", [articleId, other])))
      .rejects.toThrow(/does not belong/);
  });

  describe("multi-project isolation and the social approval queue", () => {
    let evaId: string;
    let channelId: string;
    let evaChannelId: string;

    beforeAll(async () => {
      evaId = await as(stranger, async (c) => (await c.query("select public.create_project('EVA Video Studio', 'https://evavideostudio.com', 'eva-video-studio', 'RoverEva/Eva-Video-Studio') as id")).rows[0].id as string);
      channelId = await as(owner, async (c) => (await c.query("insert into public.social_channels (project_id, provider, external_id, service) values ($1, 'buffer', 'he-linkedin', 'linkedin') returning id", [projectId])).rows[0].id as string);
      evaChannelId = await as(stranger, async (c) => (await c.query("insert into public.social_channels (project_id, provider, external_id, service) values ($1, 'buffer', 'eva-instagram', 'instagram') returning id", [evaId])).rows[0].id as string);
    });

    it("new projects get no HatchElite defaults", async () => {
      const rows = await as(stranger, async (c) => (await c.query("select p.slug, p.github_base_branch, p.blog_content_path, b.brand_name, b.author_name, b.products from public.projects p join public.brand_profiles b on b.project_id = p.id where p.id = $1", [evaId])).rows);
      expect(rows[0]).toEqual({ slug: "eva-video-studio", github_base_branch: null, blog_content_path: null, brand_name: "EVA Video Studio", author_name: "EVA Video Studio Team", products: "" });
    });

    it("a website repo can belong to only one project", async () => {
      await expect(as(stranger, (c) => c.query("select public.create_project('Copy', 'https://copy.example', 'copy', 'roveREVA/HatchElite')")))
        .rejects.toThrow(/projects_github_repo_unique/);
    });

    it("a social channel can belong to only one project", async () => {
      await expect(as(stranger, (c) => c.query("insert into public.social_channels (project_id, provider, external_id) values ($1, 'buffer', 'he-linkedin')", [evaId])))
        .rejects.toThrow(/social_channels_provider_external_key/);
    });

    it("members of one project cannot see the other project's channels or posts", async () => {
      const rows = await as(owner, async (c) => (await c.query("select id from public.social_channels where project_id = $1", [evaId])).rows);
      expect(rows).toHaveLength(0);
    });

    it("a post cannot use another project's channel, even for an owner of both", async () => {
      await db.query("insert into public.project_members (project_id, user_id, role) values ($1, $2, 'owner')", [evaId, owner]);
      try {
        await expect(as(owner, (c) => c.query("insert into public.social_posts (project_id, channel_id, body) values ($1, $2, 'Hello')", [projectId, evaChannelId])))
          .rejects.toThrow(/social_posts_channel_same_project/);
      } finally {
        await db.query("delete from public.project_members where project_id = $1 and user_id = $2", [evaId, owner]);
      }
    });

    it("only an owner approves, and only approved posts can be queued", async () => {
      const postId = await as(editor, async (c) => (await c.query("insert into public.social_posts (project_id, channel_id, body, status) values ($1, $2, 'New ISEE guide', 'in_review') returning id", [projectId, channelId])).rows[0].id as string);
      await expect(as(editor, (c) => c.query("update public.social_posts set status = 'queued' where id = $1", [postId]))).rejects.toThrow(/Only approved posts/);
      await expect(as(editor, (c) => c.query("update public.social_posts set status = 'approved' where id = $1", [postId]))).rejects.toThrow(/Only a project owner/);
      await as(owner, (c) => c.query("update public.social_posts set status = 'approved' where id = $1", [postId]));
      // Editing approved text sends it back to review.
      await as(editor, (c) => c.query("update public.social_posts set body = 'Edited' where id = $1", [postId]));
      const after = await as(owner, async (c) => (await c.query("select status, approved_by from public.social_posts where id = $1", [postId])).rows[0]);
      expect(after).toEqual({ status: "in_review", approved_by: null });
      await as(owner, (c) => c.query("update public.social_posts set status = 'approved' where id = $1", [postId]));
      await as(editor, (c) => c.query("update public.social_posts set status = 'queued', external_post_id = 'b1' where id = $1", [postId]));
      await expect(as(editor, (c) => c.query("update public.social_posts set body = 'Too late' where id = $1", [postId]))).rejects.toThrow(/already in the publishing queue/);
    });

    it("new posts cannot skip review", async () => {
      await expect(as(owner, (c) => c.query("insert into public.social_posts (project_id, channel_id, body, status) values ($1, $2, 'x', 'approved')", [projectId, channelId])))
        .rejects.toThrow(/start as draft or in_review/);
    });
  });
});
