import { setupServer } from 'msw/node'
import { createHandlers } from '../mocks/handlers'
import { OrganizerStore } from '../mocks/store'

export const store = new OrganizerStore(window.localStorage)
export const server = setupServer(...createHandlers(store, window.location.origin, 0))
