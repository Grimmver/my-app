import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ShopLauncher from '../shop/ShopLauncher.jsx'

function RootApp() {
  const [viewMode, setViewMode] = useState('warehouse') // 'warehouse' | 'shop'

  if (viewMode === 'shop') {
    return (
      <div className="relative">
        <ShopLauncher />
        <button
          type="button"
          onClick={() => setViewMode('warehouse')}
          className="fixed bottom-5 left-5 z-50 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xl flex items-center gap-2 transition-all cursor-pointer"
        >
          <span>📦</span>
          <span>Складская база</span>
        </button>
      </div>
    )
  }

  return <App onSwitchToShop={() => setViewMode('shop')} />
}

createRoot(document.getElementById('root')).render(
  <StrictModeWrapper />
)

function StrictModeWrapper() {
  return (
    <React.StrictMode>
      <RootApp />
    </React.StrictMode>
  )
}
