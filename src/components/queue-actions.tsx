import { approveSocialPost, rejectSocialPost, sendSocialPost, submitSocialPost } from "@/app/actions/social";
import { SubmitButton } from "@/components/submit-button";
import { inputClass } from "@/components/ui";
import type { Role } from "@/lib/auth";

// Buttons for one social post, shown on the project's Social page and in the cross-brand queue.
export function QueueActions({ projectId, id, status, role, returnTo }: { kind: "social"; projectId: string; id: string; status: string; role: Role; returnTo: string }) {
  const isOwner = role === "owner";
  const canEdit = role !== "viewer";
  const hidden = <input type="hidden" name="return_to" value={returnTo} />;
  return (
    <>
      {canEdit && (status === "draft" || status === "rejected") ? (
        <form action={submitSocialPost.bind(null, projectId, id)}>{hidden}<SubmitButton variant="secondary" pending="Submitting…">Submit for approval</SubmitButton></form>
      ) : null}
      {isOwner && (status === "in_review" || status === "failed") ? (
        <form action={approveSocialPost.bind(null, projectId, id)}>{hidden}<SubmitButton pending="Approving…">Approve</SubmitButton></form>
      ) : null}
      {isOwner && status === "in_review" ? (
        <form action={rejectSocialPost.bind(null, projectId, id)} className="flex gap-2">
          {hidden}
          <input className={`${inputClass} w-48`} name="reason" placeholder="Reason (optional)" aria-label="Reason for rejecting" />
          <SubmitButton variant="danger" pending="Rejecting…">Reject</SubmitButton>
        </form>
      ) : null}
      {canEdit && status === "approved" ? (
        <form action={sendSocialPost.bind(null, projectId, id)}>{hidden}<SubmitButton pending="Sending…">Send to publishing queue</SubmitButton></form>
      ) : null}
    </>
  );
}
