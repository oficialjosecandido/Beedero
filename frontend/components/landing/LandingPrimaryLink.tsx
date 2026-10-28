"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

/**
 * CTA into the app. Prefetches the destination as soon as the landing paints
 * so Enter / Join does not wait for the first RSC round-trip on click.
 */
export function LandingPrimaryLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    router.prefetch(href);
  }, [href, router]);

  return (
    <Link href={href} prefetch className={className}>
      {children}
    </Link>
  );
}
