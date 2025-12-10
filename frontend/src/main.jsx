import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@material-tailwind/react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// Set favicon from env logo URL if provided
const LOGO_URL = import.meta.env.VITE_LOGO_URL || ''
if (LOGO_URL) {
  const link = document.querySelector("link[rel='icon']")
  if (link) {
    link.setAttribute('href', LOGO_URL)
    const isSvg = /\.svg($|\?)/i.test(LOGO_URL)
    link.setAttribute('type', isSvg ? 'image/svg+xml' : 'image/png')
  }
}

const router = createBrowserRouter([
  {
    path: '/*',
    element: <App />,
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider
        router={router}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      />
    </ThemeProvider>
  </StrictMode>,
)
