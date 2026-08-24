import { Suspense, lazy } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Container from '../ui/Container';
import SectionHeading from '../ui/SectionHeading';
import { fadeUp, viewportOnce } from '../../lib/motion';
import { useLazyMount } from '../../lib/useLazyMount';
import { SceneErrorBoundary } from '../3d/SceneErrorBoundary';
import CommunityFallback from '../3d/CommunityFallback';

const CommunityScene = lazy(() => import('../3d/CommunityScene'));

const COMPARISON = [
  { label: 'Delivery distance', big: 'A few blocks', small: 'Across the city' },
  { label: 'Who you’re ordering from', big: 'Your neighbors', small: 'Anonymous chains' },
  { label: 'Logistics', big: 'Simple, local', small: 'Complex, citywide' },
];

export default function CommunitySection() {
  const prefersReducedMotion = useReducedMotion();
  const { ref, shouldMount } = useLazyMount<HTMLDivElement>('250px');
  const renderScene = shouldMount && !prefersReducedMotion;

  return (
    <section id="community" className="relative py-24 sm:py-28 md:py-32 bg-white overflow-hidden">
      <Container>
        <SectionHeading
          eyebrow="Built for your community"
          title="Not a delivery app. Your neighborhood, connected."
          description="Big platforms cover entire cities. Lokal Finder starts at the building next door — shorter distances, faster orders, real neighbors on both ends."
          align="center"
        />

        <div
          ref={ref}
          aria-hidden="true"
          className="relative mt-16 h-[420px] sm:h-[480px] md:h-[560px] rounded-3xl border border-line overflow-hidden bg-surface-alt"
        >
          {renderScene ? (
            <SceneErrorBoundary fallback={<CommunityFallback />}>
              <Suspense fallback={<CommunityFallback />}>
                <CommunityScene />
              </Suspense>
            </SceneErrorBoundary>
          ) : (
            <CommunityFallback />
          )}
        </div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="mt-16 grid sm:grid-cols-3 gap-8 sm:gap-6"
        >
          {COMPARISON.map((row) => (
            <div key={row.label} className="text-center sm:text-left">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink/40 font-medium mb-3">
                {row.label}
              </p>
              <p className="text-lg font-semibold text-brand">{row.big}</p>
              <p className="text-sm text-ink/40 line-through decoration-1 mt-1">{row.small}</p>
            </div>
          ))}
        </motion.div>
      </Container>
    </section>
  );
}
