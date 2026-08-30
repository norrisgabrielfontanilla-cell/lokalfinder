import { motion } from 'framer-motion';
import { fadeUp, viewportOnce } from '../../lib/motion';

export default function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
}) {
  const alignClass = align === 'center' ? 'items-center text-center mx-auto' : 'items-start text-left';

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={viewportOnce}
      className={`flex flex-col gap-4 max-w-2xl ${alignClass}`}
    >
      {eyebrow ? (
        <span className="text-[11px] uppercase tracking-[0.2em] text-ink/50 font-medium">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal leading-[1.1] tracking-tight text-ink text-balance">
        {title}
      </h2>
      {description ? (
        <p className="text-base md:text-lg text-ink/70 leading-relaxed">{description}</p>
      ) : null}
    </motion.div>
  );
}
