"use client"

import { useState, useEffect } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Toggle } from "@/components/ui/toggle"
import { useDebounce } from "@/hooks/use-debounce"
import { cn } from "@/lib/utils"

type FilterType = "search" | "select" | "toggle"

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
  values: Record<string, string>
  onChange: (name: string, value: string) => void
  onReset?: () => void
  className?: string
}

export function FilterBar({
  filters,
  values,
  onChange,
  onReset,
  className,
}: FilterBarProps) {
  const hasValues = Object.values(values).some((v) => v !== "")

  return (
    <div className={cn("flex flex-wrap items-center gap-2 mb-4", className)}>
      {filters.map((filter) => (
        <FilterItem
          key={filter.name}
          config={filter}
          value={values[filter.name] || ""}
          onChange={(v) => onChange(filter.name, v)}
        />
      ))}
      {onReset && hasValues && (
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="h-4 w-4 mr-1" /> Limpar
        </Button>
      )}
    </div>
  )
}

interface FilterItemProps {
  config: FilterConfig
  value: string
  onChange: (value: string) => void
}

function FilterItem({ config, value, onChange }: FilterItemProps) {
  switch (config.type) {
    case "search":
      return <SearchFilter config={config} value={value} onChange={onChange} />
    case "select":
      return <SelectFilter config={config} value={value} onChange={onChange} />
    case "toggle":
      return <ToggleFilter config={config} value={value} onChange={onChange} />
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
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={config.placeholder || "Buscar..."}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        className="pl-8 w-48"
      />
    </div>
  )
}

function SelectFilter({ config, value, onChange }: FilterItemProps) {
  const handleChange = (newValue: string) => {
    if (newValue === "__create__" && config.onCreateNew) {
      config.onCreateNew()
      return
    }
    onChange(newValue === "__all__" ? "" : newValue)
  }

  return (
    <Select value={value || "__all__"} onValueChange={handleChange}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder={config.label || "Selecione"} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">
          {config.label ? `Todos (${config.label})` : "Todos"}
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

export type { FilterConfig, FilterOption, FilterBarProps }
