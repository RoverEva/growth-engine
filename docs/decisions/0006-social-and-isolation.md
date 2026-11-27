# 0006: Social publishing through Buffer; isolation from the manifest and the database

_Date: 2026-11-27. Decided by: owner (Buffer first, Postiz later), Claude (implementation)._

## Decision
- Approved social posts go to **Buffer** (free plan) through its GraphQL API. **Postiz** (open source, self-hostable)
  is a drop-in alternative behind the same `SocialAdapter` interface.
- Buffer's free plan allows one API key per account, so `BUFFER_API_KEY` may be shared. Isolation does not depend on the
  key: each Buffer channel is linked to exactly one project in `social_channels`, and a post can only use a channel of
  its own project (composite foreign key, tested).
- Publishing targets come from `projects/<slug>/PROJECT.json` rather than a new `publishing_targets` table, so the
  knowledge base stays the single source of truth and the engine cannot be pointed at another project's repo from the UI.
- Only owners approve. Nothing posts or publishes automatically; "Send to publishing queue" hands an approved post to
  Buffer, which publishes it at the chosen time or the channel's next slot.

## Consequences
- Moving to Postiz later: set `POSTIZ_API_KEY` (+ `POSTIZ_API_URL` if self-hosted), link the Postiz channels, done.
- A shared Buffer key can see both brands' channels; the Social page only lets an owner link channels to the project
  they are in, and the database refuses a channel already linked elsewhere.
