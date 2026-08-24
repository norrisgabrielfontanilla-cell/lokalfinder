const BARS = [0.4, 0.7, 0.5, 0.9, 0.6, 1, 0.45, 0.75, 0.55, 0.85, 0.5, 0.65];

export default function CommunityFallback() {
  return (
    <div className="w-full h-full flex items-end justify-center gap-2 sm:gap-3 px-8 pb-8 bg-surface-alt">
      {BARS.map((h, i) => (
        <div
          key={i}
          className="relative flex-1 max-w-10 rounded-t-sm bg-gradient-to-t from-ink/15 to-ink/5"
          style={{ height: `${h * 70}%` }}
        >
          {i % 4 === 1 ? (
            <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-brand" />
          ) : null}
        </div>
      ))}
    </div>
  );
}
