import { ArrowRight } from 'lucide-react';
import BoomerangVideoBg from './BoomerangVideoBg';

const FEATURES = [
  { number: '01', label: 'Discover' },
  { number: '02', label: 'Connect' },
  { number: '03', label: 'Belong' },
];

export default function Hero() {
  return (
    <section className="relative flex flex-col items-center overflow-hidden h-screen">
      <BoomerangVideoBg />

      <div className="relative z-10 flex flex-col items-center pt-24 sm:pt-26 md:pt-32 px-4 sm:px-6 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl lg:text-8xl leading-[1.1] tracking-tighter text-[#14231C] font-normal">
          Your community.
          <br />
          Right here.
        </h1>
        <p className="max-w-sm sm:max-w-md mt-5 sm:mt-6 md:mt-8 text-sm md:text-base text-[#14231C]/70 leading-relaxed">
          LokalFinder connects neighbors, local vendors, and everyday essentials —
          one hyperlocal feed for the community you live in.
        </p>
        <a
          href="#early-access"
          className="mt-6 sm:mt-8 md:mt-10 px-6 sm:px-8 py-3 sm:py-3.5 bg-[#0E8A5A] text-white text-sm font-medium rounded-lg hover:bg-[#0E8A5A]/90 transition-colors duration-200"
        >
          Get Early Access
        </a>
      </div>

      <div className="relative z-10 mt-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="bg-white/90 backdrop-blur-sm border border-gray-200 border-b-0 pt-8 sm:pt-12 md:pt-16 px-5 sm:px-8 md:px-12 pb-0 shadow-sm">
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 md:gap-16">
            <div>
              <span className="text-[11px] uppercase tracking-[0.2em] text-[#14231C]/50 font-medium">
                WHAT DO WE DO?
              </span>
              <h2 className="mt-3 text-2xl sm:text-3xl md:text-4xl font-serif font-normal leading-tight tracking-tight text-[#14231C]">
                Neighbors helping
                <br className="hidden sm:block" /> neighbors
              </h2>
            </div>
            <div className="flex items-end">
              <p className="text-sm md:text-[15px] text-[#14231C]/70 leading-relaxed">
                A hyperlocal platform built for residential communities. Order from
                neighbors, discover local vendors, and stay connected to everything
                happening right where you live.
              </p>
            </div>
          </div>

          <div className="mt-6 sm:mt-8 md:mt-10 h-px bg-gray-200 w-full" />

          <div className="mt-4 sm:mt-6 grid sm:grid-cols-3 gap-2 sm:gap-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.number}
                className="group bg-[#EFF6F1] hover:bg-[#E3EFE8] transition-all duration-200 cursor-pointer px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between"
              >
                <span className="text-sm">
                  <span className="text-[#14231C]/40">{feature.number}</span>
                  <span className="mx-2 text-[#14231C]/30">/</span>
                  <span className="font-medium text-[#14231C]">{feature.label}</span>
                </span>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-gray-700 group-hover:translate-x-0.5 transition-all duration-200" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
