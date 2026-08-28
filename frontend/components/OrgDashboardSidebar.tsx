import { EventsCalendar } from "@/components/EventsCalendar";

type CalendarEvent = {
  id: number | string;
  title: string;
  occurred_at: string;
  ends_at?: string | null;
};

const COMING_SOON = [
  { label: "Investor insights", description: "Who viewed and engaged" },
  { label: "Tasks", description: "Team to-dos and follow-ups" },
  { label: "Documents", description: "Shared files and data room" },
];

export function OrgDashboardSidebar({ events }: { events: CalendarEvent[] }) {
  return (
    <aside className="flex flex-col gap-4">
      <div className="rounded-3xl border-2 border-beedero-border bg-beedero-white p-5 shadow-sm">
        <EventsCalendar events={events} embedded />

        <div className="mt-5 border-t border-dashed border-beedero-border pt-5">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-subtle">Coming soon</p>
          <ul className="mt-3 flex flex-col gap-1">
            {COMING_SOON.map((item) => (
              <li
                key={item.label}
                className="flex items-start justify-between gap-2 rounded-xl px-2 py-2 text-subtle"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-500">{item.label}</p>
                  <p className="text-xs text-subtle">{item.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">
                  Soon
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  );
}
