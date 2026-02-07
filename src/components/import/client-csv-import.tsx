'use client'

import { Upload, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useState, useCallback } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/components/ui/use-toast'
import { useImportClients } from '@/hooks/use-import'
import { formatCurrency } from '@/lib/utils'
import { type ClientImportRow } from '@/schemas/import'

interface ClientCSVImportProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ParsedRow extends ClientImportRow {
  hasWarning: boolean
  warningMessage?: string
}

function parseMoneyValue(value: string): number {
  if (!value || value.trim() === '') return 0
  const cleaned = value
    .replace(/R\$\s*/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function parsePaymentDay(value: string): number | undefined {
  if (!value || value.trim() === '') return undefined
  const match = value.match(/(\d+)/)
  if (match) {
    const day = parseInt(match[1], 10)
    if (day >= 1 && day <= 31) return day
  }
  return undefined
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',' || char === ';' || char === '\t') {
        fields.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  fields.push(current.trim())
  return fields
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])

    if (values.length < 4 || !values[0]) continue

    const nome = values[0]
    const telefone = values[1] || undefined
    const valorTotalCompra = parseMoneyValue(values[2])
    const pago = parseMoneyValue(values[3])
    const debitoAberto = valorTotalCompra - pago
    const valorParcelas = values[5] ? parseMoneyValue(values[5]) : undefined
    const numeroParcelas = values[6] ? parseInt(values[6], 10) || undefined : undefined
    const pagamentoDia = values[7] ? parsePaymentDay(values[7]) : undefined

    const hasWarning = !valorParcelas || !numeroParcelas || !pagamentoDia
    const warningMessage = hasWarning
      ? 'Dados incompletos: falta informação de parcelas ou dia de pagamento'
      : undefined

    rows.push({
      nome,
      telefone,
      debitoAberto,
      pago,
      valorParcelas,
      numeroParcelas,
      pagamentoDia,
      hasWarning,
      warningMessage,
    })
  }

  return rows
}

export function ClientCSVImport({ open, onOpenChange }: ClientCSVImportProps) {
  const { toast } = useToast()
  const importClients = useImportClients()
  const [parsedData, setParsedData] = useState<ParsedRow[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      setParsedData(parsed)
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const handleImport = async () => {
    if (parsedData.length === 0) return

    setIsLoading(true)
    try {
      const clientsToImport: ClientImportRow[] = parsedData.map((row) => ({
        nome: row.nome,
        telefone: row.telefone,
        valorTotal: row.debitoAberto + row.pago,
        debitoAberto: row.debitoAberto,
        pago: row.pago,
        valorParcelas: row.valorParcelas,
        numeroParcelas: row.numeroParcelas,
        pagamentoDia: row.pagamentoDia,
      }))

      const result = await importClients.mutateAsync(clientsToImport)

      if (result.errors.length > 0) {
        toast({
          title: 'Importação parcial',
          description: `${result.created} clientes e ${result.salesCreated} vendas importados, ${result.errors.length} erros`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Importação concluída',
          description: `${result.created} clientes e ${result.salesCreated} vendas importados com sucesso`,
        })
        onOpenChange(false)
        setParsedData([])
      }
    } catch (error) {
      toast({
        title: 'Erro na importação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setParsedData([])
    onOpenChange(false)
  }

  const warningCount = parsedData.filter((r) => r.hasWarning).length

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Importar Clientes via CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer flex flex-col items-center gap-2">
              <Upload className="h-10 w-10 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Clique para selecionar um arquivo CSV
              </span>
              <span className="text-sm text-muted-foreground">
                Colunas: NOME, DEBITO ABERTO, pago, total em aberto, valor das parcelas, numero de
                parcelas, pagamento dia
              </span>
            </label>
          </div>

          {parsedData.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="secondary">{parsedData.length} clientes encontrados</Badge>
                {warningCount > 0 && (
                  <Badge variant="warning" className="bg-yellow-100 text-yellow-800">
                    <AlertTriangle className="h-5 w-5 mr-1" />
                    {warningCount} com dados incompletos
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[400px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Débito Total</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Em Aberto</TableHead>
                      <TableHead className="text-right">Parcela</TableHead>
                      <TableHead className="text-center">Nº Parcelas</TableHead>
                      <TableHead className="text-center">Dia Pgto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, index) => (
                      <TableRow key={index} className={row.hasWarning ? 'bg-yellow-50' : ''}>
                        <TableCell>
                          {row.hasWarning ? (
                            <AlertTriangle className="h-5 w-5 text-yellow-500" />
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{row.nome}</TableCell>
                        <TableCell>{row.telefone || '-'}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.debitoAberto)}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(row.pago)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.debitoAberto - row.pago)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.valorParcelas ? formatCurrency(row.valorParcelas) : '-'}
                        </TableCell>
                        <TableCell className="text-center">{row.numeroParcelas || '-'}</TableCell>
                        <TableCell className="text-center">{row.pagamentoDia || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={parsedData.length === 0 || isLoading}>
            {isLoading ? 'Importando...' : `Importar ${parsedData.length} clientes`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
