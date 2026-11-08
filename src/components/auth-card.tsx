import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Home } from "lucide-react";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  badge,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-hero">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4">
        <Logo />
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <Home /> Back to Home
          </Link>
        </Button>
      </div>
      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md animate-fade-up rounded-3xl border bg-card p-7 shadow-lift sm:p-9">
          {badge}
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
          {footer && <div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export function safeRedirect(path: string | undefined, fallback: string): string {
  if (!path) return fallback;
  try {
    const url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return url.pathname + url.search;
  } catch {
    return fallback;
  }
}
