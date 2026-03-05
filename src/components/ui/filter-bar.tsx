'use client'

import { Search, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { Button } from '@/components/ui/button'
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Toggle } from '@/components/ui/toggle'
import { useDebounce } from '@/hooks/use-debounce'
import { cn } from '@/lib/utils'

type FilterType = 'search' | 'select' | 'toggle' | 'dateRange' | 'monthSelect'

interface FilterOption {
  value: string
  label: string
}

interface FilterConfig {
  type: FilterType
  name: string
  label?: string
  placeholder?: string
  options?: FilterOption[]
  toggleOptions?: FilterOption[]
  allowCreate?: boolean
  onCreateNew?: () => void
}

interface FilterBarProps {
  filters: FilterConfig[]
  values: Record<string, any>
  onChange: (name: string, value: any) => void
  onReset?: () => void
  className?: string
}

export function FilterBar({ filters, values, onChange, onReset, className }: FilterBarProps) {
  const hasValues = Object.values(values).some((v) => {
    if (typeof v === 'string') return v !== ''
    if (typeof v === 'object' && v !== null) return Object.keys(v).length > 0
    return false
  })

  return (
    <div className={cn('flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 mb-4', className)}>
      {filters.map((filter) => (
        <FilterItem
          key={filter.name}
          config={filter}
          value={values[filter.name] || ''}
          onChange={(v) => onChange(filter.name, v)}
        />
      ))}
      {onReset && hasValues && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="h-5 w-5 mr-1" /> Limpar
        </Button>
      )}
    </div>
  )
}

interface FilterItemProps {
  config: FilterConfig
  value: any
  onChange: (value: any) => void
}

function FilterItem({ config, value, onChange }: FilterItemProps) {
  switch (config.type) {
    case 'search':
      return <SearchFilter config={config} value={value} onChange={onChange} />
    case 'select':
      return <SelectFilter config={config} value={value} onChange={onChange} />
    case 'toggle':
      return <ToggleFilter config={config} value={value} onChange={onChange} />
    case 'dateRange':
      return <DateRangeFilter config={config} value={value} onChange={onChange} />
    case 'monthSelect':
      return <MonthSelectFilter config={config} value={value} onChange={onChange} />
    default:
      return null
  }
}

function SearchFilter({ config, value, onChange }: FilterItemProps) {
  const [localValue, setLocalValue] = useState(value)
  const debouncedValue = useDebounce(localValue, 300)

  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue)
    }
  }, [debouncedValue, onChange, value])

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
      <Input
        placeholder={config.placeholder || 'Buscar...'}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-9 h-11 w-full sm:w-56 md:w-64 text-base"
      />
    </div>
  )
}

function SelectFilter({ config, value, onChange }: FilterItemProps) {
  const handleChange = (newValue: string) => {
    if (newValue === '__create__' && config.onCreateNew) {
      config.onCreateNew()
      return
    }
    onChange(newValue === '__all__' ? '' : newValue)
  }

  return (
    <Select value={value || '__all__'} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-44 h-11 text-base">
        <SelectValue placeholder={config.label || 'Selecione'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">
          {config.label ? `Todos (${config.label})` : 'Todos'}
        </SelectItem>
        {config.options?.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
        {config.allowCreate && (
          <SelectItem value="__create__" className="text-primary font-medium">
            + Criar novo
          </SelectItem>
        )}
      </SelectContent>
    </Select>
  )
}

function ToggleFilter({ config, value, onChange }: FilterItemProps) {
  return (
    <div className="flex gap-1">
      {config.toggleOptions?.map((opt) => (
        <Toggle
          key={opt.value}
          size="sm"
          pressed={value === opt.value}
          onPressedChange={(pressed) => {
            if (pressed) onChange(opt.value)
          }}
        >
          {opt.label}
        </Toggle>
      ))}
    </div>
  )
}

function DateRangeFilter({ config, value, onChange }: FilterItemProps) {
  const dateRange: DateRange | undefined = value?.startDate && value?.endDate
    ? {
        from: new Date(value.startDate),
        to: new Date(value.endDate),
      }
    : undefined

  const handleSelect = (range: DateRange | undefined) => {
    if (range?.from && range?.to) {
      onChange({
        startDate: format(range.from, 'yyyy-MM-dd'),
        endDate: format(range.to, 'yyyy-MM-dd'),
      })
    } else {
      onChange(null)
    }
  }

  return (
    <DateRangePicker
      dateRange={dateRange}
      onSelect={handleSelect}
      placeholder={config.placeholder || 'Período...'}
    />
  )
}

function MonthSelectFilter({ config, value, onChange }: FilterItemProps) {
  const months = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i)
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy', { locale: ptBR }),
    }
  })

  const handleChange = (monthValue: string) => {
    if (monthValue === '__all__') {
      onChange('')
      return
    }

    const [year, month] = monthValue.split('-').map(Number)
    const date = new Date(year, month - 1)
    const start = startOfMonth(date)
    const end = endOfMonth(date)

    onChange({
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      month: monthValue,
    })
  }

  return (
    <Select value={value?.month || '__all__'} onValueChange={handleChange}>
      <SelectTrigger className="w-full sm:w-44 h-11 text-base">
        <SelectValue placeholder={config.label || 'Mês'} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">Todos os meses</SelectItem>
        {months.map((month) => (
          <SelectItem key={month.value} value={month.value}>
            {month.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export type { FilterConfig, FilterOption, FilterBarProps }
