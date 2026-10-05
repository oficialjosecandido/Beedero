const COLUMNS: { name: string; items: { name: string; sector: string; record: string }[] }[] = [
  {
    name: "Watching",
    items: [
      { name: "Noma Energy", sector: "Climate infrastructure", record: "91" },
      { name: "Lagoa", sector: "B2B software", record: "82" },
    ],
  },
  {
    name: "Reviewing",
    items: [{ name: "Soma Health", sector: "B2B software", record: "82" }],
  },
  {
    name: "Meeting",
    items: [
      { name: "Cork AI", sector: "Climate infrastructure", record: "91" },
      { name: "Pollen Analytics", sector: "B2B software", record: "82" },
    ],
  },
  {
    name: "Diligence",
    items: [{ name: "Rooted", sector: "B2B software", record: "82" }],
  },
];

export default function PipelinePage() {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-beedero-yellow">
        Private investor workspace
      </p>
      <div className="mb-8 mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl font-black tracking-[-0.045em]">Pipeline.</h1>
        <button
          type="button"
          className="bg-beedero-yellow px-4 py-2.5 text-xs font-black text-beedero-black"
          disabled
        >
          + Add company
        </button>
      </div>
      <div className="overflow-x-auto pb-4">
        <div className="grid min-w-[860px] grid-cols-4 gap-3">
          {COLUMNS.map((col) => (
            <section key={col.name}>
              <div className="mb-3 flex justify-between text-[10px] font-black uppercase tracking-[0.15em] text-white/35">
                <span>{col.name}</span>
                <span>{col.items.length}</span>
              </div>
              <div className="min-h-[400px] border border-white/10 bg-white/[0.02] p-3">
                {col.items.map((item) => (
                  <article key={item.name} className="mb-3 border border-white/10 bg-white/[0.03] p-4">
                    <b className="text-sm">{item.name}</b>
                    <p className="mt-3 text-xs text-white/40">{item.sector}</p>
                    <p className="mt-2 font-mono text-[10px] font-black text-beedero-yellow">
                      RECORD {item.record}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
      <p className="mt-5 text-xs text-white/35">
        This workspace is private. Founders never see pipeline status.
      </p>
    </div>
  );
}
