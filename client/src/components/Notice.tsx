import type { ReactNode } from 'react'
import InkArt, { type ArtName } from './InkArt'

interface Props {
  title: string
  children?: ReactNode
  /** Кнопка или ссылка: что сделать дальше */
  action?: ReactNode
  tone?: 'neutral' | 'error'
  /** Рисунок слева от текста */
  art?: ArtName
}

// Сообщение об ошибке или пустом состоянии: что случилось и что делать дальше
export default function Notice({ title, children, action, tone = 'neutral', art }: Props) {
  const body = (
    <>
      <p className="notice__title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </>
  )
  return (
    <div
      className={`notice ${tone === 'error' ? 'notice--error' : ''} ${art ? 'notice--art' : ''}`}
      role={tone === 'error' ? 'alert' : undefined}
    >
      {art ? (
        <>
          <InkArt name={art} className="notice__art" />
          <div>{body}</div>
        </>
      ) : (
        body
      )}
    </div>
  )
}
