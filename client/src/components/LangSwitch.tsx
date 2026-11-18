import { LANGS, getLang, setLang, useT } from '../lib/i18n'

/** EN / RU / 日本 — переключатель языка интерфейса */
export default function LangSwitch() {
  const t = useT()
  const current = getLang()
  return (
    <div className="lang-switch" role="group" aria-label={t('Language')}>
      {LANGS.map((l) => (
        <button
          key={l.id}
          type="button"
          lang={l.id}
          aria-pressed={current === l.id}
          aria-label={l.label}
          title={l.label}
          onClick={() => setLang(l.id)}
        >
          {l.short}
        </button>
      ))}
    </div>
  )
}
