import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * ScrollReveal — wraps any content and animates it into view on scroll.
 *
 * @param {'fade-up'|'fade-down'|'fade-left'|'fade-right'|'zoom'|'blur'} variant
 * @param {number} delay — stagger delay in seconds
 * @param {number} duration — animation duration
 * @param {boolean} once — only animate once (default true)
 */

const variants = {
  'fade-up': {
    hidden: { opacity: 0, y: 50, filter: 'blur(12px)', scale: 0.98 },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 },
  },
  'fade-down': {
    hidden: { opacity: 0, y: -50, filter: 'blur(12px)', scale: 0.98 },
    visible: { opacity: 1, y: 0, filter: 'blur(0px)', scale: 1 },
  },
  'fade-left': {
    hidden: { opacity: 0, x: -50, filter: 'blur(12px)' },
    visible: { opacity: 1, x: 0, filter: 'blur(0px)' },
  },
  'fade-right': {
    hidden: { opacity: 0, x: 50, filter: 'blur(12px)' },
    visible: { opacity: 1, x: 0, filter: 'blur(0px)' },
  },
  zoom: {
    hidden: { opacity: 0, scale: 0.85, filter: 'blur(12px)' },
    visible: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  },
  blur: {
    hidden: { opacity: 0, filter: 'blur(16px)' },
    visible: { opacity: 1, filter: 'blur(0px)' },
  },
}

export function ScrollReveal({
  children,
  className,
  variant = 'fade-up',
  delay = 0,
  duration = 0.6,
  once = true,
  amount = 0.15,
  as = 'div',
  ...props
}) {
  const Component = motion[as] || motion.div

  return (
    <Component
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={variants[variant] || variants['fade-up']}
      transition={{
        type: 'spring',
        stiffness: 70,
        damping: 20,
        mass: 1,
        delay,
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </Component>
  )
}

/**
 * ScrollRevealGroup — staggers multiple children with increasing delays.
 */
export function ScrollRevealGroup({
  children,
  className,
  variant = 'fade-up',
  stagger = 0.1,
  duration = 0.5,
  once = true,
  ...props
}) {
  const container = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
      },
    },
  }

  const item = variants[variant] || variants['fade-up']

  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.1 }}
      variants={container}
      className={cn(className)}
      {...props}
    >
      {Array.isArray(children)
        ? children.map((child, i) => (
          <motion.div
            key={i}
            variants={item}
            transition={{ type: 'spring', stiffness: 70, damping: 20, mass: 1 }}
          >
            {child}
          </motion.div>
        ))
        : children}
    </motion.div>
  )
}
