import { FetchInterceptor } from '@mswjs/interceptors/fetch'
import { getResponse, HttpResponse } from 'msw'
import { createHandlers } from './handlers'
import { OrganizerStore, type StorageAdapter } from './store'

export function createMockBackend(storage: StorageAdapter, origin: string, latency = 180) {
  const handlers = createHandlers(new OrganizerStore(storage), origin, latency)
  // In-page interception avoids service-worker suspension in background tabs.
  const interceptor = new FetchInterceptor()
  const isApiRequest = (request: Request) => {
    const url = new URL(request.url)
    return url.origin === origin && url.pathname.startsWith('/api/')
  }

  interceptor.on('request', async ({ request, controller }) => {
    if (!isApiRequest(request)) return
    const response = await getResponse(handlers, request)
    if (!response) {
      console.error('[mock-api] Aucune réponse pour', request.method, request.url)
      controller.respondWith(HttpResponse.json({
        code: 'missing_handler', error: 'Le backend simulé n’a pas pu traiter cette requête.',
      }, { status: 500 }))
      return
    }
    controller.respondWith(response)
  })

  interceptor.on('unhandledException', ({ error, request, controller }) => {
    if (!isApiRequest(request)) return
    console.error('[mock-api] Erreur de transport', error)
    controller.respondWith(HttpResponse.json({
      code: 'transport_error', error: 'Le backend simulé a rencontré une erreur. Rechargez la page et réessayez.',
    }, { status: 500 }))
  })

  return {
    start: () => interceptor.apply(),
    stop: () => interceptor.dispose(),
  }
}

export function startMockBackend() {
  const backend = createMockBackend(window.localStorage, window.location.origin)
  backend.start()
  if (import.meta.hot) import.meta.hot.dispose(() => backend.stop())
}
