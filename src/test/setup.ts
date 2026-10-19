import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { store } from './server'

beforeEach(() => {
  window.localStorage.clear()
  store.reset()
})

afterEach(() => {
  cleanup()
})
