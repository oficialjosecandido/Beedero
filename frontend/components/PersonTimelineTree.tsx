import { profileSectionHeadingClass, type TimelineBand } from "@/components/PersonTimeline";

/**
 * The Figma "Timeline tree": one column per record, its height showing how
 * many years it lived. Columns are packed left-to-right so two records that
 * never overlap in time can share one, which keeps the grid narrow.
 */

const ROW_HEIGHT = 88;
const YEAR_COLUMN = 58;
const MIN_BRANCH_WIDTH = 120;
const GAP = 8;

type Category = "work" | "advisory" | "volunteer" | "project" | "declared";

const CATEGORIES: Record<Category, { label: string; bar: string; accent: string; dot: string }> = {
  work: {
    label: "Work",
    bar: "border-l-beedero-yellow",
    accent: "text-amber-700",
    dot: "bg-beedero-yellow",
  },
  advisory: {
    label: "Advisory",
    bar: "border-l-violet-400",
    accent: "text-violet-700",
    dot: "bg-violet-400",
  },
  volunteer: {
    label: "Volunteer",
    bar: "border-l-sky-400",
    accent: "text-sky-700",
    dot: "bg-sky-400",
  },
  project: {
    label: "Project",
    bar: "border-l-emerald-400",
    accent: "text-emerald-700",
    dot: "bg-emerald-400",
  },
  declared: {
    label: "Self-declared",
    bar: "border-l-zinc-300",
    accent: "text-zinc-500",
    dot: "bg-zinc-300",
  },
};

const CATEGORY_ORDER: Category[] = ["work", "advisory", "project", "volunteer", "declared"];

/**
 * Roles arrive as display strings from three different models, so the group
 * is read off keywords rather than a code. Anything unrecognised falls back
 * to the record's verification state, which is the one fact always present.
 */
function categoryOf(band: TimelineBand): Category {
  const role = band.role.toLowerCase();
  if (role.includes("volunteer")) return "volunteer";
  if (role.includes("advisor") || role.includes("board") || role.includes("fractional")) {
    return "advisory";
  }
  if (role.includes("contractor") || role.includes("freelance")) return "project";
  return band.verified ? "work" : "declared";
}

function year(value: string): number {
  return new Date(value).getUTCFullYear();
}

type Branch = {
  key: string;
  title: string;
  subtitle: string;
  range: string;
  status: string;
  ongoing: boolean;
  verified: boolean;
  milestones: number;
  category: Category;
  topRow: number;
  bottomRow: number;
  column: number;
};

