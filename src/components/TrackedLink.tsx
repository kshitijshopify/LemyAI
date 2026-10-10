"use client";

import { track } from "@/lib/analytics";

export function TrackedLink({
  href,
  event,
  params,
  className,
  children,
  external,
}: {
  href: string;
  event: string;
  params?: Record<string, unknown>;
  className?: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => track(event, params)}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
    >
      {children}
    </a>
  );
}
