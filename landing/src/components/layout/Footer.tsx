import Logo from '../ui/Logo';
import Container from '../ui/Container';
import { FOOTER_LINKS } from '../../data/content';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-line py-14 sm:py-16">
      <Container>
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-12">
          <div className="max-w-xs">
            <a href="#" className="flex items-center gap-2.5">
              <Logo className="w-6 h-6 text-ink" />
              <span className="font-semibold text-base tracking-tight text-ink">Lokal Finder</span>
            </a>
            <p className="mt-4 text-sm text-ink/55 leading-relaxed">
              The operating layer for discovering and ordering from businesses inside your
              own community — starting with food.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
              <div key={heading}>
                <p className="text-xs uppercase tracking-[0.15em] text-ink/40 font-medium mb-4">
                  {heading}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {links.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        className="text-sm text-ink/65 hover:text-ink transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 pt-8 border-t border-line flex flex-col sm:flex-row justify-between gap-4 text-xs text-ink/40">
          <span>© {new Date().getFullYear()} Lokal Finder. All rights reserved.</span>
          <span>Built for communities, one neighborhood at a time.</span>
        </div>
      </Container>
    </footer>
  );
}
