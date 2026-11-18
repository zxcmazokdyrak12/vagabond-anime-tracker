import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import axios from 'axios'
import { importList } from '../api'
import { plural } from '../lib/status'
import type { ImportResult } from '../types'
import { useT } from '../lib/i18n'

/** Выгрузка MAL приходит как .xml.gz — распаковываем прямо в браузере */
async function readExport(file: File): Promise<string> {
  if (file.name.endsWith('.gz') && 'DecompressionStream' in window) {
    const stream = file.stream().pipeThrough(new DecompressionStream('gzip'))
    return new Response(stream).text()
  }
  return file.text()
}

export function ImportButton({ onImported }: { onImported: () => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(true)}>
        {t('Import from MyAnimeList or Shikimori')}
      </button>
      {open && <ImportDialog onClose={() => setOpen(false)} onImported={onImported} />}
    </>
  )
}

export default function ImportDialog({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const t = useT()
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
      const reason = axios.isAxiosError(err) ? (err.response?.data as { error?: string })?.error : undefined
      setError(
        reason ? t(reason) : t('The file could not be imported. Check that it is a MyAnimeList or Shikimori export.')
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
            {t('Import your list')}
          </h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('Close')}>
            ✕
          </button>
        </div>

        <ol className="import-steps">
          <li>
            <strong>MyAnimeList:</strong> {t('open')}{' '}
            <a href="https://myanimelist.net/panel.php?go=export" target="_blank" rel="noreferrer">
              Export lists
            </a>
            {t(', choose Anime and download the file (.xml.gz is fine).')}
          </li>
          <li>
            <strong>{t('Shikimori')}:</strong>{' '}
            {t('in your profile settings, open Account, then export your anime list as XML or JSON.')}
          </li>
        </ol>

        <label className="check">
          <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
          {t('Replace progress for titles already in my scrolls')}
        </label>

        <input
          ref={fileRef}
          type="file"
          accept=".xml,.gz,.json,application/xml,text/xml,application/json,application/gzip"
          className="visually-hidden"
          onChange={onFile}
          aria-label={t('Export file')}
        />
        <button type="button" className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? t('Importing…') : t('Choose the export file')}
        </button>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {result && (
          <p className="import-result" role="status">
            {t('Added {titles}', { titles: plural(result.added, 'title') })}
            {result.updated > 0 && t(', updated {n}', { n: result.updated })}
            {result.skipped > 0 && t(', kept {n} you already had', { n: result.skipped })}.
          </p>
        )}
      </div>
    </div>
  )
}
