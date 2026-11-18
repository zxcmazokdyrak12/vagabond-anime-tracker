import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import axios from 'axios'
import { importList } from '../api'
import { plural } from '../lib/status'
import type { ImportResult } from '../types'

/** Выгрузка MAL приходит как .xml.gz — распаковываем прямо в браузере */
async function readExport(file: File): Promise<string> {
  if (file.name.endsWith('.gz') && 'DecompressionStream' in window) {
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(stream).text()
  }
  return file.text()
}

export function ImportButton({ onImported }: { onImported: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(true)}>
        Import from MyAnimeList or Shikimori
      </button>
      {open && <ImportDialog onClose={() => setOpen(false)} onImported={onImported} />}
    </>
  )
}

export default function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [overwrite, setOverwrite] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const res = await importList(await readExport(file), overwrite)
      setResult(res.data)
      onImported()
    } catch (err) {
      setError(
        (axios.isAxiosError(err) && (err.response?.data as { error?: string })?.error) ||
          'The file could not be imported. Check that it is a MyAnimeList or Shikimori export.'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog__head">
          <h2 id="import-title" className="section-head" style={{ marginBottom: 0 }}>
            <span className="brush" aria-hidden="true">移</span>
            Import your list
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <ol className="import-steps">
          <li>
            <strong>MyAnimeList:</strong> open{' '}
            <a href="https://myanimelist.net/panel.php?go=export" target="_blank" rel="noreferrer">
              Export lists
            </a>
            , choose Anime and download the file (.xml.gz is fine).
          </li>
          <li>
            <strong>Shikimori:</strong> in your profile settings, open Account, then export your anime list as XML or
            JSON.
          </li>
        </ol>

        <label className="check">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          Replace progress for titles already in my scrolls
        </label>

        <input
          ref={fileRef}
          type="file"
          accept=".xml,.gz,.json,application/xml,text/xml,application/json,application/gzip"
          className="visually-hidden"
          onChange={onFile}
          aria-label="Export file"
        />
        <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? 'Importing…' : 'Choose the export file'}
        </button>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <p className="import-result" role="status">
            Added {plural(result.added, 'title')}
            {result.updated > 0 && `, updated ${result.updated}`}
            {result.skipped > 0 && `, kept ${result.skipped} you already had`}.
          </p>
        )}
      </div>
    </div>
  )
}
