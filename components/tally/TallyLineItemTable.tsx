'use client';

import type { ReactNode } from 'react';

export type ColumnDef = {
  key: string;
  label: string;
  className?: string;
  align?: 'left' | 'right';
};

export type TallyLineItemTableProps = {
  columns: ColumnDef[];
  rowCount: number;
  getCell: (row: number, colKey: string) => ReactNode;
  focusedCell: { row: number; col: string } | null;
  onCellFocus: (row: number, col: string) => void;
};

export function TallyLineItemTable({
  columns,
  rowCount,
  getCell,
  focusedCell,
  onCellFocus,
}: TallyLineItemTableProps) {
  return (
    <table className="w-full border-collapse text-[13px]" style={{ border: '1px solid #AAAAAA' }}>
      <thead>
        <tr className="bg-[#F0F0F0]">
          <th className="border border-[#AAAAAA] px-1 py-[2px] text-left font-semibold text-[#1B5E20]">
            No
          </th>
          {columns.map((c) => (
            <th
              key={c.key}
              className={`border border-[#AAAAAA] px-1 py-[2px] font-semibold text-[#1B5E20] ${
                c.align === 'right' ? 'text-right' : 'text-left'
              } ${c.className ?? ''}`}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rowCount }, (_, row) => (
          <tr key={row}>
            <td className="border border-[#AAAAAA] px-1 py-0 text-right tabular-nums text-[#1B5E20]">
              {row + 1}
            </td>
            {columns.map((c) => {
              const focused = focusedCell?.row === row && focusedCell.col === c.key;
              return (
                <td
                  key={c.key}
                  className={`border border-[#AAAAAA] p-0 ${c.align === 'right' ? 'text-right' : ''}`}
                  style={focused ? { background: '#FFEB3B' } : undefined}
                  onFocusCapture={() => onCellFocus(row, c.key)}
                  onClick={() => onCellFocus(row, c.key)}
                >
                  {getCell(row, c.key)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
