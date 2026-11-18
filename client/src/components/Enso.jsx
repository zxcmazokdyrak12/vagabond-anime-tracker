// Индикатор загрузки — энсо, круг одним движением кисти
export default function Enso({ label = 'Loading…' }) {
  return (
    <div className="enso" role="status">
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </div>
  )
}
