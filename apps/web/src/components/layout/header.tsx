"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

export function Header() {
  const t = useTranslations("nav");
  const [scrolled, setScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const updateScroll = () => {
      setScrolled(window.scrollY > 8);
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(
        scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0
      );
    };
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  const links = [
    { href: "/#features", label: t("features") },
    { href: "/pricing", label: t("pricing") },
    { href: "/about", label: t("about") }
  ];

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-x-0 top-0 z-50 h-0.5"
        data-testid="scroll-progress"
      >
        <div
          className="h-full bg-primary transition-[width] duration-150"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>
      <header
        className={`sticky top-0 z-40 border-b border-border/70 transition-colors ${
          scrolled
            ? "bg-background/85 shadow-sm backdrop-blur-xl"
            : "bg-background"
        }`}
      >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-page">
        <Link
          aria-label="FinAdvisor"
          className="shrink-0 text-xl font-bold tracking-tight text-foreground"
          href="/"
          onClick={() => setMenuOpen(false)}
        >
          FinAdvisor
        </Link>

        <nav
          aria-label={t("primaryNavigation")}
          className="hidden items-center gap-8 md:flex"
        >
          {links.map((link) => (
            <Link
              className="text-sm font-medium text-muted-foreground transition-all hover:-translate-y-0.5 hover:text-primary"
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <div className="hidden items-center gap-1.5 sm:flex">
            <LocaleSwitcher />
            <ThemeToggle />
          </div>
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost">
              <Link href="/login">{t("login")}</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">{t("signup")}</Link>
            </Button>
          </div>
          <Button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
            className="md:hidden"
            data-testid="mobile-menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            size="icon"
            variant="outline"
          >
            <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
          </Button>
        </div>
      </div>

      {menuOpen ? (
        <nav
          aria-label={t("mobileNavigation")}
          className="absolute inset-x-0 top-16 border-b border-border bg-background p-5 shadow-lg md:hidden"
        >
          <div className="mx-auto flex max-w-7xl flex-col gap-4">
            {links.map((link) => (
              <Link
                className="py-1 text-sm font-medium"
                href={link.href}
                key={link.href}
                onClick={() => setMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="flex items-center gap-3 border-t border-border pt-4 sm:hidden">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
            <div className="flex gap-2 border-t border-border pt-4 md:hidden">
              <Button asChild className="flex-1" variant="outline">
                <Link href="/login" onClick={() => setMenuOpen(false)}>
                  {t("login")}
                </Link>
              </Button>
              <Button asChild className="flex-1">
                <Link href="/signup" onClick={() => setMenuOpen(false)}>
                  {t("signup")}
                </Link>
              </Button>
            </div>
          </div>
        </nav>
      ) : null}
      </header>
    </>
  );
}
