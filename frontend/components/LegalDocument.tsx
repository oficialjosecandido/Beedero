import Link from "next/link";

/**
 * Minimal markdown renderer for the two static legal pages. Handles just the
 * subset the legal drafts actually use (headings, blockquotes, tables, lists,
 * hr, bold/code/placeholder inline spans) — not a general-purpose parser.
 */

function inlineNodes(text: string, keyPrefix: string): React.ReactNode[] {
  const pattern = /\*\*(.+?)\*\*|`([^`]+)`|\[LEGAL REVIEW:([^\]]*)\]|\{([^}]+)\}/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const key = `${keyPrefix}-${i++}`;
    if (match[1] !== undefined) {
      nodes.push(
        <strong key={key} className="font-bold text-beedero-black">
          {match[1]}
        </strong>,
      );
    } else if (match[2] !== undefined) {
      nodes.push(
        <code key={key} className="rounded bg-beedero-black/5 px-1 py-0.5 text-[0.85em]">
          {match[2]}
        </code>,
      );
    } else if (match[3] !== undefined) {
      nodes.push(
        <span
          key={key}
          className="rounded bg-amber-200/70 px-1 py-0.5 text-[0.9em] font-semibold text-amber-900"
        >
          [LEGAL REVIEW:{match[3]}]
        </span>,
      );
    } else if (match[4] !== undefined) {
      nodes.push(
        <span
          key={key}
          className="rounded border border-dashed border-beedero-border px-1 text-[0.9em] text-beedero-black/60"
        >
          {"{" + match[4] + "}"}
        </span>,
      );
    }
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function renderTable(block: string, key: string) {
  const rows = block.split("\n").filter((line) => line.trim().startsWith("|"));
  const [headerRow, , ...bodyRows] = rows;
  const headers = headerRow
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());

  return (
    <div key={key} className="my-4 overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-beedero-border">
            {headers.map((h, idx) => (
              <th key={idx} className="px-3 py-2 font-black uppercase tracking-[-0.01em]">
                {inlineNodes(h, `${key}-h-${idx}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bodyRows.map((row, rIdx) => {
            const cells = row
              .split("|")
              .slice(1, -1)
              .map((cell) => cell.trim());
            return (
              <tr key={rIdx} className="border-b border-beedero-border">
                {cells.map((cell, cIdx) => (
                  <td key={cIdx} className="px-3 py-2 align-top text-beedero-black/75">
                    {inlineNodes(cell, `${key}-r${rIdx}-c${cIdx}`)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderBlock(block: string, key: string): React.ReactNode {
  const trimmed = block.trim();

  if (trimmed === "---") {
    return <hr key={key} className="my-8 border-beedero-border" />;
  }

  if (trimmed.startsWith("> ")) {
    const text = trimmed
      .split("\n")
      .map((line) => line.replace(/^>\s?/, ""))
      .join(" ");
    return (
      <blockquote
        key={key}
        className="my-6 rounded-2xl border border-amber-300 bg-warning-surface px-5 py-4 text-sm font-medium leading-6 text-amber-900"
      >
        {inlineNodes(text, key)}
      </blockquote>
    );
  }

  if (trimmed.startsWith("|")) {
    return renderTable(trimmed, key);
  }

  if (/^#{1,3}\s/.test(trimmed)) {
    const level = trimmed.match(/^#+/)?.[0].length ?? 1;
    const text = trimmed.replace(/^#{1,3}\s/, "");
    if (level === 1) {
      return (
        <h1 key={key} className="mt-2 text-4xl font-black uppercase tracking-[-0.05em]">
          {inlineNodes(text, key)}
        </h1>
      );
    }
    if (level === 2) {
      return (
        <h2 key={key} className="mt-10 text-2xl font-black tracking-[-0.03em]">
          {inlineNodes(text, key)}
        </h2>
      );
    }
    return (
      <h3 key={key} className="mt-6 text-lg font-black tracking-[-0.02em]">
        {inlineNodes(text, key)}
      </h3>
    );
  }

  if (/^-\s/.test(trimmed)) {
    const items = trimmed.split("\n").map((line) => line.replace(/^-\s/, ""));
    return (
      <ul key={key} className="my-3 flex list-disc flex-col gap-2 pl-5">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm font-medium leading-6 text-beedero-black/75">
            {inlineNodes(item, `${key}-${idx}`)}
          </li>
        ))}
      </ul>
    );
  }

  if (/^\d+\.\s/.test(trimmed)) {
    const items = trimmed.split("\n").map((line) => line.replace(/^\d+\.\s/, ""));
    return (
      <ol key={key} className="my-3 flex list-decimal flex-col gap-2 pl-5">
        {items.map((item, idx) => (
          <li key={idx} className="text-sm font-medium leading-6 text-beedero-black/75">
            {inlineNodes(item, `${key}-${idx}`)}
          </li>
        ))}
      </ol>
    );
  }

  return (
    <p key={key} className="my-3 text-sm font-medium leading-6 text-beedero-black/75">
      {inlineNodes(trimmed, key)}
    </p>
  );
}

export function renderLegalMarkdown(source: string): React.ReactNode[] {
  const blocks = source.trim().split(/\n\n+/);
  return blocks.map((block, idx) => renderBlock(block, `b-${idx}`));
}

export function LegalDocument({
  content,
  draft = false,
}: {
  title: string;
  content: string;
  draft?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col bg-beedero-white text-beedero-black">
      <nav className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" className="text-lg font-black uppercase tracking-[-0.04em]">
          Beedero
        </Link>
        <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-1 text-sm font-semibold uppercase tracking-[-0.02em] text-beedero-black/60">
          <Link href="/privacy" className="hover:text-beedero-black">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-beedero-black">
            Terms
          </Link>
        </div>
      </nav>
      <div className="mx-auto w-full max-w-3xl flex-1 px-5 pb-12 sm:px-8">
        {draft && (
          <div className="rounded-2xl border border-amber-300 bg-warning-surface px-5 py-4 text-sm font-semibold text-amber-900">
            Draft pending legal review.
          </div>
        )}
        <article>{renderLegalMarkdown(content)}</article>
      </div>
    </div>
  );
}
