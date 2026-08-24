import { motion } from 'framer-motion';
import Container from '../ui/Container';
import Button from '../ui/Button';
import { fadeUp, viewportOnce } from '../../lib/motion';

export default function FinalCta() {
  return (
    <section data-nav-theme="dark" className="relative py-32 sm:py-40 bg-brand-dark overflow-hidden">
      <div
        aria-hidden="true"
        className="animate-drift absolute -top-1/3 left-1/4 w-[60vw] h-[60vw] rounded-full bg-brand/30 blur-3xl"
      />

      <Container className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
        >
          <p className="text-[11px] uppercase tracking-[0.2em] text-white/60 font-medium mb-6">
            Lokal Finder
          </p>
          <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl text-white leading-[1.05] tracking-tight">
            Your community.
            <br />
            Connected.
          </h2>

          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Button href="#product" variant="inverted">
              Explore Lokal Finder
            </Button>
            <Button href="#early-access" variant="outline-light">
              Partner with Lokal Finder
            </Button>
          </div>
        </motion.div>
      </Container>
    </section>
  );
}
