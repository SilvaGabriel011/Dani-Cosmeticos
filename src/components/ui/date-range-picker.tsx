'use client'

import { CalendarIcon, X } from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export interface DateRange {
  from?: Date
  to?: Date
}

interface DateRangePickerProps {
  dateRange?: DateRange
  onSelect?: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
}

export function DateRangePicker({ dateRange, onSelect, placeholder = 'Selecionar período', className }: DateRangePickerProps) {
  const [tempRange, setTempRange] = useState<DateRange | undefined>(dateRange)
  const [open, setOpen] = useState(false)

  const handleSelect = (date: Date) => {
    if (!tempRange?.from || (tempRange.from && tempRange.to)) {
      setTempRange({ from: date, to: undefined })
    } else {
      if (date < tempRange.from) {
        setTempRange({ from: date, to: tempRange.from })
      } else {
        setTempRange({ from: tempRange.from, to: date })
      }
    }
  }

  const handleApply = () => {
    if (tempRange?.from && tempRange?.to) {
      onSelect?.(tempRange)
      setOpen(false)
    }
  }

  const handleClear = () => {
    setTempRange(undefined)
    onSelect?.(undefined)
    setOpen(false)
  }

  const displayText = dateRange?.from && dateRange?.to
    ? `${format(dateRange.from, 'dd/MM/yyyy')} - ${format(dateRange.to, 'dd/MM/yyyy')}`
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full sm:w-56 justify-start text-left font-normal h-11 text-base',
            !dateRange && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 border-b">
          <p className="text-sm font-medium mb-1">Selecionar Período</p>
          <p className="text-xs text-muted-foreground">
            {tempRange?.from && !tempRange?.to && 'Selecione a data final'}
            {tempRange?.from && tempRange?.to && `${format(tempRange.from, 'dd/MM/yyyy')} - ${format(tempRange.to, 'dd/MM/yyyy')}`}
            {!tempRange?.from && 'Selecione a data inicial'}
          </p>
        </div>
        <Calendar
          selected={tempRange?.from}
          onSelect={handleSelect}
        />
        <div className="flex gap-2 p-3 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleClear}
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleApply}
            disabled={!tempRange?.from || !tempRange?.to}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
