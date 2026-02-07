'use client'

import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  UserX,
  BarChart3,
  Settings,
  Sparkles,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/estoque', label: 'Estoque', icon: Package },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/clientes/devedores', label: 'Devedores', icon: UserX },
  { href: '/relatorios', label: 'Relatorios', icon: BarChart3 },
  { href: '/configuracoes', label: 'Configuracoes', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  // Close mobile nav on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Detect screen size and auto-collapse on tablet-sized screens
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1279px)')
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setCollapsed(true)
    }
    handleChange(mq)
    mq.addEventListener('change', handleChange)
    return () => mq.removeEventListener('change', handleChange)
  }, [])

  return (
    <>
      {/* Desktop/Tablet sidebar — hidden below md */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r bg-card shrink-0 transition-all duration-200',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        <div className={cn('flex h-14 items-center border-b', collapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          <div className={cn('flex items-center gap-2', collapsed && 'justify-center')}>
            <Sparkles className="h-6 w-6 text-primary shrink-0" />
            {!collapsed && <span className="text-base font-semibold">Dani Cosméticos</span>}
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent transition-colors"
            aria-label={collapsed ? 'Expandir menu' : 'Minimizar menu'}
            title={collapsed ? 'Expandir menu' : 'Minimizar menu'}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
          </button>
        </div>
        <nav className={cn('flex-1 space-y-1', collapsed ? 'p-2' : 'p-3')}>
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center rounded-lg font-medium transition-colors',
                  collapsed
                    ? 'justify-center p-2.5'
                    : 'gap-3 px-3 py-2 text-sm',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className={cn(collapsed ? 'h-5 w-5' : 'h-5 w-5')} />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>
      </aside>

      {/* Mobile top bar — visible below md */}
      <header className="md:hidden flex items-center justify-between border-b bg-card px-4 h-14 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <span className="text-base font-semibold">Dani Cosméticos</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent transition-colors"
          aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {/* Mobile dropdown nav */}
      {mobileOpen && (
        <nav className="md:hidden flex items-center gap-1 overflow-x-auto border-b bg-card px-3 py-2 shrink-0">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors shrink-0',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </>
  )
}
