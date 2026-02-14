import { Sidebar } from '@/components/layout/sidebar'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen flex-col md:flex-row">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-muted/30 p-4 pb-24 md:p-6 md:pb-6">{children}</main>
    </div>
  )
}
