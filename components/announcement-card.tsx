import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ArrowRightIcon, MegaphoneIcon } from "@/components/icons";
import { MinecraftAvatar } from "@/components/minecraft-avatar";
import { getContent } from "@/lib/content";
import { formatDate } from "@/lib/format";
import type { Announcement, AnnouncementAuthor } from "@/lib/types";

function AnnouncementAuthorLine({ author }: { author: AnnouncementAuthor | null }) {
  if (!author) {
    return (
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-aqua-200 bg-aqua-50 text-aqua-600"
          aria-hidden="true"
        >
          <MegaphoneIcon width={14} height={14} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-navy-600">Author not recorded</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-navy-400">
            Legacy announcement
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      {author.minecraftUsername ? (
        <MinecraftAvatar
          username={author.minecraftUsername}
          uuid={author.minecraftUuid}
          size={30}
          className="!rounded-full"
        />
      ) : (
        <Avatar
          name={author.username}
          src={author.avatarUrl}
          size={30}
          className="!rounded-full"
        />
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold text-navy-800">{author.username}</p>
        <p
          className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
          style={{ color: author.rank.color }}
        >
          <span
            className="h-1 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: author.rank.color }}
            aria-hidden="true"
          />
          {author.rank.name}
        </p>
      </div>
    </div>
  );
}

export async function AnnouncementCard({
  announcement,
  clamped = false,
}: {
  announcement: Announcement;
  clamped?: boolean;
}) {
  const copy = await getContent();

  return (
    <article className="panel panel-hover group relative overflow-hidden p-6">
      <span className="absolute inset-y-5 left-0 w-1 rounded-full bg-gradient-to-b from-sun/0 via-sun to-sun/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <AnnouncementAuthorLine author={announcement.author} />
        <div className="flex items-center gap-2 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-400">
          <span className="h-1.5 w-1.5 rounded-full bg-sun" />
          {formatDate(announcement.createdAt)}
        </div>
      </div>
      <h3 className="mt-4 font-display text-lg font-bold leading-snug text-navy-900">
        {announcement.title}
      </h3>
      <p
        className={`mt-2.5 whitespace-pre-line text-sm leading-relaxed text-navy-500 ${
          clamped ? "line-clamp-3" : ""
        }`}
      >
        {announcement.body}
      </p>
      <div className="mt-5 flex justify-end">
        <Link
          href="/announcements"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-aqua-700 transition-colors group-hover:text-sun-deep"
        >
          {copy["announcements.card.link"]}
          <ArrowRightIcon width={13} height={13} className="transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
