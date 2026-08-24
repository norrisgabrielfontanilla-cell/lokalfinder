import { Suspense, lazy } from 'react';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import Hero from './components/sections/Hero';
import HowItWorks from './components/sections/HowItWorks';
import ProductShowcase from './components/sections/ProductShowcase';
import CommunitySection from './components/sections/CommunitySection';
import MerchantSection from './components/sections/MerchantSection';
import SocialProof from './components/sections/SocialProof';
import FinalCta from './components/sections/FinalCta';

// GSAP + ScrollTrigger are only needed for the Vision section's pinned
// scroll narrative — keep them out of the initial bundle.
const VisionSection = lazy(() => import('./components/sections/VisionSection'));

export default function App() {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden font-sans">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <ProductShowcase />
        <CommunitySection />
        <MerchantSection />
        <Suspense fallback={<div className="bg-ink min-h-[60vh]" />}>
          <VisionSection />
        </Suspense>
        <SocialProof />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
