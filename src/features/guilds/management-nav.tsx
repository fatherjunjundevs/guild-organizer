"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utilities/cn";

type ManagementNavProps = {
  guildId: string;
};

const futureItems = ["Events", "Templates", "History", "Settings"];

export function ManagementNav({ guildId }: ManagementNavProps) {
  const pathname = usePathname();

  const items = [
    {
      label: "Dashboard",
      href: `/app/guild/${guildId}/dashboard`,
    },
    {
      label: "Roster",
      href: `/app/guild/${guildId}/roster`,
    },
  ];

  return (
    <nav aria-label="Management" className="hidden px-3 pb-5 lg:block">
      <div className="space-y-1">
        {items.map((item) => {
          const isActive =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex h-10 items-center rounded-[var(--radius-md)] px-3 text-sm font-semibold transition-colors",
                isActive
                  ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--surface-2)] hover:text-[var(--text-primary)]",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-2 space-y-1 text-sm text-[var(--text-disabled)]">
        {futureItems.map((item) => (
          <span key={item} className="flex h-10 items-center px-3">
            {item}
          </span>
        ))}
      </div>
    </nav>
  );
}
