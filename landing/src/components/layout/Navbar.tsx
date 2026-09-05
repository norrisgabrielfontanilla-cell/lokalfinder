import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Logo from '../ui/Logo';
import Container from '../ui/Container';
import { NAV_LINKS } from '../../data/content';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [overDark, setOverDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Sample just below the fixed navbar's own height, otherwise
    // elementFromPoint only ever hits the navbar itself.
    const PROBE_Y = 96;

    const onScroll = () => {
      setScrolled(window.scrollY > 24);
      const el = document.elementFromPoint(window.innerWidth / 2, PROBE_Y);
      setOverDark(Boolean(el?.closest('[data-nav-theme="dark"]')));
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const barTheme = overDark
    ? 'bg-ink/70 backdrop-blur-md border-b border-white/10'
    : scrolled
      ? 'bg-white/85 backdrop-blur-md border-b border-line'
      : 'bg-transparent border-b border-transparent';

  const textTheme = overDark ? 'text-white' : 'text-ink';
  const linkTheme = overDark ? 'text-white/70 hover:text-white' : 'text-ink/70 hover:text-ink';

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${barTheme}`}>
      <Container>
        <nav className="grid grid-cols-[1fr_auto_1fr] items-center py-4 sm:py-5">
          <a href="#" className={`justify-self-start flex items-center gap-2.5 ${textTheme}`}>
            <Logo className="w-6 h-6" />
            <span className="font-semibold text-base tracking-tight">Lokal Finder</span>
          </a>

          <div className="justify-self-center hidden lg:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm transition-colors duration-200 ${linkTheme}`}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="justify-self-end flex items-center gap-3">
            <a
              href="/lokalfinder/"
              className="hidden sm:inline-flex px-5 py-2.5 bg-brand text-white text-sm font-medium rounded-lg hover:bg-brand/90 transition-colors duration-200 whitespace-nowrap"
            >
              Get Early Access
            </a>
            <button
              type="button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className={`lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg transition-colors duration-200 ${textTheme} ${overDark ? 'hover:bg-white/10' : 'hover:bg-ink/5'}`}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>
      </Container>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="lg:hidden overflow-hidden bg-white border-b border-line"
          >
            <Container className="flex flex-col gap-1 py-4">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="py-2.5 text-base text-ink/80 hover:text-ink transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="/lokalfinder/"
                onClick={() => setMenuOpen(false)}
                className="mt-2 px-5 py-3 bg-brand text-white text-sm font-medium rounded-lg text-center"
              >
                Get Early Access
              </a>
            </Container>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}
