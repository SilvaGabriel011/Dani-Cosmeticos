"use client"

import { useState, useCallback } from "react"
import { Upload, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { useImportProducts } from "@/hooks/use-import"
import { ProductImportRow } from "@/schemas/import"
import { formatCurrency } from "@/lib/utils"

interface ProductCSVImportProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface ParsedRow extends ProductImportRow {
  hasWarning: boolean
  warningMessage?: string
}

function parseMoneyValue(value: string): number {
  if (!value || value.trim() === "") return 0
  const cleaned = value
    .replace(/R\$\s*/gi, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim()
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []

  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(/[,;\t]/).map((v) => v.trim())

    if (values.length < 7 || !values[0]) continue

    const marca = values[0]
    const linha = values[1] || undefined
    const fragrancia = values[2] || undefined
    const categoria = values[3]
    const tipoEmbalagem = values[4] || undefined
    const quantidade = parseInt(values[5], 10) || 0
    const valor = parseMoneyValue(values[6])

    const hasWarning = !categoria || valor <= 0
    const warningMessage = hasWarning
      ? !categoria
        ? "Categoria não informada"
        : "Valor inválido"
      : undefined

    rows.push({
      marca,
      linha,
      fragrancia,
      categoria,
      tipoEmbalagem,
      quantidade,
      valor,
      hasWarning,
      warningMessage,
    })
  }

  return rows
}

export function ProductCSVImport({ open, onOpenChange }: ProductCSVImportProps) {
  const { toast } = useToast()
  const importProducts = useImportProducts()
  const [parsedData, setParsedData] = useState<ParsedRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [defaultMargin, setDefaultMargin] = useState(35)

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = (e) => {
        const text = e.target?.result as string
        const parsed = parseCSV(text)
        setParsedData(parsed)
      }
      reader.readAsText(file, "UTF-8")
    },
    []
  )

  const handleImport = async () => {
    if (parsedData.length === 0) return

    setIsLoading(true)
    try {
      const productsToImport: ProductImportRow[] = parsedData
        .filter((row) => !row.hasWarning)
        .map((row) => ({
          marca: row.marca,
          linha: row.linha,
          fragrancia: row.fragrancia,
          categoria: row.categoria,
          tipoEmbalagem: row.tipoEmbalagem,
          quantidade: row.quantidade,
          valor: row.valor,
        }))

      const result = await importProducts.mutateAsync({
        products: productsToImport,
        defaultProfitMargin: defaultMargin,
      })

      const messages: string[] = []
      messages.push(`${result.created} produtos importados`)
      if (result.brandsCreated.length > 0) {
        messages.push(`${result.brandsCreated.length} marcas criadas`)
      }
      if (result.categoriesCreated.length > 0) {
        messages.push(`${result.categoriesCreated.length} categorias criadas`)
      }

      if (result.errors.length > 0) {
        toast({
          title: "Importação parcial",
          description: `${messages.join(", ")}. ${result.errors.length} erros`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Importação concluída",
          description: messages.join(", "),
        })
        onOpenChange(false)
        setParsedData([])
      }
    } catch (error) {
      toast({
        title: "Erro na importação",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
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
  const validCount = parsedData.length - warningCount

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] md:max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Importar Produtos via CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileChange}
              className="hidden"
              id="product-csv-upload"
            />
            <label
              htmlFor="product-csv-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Clique para selecionar um arquivo CSV
              </span>
              <span className="text-xs text-muted-foreground">
                Colunas: MARCA, LINHA, FRAGRANCIA, CATEGORIA, CAIXA/KIT/UNIDADE,
                QTDE, VALOR
              </span>
            </label>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="defaultMargin">Margem padrão para novas marcas:</Label>
              <Input
                id="defaultMargin"
                type="number"
                min="0"
                max="100"
                value={defaultMargin}
                onChange={(e) => setDefaultMargin(Number(e.target.value))}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
          </div>

          {parsedData.length > 0 && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <Badge variant="secondary">
                  {parsedData.length} produtos encontrados
                </Badge>
                {warningCount > 0 && (
                  <Badge variant="warning" className="bg-yellow-100 text-yellow-800">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {warningCount} com problemas (serão ignorados)
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[350px] border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Marca</TableHead>
                      <TableHead>Linha</TableHead>
                      <TableHead>Fragrância</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-center">Qtde</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.map((row, index) => (
                      <TableRow
                        key={index}
                        className={row.hasWarning ? "bg-red-50" : ""}
                      >
                        <TableCell>
                          {row.hasWarning ? (
                            <AlertTriangle className="h-4 w-4 text-red-500" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{row.marca}</TableCell>
                        <TableCell>{row.linha || "-"}</TableCell>
                        <TableCell>{row.fragrancia || "-"}</TableCell>
                        <TableCell>{row.categoria || "-"}</TableCell>
                        <TableCell>{row.tipoEmbalagem || "-"}</TableCell>
                        <TableCell className="text-center">{row.quantidade}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.valor)}
                        </TableCell>
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
          <Button
            onClick={handleImport}
            disabled={validCount === 0 || isLoading}
          >
            {isLoading ? "Importando..." : `Importar ${validCount} produtos`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
