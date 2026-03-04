import { Capacitor } from '@capacitor/core'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { useMutation } from '@tanstack/react-query'

async function downloadBackup(): Promise<void> {
  const response = await fetch('/api/backup')

  if (!response.ok) {
    const body = (await response.json()) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? 'Erro ao gerar backup')
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `backup-${timestamp}.json`

  if (Capacitor.isNativePlatform()) {
    const text = await response.text()
    await Filesystem.writeFile({
      path: filename,
      data: text,
      directory: Directory.Downloads,
      encoding: Encoding.UTF8,
    })
  } else {
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }
}

async function restoreBackup(file: File): Promise<{ restoredAt: string }> {
  const text = await file.text()

  let parsed: Record<string, unknown>
  try {
    parsed = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error('Arquivo inválido. Selecione um arquivo de backup JSON válido.')
  }

  // The backup file root is the data itself (exportedAt, version, plus table arrays)
  // We send the whole parsed object as `data` with confirm: true
  const response = await fetch('/api/backup/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirm: true, data: parsed }),
  })

  if (!response.ok) {
    const body = (await response.json()) as { error?: { message?: string } }
    throw new Error(body.error?.message ?? 'Erro ao restaurar backup')
  }

  return (response.json()) as Promise<{ restoredAt: string }>
}

export function useDownloadBackup() {
  return useMutation({ mutationFn: downloadBackup })
}

export function useRestoreBackup() {
  return useMutation({ mutationFn: restoreBackup })
}
