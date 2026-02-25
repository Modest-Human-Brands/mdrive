import type { execa } from 'execa'
import { InternalStateManager } from 'motia'

type Process = ReturnType<typeof execa>
type ProcessMeta = { slug: string; deviceId: string; codec: string }

// In-memory handles for current session only
const handles = new Map<string, Process>()

export function registerProcess(key: string, proc: Process, meta: Omit<ProcessMeta, 'pid'>, state: InternalStateManager) {
  handles.set(key, proc)
  const pid = proc.pid!
  state.set('stream-processes', `stream:${key}`, { ...meta, pid, startedAt: Date.now() })
}

export function deregisterProcess(key: string, state: InternalStateManager) {
  handles.delete(key)
  state.delete('stream-processes', `stream:${key}`)
}

export function getProcess(key: string): Process | undefined {
  return handles.get(key)
}

export function getProcesses(): MapIterator<[string, Process]> {
  return handles.entries()
}

export function hasProcess(key: string): boolean {
  return handles.has(key)
}
