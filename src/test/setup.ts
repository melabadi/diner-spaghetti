import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { server, store } from './server'

beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' })
})

beforeEach(() => {
  window.localStorage.clear()
  store.reset()
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
