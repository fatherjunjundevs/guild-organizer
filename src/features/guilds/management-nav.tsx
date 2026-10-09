"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utilities/cn";

type ManagementNavProps = {
  guildId: string;
  canShare?: boolean;
};

const futureItems = ["History", "Settings"];

export function isManagementNavItemActive(
  pathname: string,
  href: string,
) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ManagementNav({ guildId, canShare = false }: ManagementNavProps) {
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
    {
      label: "Templates",
      href: `/app/guild/${guildId}/templates`,
    },
    {
      label: "Events",
      href: `/app/guild/${guildId}/events`,
    },
  ];
  if (canShare) items.push({ label: "Sharing", href: `/app/guild/${guildId}/sharing` });

  return (
    <nav aria-label="Management" className="pb-4 lg:px-3 lg:pb-5">
      <div className="overflow-x-auto px-5 pb-1 lg:overflow-visible lg:px-0 lg:pb-0">
        <div className="flex min-w-max gap-2 lg:block lg:min-w-0 lg:space-y-1">
          {items.map((item) => {
            const isActive = isManagementNavItemActive(
              pathname,
              item.href,
            );

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-9 shrink-0 items-center rounded-full border px-3 text-sm font-semibold transition-[background-color,border-color,color,box-shadow] duration-[var(--duration-fast)] lg:h-10 lg:w-full lg:rounded-[var(--radius-md)] lg:border-transparent",
                  isActive
                    ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm lg:border-transparent lg:shadow-none"
                    : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)] lg:bg-transparent lg:hover:border-transparent lg:hover:bg-[var(--surface-2)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="mt-2 hidden space-y-1 text-sm text-[var(--text-disabled)] lg:block">
        {futureItems.map((item) => (
          <span key={item} className="flex h-10 items-center px-3">
            {item}
          </span>
        ))}
      </div>
    </nav>
  );
}
