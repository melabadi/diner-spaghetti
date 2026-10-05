import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Le conteneur de l’application est introuvable.')
const root = createRoot(container)

async function start() {
  try {
    const { startMockBackend } = await import('./mocks/browser')
    startMockBackend()
    root.render(<StrictMode><App /></StrictMode>)
  } catch (error) {
    console.error('Impossible de démarrer le backend simulé.', error)
    root.render(
      <main className="boot-error">
        <h1>La démo n’a pas pu démarrer</h1>
        <p>Le backend simulé n’a pas pu se lancer. Autorisez le stockage local dans votre navigateur, vérifiez que Vite est démarré, puis réessayez.</p>
        <button onClick={() => window.location.reload()}>Réessayer</button>
      </main>,
    )
  }
}

void start()
