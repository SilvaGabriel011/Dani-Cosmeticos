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
  PanelLeftClose,
  PanelLeftOpen,
  MoreHorizontal,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

import { cn } from '@/lib/utils'
import { ThemeToggle } from './theme-toggle'

const navItems = [
  { href: '/dashboard', label: 'Inicio', icon: LayoutDashboard },
  { href: '/estoque', label: 'Estoque', icon: Package },
  { href: '/vendas', label: 'Vendas', icon: ShoppingCart },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/clientes/devedores', label: 'Devedores', icon: UserX },
  { href: '/relatorios', label: 'Relatorios', icon: BarChart3 },
  { href: '/configuracoes', label: 'Configuracoes', icon: Settings },
]

const mobileMainItems = navItems.slice(0, 4)
const mobileMoreItems = navItems.slice(4)

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setMoreOpen(false)
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

  const isMoreActive = mobileMoreItems.some((item) => pathname.startsWith(item.href))

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
        <div className={cn('border-t', collapsed ? 'p-2' : 'p-3')}>
          <ThemeToggle collapsed={collapsed} />
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden flex items-center justify-center border-b bg-card px-4 h-12 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold">Dani Cosméticos</span>
        </div>
      </header>

      {/* Mobile "More" menu overlay */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col">
          <div
            className="flex-1 bg-black/50"
            onClick={() => setMoreOpen(false)}
          />
          <div className="bg-card border-t rounded-t-2xl p-4 pb-24 space-y-1 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-muted-foreground">Mais opcoes</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="rounded-full p-1.5 hover:bg-accent transition-colors"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            {mobileMoreItems.map((item) => {
              const isActive = pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-foreground hover:bg-accent'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              )
            })}
            <div className="pt-2 border-t mt-2">
              <ThemeToggle collapsed={false} />
            </div>
          </div>
        </div>
      )}

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t">
        <div className="flex items-stretch justify-around h-16 pb-[env(safe-area-inset-bottom)]">
          {mobileMainItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors min-w-0',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground active:text-foreground'
                )}
              >
                <div className={cn(
                  'flex items-center justify-center w-10 h-7 rounded-full transition-colors',
                  isActive && 'bg-primary/15'
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
          <button
            onClick={() => setMoreOpen(!moreOpen)}
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors min-w-0',
              isMoreActive
                ? 'text-primary'
                : 'text-muted-foreground active:text-foreground'
            )}
          >
            <div className={cn(
              'flex items-center justify-center w-10 h-7 rounded-full transition-colors',
              isMoreActive && 'bg-primary/15'
            )}>
              <MoreHorizontal className="h-5 w-5" />
            </div>
            <span>Mais</span>
          </button>
        </div>
      </nav>
    </>
  )
}
