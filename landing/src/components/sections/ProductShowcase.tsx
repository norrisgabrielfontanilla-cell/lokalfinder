import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';
import { Check, MapPin, Plus, Search, ShoppingBag, Star } from 'lucide-react';
import Container from '../ui/Container';
import SectionHeading from '../ui/SectionHeading';
import { fadeUp, viewportOnce } from '../../lib/motion';

type Stage = 'search' | 'results' | 'cart' | 'confirmed';

const STAGES: Stage[] = ['search', 'results', 'cart', 'confirmed'];
const STAGE_DURATION = 2600;

const RESULTS = [
  { name: "Neighbor's Grill", meta: '4.9 · 12 min · Block C', price: '$$' },
  { name: 'Corner Burger Co.', meta: '4.7 · 8 min · Block A', price: '$' },
  { name: "Bea's Kitchen", meta: '4.8 · 15 min · Block D', price: '$$' },
];

function useAutoStage(active: boolean) {
  const [stageIndex, setStageIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!active || prefersReducedMotion) return;
    const interval = window.setInterval(() => {
      setStageIndex((index) => (index + 1) % STAGES.length);
    }, STAGE_DURATION);
    return () => window.clearInterval(interval);
  }, [active, prefersReducedMotion]);

  return STAGES[stageIndex];
}

export default function ProductShowcase() {
  const frameRef = useRef<HTMLDivElement>(null);
  const inView = useInView(frameRef, { once: false, margin: '-100px' });
  const stage = useAutoStage(inView);

  return (
    <section id="product" className="relative py-24 sm:py-28 md:py-32 bg-white">
      <Container>
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          <SectionHeading
            eyebrow="The product"
            title="A real interface for a real neighborhood."
            description="Search what you're craving, pick a seller a few doors down, and check out — the same flow whether it's dinner, laundry, or a same-day errand."
          />

          <motion.div
            ref={frameRef}
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="relative mx-auto w-full max-w-sm"
          >
            <div
              aria-hidden="true"
              className="rounded-[28px] border border-line bg-surface-alt shadow-xl overflow-hidden"
            >
              <div className="flex items-center gap-2 px-5 py-4 border-b border-line bg-white">
                <MapPin className="w-4 h-4 text-brand" />
                <span className="text-xs font-medium text-ink/70">Grass Residences, Block C</span>
              </div>

              <div className="relative h-[420px] p-5">
                <AnimatePresence mode="wait">
                  {stage === 'search' ? (
                    <motion.div
                      key="search"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35 }}
                      className="flex flex-col gap-4"
                    >
                      <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white border border-line">
                        <Search className="w-4 h-4 text-ink/40" />
                        <span className="text-sm text-ink/80">Burger</span>
                        <motion.span
                          animate={{ opacity: [1, 0] }}
                          transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                          className="w-px h-4 bg-ink/40"
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {['Food', 'Coffee', 'Laundry', 'Services'].map((chip) => (
                          <span
                            key={chip}
                            className="px-3 py-1.5 rounded-full bg-white border border-line text-xs text-ink/60"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}

                  {stage === 'results' ? (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35 }}
                      className="flex flex-col gap-3"
                    >
                      {RESULTS.map((result, index) => (
                        <motion.div
                          key={result.name}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.12 }}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border ${
                            index === 0 ? 'border-brand bg-brand-light' : 'border-line bg-white'
                          }`}
                        >
                          <div>
                            <p className="text-sm font-medium text-ink">{result.name}</p>
                            <p className="text-xs text-ink/50 flex items-center gap-1 mt-0.5">
                              <Star className="w-3 h-3 fill-current text-amber-400" />
                              {result.meta}
                            </p>
                          </div>
                          <span className="text-xs text-ink/40">{result.price}</span>
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : null}

                  {stage === 'cart' ? (
                    <motion.div
                      key="cart"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35 }}
                      className="flex flex-col gap-4"
                    >
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-white border border-line">
                        <div>
                          <p className="text-sm font-medium text-ink">Classic Cheeseburger</p>
                          <p className="text-xs text-ink/50 mt-0.5">Neighbor's Grill</p>
                        </div>
                        <motion.div
                          initial={{ scale: 0.7, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.2, type: 'spring', stiffness: 300, damping: 18 }}
                          className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </motion.div>
                      </div>
                      <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-ink text-white">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4" />
                          <span className="text-sm">1 item</span>
                        </div>
                        <span className="text-sm font-medium">₱185.00</span>
                      </div>
                    </motion.div>
                  ) : null}

                  {stage === 'confirmed' ? (
                    <motion.div
                      key="confirmed"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35 }}
                      className="flex flex-col items-center justify-center h-full text-center gap-4"
                    >
                      <motion.div
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                        className="w-14 h-14 rounded-full bg-brand text-white flex items-center justify-center"
                      >
                        <Check className="w-6 h-6" />
                      </motion.div>
                      <div>
                        <p className="text-sm font-medium text-ink">Order placed</p>
                        <p className="text-xs text-ink/50 mt-1">Arriving in ~12 minutes</p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
            <p className="mt-4 text-center text-xs text-ink/40">
              Illustrative product preview — not a live transaction.
            </p>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
