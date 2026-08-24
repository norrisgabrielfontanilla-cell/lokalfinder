import { useEffect, useLayoutEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Home, ShoppingBag, Shirt, Sparkles, Utensils, Wrench } from 'lucide-react';
import Container from '../ui/Container';
import { fadeUp, staggerContainer, viewportOnce } from '../../lib/motion';
import { ECOSYSTEM_STAGES } from '../../data/content';

gsap.registerPlugin(ScrollTrigger);

const ICONS = {
  food: Utensils,
  laundry: Shirt,
  cleaning: Sparkles,
  housekeeping: Home,
  services: Wrench,
  retail: ShoppingBag,
} as const;

const POSITIONS = [
  { top: '8%', left: '50%' },
  { top: '30%', left: '85%' },
  { top: '68%', left: '80%' },
  { top: '85%', left: '50%' },
  { top: '68%', left: '20%' },
  { top: '30%', left: '15%' },
];

export default function VisionSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const finalTextRef = useRef<HTMLParagraphElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useLayoutEffect(() => {
    if (prefersReducedMotion) return;
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const items = itemRefs.current.filter(Boolean) as HTMLDivElement[];
      gsap.set(items, { opacity: 0, scale: 0.4 });
      gsap.set(finalTextRef.current, { opacity: 0, y: 16 });

      const timeline = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=140%',
          scrub: 0.6,
          pin: true,
        },
      });

      items.forEach((item) => {
        timeline.to(item, { opacity: 1, scale: 1, duration: 0.4, ease: 'back.out(1.6)' }, '>-0.1');
      });

      timeline.to(finalTextRef.current, { opacity: 1, y: 0, duration: 0.4 }, '>-0.1');
    }, section);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  useEffect(() => {
    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);

  return (
    <section
      id="vision"
      ref={sectionRef}
      data-nav-theme="dark"
      className="relative py-24 sm:py-28 md:py-32 bg-ink overflow-hidden"
    >
      <Container className="relative z-10 h-full flex flex-col items-center justify-center text-center">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={viewportOnce}
          className="max-w-xl mx-auto"
        >
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/50 font-medium">
            The bigger vision
          </span>
          <h2 className="mt-4 font-serif text-3xl sm:text-4xl md:text-5xl text-white leading-[1.1] tracking-tight">
            It starts with food. It doesn’t end there.
          </h2>
        </motion.div>

        <div className="relative mt-4 w-full max-w-md aspect-square">
          {prefersReducedMotion ? (
            <motion.div
              variants={staggerContainer(0.1)}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="grid grid-cols-3 gap-6 place-items-center h-full content-center"
            >
              {ECOSYSTEM_STAGES.map((stage) => {
                const Icon = ICONS[stage.key as keyof typeof ICONS];
                return (
                  <motion.div key={stage.key} variants={fadeUp} className="flex flex-col items-center gap-2">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center">
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xs text-white/60">{stage.label}</span>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            ECOSYSTEM_STAGES.map((stage, i) => {
              const Icon = ICONS[stage.key as keyof typeof ICONS];
              const pos = POSITIONS[i % POSITIONS.length];
              return (
                <div
                  key={stage.key}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  style={{ top: pos.top, left: pos.left }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <span className="text-xs text-white/60 whitespace-nowrap">{stage.label}</span>
                </div>
              );
            })
          )}
        </div>

        <p ref={finalTextRef} className="mt-8 font-serif text-2xl sm:text-3xl text-white">
          Everything you need, around you.
        </p>
      </Container>
    </section>
  );
}
