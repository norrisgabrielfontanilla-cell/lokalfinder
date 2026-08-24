import { motion, useReducedMotion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import BoomerangVideoBg from '../ui/BoomerangVideoBg';
import Container from '../ui/Container';
import Button from '../ui/Button';
import { fadeUp, staggerContainer, viewportOnce } from '../../lib/motion';
import { HERO_CATEGORIES } from '../../data/content';

export default function Hero() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative flex flex-col overflow-hidden min-h-screen">
      <BoomerangVideoBg />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-white/85 via-white/55 to-white/70" />

      <Container className="relative z-10 flex flex-col flex-1 justify-center pt-28 pb-24">
        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          animate="visible"
          className="max-w-3xl"
        >
          <motion.span
            variants={fadeUp}
            className="inline-block text-[11px] uppercase tracking-[0.2em] text-ink/50 font-medium mb-5"
          >
            Community commerce, reimagined
          </motion.span>

          <motion.h1
            variants={fadeUp}
            className="font-serif text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-[1.05] tracking-tight text-ink font-normal"
          >
            Everything local.
            <br />
            One place.
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-xl text-base md:text-lg text-ink/70 leading-relaxed"
          >
            Discover food, services, and businesses around your community — without
            leaving your neighborhood.
          </motion.p>

          <motion.div variants={fadeUp} className="mt-9 flex flex-wrap items-center gap-4">
            <Button href="#product" variant="primary">
              Explore Lokal Finder
            </Button>
            <Button href="#businesses" variant="secondary">
              For Businesses
            </Button>
          </motion.div>
        </motion.div>

        <motion.ul
          variants={staggerContainer(0.08, 0.4)}
          initial="hidden"
          animate="visible"
          className="mt-16 flex flex-wrap gap-3"
          aria-label="What you can find on Lokal Finder"
        >
          {HERO_CATEGORIES.map((category, index) => (
            <motion.li
              key={category.key}
              variants={fadeUp}
              animate={
                prefersReducedMotion
                  ? undefined
                  : { y: [0, -6, 0] }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: index * 0.25 }
              }
              className="px-4 py-2 rounded-full bg-white/80 backdrop-blur-sm border border-line text-sm text-ink/80 shadow-sm"
            >
              {category.label}
            </motion.li>
          ))}
        </motion.ul>
      </Container>

      <motion.div
        variants={fadeUp}
        initial="hidden"
        whileInView="visible"
        viewport={viewportOnce}
        className="relative z-10 flex justify-center pb-8"
      >
        <a
          href="#customers"
          className="flex flex-col items-center gap-1.5 text-ink/40 hover:text-ink/70 transition-colors duration-200"
          aria-label="Scroll to learn how Lokal Finder works"
        >
          <span className="text-[11px] uppercase tracking-[0.2em]">Scroll</span>
          <ChevronDown className="w-4 h-4" />
        </a>
      </motion.div>
    </section>
  );
}
