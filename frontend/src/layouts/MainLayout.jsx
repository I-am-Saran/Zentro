import { useState } from 'react'
import TopNav from '../components/TopNav'

export default function MainLayout({ children }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop/tablet) */}
      <TopNav open={open} onClose={() => setOpen(false)} />

      {/* Mobile topbar with toggle */}
      <div className="flex-1 flex flex-col">
        <div className="flex sm:hidden items-center justify-between bg-primary text-white px-4 py-3 shadow-sm">
          <button
            aria-label="Toggle Navigation"
            onClick={() => setOpen(true)}
            className="rounded-md border border-white/20 px-3 py-2"
          >
            Menu
          </button>
          <span className="font-semibold">Alchemy</span>
        </div>

        {open && (
          <div
            className="fixed inset-0 bg-black/30 sm:hidden z-40"
            onClick={() => setOpen(false)}
          />
        )}

        <main className="flex-1 sm:ml-64 p-6 bg-gradient-to-b from-white to-[#F6F8F5] overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}