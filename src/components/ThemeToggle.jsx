import { useTheme } from './providers/ExperienceProvider'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button 
      onClick={toggleTheme}
      className="p-2 rounded-xl border border-[var(--border)] bg-[var(--bg-2)] hover:bg-[var(--bg-3)] text-[var(--text-1)] hover:text-[#12AAFF] transition-all duration-200 flex items-center justify-center shadow-sm"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <Sun className="w-4 h-4 text-amber-400" />
      ) : (
        <Moon className="w-4 h-4 text-slate-700" />
      )}
    </button>
  )
}
