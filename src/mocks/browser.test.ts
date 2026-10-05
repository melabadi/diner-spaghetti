import { createServer, type RequestListener, type Server } from 'node:http'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { api } from '../api'
import { organizerSchema, summarize, type ReservationInput } from '../domain'
import { server, store } from '../test/server'
import { createMockBackend } from './browser'

const origin = window.location.origin
const reservation: ReservationInput = {
  name: 'Invité Démo', email: 'invite@example.test',
  adults: 2, children: 1, vegetarian: 1, glutenFree: 1,
  paymentStatus: 'pending', note: '',
}

let backend: ReturnType<typeof createMockBackend> | undefined

beforeAll(() => server.close())
afterAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => {
  backend?.stop()
  backend = undefined
})

function start() {
  backend = createMockBackend(window.localStorage, origin, 0)
  backend.start()
}

function listen(httpServer: Server): Promise<string> {
  return new Promise((resolve, reject) => {
    httpServer.once('error', reject)
    httpServer.listen(0, '127.0.0.1', () => {
      httpServer.off('error', reject)
      const address = httpServer.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Expected a loopback TCP address'))
        return
      }
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })
}

function close(httpServer: Server): Promise<void> {
  if (!httpServer.listening) return Promise.resolve()
  return new Promise((resolve, reject) => {
    httpServer.close((error) => error ? reject(error) : resolve())
  })
}

describe('in-page mock transport', () => {
  it('answers fetch requests without registering a service worker', async () => {
    start()
    const data = await api.load()
    expect(summarize(data).guests).toBe(99)
  })

  it('creates a reservation with HTTP 201 and the full validated state', async () => {
    start()
    const response = await fetch(`${origin}/api/reservations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reservation),
    })
    expect(response.status).toBe(201)
    const body: unknown = await response.json()
    const data = organizerSchema.parse(body)
    expect(summarize(data).guests).toBe(102)
    expect(data.reservations.at(-1)?.totalCents).toBe(4600)
  })

  it('persists a paid reservation across transport teardown and restart', async () => {
    start()
    const created = await api.addReservation(reservation)
    const id = created.reservations.at(-1)?.id
    if (!id) throw new Error('Expected a created reservation')
    await api.setPayment(id, 'paid')
    backend?.stop()
    start()
    const reloaded = await api.load()
    expect(reloaded.reservations.find((item) => item.id === id)?.paymentStatus).toBe('paid')
    expect(summarize(reloaded).collectedCents).toBe(103000)
  })

  it('returns validation errors without changing persisted data', async () => {
    start()
    const before = store.read()
    const response = await fetch(`${origin}/api/reservations`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...reservation, adults: 0, children: 0 }),
    })
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'validation_error' })
    expect(store.read()).toEqual(before)
  })

  it('returns a JSON 404 for an unknown API route', async () => {
    start()
    const response = await fetch(`${origin}/api/unknown`)
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ code: 'not_found', error: 'Cette route API n’existe pas.' })
  })

  it('leaves static resources and other origins to the original fetch implementation', async () => {
    const nativeRequests: string[] = []
    const handleRequest: RequestListener = (incoming, response) => {
      nativeRequests.push(incoming.url || '')
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ passthrough: true }))
    }
    const serve = createServer(handleRequest)
    const foreign = createServer(handleRequest)
    try {
      const mockOrigin = await listen(serve)
      const foreignOrigin = await listen(foreign)
      backend = createMockBackend(window.localStorage, mockOrigin, 0)
      backend.start()
      expect(await (await fetch(`${mockOrigin}/assets/example.svg`)).json()).toEqual({ passthrough: true })
      expect(await (await fetch(`${foreignOrigin}/api/organizer`)).json()).toEqual({ passthrough: true })
      expect(nativeRequests).toEqual(['/assets/example.svg', '/api/organizer'])
      const body: unknown = await (await fetch(`${mockOrigin}/api/organizer`)).json()
      expect(summarize(organizerSchema.parse(body)).guests).toBe(99)
      expect(nativeRequests).toHaveLength(2)
    } finally {
      await close(serve)
      await close(foreign)
    }
  })

  it('restores the original fetch function when stopped', () => {
    const original = globalThis.fetch
    start()
    expect(globalThis.fetch).not.toBe(original)
    backend?.stop()
    expect(globalThis.fetch).toBe(original)
  })

  it('surfaces inaccessible storage as an explicit error', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    backend = createMockBackend({
      getItem: () => { throw new DOMException('Access denied', 'SecurityError') },
      setItem: vi.fn(),
    }, origin, 0)
    backend.start()
    await expect(api.load()).rejects.toThrow('Le stockage local est inaccessible.')
    expect(log).toHaveBeenCalled()
  })
})
