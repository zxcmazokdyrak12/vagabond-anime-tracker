import { AnimatePresence, motion } from 'framer-motion'

// Оттиск печати «録» (записано), который ставится на постер при добавлении в свитки
export default function Stamp({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          className="stamp"
          aria-hidden="true"
          initial={{ scale: 2.4, opacity: 0, rotate: -24 }}
          animate={{ scale: 1, opacity: 1, rotate: -8 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.2, 0.9, 0.3, 1.2] }}
        >
          録
        </motion.span>
      )}
    </AnimatePresence>
  )
}
