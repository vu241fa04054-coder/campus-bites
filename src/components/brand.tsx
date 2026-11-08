import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, ImageOff } from "lucide-react";

import logo from "@/assets/campusbite-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PAYMENT_LABEL, STATUS_LABEL, type PaymentStatus } from "@/lib/format";
import type { OrderStatus } from "@/lib/rules";

export function Logo({ className, to = "/" }: { className?: string; to?: "/" | "/admin" | "/menu" }) {
  return (
    <Link to={to} className={cn("flex items-center gap-2", className)} aria-label="CampusBite home">
      <img src={logo} alt="" width={36} height={36} className="h-9 w-9" />
      <span className="font-display text-xl font-bold tracking-tight text-foreground">
        Campus<span className="text-accent">Bite</span>
      </span>
    </Link>
  );
}

export function BackButton({ fallback = "/", label = "Back" }: { fallback?: "/" | "/menu" | "/orders" | "/admin"; label?: string }) {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        if (window.history.length > 1) router.history.back();
        else router.navigate({ to: fallback });
      }}
    >
      <ArrowLeft /> {label}
    </Button>
  );
}

export function PinInput({
  id,
  value,
  onChange,
  autoComplete = "current-password",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        inputMode="numeric"
        autoComplete={autoComplete}
        maxLength={10}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder="1–10 digits"
        className="pr-11 tracking-widest"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide PIN" : "Show PIN"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: "bg-warning/15 text-warning",
  accepted: "bg-info/15 text-info",
  preparing: "bg-accent/15 text-accent",
  ready: "bg-primary/15 text-primary",
  out_for_delivery: "bg-info/15 text-info",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/15 text-destructive",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_STYLE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}

const PAY_STYLE: Record<PaymentStatus, string> = {
  pending: "bg-warning/15 text-warning",
  paid: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  refunded: "bg-info/15 text-info",
};

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", PAY_STYLE[status])}>
      {PAYMENT_LABEL[status]}
    </span>
  );
}

/** Seed images live in /public; admin uploads live in private storage and need a signed URL. */
export function FoodImage({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(path && path.startsWith("/") ? path : null);

  useEffect(() => {
    if (!path) return setUrl(null);
    if (path.startsWith("/")) return setUrl(path);
    let active = true;
    supabase.storage
      .from("food-images")
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => active && setUrl(data?.signedUrl ?? null));
    return () => {
      active = false;
    };
  }, [path]);

  if (!url)
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ImageOff className="h-6 w-6" />
      </div>
    );
  return <img src={url} alt={alt} loading="lazy" className={cn("object-cover", className)} />;
}

export function PageTitle({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
