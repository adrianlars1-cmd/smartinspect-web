/**
 * SmartInspect AI brand mark.
 * Uses the official PNG asset from /public/logo.png.
 *
 * A radial-gradient mask feathers the edges of the PNG so the
 * dark navy background of the image blends seamlessly into the page.
 */
export default function Logo({ size = 96, className = '' }) {
  const fadeMask =
    'radial-gradient(circle at center, #000 55%, rgba(0,0,0,0.6) 70%, transparent 92%)'

  return (
    <img
      src="/logo.png"
      alt="SmartInspect AI"
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        WebkitMaskImage: fadeMask,
        maskImage: fadeMask,
      }}
    />
  )
}

/**
 * Logo + wordmark inline. Use in headers / login screens.
 */
export function LogoLockup({ size = 64, textColor = 'white' }) {
  return (
    <div className="flex items-center gap-3">
      <Logo size={size} />
      <span
        className="font-semibold tracking-tight"
        style={{
          color: textColor,
          fontSize: size * 0.45,
          letterSpacing: '-0.01em',
        }}
      >
        SmartInspect AI
      </span>
    </div>
  )
}
