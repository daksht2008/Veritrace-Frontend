import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const colors = ['#12AAFF', '#00D395', '#4DC3FF', '#1B4ADD', '#B388FF']

/** A contained, performance-friendly background-boxes effect. */
export const BoxesCore = ({ className, rows = 16, cols = 22, ...props }) => {
  const cells = useMemo(() => Array.from({ length: rows * cols }, (_, index) => ({
    id: index,
    color: colors[index % colors.length],
  })), [rows, cols])

  return (
    <div className={cn('absolute inset-0 grid pointer-events-auto', className)} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))` }} {...props}>
      {cells.map(({ id, color }) => (
        <motion.div key={id} whileHover={{ backgroundColor: `${color}32` }} transition={{ duration: 0.16 }} className="border-r border-t border-[var(--border)]/50" />
      ))}
    </div>
  )
}

export const Boxes = React.memo(BoxesCore)
