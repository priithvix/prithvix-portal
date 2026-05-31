'use client';

import { useTallyButtons } from '@/components/tally/TallyButtonBarContext';

export function TallyRightButtonBar() {
  const buttons = useTallyButtons();

  if (buttons.length === 0) {
    return (
      <aside
        className="tally-right-bar flex w-[130px] min-w-[130px] shrink-0 flex-col gap-0 border-l border-[#AAAAAA] p-0"
        style={{ background: '#F5F5F5' }}
      />
    );
  }

  return (
    <aside
      className="tally-right-bar flex w-[130px] min-w-[130px] shrink-0 flex-col gap-0 border-l border-[#AAAAAA] p-0"
      style={{ background: '#F5F5F5' }}
    >
      {buttons.map((b, i) => (
        <button
          key={`${b.shortcut}-${i}`}
          type="button"
          className="tally-button-bar-btn"
          onClick={() => b.onClick?.()}
        >
          <span className="tally-btn-shortcut tally-fkey-label">{b.shortcut}</span>
          <span className="tally-btn-colon tally-fkey-colon">: </span>
          <span className="tally-btn-label tally-fkey-description">{b.label}</span>
        </button>
      ))}
    </aside>
  );
}
