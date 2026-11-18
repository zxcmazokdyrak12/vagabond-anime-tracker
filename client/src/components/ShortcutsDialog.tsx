import { useEffect, useRef } from 'react'

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Anywhere',
    keys: [
      ['/', 'Search anime'],
      ['?', 'Show or hide this list'],
      ['Esc', 'Close'],
    ],
  },
  {
    title: 'In My scrolls, on a focused row',
    keys: [
      ['j  k', 'Next or previous title'],
      ['+  −', 'Episode watched, or one fewer'],
      ['1  2  3  4', 'Watching, completed, planning, dropped'],
      ['Enter', 'Open dates and notes'],
    ],
  },
]

export default function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => previous?.focus()
  }, [])

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div className="dialog__head">
          <h2 id="shortcuts-title" className="section-head" style={{ marginBottom: 0 }}>
            <span className="brush" aria-hidden="true">鍵</span>
            Keyboard shortcuts
          </h2>
          <button ref={closeRef} type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="sub-head">{g.title}</h3>
            <dl className="info-list shortcuts">
              {g.keys.map(([k, what]) => (
                <div key={k}>
                  <dt>
                    {k.split('  ').map((part) => (
                      <kbd key={part}>{part}</kbd>
                    ))}
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}
