import Link from "next/link";
import { cn } from "cn";

const SIZES = {
  md: { tile: "size-8 rounded-xl sm:size-9", icon: "size-4 sm:size-5", text: "text-xl sm:text-[1.65rem]", gap: "gap-2 sm:gap-2.5" },
  xl: { tile: "size-11 rounded-2xl sm:size-14", icon: "size-6 sm:size-8", text: "text-4xl sm:text-5xl", gap: "gap-3 sm:gap-4" },
} as const;

// Icon tile + wordmark. Renders a link when `href` is given, plain text otherwise
// (e.g. inside the landing page's <h1>).
export function BrandLogo({
  href,
  size = "md",
  className,
}: {
  href?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = SIZES[size];
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center bg-gradient-to-br from-sky-400 to-indigo-600 text-white shadow-md shadow-indigo-700/30 ring-1 ring-white/20",
          s.tile
        )}
      >
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={s.icon}
        >
          <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
        </svg>
      </span>
      <span className={cn("font-display font-extrabold leading-none tracking-tight whitespace-nowrap", s.text)}>
        Travel{" "}
        <span className="bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-transparent dark:from-sky-300 dark:to-indigo-400">
          Tutorial
        </span>
      </span>
    </>
  );

  const classes = cn("inline-flex items-center", s.gap, className);
  return href ? (
    <Link href={href} className={classes}>
      {content}
    </Link>
  ) : (
    <span className={classes}>{content}</span>
  );
}
