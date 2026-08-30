type LogoProps = {
  className?: string;
};

export default function Logo({ className }: LogoProps) {
  return (
    <svg viewBox="0 0 256 256" fill="currentColor" className={className} aria-hidden="true">
      <path d="M 64 32 L 128 32 L 128 160 L 224 160 L 224 224 L 64 224 Z" />
    </svg>
  );
}
