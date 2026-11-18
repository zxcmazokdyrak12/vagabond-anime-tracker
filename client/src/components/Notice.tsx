import type { ReactNode } from 'react'

interface Props {
  title: string
  children?: ReactNode
  /** Кнопка или ссылка: что сделать дальше */
  action?: ReactNode
  tone?: 'neutral' | 'error'
}

// Сообщение об ошибке или пустом состоянии: что случилось и что делать дальше
export default function Notice({ title, children, action, tone = 'neutral' }: Props) {
  return (
    <div className={`notice ${tone === 'error' ? 'notice--error' : ''}`} role={tone === 'error' ? 'alert' : undefined}>
      <p className="notice__title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}