export function PersonTimelineTree({ bands }: { bands: TimelineBand[] }) {
  if (bands.length === 0) return null;

  const thisYear = new Date().getUTCFullYear();

  // Rows are the years the data actually turns on, newest first, with "Now"
  // above them — the design skips years where nothing starts or ends.
  const years = [
    ...new Set(
      bands.flatMap((band) => [
        year(band.started_on),
        band.ended_on ? year(band.ended_on) : thisYear,
      ])
    ),
  ].sort((a, b) => b - a);
  const rows = ["Now", ...years.map(String)];
  const rowOf = (value: number) => rows.indexOf(String(value));

  const unplaced = bands
    .map((band, index) => {
      const startYear = year(band.started_on);
      const endYear = band.ended_on ? year(band.ended_on) : null;
      const ongoing = endYear === null;
      return {
        key: `${band.org_name}-${band.started_on}-${index}`,
        title: band.title || band.role || band.org_name,
        subtitle: band.title || band.role ? band.org_name : "",
        range: ongoing ? `${startYear} — present` : `${startYear} — ${endYear}`,
        status: ongoing ? "Ongoing" : "Completed",
        ongoing,
        verified: band.verified,
        milestones: band.milestones.length,
        category: categoryOf(band),
        // Ongoing records reach the "Now" row; finished ones stop at the row
        // of the year they ended.
        topRow: ongoing ? 0 : Math.max(rowOf(endYear), 0),
        bottomRow: Math.max(rowOf(startYear), 0),
      };
    })
    .sort((a, b) => a.topRow - b.topRow || b.bottomRow - b.topRow - (a.bottomRow - a.topRow));

  // Greedy interval packing: reuse a column whenever the row ranges are clear.
  const columns: { top: number; bottom: number }[][] = [];
  const branches: Branch[] = unplaced.map((branch) => {
    let column = columns.findIndex((taken) =>
      taken.every((span) => branch.bottomRow < span.top || branch.topRow > span.bottom)
    );
    if (column === -1) {
      columns.push([]);
      column = columns.length - 1;
    }
    columns[column].push({ top: branch.topRow, bottom: branch.bottomRow });
    return { ...branch, column: column + 2 };
  });

  const columnCount = columns.length;
  const usedCategories = CATEGORY_ORDER.filter((category) =>
    branches.some((branch) => branch.category === category)
  );
  const minWidth = YEAR_COLUMN + columnCount * MIN_BRANCH_WIDTH + (columnCount + 1) * GAP;

  return (
    <section className="border-t border-zinc-100 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className={profileSectionHeadingClass}>Timeline tree</h2>
          <p className="mt-2 text-lg font-extrabold tracking-tight text-zinc-900">
            The shape of this record.
          </p>
        </div>
        <p className="max-w-[300px] text-xs leading-5 text-zinc-500">
          One column per activity. Its height shows how long it lived across the years.
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-bold">
        {usedCategories.map((category) => (
          <span key={category} className={`flex items-center gap-1.5 ${CATEGORIES[category].accent}`}>
            <span className={`size-2 rounded-full ${CATEGORIES[category].dot}`} aria-hidden />
            {CATEGORIES[category].label}
          </span>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto pb-3">
        <div
          className="grid gap-2"
          style={{
            minWidth: `${minWidth}px`,
            gridTemplateColumns: `${YEAR_COLUMN}px repeat(${columnCount}, minmax(${MIN_BRANCH_WIDTH}px, 1fr))`,
            gridTemplateRows: `repeat(${rows.length}, ${ROW_HEIGHT}px)`,
          }}
        >
          {rows.map((label, index) => (
            <div
              key={label}
              className="col-start-1 flex items-start justify-end border-t border-zinc-100 pr-2 pt-2"
              style={{ gridRow: index + 1 }}
            >
              <span
                className={`text-xs font-extrabold tabular-nums ${
                  index === 0 ? "text-amber-700" : "text-zinc-400"
                }`}
              >
                {label}
              </span>
            </div>
          ))}

          {rows.map((label, index) => (
            <div
              key={`guide-${label}`}
              aria-hidden
              className="pointer-events-none border-t border-zinc-100"
              style={{ gridRow: index + 1, gridColumn: `2 / ${columnCount + 2}` }}
            />
          ))}

          {branches.map((branch) => {
            const tone = CATEGORIES[branch.category];
            return (
              <article
                key={branch.key}
                className={`relative z-10 flex min-w-0 flex-col justify-between rounded-xl border border-zinc-200 border-l-[3px] bg-white p-3 shadow-sm ${tone.bar}`}
                style={{
                  gridColumn: branch.column,
                  gridRow: `${branch.topRow + 1} / ${branch.bottomRow + 2}`,
                }}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <p
                      className={`text-[9px] font-black uppercase tracking-[0.13em] ${tone.accent}`}
                    >
                      {tone.label}
                      {branch.verified && <span className="ml-1 text-emerald-600">✓</span>}
                    </p>
                    <span
                      className={`text-[9px] font-black uppercase tracking-[0.1em] ${
                        branch.ongoing ? tone.accent : "text-zinc-400"
                      }`}
                    >
                      {branch.status}
                    </span>
                  </div>
                  <h3 className="mt-2 text-xs font-bold leading-5 text-zinc-900">{branch.title}</h3>
                  {branch.subtitle && (
                    <p className="mt-1 truncate text-[10px] font-semibold text-zinc-500">
                      {branch.subtitle}
                    </p>
                  )}
                </div>
                <p className="mt-2 border-t border-zinc-100 pt-2 text-[9px] font-black uppercase tracking-[0.1em] tabular-nums text-zinc-400">
                  {branch.range}
                  {branch.milestones > 0 && (
                    <span className="ml-1.5 text-amber-700">
                      · {branch.milestones} milestone{branch.milestones === 1 ? "" : "s"}
                    </span>
                  )}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
