import Link from "next/link";

interface VoyaraLogoProps {
  href?: string;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  size?: "sm" | "md" | "lg";
}

export function VoyaraLogo({
  href = "/",
  className,
  iconClassName,
  textClassName,
  size = "md",
}: VoyaraLogoProps) {
  const iconSizes = {
    sm: "w-5 h-4",
    md: "w-6 h-5",
    lg: "w-8 h-6",
  };

  const textSizes = {
    sm: "text-base font-serif font-bold tracking-tight text-[var(--foreground)]",
    md: "text-xl font-serif font-bold tracking-tight text-[var(--foreground)]",
    lg: "text-2xl font-serif font-extrabold tracking-tight text-[var(--foreground)]",
  };

  const finalIconClass = iconClassName || iconSizes[size];
  const finalTextClass = textClassName || textSizes[size];
  const finalContainerClass =
    className ||
    "flex items-center gap-2.5 hover:opacity-90 transition-opacity drop-shadow";

  const content = (
    <>
      <svg className={`${finalIconClass} text-[var(--gold)] shrink-0`} viewBox="0 0 28 20" fill="none">
        <path
          d="M2 17L10 3L16 13L21 6L26 17H2Z"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className={finalTextClass}>Voyara</span>
    </>
  );

  if (!href) {
    return <div className={finalContainerClass}>{content}</div>;
  }

  return (
    <Link href={href} className={finalContainerClass}>
      {content}
    </Link>
  );
}

export default VoyaraLogo;
