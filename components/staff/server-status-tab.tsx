"use client";

import { useCallback, useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import {
  CheckIcon,
  CloseIcon,
  ServerIcon,
  WrenchIcon,
} from "@/components/icons";
import {
  MAX_STATUS_MESSAGE,
  type OwnerServerStatus,
  type PublicServerStatus,
} from "@/lib/types";
import { MAX_IP_DISPLAY_TEXT } from "@/lib/ip-display-format";
import {
  apiRequest,
  ErrorNote,
  errorMessage,
  Field,
  PageSectionHeader,
  Spinner,
  type Notify,
} from "./ui";

interface OwnerSnapshot {
  status: OwnerServerStatus | null;
  message: string;
  minecraft: {
    reachable: boolean;
    online: boolean;
    version: string | null;
    checkedAt: string;
  };
}

interface IpDisplaySnapshot {
  displayText: string;
  showGlobe: boolean;
  copyValue: string;
}

const OPTIONS: {
  id: OwnerServerStatus;
  title: string;
  description: string;
  icon: typeof CheckIcon;
  iconClass: string;
  selectedClass: string;
}[] = [
  {
    id: "online",
    title: "Set Online",
    description: "Visitors see STATUS ONLINE with a glowing green indicator.",
    icon: CheckIcon,
    iconClass: "border-emerald-200 bg-emerald-50 text-emerald-600",
    selectedClass: "border-emerald-400/70 bg-emerald-50/80 ring-2 ring-emerald-300/50",
  },
  {
    id: "offline",
    title: "Set Offline",
    description: "Visitors see STATUS OFFLINE with a red indicator.",
    icon: CloseIcon,
    iconClass: "border-red-200 bg-red-50 text-red-500",
    selectedClass: "border-red-400/70 bg-red-50/80 ring-2 ring-red-300/50",
  },
  {
    id: "maintenance",
    title: "Set Maintenance",
    description: "Visitors see UNDER MAINTENANCE with your optional message.",
    icon: WrenchIcon,
    iconClass: "border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 text-orange-600",
    selectedClass:
      "border-orange-400/70 bg-gradient-to-r from-orange-50/80 to-red-50/80 ring-2 ring-orange-300/50",
  },
];

function effectiveStatus(snapshot: OwnerSnapshot): PublicServerStatus {
  if (snapshot.status) return snapshot.status;
  if (!snapshot.minecraft.reachable) return "unknown";
  return snapshot.minecraft.online ? "online" : "offline";
}

export function ServerStatusTab({ notify }: { notify: Notify }) {
  const [snapshot, setSnapshot] = useState<OwnerSnapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<OwnerServerStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [display, setDisplay] = useState<IpDisplaySnapshot | null>(null);
  const [displayText, setDisplayText] = useState("");
  const [showGlobe, setShowGlobe] = useState(true);
  const [displayLoadError, setDisplayLoadError] = useState("");
  const [displayError, setDisplayError] = useState("");
  const [displayPending, setDisplayPending] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoadError("");
      const data = await apiRequest<OwnerSnapshot>("/api/owner/server-status");
      setSnapshot(data);
      setSelected(data.status);
      setMessage(data.message);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  const loadDisplay = useCallback(async () => {
    try {
      setDisplayLoadError("");
      const data = await apiRequest<IpDisplaySnapshot>("/api/owner/ip-display");
      setDisplay(data);
      setDisplayText(data.displayText);
      setShowGlobe(data.showGlobe);
    } catch (err) {
      setDisplayLoadError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadDisplay();
  }, [loadDisplay]);

  async function save() {
    if (!selected) return;
    setError("");
    setPending(true);
    try {
      const data = await apiRequest<{ ok: boolean; status: OwnerServerStatus; message: string }>(
        "/api/owner/server-status",
        { method: "PUT", body: { status: selected, message: message.trim() } },
      );
      setSnapshot((current) => (current ? { ...current, status: data.status, message: data.message } : current));
      setMessage(data.message);
      notify(`Server status saved — visitors now see “${labelFor(data.status)}”.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  async function saveDisplay() {
    const text = displayText.trim();
    if (!text) {
      setDisplayError("Enter the IP display text.");
      return;
    }

    setDisplayError("");
    setDisplayPending(true);
    try {
      const data = await apiRequest<IpDisplaySnapshot>("/api/owner/ip-display", {
        method: "PUT",
        body: { displayText: text, showGlobe },
      });
      setDisplay(data);
      setDisplayText(data.displayText);
      setShowGlobe(data.showGlobe);
      notify("Homepage IP display saved.");
    } catch (err) {
      setDisplayError(errorMessage(err));
    } finally {
      setDisplayPending(false);
    }
  }

  const current = snapshot ? effectiveStatus(snapshot) : "unknown";

  return (
    <div>
      <PageSectionHeader
        title="Server status control"
        description="Choose what the homepage badge shows. Your selection overrides the live Minecraft ping until you change it."
      />

      {loadError && (
        <div className="mt-5">
          <ErrorNote>{loadError}</ErrorNote>
        </div>
      )}

      {!snapshot ? (
        <div className="panel mt-5 px-6 py-16">
          <Spinner label="Loading server status" />
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            <div role="radiogroup" aria-label="Server status" className="space-y-3">
              {OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = selected === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => {
                      setSelected(option.id);
                      if (error) setError("");
                    }}
                    className={`flex w-full items-center gap-4 rounded-2xl border bg-white/90 p-4 text-left shadow-[0_16px_38px_-30px_rgba(9,60,90,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white ${
                      active ? option.selectedClass : "border-aqua-200/80 hover:border-aqua-300"
                    }`}
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${option.iconClass}`}
                    >
                      <Icon width={18} height={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-sm font-bold text-navy-900">
                        {option.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-navy-500">
                        {option.description}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        active
                          ? "border-sun-deep bg-sun-deep text-white"
                          : "border-aqua-200 bg-white text-transparent"
                      }`}
                    >
                      <CheckIcon width={11} height={11} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="panel p-5">
              <Field
                label="Maintenance message (optional)"
                htmlFor="status-message"
                hint={`Shown under the homepage badge while Under Maintenance. Up to ${MAX_STATUS_MESSAGE} characters.`}
              >
                <input
                  id="status-message"
                  className="input"
                  maxLength={MAX_STATUS_MESSAGE}
                  placeholder="e.g. Back online after today's update — thanks for your patience!"
                  value={message}
                  onChange={(event) => {
                    setMessage(event.target.value);
                    if (error) setError("");
                  }}
                />
              </Field>

              {error && (
                <div className="mt-4">
                  <ErrorNote>{error}</ErrorNote>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[11px] leading-relaxed text-navy-400">
                  The homepage refreshes within 30 seconds of saving.
                </p>
                <button
                  type="button"
                  onClick={save}
                  disabled={!selected || pending}
                  className="btn-primary !py-2.5 text-xs"
                >
                  {pending ? "Saving…" : "Save Status"}
                </button>
              </div>
            </div>

            <div className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-semibold text-navy-900">
                    Homepage IP display
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-navy-400">
                    Style the address shown on the homepage status card. Copying always uses the real
                    server address.
                  </p>
                </div>
                <span className="rounded-full border border-aqua-200 bg-aqua-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-aqua-700">
                  Owner only
                </span>
              </div>

              {displayLoadError && (
                <div className="mt-4">
                  <ErrorNote>{displayLoadError}</ErrorNote>
                </div>
              )}

              {!display && !displayLoadError && (
                <div className="mt-4">
                  <Spinner label="Loading IP display" />
                </div>
              )}

              {display && (
                <div className="mt-4 space-y-4">
                  <Field
                    label="IP display text"
                    htmlFor="ip-display-text"
                    hint={`Shown between the globe and copy button. Up to ${MAX_IP_DISPLAY_TEXT} characters; Unicode and emoji are allowed.`}
                  >
                    <input
                      id="ip-display-text"
                      className="input font-mono text-[13px]"
                      maxLength={MAX_IP_DISPLAY_TEXT}
                      spellCheck={false}
                      disabled={displayPending}
                      value={displayText}
                      onChange={(event) => {
                        setDisplayText(event.target.value);
                        if (displayError) setDisplayError("");
                      }}
                    />
                  </Field>

                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-aqua-100 bg-aqua-50/50 px-3.5 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-ember"
                      checked={showGlobe}
                      disabled={displayPending}
                      onChange={(event) => setShowGlobe(event.target.checked)}
                    />
                    <span className="text-xs text-navy-600">
                      <strong className="font-semibold text-navy-900">Show 🌐 icon</strong> — appears
                      before the IP display text.
                    </span>
                  </label>

                  <p className="rounded-lg border border-aqua-100 bg-white px-3 py-2 text-[11px] leading-relaxed text-navy-500">
                    The copy button still copies{" "}
                    <span className="font-mono text-navy-900">{display.copyValue}</span>. The display
                    text never changes the Minecraft server address.
                  </p>

                  {displayError && <ErrorNote>{displayError}</ErrorNote>}

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] leading-relaxed text-navy-400">
                      Refresh the homepage to see the new display.
                    </p>
                    <button
                      type="button"
                      onClick={saveDisplay}
                      disabled={displayPending || !displayText.trim()}
                      className="btn-primary !py-2.5 text-xs"
                    >
                      {displayPending ? "Saving…" : "Save IP display"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-navy-400">
                Current active status
              </p>
              <div className="mt-3 flex justify-center">
                <StatusBadge status={current} />
              </div>
              {current === "maintenance" && snapshot.message && (
                <p className="mt-3 rounded-lg border border-orange-200/70 bg-orange-50/60 px-3 py-2 text-center text-xs leading-relaxed text-orange-800">
                  {snapshot.message}
                </p>
              )}
              <p className="mt-3 text-center text-[11px] leading-relaxed text-navy-400">
                {snapshot.status
                  ? "Set by the Owner Panel. The live ping cannot override it."
                  : "No status saved yet — the badge follows the live Minecraft ping."}
              </p>
            </div>

            <div className="panel p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-aqua-100 bg-aqua-50 text-aqua-700">
                  <ServerIcon width={16} height={16} />
                </span>
                <div>
                  <p className="font-display text-sm font-bold text-navy-900">Minecraft monitor</p>
                  <p className="text-[11px] text-navy-400">Separate from the public badge.</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-navy-600">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 rounded-full ${
                    !snapshot.minecraft.reachable
                      ? "bg-navy-300"
                      : snapshot.minecraft.online
                        ? "bg-emerald-500"
                        : "bg-red-500"
                  }`}
                />
                {!snapshot.minecraft.reachable
                  ? "Ping unavailable"
                  : snapshot.minecraft.online
                    ? "Server responding — online"
                    : "Server responding — offline"}
                {snapshot.minecraft.version && (
                  <span className="ml-auto font-mono text-[10px] text-navy-400">
                    {snapshot.minecraft.version}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function labelFor(status: OwnerServerStatus): string {
  return status === "online" ? "Status Online" : status === "offline" ? "Status Offline" : "Under Maintenance";
}
