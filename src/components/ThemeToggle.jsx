import { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <button 
      className={`theme-toggle-btn ${theme}`} 
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      <div className="theme-toggle-track">
        {/* Starry details for dark mode background */}
        <span className="star star-1"></span>
        <span className="star star-2"></span>
        <span className="star star-3"></span>
        {/* Clouds for light mode background */}
        <span className="cloud cloud-1"></span>
        <span className="cloud cloud-2"></span>
      </div>
      <div className="theme-toggle-thumb">
        {/* The sun / moon shape inside thumb */}
        <div className="thumb-shape"></div>
      </div>
    </button>
  )
}
