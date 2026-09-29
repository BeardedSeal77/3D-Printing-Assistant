"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { BoxesIcon, FlaskConicalIcon, PrinterIcon } from "lucide-react"

const links = [
  { href: "/", label: "Materials", icon: FlaskConicalIcon },
  { href: "/inventory", label: "Inventory", icon: BoxesIcon },
]

export function SiteNav() {
  const pathname = usePathname()
  return (
    <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-medium">
          <PrinterIcon className="size-5" />
          <span>Print Dashboard</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>
    </header>
  )
}
