import type { SeriesPoint } from "@/lib/nexus";

/** Thirty days as bars, with the total and the last day. No chart library:
 *  an SVG is all a daily count needs. */
export function Bars({ title, points, note }: { title: string; points: SeriesPoint[]; note?: string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const width = 300;
  const height = 72;
  const gap = 2;
  const bar = (width - gap * (points.length - 1)) / Math.max(1, points.length);
  const last = points[points.length - 1];
  return (
    <figure className="border border-app-border bg-app-surface p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{title}</span>
        <span className="text-xs text-white/45">
          <b className="text-base font-black text-white">{total.toLocaleString("en-GB")}</b> in 30 days
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-3 h-[72px] w-full"
        role="img"
        aria-label={`${title}: ${total} in 30 days, ${last?.value ?? 0} on the last day`}
        preserveAspectRatio="none"
      >
        {points.map((point, index) => {
          const h = point.value ? Math.max(2, (point.value / max) * (height - 4)) : 1;
          return (
            <rect
              key={point.date}
              x={index * (bar + gap)}
              y={height - h}
              width={bar}
              height={h}
              className={index === points.length - 1 ? "fill-beedero-yellow" : "fill-white/25"}
            >
              <title>{`${point.date}: ${point.value}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-white/30">
        <span>{points[0]?.date.slice(5)}</span>
        <span>today</span>
      </div>
      {note && <p className="mt-2 text-[11px] leading-4 text-white/35">{note}</p>}
    </figure>
  );
}

export function Funnel({ steps }: { steps: { label: string; count: number; pct_of_first: number | null }[] }) {
  const first = steps[0]?.count || 1;
  return (
    <ol className="space-y-2">
      {steps.map((step) => (
        <li key={step.label}>
          <div className="flex items-baseline justify-between gap-3 text-xs">
            <span className="text-white/70">{step.label}</span>
            <span className="tabular-nums text-white/50">
              <b className="text-sm text-white">{step.count.toLocaleString("en-GB")}</b>
              {step.pct_of_first !== null && ` · ${step.pct_of_first}%`}
            </span>
          </div>
          <div className="mt-1 h-2 bg-white/10">
            <div className="h-full bg-beedero-yellow" style={{ width: `${Math.round((step.count / first) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

/** Weekly cohorts: the share of each signup week active in the weeks after. */
export function Cohorts({ rows }: { rows: { week_of: string; size: number; weeks: (number | null)[] }[] }) {
  const columns = Math.max(0, ...rows.map((row) => row.weeks.length));
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-xs">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.12em] text-white/40">
            <th className="px-2 py-1.5 text-left font-black">Joined week of</th>
            <th className="px-2 py-1.5 text-right font-black">People</th>
            {Array.from({ length: columns }, (_, i) => (
              <th key={i} className="px-2 py-1.5 text-center font-black">
                W{i + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.week_of} className="border-t border-app-border">
              <td className="px-2 py-1.5 text-white/70">{row.week_of}</td>
              <td className="px-2 py-1.5 text-right tabular-nums text-white">{row.size}</td>
              {Array.from({ length: columns }, (_, i) => {
                const value = row.weeks[i];
                return (
                  <td key={i} className="px-1 py-1">
                    {value === undefined ? null : (
                      <span
                        className={`block py-1 text-center font-bold tabular-nums ${
                          value !== null && value >= 50 ? "text-beedero-black" : "text-white"
                        }`}
                        style={{ background: `rgba(249, 222, 74, ${value === null ? 0 : 0.08 + (value / 100) * 0.7})` }}
                      >
                        {value === null ? "—" : `${value}%`}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
