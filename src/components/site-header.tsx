import { Link } from "@tanstack/react-router";
import { ClipboardList, LayoutDashboard, LogOut, ShoppingCart, User, UtensilsCrossed } from "lucide-react";

import { Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useAuth, useSignOut } from "@/lib/auth";
import { useCart } from "@/lib/cart";

const navLink =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground";
const navActive = "bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary";

export function SiteHeader() {
  const { user, role, loading } = useAuth();
  const { count } = useCart();
  const signOut = useSignOut();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
        <Logo />
        {loading ? (
          <div className="h-8 w-40" />
        ) : user && role === "student" ? (
          <nav className="flex items-center gap-1">
            <Link to="/menu" className={navLink} activeProps={{ className: navActive }}>
              <UtensilsCrossed className="h-4 w-4" />
              <span className="hidden sm:inline">Menu</span>
            </Link>
            <Link to="/orders" className={navLink} activeProps={{ className: navActive }}>
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Orders</span>
            </Link>
            <Link to="/cart" className={navLink} activeProps={{ className: navActive }}>
              <span className="relative">
                <ShoppingCart className="h-4 w-4" />
                {count > 0 && (
                  <span className="absolute -right-2.5 -top-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                    {count}
                  </span>
                )}
              </span>
              <span className="hidden sm:inline">Cart</span>
            </Link>
            <Link to="/profile" className={navLink} activeProps={{ className: navActive }}>
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => signOut("/")} aria-label="Log out">
              <LogOut /> <span className="hidden md:inline">Logout</span>
            </Button>
          </nav>
        ) : user && role === "admin" ? (
          <nav className="flex items-center gap-2">
            <Button asChild variant="soft" size="sm">
              <Link to="/admin">
                <LayoutDashboard /> Dashboard
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut("/")}>
              <LogOut /> Logout
            </Button>
          </nav>
        ) : (
          <nav className="flex items-center gap-2">
            <Link to="/admin-login" className={`${navLink} hidden sm:inline-flex`}>
              Admin
            </Link>
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link to="/register">Register</Link>
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t bg-secondary/40">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
        <p>© {new Date().getFullYear()} CampusBite · College canteen pre-ordering</p>
        <p>Open 08:00 – 18:00 IST</p>
      </div>
    </footer>
  );
}
