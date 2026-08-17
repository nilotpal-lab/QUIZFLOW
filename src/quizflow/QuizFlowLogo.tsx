/* ================================================================
   QuizFlow — Brand Logo
   Renders the QuizFlow brand logo (public/logo.png).
   ================================================================ */

export default function QuizFlowLogo({
  size = 28,
  className = '',
  alt = 'QuizFlow'
}: {
  size?: number
  className?: string
  alt?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      className={`inline-block shrink-0 select-none object-contain ${className}`}
    />
  )
}

