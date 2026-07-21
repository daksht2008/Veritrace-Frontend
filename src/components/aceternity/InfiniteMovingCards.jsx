import React from 'react'
import { cn } from '@/lib/utils'

/**
 * Aceternity UI — Infinite Moving Cards Component
 * Pure JSX rendering for instant, zero-delay synchronous movement across multiple carousels.
 */
export const InfiniteMovingCards = ({
  items,
  direction = 'left',
  speed = 'normal',
  pauseOnHover = true,
  className,
  renderItem,
  children,
}) => {
  const duration = speed === 'fast' ? '25s' : speed === 'normal' ? '45s' : '85s'
  const animDirection = direction === 'left' ? 'forwards' : 'reverse'

  const content = items
    ? items.map((item, idx) => (
        <li key={idx} className="shrink-0">
          {renderItem(item, idx)}
        </li>
      ))
    : React.Children.map(children, (child, idx) => (
        <li key={idx} className="shrink-0">
          {child}
        </li>
      ))

  return (
    <div
      className={cn(
        'scroller relative z-20 w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_5%,white_95%,transparent)]',
        className
      )}
    >
      <ul
        className={cn(
          'flex min-w-full shrink-0 gap-4 py-3 w-max flex-nowrap m-0 p-0 list-none animate-scroll',
          pauseOnHover && 'hover:[animation-play-state:paused]'
        )}
        style={{
          '--animation-duration': duration,
          '--animation-direction': animDirection,
        }}
      >
        {/* Set 1 */}
        {content}
        {/* Set 2 (for seamless infinite loop) */}
        {content}
      </ul>
    </div>
  )
}
