"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, X, ArrowRight, Heart } from "lucide-react";
import { Brand } from "./brand";
export function PublicShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [path]);
  useEffect(() => {
    document.documentElement.classList.add("js-reveal");
    const nodes = document.querySelectorAll(".reveal");
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            observer.unobserve(e.target);
          }
        }),
      { threshold: 0.08 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => {
      observer.disconnect();
      document.documentElement.classList.remove("js-reveal");
    };
  }, [path]);
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="announcement">
        A little guidance can make a world of difference.
        <Link href="/get-support">
          Let’s find your next step <ArrowUpRight size={13} />
        </Link>
      </div>
      <header className="site-header">
        <div className="shell nav-inner">
          <Brand />
          <nav
            aria-label="Main navigation"
            className={open ? "main-nav open" : "main-nav"}
          >
            {[
              ["Our story", "/about"],
              ["How we help", "/services"],
              ["Resources", "/resources"],
              ["Get involved", "/get-involved"],
            ].map(([text, href]) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? "page" : undefined}
              >
                {text}
              </Link>
            ))}
            <Link className="mobile-only" href="/login">
              Team sign in
            </Link>
          </nav>
          <Link href="/donate" className="button button-dark nav-donate">
            <span className="donate-desktop-label">Give a little good</span>
            <span className="donate-mobile-label">Give</span>
            <Heart size={15} />
          </Link>
          <button
            className="menu-button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label="Toggle navigation"
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">{children}</main>
      <footer className="footer">
        <div className="shell footer-top">
          <div>
            <Brand />
            <p>
              A clearer path through aging.
              <br />A community beside you.
            </p>
          </div>
          <div>
            <span className="eyebrow">FIND YOUR WAY</span>
            <Link href="/services">How we help</Link>
            <Link href="/get-support">Find support</Link>
            <Link href="/resources">Resource library</Link>
          </div>
          <div>
            <span className="eyebrow">GROW WITH US</span>
            <Link href="/about">Our foundation</Link>
            <Link href="/get-involved">Volunteer & partner</Link>
            <Link href="/donate">Support our work</Link>
          </div>
          <div className="footer-invitation">
            <span className="eyebrow">LET’S TAKE THE NEXT STEP</span>
            <p>
              Good things begin
              <br />
              with a conversation.
            </p>
            <Link className="text-link" href="/get-support">
              Reach out to us <ArrowUpRight size={18} />
            </Link>
          </div>
        </div>
        <div className="shell footer-bottom">
          <span>© {new Date().getFullYear()} The Elder Care Foundation</span>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/accessibility">Accessibility</Link>
            <Link href="/login">
              Team sign in <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
        <div className="shell footer-note">
          We provide information, navigation and connections to external
          professionals. We do not provide medical treatment or residential
          care. Editorial images are AI generated.
        </div>
      </footer>
    </>
  );
}
export function ArrowLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`text-link ${className}`}>
      {children}
      <ArrowUpRight size={19} />
    </Link>
  );
}
