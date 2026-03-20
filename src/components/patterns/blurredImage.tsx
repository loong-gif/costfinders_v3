import { Lock, Tag } from '@phosphor-icons/react/dist/ssr'
import Image from 'next/image'

interface BlurredImageProps {
  src: string | null | undefined
  alt: string
  fill?: boolean
  sizes?: string
  className?: string
  priority?: boolean
}

export function BlurredImage({
  src,
  alt,
  fill = true,
  sizes,
  className = '',
  priority = false,
}: BlurredImageProps) {
  return (
    <div className={`relative w-full h-full overflow-hidden ${className}`}>
      {/* Blurred Image or Placeholder */}
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill={fill}
          sizes={sizes}
          priority={priority}
          loading={priority ? 'eager' : 'lazy'}
          className="object-cover blur-xl scale-110"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-[#faf5ee]">
          <Tag size={48} weight="light" className="text-[#92400e] blur-sm" />
        </div>
      )}

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-[#e8ddd0]/60" />

      {/* Lock Icon + Message */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <div className="w-16 h-16 rounded-full bg-[#f2ebe2] border border-[#d4c4b0] flex items-center justify-center">
          <Lock size={32} weight="light" className="text-[#78350f]" />
        </div>
        <span className="text-xs text-[#92400e] font-medium">
          Unlock with account
        </span>
      </div>
    </div>
  )
}
