import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NavbarLink = {
  label: string;
  href: string;
};

const defaultLinks: NavbarLink[] = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export function Navbar({
  brand = "Vipe DZ",
  links = defaultLinks,
  className,
}: {
  brand?: string;
  links?: NavbarLink[];
  className?: string;
}) {
  return (
    <header className={cn("w-full border-b border-border/60 bg-background/70 backdrop-blur", className)}>
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <a href="#" className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/12 text-primary">
            <span className="text-sm">⚡</span>
          </span>
          <span className="text-sm sm:text-base">{brand}</span>
        </a>

        <div className="hidden items-center gap-6 sm:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
            Sign in
          </Button>
          <Button variant="glow" size="sm">
            Get started
          </Button>
        </div>
      </nav>
    </header>
  );
}
