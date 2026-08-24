import Logo from './Logo';

const NAV_LINKS = [
  { label: 'Discover', href: '#discover' },
  { label: 'Community', href: '#community' },
  { label: 'Vendors', href: '#vendors' },
  { label: 'About', href: '#about' },
];

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 sm:px-10 md:px-14 py-4 sm:py-5">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <a href="#" className="justify-self-start flex items-center gap-2.5">
          <Logo className="w-6 h-6 text-[#14231C]" />
          <span className="font-semibold text-base tracking-tight text-[#14231C]">
            LokalFinder
          </span>
        </a>

        <div className="justify-self-center hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[#14231C]/70 hover:text-[#14231C] transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
        </div>

        <a
          href="#early-access"
          className="justify-self-end px-5 py-2.5 bg-[#0E8A5A] text-white text-sm font-medium rounded-lg hover:bg-[#0E8A5A]/90 transition-colors duration-200"
        >
          Get Early Access
        </a>
      </div>
    </nav>
  );
}
