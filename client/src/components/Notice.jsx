// Сообщение об ошибке или пустом состоянии: что случилось и что делать дальше
export default function Notice({ title, children, action, tone = 'neutral' }) {
  return (
    <div className={`notice ${tone === 'error' ? 'notice--error' : ''}`} role={tone === 'error' ? 'alert' : undefined}>
      <p className="notice__title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}
