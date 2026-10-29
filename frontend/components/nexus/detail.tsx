import type { AuditRow, Ladder } from "@/lib/nexus";

import { When } from "./ui";

/** A verification ladder, compact: percentage, the 50% mark, the rungs. */
export function LadderList({ ladder }: { ladder: Ladder }) {
  return (
    <>
      <div className="flex items-baseline justify-between">
        <b className="text-3xl font-black tabular-nums">{ladder.percent}%</b>
        <span className="text-xs text-white/45">
          {ladder.done_count} of {ladder.total_count} steps
        </span>
      </div>
      <div className="relative mt-2 h-1.5 bg-white/10">
        <div className="h-full bg-beedero-yellow" style={{ width: `${ladder.percent}%` }} />
        <span aria-hidden className="absolute -top-1 left-1/2 h-3.5 w-px bg-white/60" />
      </div>
      <ol className="mt-4 space-y-2">
        {ladder.rungs.map((rung, index) => (
          <li key={rung.key} className="flex items-start gap-2.5 text-sm">
            <span
              className={`mt-0.5 grid size-5 shrink-0 place-items-center text-[10px] font-black ${
                rung.done ? "bg-beedero-yellow text-beedero-black" : "border border-app-border text-white/40"
              }`}
            >
              {rung.done ? "✓" : index + 1}
            </span>
            <span className="min-w-0">
              <span className={rung.done ? "text-white" : "text-white/55"}>{rung.label}</span>
              {rung.detail && <span className="block text-[11px] text-white/40">{rung.detail}</span>}
              {rung.warning && <span className="block text-[11px] text-[#ff8d82]">{rung.warning}</span>}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

/** What staff did to this person or organisation, newest first. */
export function History({ rows }: { rows: AuditRow[] }) {
  if (rows.length === 0) return <p className="text-sm text-white/40">No staff action yet.</p>;
  return (
    <ul className="divide-y divide-app-border text-sm">
      {rows.map((row) => (
        <li key={row.id} className="py-2">
          <span className="text-white">{row.action_label}</span>
          {row.reason && <span className="text-white/55"> — {row.reason}</span>}
          <span className="block text-[11px] text-white/35">
            {row.actor} · <When at={row.created_at} />
          </span>
        </li>
      ))}
    </ul>
  );
}
