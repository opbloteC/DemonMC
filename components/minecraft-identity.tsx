import { CubeIcon, LockIcon } from "@/components/icons";

export function MinecraftIdentity({
  current,
  compact = false,
  brandName = "DemonMC",
}: {
  current: string | null;
  compact?: boolean;
  brandName?: string;
}) {
  return (
    <div className={compact ? "" : "panel p-6"}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-aqua-100 bg-aqua-50 text-aqua-700">
          <CubeIcon width={17} height={17} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold text-navy-900">Minecraft identity</h2>
          <p className="mt-1 text-xs leading-relaxed text-navy-500">
            {current
              ? "This name is shown on the public players page together with your real skin."
              : "No Minecraft username is linked to this account."}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-aqua-200 bg-aqua-50/60 px-3.5 py-2.5">
        <span className="truncate font-mono text-sm font-semibold text-navy-700">
          {current ?? "Not linked"}
        </span>
        <LockIcon width={15} height={15} className="shrink-0 text-navy-400" />
      </div>

      <p className="mt-2.5 text-[11px] leading-relaxed text-navy-400">
        Minecraft usernames are locked and cannot be changed. Contact {brandName} staff if you need
        help with the name linked to your account.
      </p>
    </div>
  );
}
