import { motion } from 'framer-motion';
import Container from '../ui/Container';
import { fadeUp, staggerContainer, viewportOnce } from '../../lib/motion';
import { SOCIAL_PROOF_STATS } from '../../data/content';

export default function SocialProof() {
  return (
    <section id="about" className="relative py-20 sm:py-24 bg-white border-y border-line">
      <Container>
        <motion.div
          variants={staggerContainer(0.1)}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="grid sm:grid-cols-3 gap-10 sm:gap-6 text-center"
        >
          {SOCIAL_PROOF_STATS.map((stat) => (
            <motion.div key={stat.label} variants={fadeUp}>
              <p className="font-serif text-2xl sm:text-3xl text-ink">{stat.value}</p>
              <p className="text-xs uppercase tracking-[0.15em] text-ink/45 mt-2">{stat.label}</p>
            </motion.div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
