import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Container from '../ui/Container';
import SectionHeading from '../ui/SectionHeading';
import { fadeUp, staggerContainer, viewportOnce } from '../../lib/motion';
import { CUSTOMER_JOURNEY } from '../../data/content';

export default function HowItWorks() {
  const trackRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ['start 0.8', 'end 0.6'],
  });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <section id="customers" className="relative py-24 sm:py-28 md:py-32 bg-surface-alt">
      <Container>
        <SectionHeading
          eyebrow="For customers"
          title="Find it, order it, get it — all inside your community."
          description="No more searching city-wide for what’s already around the corner."
        />

        <div ref={trackRef} className="relative mt-16 md:mt-20">
          <div className="hidden md:block absolute left-0 right-0 top-6 h-px bg-line">
            <motion.div
              style={{ scaleX: lineScale }}
              className="h-full bg-brand origin-left"
            />
          </div>

          <motion.ol
            variants={staggerContainer(0.15)}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8"
          >
            {CUSTOMER_JOURNEY.map((item) => (
              <motion.li key={item.step} variants={fadeUp} className="relative flex flex-col gap-3">
                <div className="relative z-10 w-3 h-3 rounded-full bg-brand ring-4 ring-surface-alt hidden md:block" />
                <span className="font-serif text-4xl text-ink/25">{item.step}</span>
                <h3 className="text-lg font-semibold text-ink">{item.title}</h3>
                <p className="text-sm text-ink/65 leading-relaxed">{item.description}</p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </Container>
    </section>
  );
}
