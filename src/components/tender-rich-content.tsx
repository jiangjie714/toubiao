import type { TenderContentBlock } from "@/lib/tender-sections";

function ContentBlock({ block }: { block: TenderContentBlock }) {
  if (block.type === "paragraph") {
    if (!block.text) return null;
    return (
      <div className="max-w-[75ch] whitespace-pre-wrap break-words text-[15px] leading-8 text-slate-700">
        {block.text}
      </div>
    );
  }

  if (block.type === "link") {
    return (
      <a
        href={block.href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-accent transition-colors duration-150 hover:border-accent hover:bg-blue-50 hover:text-primary"
      >
        <span className="truncate">{block.label}</span>
        <span className="shrink-0 text-xs text-slate-400">打开</span>
      </a>
    );
  }

  if (block.rows.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full border-collapse text-sm">
        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="even:bg-slate-50/70">
              {row.map((cell, cellIndex) => {
                const Cell = cell.header ? "th" : "td";
                return (
                  <Cell
                    key={cellIndex}
                    colSpan={cell.colSpan}
                    rowSpan={cell.rowSpan}
                    className="border border-slate-200 px-3 py-2 text-left align-top text-slate-700"
                  >
                    {cell.text}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TenderRichContent({ blocks }: { blocks: TenderContentBlock[] }) {
  if (blocks.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => (
        <ContentBlock key={`${block.type}-${index}`} block={block} />
      ))}
    </div>
  );
}
