import Link from "next/link";

export function BrandMark() {
  return (
    <Link href="/" className="flex items-baseline gap-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="font-display text-2xl leading-none tracking-tight">RACO</span>
      <span className="t-meta">Fashion Studio</span>
    </Link>
  );
}
