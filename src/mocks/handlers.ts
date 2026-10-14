import { delay, http, HttpResponse } from 'msw'
import { z } from 'zod'
import type { Organizer } from '../domain'
import { ApiError, OrganizerStore } from './store'

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new ApiError(400, 'invalid_json', 'Le corps de la requête doit être du JSON valide.')
    }
    throw error
  }
}

export function createHandlers(store: OrganizerStore, baseUrl: string, latency = 180) {
  const respond = async (action: () => Organizer | Promise<Organizer>, status = 200) => {
    if (latency > 0) await delay(latency)
    try {
      return HttpResponse.json(await action(), { status })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return HttpResponse.json({ code: 'validation_error', error: error.issues[0].message }, { status: 400 })
      }
      if (error instanceof ApiError) {
        if (error.status >= 500) console.error('[mock-api]', error)
        return HttpResponse.json({ code: error.code, error: error.message }, { status: error.status })
      }
      console.error('[mock-api] Erreur inattendue', error)
      return HttpResponse.json({ code: 'internal_error', error: 'Le serveur simulé a rencontré une erreur. Réessayez.' }, { status: 500 })
    }
  }
  const id = (value: string | readonly string[] | undefined) => z.string().min(1).parse(value)

  return [
    http.get(`${baseUrl}/api/organizer`, () => respond(() => store.read())),
    http.put(`${baseUrl}/api/event`, ({ request }) => respond(async () => store.updateEvent(await readBody(request)))),
    http.post(`${baseUrl}/api/reservations`, ({ request }) => respond(async () => store.addReservation(await readBody(request)), 201)),
    http.patch(`${baseUrl}/api/reservations/:id`, ({ request, params }) => respond(async () => store.setPayment(id(params.id), await readBody(request)))),
    http.delete(`${baseUrl}/api/reservations/:id`, ({ params }) => respond(() => store.deleteReservation(id(params.id)))),
    http.put(`${baseUrl}/api/reservations/:id/arrival`, ({ request, params }) => respond(async () => store.setArrival(id(params.id), await readBody(request)))),
    http.patch(`${baseUrl}/api/reservations/:id/table`, ({ request, params }) => respond(async () => store.setTable(id(params.id), await readBody(request)))),
    http.post(`${baseUrl}/api/tables`, ({ request }) => respond(async () => store.addTable(await readBody(request)), 201)),
    http.put(`${baseUrl}/api/tables/:id`, ({ request, params }) => respond(async () => store.updateTable(id(params.id), await readBody(request)))),
    http.delete(`${baseUrl}/api/tables/:id`, ({ params }) => respond(() => store.deleteTable(id(params.id)))),
    http.post(`${baseUrl}/api/volunteers`, ({ request }) => respond(async () => store.addVolunteer(await readBody(request)), 201)),
    http.delete(`${baseUrl}/api/volunteers/:id`, ({ params }) => respond(() => store.deleteVolunteer(id(params.id)))),
    http.post(`${baseUrl}/api/expenses`, ({ request }) => respond(async () => store.addExpense(await readBody(request)), 201)),
    http.patch(`${baseUrl}/api/expenses/:id`, ({ request, params }) => respond(async () => store.setPurchased(id(params.id), await readBody(request)))),
    http.delete(`${baseUrl}/api/expenses/:id`, ({ params }) => respond(() => store.deleteExpense(id(params.id)))),
    http.post(`${baseUrl}/api/reset`, () => respond(() => store.reset())),
    http.all(`${baseUrl}/api/*`, () => HttpResponse.json({ code: 'not_found', error: 'Cette route API n’existe pas.' }, { status: 404 })),
  ]
}
