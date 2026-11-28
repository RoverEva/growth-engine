import Link from "next/link";
import { createSocialPost, deleteSocialPost, linkChannel, setChannelBoard, unlinkChannel } from "@/app/actions/social";
import { QueueActions } from "@/components/queue-actions";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, Empty, Notice, inputClass, labelClass } from "@/components/ui";
import { canEdit, requireProject } from "@/lib/auth";
import { errorText } from "@/lib/flash";
import { ADAPTERS, isProviderConfigured, providerKey } from "@/lib/social";
import { isPinterest, type ProviderBoard, type ProviderChannel, type SocialProvider } from "@/lib/social/types";

export default async function SocialPage({ params, searchParams }: { params: Promise<{ projectId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { projectId } = await params;
  const flash = await searchParams;
  const { supabase, project, role } = await requireProject(projectId);
  const isOwner = role === "owner";
  const [{ data: channels }, { data: posts }] = await Promise.all([
    supabase.from("social_channels").select("*").eq("project_id", projectId).order("created_at"),
    supabase.from("social_posts").select("*, social_channels(display_name, service, provider)").eq("project_id", projectId).order("created_at", { ascending: false }).limit(100),
  ]);

  // Owners can list the accounts their Buffer/Postiz key can see, then link the ones that belong to this brand.
  const discover = isOwner && (flash.discover === "buffer" || flash.discover === "postiz") ? (flash.discover as SocialProvider) : null;
  let found: ProviderChannel[] = [];
  let discoverError = "";
  if (discover) {
    try {
      found = await ADAPTERS[discover].listChannels(providerKey(discover, project.slug));
    } catch (error) {
      discoverError = errorText(error);
    }
  }
  // Pinterest boards for linked Pinterest channels (owners pick the default board once).
  const boards = new Map<string, ProviderBoard[] | string>();
  if (isOwner) {
    for (const c of channels ?? []) {
      if (!isPinterest(c.service) || c.provider !== "buffer") continue;
      try { boards.set(c.id, await (ADAPTERS.buffer.listBoards?.(providerKey("buffer", project.slug), c.external_id) ?? Promise.resolve([]))); }
      catch (error) { boards.set(c.id, errorText(error)); }
    }
  }
  const linkedIds = new Set((channels ?? []).map((c) => `${c.provider}:${c.external_id}`));

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">Social posts</h1>
        <p className="text-sm text-slate-600">Posts for <strong>{project.name}</strong> only. Every post needs an owner&apos;s approval, then goes to this brand&apos;s own channels in Buffer (Postiz is the open-source alternative). See all brands in the <Link className="text-violet-700 underline" href="/queue">approval queue</Link>.</p>
      </div>
      <Notice notice={flash.notice} error={flash.error} />

      <Card title="Channels linked to this project">
        {channels?.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2">
                <span><Badge value={c.provider} /> {c.display_name || c.external_id} <span className="text-slate-500">({c.service || "unknown service"})</span>
                  {isPinterest(c.service) ? <span className="ml-2 text-xs text-slate-600">Board: {c.board_name || <strong className="text-amber-700">not chosen</strong>}</span> : null}
                  {isOwner && isPinterest(c.service) ? (() => {
                    const list = boards.get(c.id);
                    if (typeof list === "string") return <span className="ml-2 text-xs text-red-700">{list}</span>;
                    if (!list?.length) return null;
                    return (
                      <form action={setChannelBoard.bind(null, projectId, c.id)} className="mt-1 flex gap-2">
                        <select className={`${inputClass} w-64`} name="board" defaultValue={c.board_service_id ? `${c.board_service_id}|${c.board_name ?? ""}` : ""} aria-label="Pinterest board">
                          <option value="">Choose a board…</option>
                          {list.map((b) => <option key={b.serviceId} value={`${b.serviceId}|${b.name}`}>{b.name}</option>)}
                        </select>
                        <SubmitButton variant="secondary" pending="Saving…">Save board</SubmitButton>
                      </form>
                    );
                  })() : null}
                </span>
                {isOwner ? <form action={unlinkChannel.bind(null, projectId, c.id)}><SubmitButton variant="danger" pending="Unlinking…">Unlink</SubmitButton></form> : null}
              </li>
            ))}
          </ul>
        ) : <Empty>No channels yet.{isOwner ? " Find your accounts below and link the ones that belong to this brand." : " Ask an owner to link one."}</Empty>}
        {isOwner ? (
          <div className="mt-4 grid gap-3 text-sm">
            <div className="flex flex-wrap gap-2">
              {(["buffer", "postiz"] as const).map((p) => (
                <Link key={p} href={`?discover=${p}`} className={`rounded-lg border px-3 py-1.5 font-semibold ${isProviderConfigured(p, project.slug) ? "border-slate-300 text-slate-800 hover:bg-slate-50" : "border-dashed border-slate-300 text-slate-400"}`}>
                  Find {p === "buffer" ? "Buffer" : "Postiz"} channels{isProviderConfigured(p, project.slug) ? "" : " (key not set)"}
                </Link>
              ))}
            </div>
            {discoverError ? <p className="text-red-700">{discoverError}</p> : null}
            {discover && !discoverError ? (
              found.length ? (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {found.map((c) => (
                    <li key={c.externalId} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span>{c.displayName} <span className="text-slate-500">[{c.service}]</span></span>
                      {linkedIds.has(`${discover}:${c.externalId}`) ? <Badge value="working" label="linked here" /> : (
                        <form action={linkChannel.bind(null, projectId)}>
                          <input type="hidden" name="provider" value={discover} />
                          <input type="hidden" name="external_id" value={c.externalId} />
                          <input type="hidden" name="service" value={c.service} />
                          <input type="hidden" name="display_name" value={c.displayName} />
                          <SubmitButton variant="secondary" pending="Linking…">Link to {project.name}</SubmitButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-slate-600">No channels found. Connect this brand&apos;s social accounts in {discover} first.</p>
            ) : null}
            <p className="text-xs text-slate-500">A channel can be linked to one project only. Linking another brand&apos;s account here is refused by the database.</p>
          </div>
        ) : null}
      </Card>

      {canEdit(role) ? (
        <Card title="New post">
          {channels?.length ? (
            <form action={createSocialPost.bind(null, projectId)} className="grid gap-3">
              <label className={labelClass}>Channel
                <select className={inputClass} name="channel_id" required>
                  {channels.map((c) => <option key={c.id} value={c.id}>{c.display_name || c.external_id} ({c.service})</option>)}
                </select>
              </label>
              <label className={labelClass}>Text<textarea className={inputClass} name="body" rows={5} maxLength={3000} required /></label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={labelClass}>Image URL (required for Pinterest)<input className={inputClass} name="image_url" type="url" pattern="https://.*" placeholder={`${project.site_url}/pins/…jpg`} /></label>
                <label className={labelClass}>Pin title (Pinterest, optional)<input className={inputClass} name="title" maxLength={100} /></label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className={labelClass}>Link (optional; UTM tags are added when sent)<input className={inputClass} name="link_url" type="url" pattern="https://.*" placeholder={`${project.site_url}/…`} /></label>
                <label className={labelClass}>Publish at (optional)<input className={inputClass} name="scheduled_for" type="datetime-local" /></label>
                <label className={labelClass}>Save as
                  <select className={inputClass} name="submit" defaultValue="review"><option value="review">Submit for approval</option><option value="draft">Draft</option></select>
                </label>
              </div>
              <p className="text-xs text-slate-500">No time = the channel&apos;s next free slot in Buffer&apos;s queue after approval. Don&apos;t include student names, photos or private customer content.</p>
              <div><SubmitButton pending="Saving…">Save post</SubmitButton></div>
            </form>
          ) : <Empty>Link a channel first.</Empty>}
        </Card>
      ) : null}

      <Card title="Posts">
        {posts?.length ? (
          <ul className="divide-y divide-slate-100">
            {posts.map((p) => (
              <li key={p.id} className="grid gap-2 py-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge value={p.status} />
                  <span className="text-slate-500">{p.social_channels?.display_name ?? "channel"} · {p.scheduled_for ? new Date(p.scheduled_for).toLocaleString("en-US") : "next queue slot"}</span>
                </div>
                <p className="whitespace-pre-wrap text-slate-800">{p.body}</p>
                {p.title ? <p className="font-semibold text-slate-800">{p.title}</p> : null}
                {/* eslint-disable-next-line @next/next/no-img-element -- external pin preview, not page content */}
                {p.image_url ? <img src={p.image_url} alt="" className="h-40 w-auto rounded border border-slate-200 object-contain" /> : null}
                {p.link_url ? <a className="text-violet-700 underline" href={p.link_url}>{p.link_url}</a> : null}
                {p.review_note && p.status === "rejected" ? <p className="text-red-700">Rejected: {p.review_note}</p> : null}
                {p.last_error ? <p className="text-red-700">Last error: {p.last_error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <QueueActions kind="social" projectId={projectId} id={p.id} status={p.status} role={role} returnTo={`/p/${projectId}/social`} />
                  {(p.status === "draft" || p.status === "rejected" || isOwner) && p.status !== "queued" && canEdit(role) ? (
                    <form action={deleteSocialPost.bind(null, projectId, p.id)}><SubmitButton variant="danger" pending="Deleting…">Delete</SubmitButton></form>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty>No posts yet.</Empty>}
      </Card>
    </div>
  );
}
