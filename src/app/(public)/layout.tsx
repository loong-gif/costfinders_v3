import { PublicHeader } from '@/components/layout/publicHeader'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <PublicHeader />
      {children}
    </>
  )
}
