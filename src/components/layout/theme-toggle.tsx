'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

export function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted) return null

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className={cn(
        'flex items-center rounded-lg font-medium transition-colors text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2 text-sm'
      )}
      aria-label={`Mudar para modo ${resolvedTheme === 'dark' ? 'claro' : 'escuro'}`}
      title={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
      {!collapsed && (resolvedTheme === 'dark' ? 'Modo Claro' : 'Modo Escuro')}
    </button>
  )
}
