/**
 * api.ts — IpcResult unwrap helper.
 *
 * Throws an Error with `message` when the result is not ok, so stores can
 * try/catch and surface it as a toast.
 */
import type { IpcResult } from '@shared/types'

export async function unwrap<T>(p: Promise<IpcResult<T>>): Promise<T> {
  const result = await p
  if (result.ok) return result.data
  throw new Error(result.error.message)
}
