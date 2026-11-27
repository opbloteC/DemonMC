"use client";

import { useCallback, useEffect, useState } from "react";
import { MegaphoneIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { RankBadge } from "@/components/rank-badge";
import { formatDate } from "@/lib/format";
import { userCan, type Announcement, type SessionUser } from "@/lib/types";
import {
  apiRequest,
  ConfirmDialog,
  EmptyState,
  ErrorNote,
  errorMessage,
  Field,
  Modal,
  PageSectionHeader,
  Spinner,
  type Notify,
} from "./ui";

function AnnouncementEditor({
  announcement,
  onClose,
  onSaved,
}: {
  announcement: Announcement | null;
  onClose: () => void;
  onSaved: (mode: "create" | "edit") => void;
}) {
  const [title, setTitle] = useState(announcement?.title ?? "");
  const [body, setBody] = useState(announcement?.body ?? "");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      await apiRequest(
        announcement ? `/api/admin/announcements/${announcement.id}` : "/api/admin/announcements",
        {
          method: announcement ? "PATCH" : "POST",
          body: { title, body },
        },
      );
      onSaved(announcement ? "edit" : "create");
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <Modal
      title={announcement ? "Edit announcement" : "New announcement"}
      description="Announcements appear on the homepage and the announcements page once published."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Title" htmlFor="announcement-title" hint="3–120 characters.">
          <input
            id="announcement-title"
            className="input"
            required
            minLength={3}
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Season 2 is live"
          />
        </Field>

        <Field label="Announcement" htmlFor="announcement-body" hint="3–2000 characters.">
          <textarea
            id="announcement-body"
            rows={7}
            required
            minLength={3}
            maxLength={2000}
            className="input resize-y"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write the announcement here…"
          />
        </Field>

        {error && <ErrorNote>{error}</ErrorNote>}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-ghost !py-2.5 text-xs" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" disabled={pending} className="btn-primary !py-2.5 text-xs">
            {pending ? "Saving…" : announcement ? "Save changes" : "Create announcement"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function AnnouncementsTab({ user, notify }: { user: SessionUser; notify: Notify }) {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [editor, setEditor] = useState<
    { mode: "create" } | { mode: "edit"; announcement: Announcement } | null
  >(null);
  const [deleting, setDeleting] = useState<Announcement | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const canCreate = userCan(user, "announcements.create");
  const canEdit = userCan(user, "announcements.edit");
  const canDelete = userCan(user, "announcements.delete");
  const canPin = userCan(user, "announcements.pin");
  const canPublish = userCan(user, "announcements.publish");

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const data = await apiRequest<{ announcements: Announcement[] }>("/api/admin/announcements");
      setAnnouncements(data.announcements);
    } catch (error) {
      setAnnouncements([]);
      setLoadError(errorMessage(error));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmDelete() {
    if (!deleting) return;
    setDeletePending(true);
    try {
      await apiRequest(`/api/admin/announcements/${deleting.id}`, { method: "DELETE" });
      notify("Announcement deleted.");
      setDeleting(null);
      await load();
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setDeletePending(false);
    }
  }

  async function setFlag(announcement: Announcement, patch: { pinned?: boolean; published?: boolean }) {
    setBusyId(announcement.id);
    try {
      await apiRequest(`/api/admin/announcements/${announcement.id}`, {
        method: "PATCH",
        body: patch,
      });
      if (patch.pinned !== undefined) {
        notify(patch.pinned ? "Announcement pinned." : "Announcement unpinned.");
      } else if (patch.published !== undefined) {
        notify(patch.published ? "Announcement published." : "Announcement unpublished.");
      }
      await load();
    } catch (error) {
      notify(errorMessage(error), "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageSectionHeader
        title="Announcements"
        description="Publish updates to the homepage and the public announcements page. Actions follow your permissions."
        action={
          canCreate ? (
            <button
              type="button"
              className="btn-primary !px-4 !py-2.5 text-xs"
              onClick={() => setEditor({ mode: "create" })}
            >
              <PlusIcon width={14} height={14} />
              New announcement
            </button>
          ) : undefined
        }
      />

      {loadError && (
        <div className="mt-5">
          <ErrorNote>{loadError}</ErrorNote>
        </div>
      )}

      <div className="panel mt-5 overflow-hidden">
        {announcements === null ? (
          <div className="px-6 py-16">
            <Spinner label="Loading announcements" />
          </div>
        ) : announcements.length === 0 ? (
          <EmptyState
            icon={<MegaphoneIcon width={19} height={19} />}
            title="No announcements yet"
            description="Publish your first update and it will show up on the homepage and announcements page."
            action={
              canCreate ? (
                <button
                  type="button"
                  className="btn-ghost !py-2.5 text-xs"
                  onClick={() => setEditor({ mode: "create" })}
                >
                  <PlusIcon width={14} height={14} />
                  Write an announcement
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="divide-y divide-aqua-100">
            {announcements.map((announcement) => {
              const busy = busyId === announcement.id;
              return (
                <li key={announcement.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
                        {formatDate(announcement.createdAt)}
                        {announcement.updatedAt !== announcement.createdAt && " · edited"}
                        {announcement.pinned && (
                          <span className="rounded border border-sun/40 bg-sun/10 px-1.5 py-0.5 text-[9px] text-sun-deep">
                            Pinned
                          </span>
                        )}
                        {!announcement.published && (
                          <span className="rounded border border-ember/25 bg-ember/[0.06] px-1.5 py-0.5 text-[9px] text-ember-bright">
                            Draft
                          </span>
                        )}
                      </p>
                      <h3 className="mt-1.5 font-display text-sm font-semibold text-navy-900">
                        {announcement.title}
                      </h3>
                      <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-navy-500">
                        {announcement.body}
                      </p>
                      {announcement.author && (
                        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-navy-400">
                          By {announcement.author.username}
                          <RankBadge rank={announcement.author.rank} size="sm" />
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {canPin && (
                        <button
                          type="button"
                          className="btn-subtle !px-2.5 !py-1.5 text-[10px]"
                          disabled={busy}
                          onClick={() =>
                            void setFlag(announcement, { pinned: !announcement.pinned })
                          }
                        >
                          {announcement.pinned ? "Unpin" : "Pin"}
                        </button>
                      )}
                      {canPublish && (
                        <button
                          type="button"
                          className="btn-subtle !px-2.5 !py-1.5 text-[10px]"
                          disabled={busy}
                          onClick={() =>
                            void setFlag(announcement, { published: !announcement.published })
                          }
                        >
                          {announcement.published ? "Unpublish" : "Publish"}
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          aria-label={`Edit ${announcement.title}`}
                          className="icon-btn"
                          onClick={() => setEditor({ mode: "edit", announcement })}
                        >
                          <PencilIcon width={14} height={14} />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          aria-label={`Delete ${announcement.title}`}
                          className="icon-btn hover:border-ember/30 hover:text-ember-bright"
                          onClick={() => setDeleting(announcement)}
                        >
                          <TrashIcon width={14} height={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editor && (
        <AnnouncementEditor
          key={editor.mode === "edit" ? editor.announcement.id : "new"}
          announcement={editor.mode === "edit" ? editor.announcement : null}
          onClose={() => setEditor(null)}
          onSaved={(mode) => {
            setEditor(null);
            notify(mode === "create" ? "Announcement created." : "Announcement updated.");
            void load();
          }}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete announcement"
          message={`Delete “${deleting.title}”? This removes it from the site immediately.`}
          pending={deletePending}
          onCancel={() => setDeleting(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
