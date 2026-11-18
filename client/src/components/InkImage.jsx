// Картинка, «отпечатанная» тушью: ч/б и впитана в бумагу, цвет проступает при наведении
export default function InkImage({ src, alt = '', className = '', live = false, eager = false }) {
  return (
    <span className={`ink-frame ${live ? 'ink-frame--live' : ''} ${className}`}>
      {src && <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />}
    </span>
  )
}
