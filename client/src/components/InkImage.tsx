// Картинка, «отпечатанная» тушью: ч/б и впитана в бумагу, цвет проступает при наведении
interface Props {
  src?: string | null
  alt?: string
  className?: string
  /** Сразу в цвете, без «печати тушью» */
  live?: boolean
  /** Для первого экрана: грузить без lazy */
  eager?: boolean
}

export default function InkImage({ src, alt = '', className = '', live = false, eager = false }: Props) {
  return (
    <span className={`ink-frame ${live ? 'ink-frame--live' : ''} ${className}`}>
      {src && <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />}
    </span>
  )
}
