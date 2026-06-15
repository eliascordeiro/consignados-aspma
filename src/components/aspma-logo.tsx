/**
 * AspmaLogo — logo circular vetorial da ASPMA.
 * Totalmente SVG, sem dependência de imagem ou fonte externa.
 * Funciona em qualquer tamanho e fundo.
 *
 * Variantes:
 *  - "default"  → círculo gradiente verde/teal com "A" branco  (ideal em fundos neutros ou escuros)
 *  - "inverted" → círculo branco com "A" verde                 (ideal sobre fundo verde sólido)
 */

interface AspmaLogoProps {
  size?: number
  className?: string
  variant?: 'default' | 'inverted'
}

export function AspmaLogo({ size = 40, className = '', variant = 'default' }: AspmaLogoProps) {
  if (variant === 'inverted') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        aria-label="ASPMA"
      >
        {/* Fundo branco */}
        <circle cx="20" cy="20" r="20" fill="white" />
        {/* Anel decorativo */}
        <circle cx="20" cy="20" r="16.5" stroke="#059669" strokeWidth="1" strokeOpacity="0.3" fill="none" />
        {/* Letra A em verde */}
        <path
          d="M12 28 L20 11 L28 28"
          stroke="#059669"
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <line x1="15" y1="21" x2="25" y2="21" stroke="#059669" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    )
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="ASPMA"
    >
      <defs>
        {/* Gradiente verde → teal, igual ao tema do sistema */}
        <linearGradient id="aspmaGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#0d9488" />
        </linearGradient>
      </defs>

      {/* Sombra sutil na borda */}
      <circle cx="20" cy="20" r="20" fill="rgba(0,0,0,0.12)" />

      {/* Círculo principal com gradiente */}
      <circle cx="20" cy="20" r="19" fill="url(#aspmaGrad)" />

      {/* Anel decorativo interno */}
      <circle cx="20" cy="20" r="15.5" stroke="rgba(255,255,255,0.25)" strokeWidth="1" fill="none" />

      {/* Letra A — desenhada como path vetorial (sem fonte) */}
      {/* Diagonais esquerda e direita */}
      <path
        d="M12 28 L20 11 L28 28"
        stroke="white"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Barra horizontal */}
      <line x1="15" y1="21" x2="25" y2="21" stroke="white" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  )
}
