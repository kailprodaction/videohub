import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Sidebar } from './Sidebar'

export function RootLayout() {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="min-h-screen bg-bg text-text">
      <Navbar onMenuClick={() => setCollapsed((v) => !v)} />
      <div className="flex">
        <Sidebar collapsed={collapsed} />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
