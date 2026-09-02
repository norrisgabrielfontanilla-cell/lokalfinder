import { motion } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import Container from '../ui/Container';
import SectionHeading from '../ui/SectionHeading';
import Button from '../ui/Button';
import AnimatedCounter from '../ui/AnimatedCounter';
import { fadeUp, staggerContainer, viewportOnce } from '../../lib/motion';
import { MERCHANT_STEPS } from '../../data/content';

const ORDERS = [
  { customer: 'Block C · Unit 12', item: 'Classic Cheeseburger', status: 'Preparing' },
  { customer: 'Block A · Unit 04', item: 'Iced Latte x2', status: 'Out for delivery' },
  { customer: 'Block D · Unit 21', item: 'Laundry pickup', status: 'Delivered' },
];

const STATUS_STYLES: Record<string, string> = {
  Preparing: 'bg-amber-100 text-amber-700',
  'Out for delivery': 'bg-blue-100 text-blue-700',
  Delivered: 'bg-brand-light text-brand-dark',
};

const DASHBOARD_STATS: { label: string; value?: number; suffix?: string; staticValue?: string }[] = [
  { label: "Today's orders", value: 34 },
  { label: 'Avg. rating', staticValue: '4.9' },
  { label: 'Repeat customers', value: 68, suffix: '%' },
];

export default function MerchantSection() {
  return (
    <section id="businesses" className="relative py-24 sm:py-28 md:py-32 bg-surface-alt">
      <Container>
        <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
          <div>
            <SectionHeading
              eyebrow="For businesses"
              title="Turn your neighborhood into your marketplace."
              description="No storefront rent, no city-wide competition — just your community, ready to order."
            />

            <motion.ul
              variants={staggerContainer(0.08)}
              initial="hidden"
              whileInView="visible"
              viewport={viewportOnce}
              className="mt-10 grid sm:grid-cols-2 gap-x-8 gap-y-5"
            >
              {MERCHANT_STEPS.map((step) => (
                <motion.li key={step.title} variants={fadeUp} className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-brand shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-ink">{step.title}</p>
                    <p className="text-sm text-ink/55 mt-0.5">{step.description}</p>
                  </div>
                </motion.li>
              ))}
            </motion.ul>

            <div className="mt-10">
              <Button href="/lokalfinder/" variant="primary">
                Partner with Lokal Finder
              </Button>
            </div>
          </div>

          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={viewportOnce}
            className="rounded-2xl border border-line bg-white shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-line">
              <div>
                <p className="text-sm font-semibold text-ink">Neighbor's Grill</p>
                <p className="text-xs text-ink/45">Merchant dashboard</p>
              </div>
              <span className="w-2 h-2 rounded-full bg-brand" />
            </div>

            <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
              {DASHBOARD_STATS.map((stat) => (
                <div key={stat.label} className="px-5 py-5 text-center">
                  <p className="text-2xl font-serif text-ink">
                    {stat.staticValue ?? <AnimatedCounter value={stat.value ?? 0} suffix={stat.suffix ?? ''} />}
                  </p>
                  <p className="text-[11px] text-ink/45 mt-1.5 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="px-6 py-5">
              <p className="text-xs font-medium text-ink/50 uppercase tracking-wide mb-3">
                Recent orders
              </p>
              <div className="flex flex-col gap-3">
                {ORDERS.map((order) => (
                  <div key={order.customer} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="text-ink font-medium">{order.item}</p>
                      <p className="text-ink/45 text-xs">{order.customer}</p>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${STATUS_STYLES[order.status]}`}
                    >
                      {order.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="px-6 pb-5 text-[11px] text-ink/35">
              Illustrative dashboard preview.
            </p>
          </motion.div>
        </div>
      </Container>
    </section>
  );
}
