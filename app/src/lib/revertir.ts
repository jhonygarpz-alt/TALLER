import { supabase } from './supabase'
import { errorTexto } from './format'

/**
 * Reversión controlada de un subproceso (anular trabajo, cancelar destajo, devolver material).
 * Pide el motivo, llama a la función segura del servidor y devuelve el error en texto (o null).
 * Si el usuario cancela, devuelve undefined.
 */
export async function revertir(funcion: string, args: Record<string, unknown>, pregunta: string): Promise<string | null | undefined> {
  const motivo = prompt(`${pregunta}\n\nEscribe el motivo (queda registrado en auditoría):`)
  if (motivo === null) return undefined
  if (!motivo.trim()) return 'El motivo es obligatorio'
  const { error } = await supabase.rpc(funcion, { ...args, p_motivo: motivo.trim() })
  return error ? errorTexto(error) : null
}
