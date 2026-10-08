import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

export function Footer() {
  const nav = useTranslations("nav");
  const common = useTranslations("common");
  const footer = useTranslations("common.footer");

  const groups = [
    {
      title: footer("product"),
      links: [
        { label: nav("features"), href: "/#features" },
        { label: nav("pricing"), href: "/pricing" }
      ]
    },
    {
      title: footer("company"),
      links: [
        { label: nav("about"), href: "/about" },
        { label: footer("contact"), href: "mailto:hello@finadvisor.uz" }
      ]
    },
    {
      title: footer("resources"),
      links: [
        { label: footer("help"), href: "mailto:hello@finadvisor.uz" },
        { label: footer("terms"), href: "/terms" },
        { label: footer("privacy"), href: "/privacy" },
        { label: footer("refund"), href: "/refund" },
        { label: footer("aiDisclaimer"), href: "/ai-disclaimer" }
      ]
    },
    {
      title: footer("account"),
      links: [
        { label: nav("login"), href: "/login" },
        { label: nav("signup"), href: "/signup" }
      ]
    }
  ];

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-page py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {groups.map((group) => (
            <section key={group.title}>
              <h2 className="text-sm font-semibold">{group.title}</h2>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      className="text-sm text-muted-foreground transition-colors hover:translate-x-0.5 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      href={link.href}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-10 border-t border-border pt-6 text-xs leading-6 text-muted-foreground">
          {common("disclaimer")}
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} FinAdvisor
        </p>
      </div>
    </footer>
  );
}
