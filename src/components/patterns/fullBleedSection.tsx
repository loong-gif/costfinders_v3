import Image from 'next/image'
import type { ReactNode } from 'react'

interface FullBleedSectionProps {
  children: ReactNode
  backgroundImage?: string
  overlay?: string
  backgroundColor?: string
  className?: string
  innerClassName?: string
  id?: string
}

export function FullBleedSection({
  children,
  backgroundImage,
  overlay,
  backgroundColor,
  className = '',
  innerClassName = '',
  id,
}: FullBleedSectionProps) {
  return (
    <section
      id={id}
      className={`relative w-full overflow-hidden ${backgroundColor ?? ''} ${className}`}
    >
      {backgroundImage && (
        <Image
          src={backgroundImage}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority={false}
        />
      )}
      {overlay && (
        <div className={`absolute inset-0 ${overlay}`} aria-hidden="true" />
      )}
      <div
        className={`relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${innerClassName}`}
      >
        {children}
      </div>
    </section>
  )
}
