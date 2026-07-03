import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// jsdom serves an opaque origin (no Storage), and Node 24's experimental global
// `localStorage` is inert without --localstorage-file, so provide a real
// in-memory Storage for the consent store and anything else that persists.
class MemoryStorage implements Storage {
  #store = new Map<string, string>()
  get length() {
    return this.#store.size
  }
  clear() {
    this.#store.clear()
  }
  getItem(key: string) {
    return this.#store.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.#store.set(key, String(value))
  }
  removeItem(key: string) {
    this.#store.delete(key)
  }
  key(index: number) {
    return [...this.#store.keys()][index] ?? null
  }
}

const storage = new MemoryStorage()
for (const target of [globalThis, window]) {
  Object.defineProperty(target, 'localStorage', {
    value: storage,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  cleanup()
  storage.clear()
})
