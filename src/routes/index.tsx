import { createFileRoute, Link } from "@tanstack/react-router";
import { Clock, ShieldCheck, ShoppingBag, Timer, UtensilsCrossed } from "lucide-react";

import hero from "@/assets/hero-food.jpg";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CampusBite — Pre-order your college canteen food" },
      {
        name: "description",
        content: "Browse the canteen menu, order ahead, choose your pickup time and skip the queue with CampusBite.",
      },
      { property: "og:title", content: "CampusBite — Pre-order your college canteen food" },
      {
        property: "og:description",
        content: "Browse the canteen menu, order ahead, choose your pickup time and skip the queue.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const DISHES = [
  { name: "Masala Dosa", img: "/images/food/masala-dosa.jpg", tag: "Breakfast" },
  { name: "Veg Thali", img: "/images/food/veg-thali.jpg", tag: "Meals" },
  { name: "Samosa", img: "/images/food/samosa.jpg", tag: "Snacks" },
  { name: "Cold Coffee", img: "/images/food/cold-coffee.jpg", tag: "Beverages" },
  { name: "Veg Biryani", img: "/images/food/veg-biryani.jpg", tag: "Meals" },
  { name: "Masala Chai", img: "/images/food/masala-chai.jpg", tag: "Beverages" },
];

const STEPS = [
  { icon: UtensilsCrossed, title: "Pick your food", text: "Browse today's menu with live stock." },
  { icon: Timer, title: "Choose pickup time", text: "Type any time between 08:00 and 18:00." },
  { icon: ShoppingBag, title: "Collect & enjoy", text: "Track your order and pick it up hot." },
];

function Home() {
  const { user, role } = useAuth();
  const isStudent = user && role === "student";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="bg-hero">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:grid-cols-2 md:py-20">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                <Clock className="h-3.5 w-3.5" /> Canteen open 08:00 – 18:00 IST
              </span>
              <h1 className="mt-5 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
                Skip the queue.
                <br />
                <span className="text-primary">Pre-order</span> your <span className="text-accent">canteen</span> food.
              </h1>
              <p className="mt-5 max-w-md text-lg text-muted-foreground">
                CampusBite lets students order ahead, choose a pickup time and track their order — all from their
                phone.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                {isStudent ? (
                  <Button asChild variant="hero" size="lg">
                    <Link to="/menu">Browse menu</Link>
                  </Button>
                ) : role === "admin" ? (
                  <Button asChild variant="hero" size="lg">
                    <Link to="/admin">Open dashboard</Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="hero" size="lg">
                      <Link to="/register">Get started — it's free</Link>
                    </Button>
                    <Button asChild variant="outline" size="lg" className="rounded-full">
                      <Link to="/login">Student login</Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 -z-0 rounded-[2rem] bg-accent/10 blur-2xl" aria-hidden />
              <img
                src={hero}
                alt="Masala dosa, samosas, thali and chai on a canteen table"
                width={1600}
                height={1008}
                className="relative aspect-[16/11] w-full rounded-3xl object-cover shadow-lift"
              />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border bg-card p-6 shadow-soft">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-accent">Step {i + 1}</p>
                <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-secondary/50">
          <div className="mx-auto max-w-6xl px-4 py-14">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold sm:text-3xl">Campus favourites</h2>
                <p className="mt-1 text-muted-foreground">Freshly made every day in our canteen kitchen.</p>
              </div>
              <Button asChild variant="accent" className="rounded-full">
                <Link to={isStudent ? "/menu" : "/login"}>See full menu</Link>
              </Button>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3">
              {DISHES.map((d) => (
                <div key={d.name} className="group overflow-hidden rounded-2xl border bg-card shadow-soft">
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    <img
                      src={d.img}
                      alt={d.name}
                      loading="lazy"
                      width={600}
                      height={600}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>
                  <div className="flex items-center justify-between p-4">
                    <span className="font-semibold">{d.name}</span>
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
                      {d.tag}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="flex flex-col items-center justify-between gap-6 rounded-3xl bg-brand p-8 text-primary-foreground sm:flex-row sm:p-10">
            <div>
              <h2 className="text-2xl font-bold">Canteen staff?</h2>
              <p className="mt-1 opacity-90">Manage orders, menu, stock and reports from the admin dashboard.</p>
            </div>
            <Button asChild variant="accent" size="lg" className="rounded-full">
              <Link to="/admin-login">
                <ShieldCheck /> Admin login
              </Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
