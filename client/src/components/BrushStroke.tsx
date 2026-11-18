// Сужающийся мазок кисти с рваным краем; рисуется слева направо один раз при загрузке
export default function BrushStroke() {
  return (
    <svg className="brush-stroke" viewBox="0 0 1200 14" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="brush-rough" x="0" y="-50%" width="100%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04 0.9" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
      </defs>
      <path
        filter="url(#brush-rough)"
        fill="currentColor"
        d="M2 6.5C60 2.5 180 3 420 4.2S900 5.4 1196 6.2c2 .3 2 1.1 0 1.4C900 8.6 640 9.2 400 10.4S90 12.8 6 11.6C0 10.8-1 7.3 2 6.5Z"
      />
    </svg>
  )
}
