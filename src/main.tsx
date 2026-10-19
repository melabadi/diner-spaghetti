import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Le conteneur de l’application est introuvable.')
const root = createRoot(container)

root.render(<StrictMode><App /></StrictMode>)
