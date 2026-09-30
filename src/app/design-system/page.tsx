import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

const surfaces = [
  ["Base", "var(--bg-base)"],
  ["Canvas", "var(--bg-canvas)"],
  ["Surface 1", "var(--surface-1)"],
  ["Surface 2", "var(--surface-2)"],
  ["Surface 3", "var(--surface-3)"],
  ["Surface 4", "var(--surface-4)"],
];

export default function DesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-[var(--border-subtle)] pb-8">
          <StatusChip tone="accent">Development Only</StatusChip>

          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
            Guild Organizer Design System
          </h1>

          <p className="mt-3 max-w-2xl text-[var(--text-secondary)]">
            Production reference for colors, typography, controls, surfaces,
            states, and Guild theming.
          </p>
        </header>

        <section className="py-10">
          <SectionTitle
            eyebrow="Foundation"
            title="Surfaces"
            description="Opaque surfaces remain the primary working material."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {surfaces.map(([name, color]) => (
              <div key={name}>
                <div
                  className="h-28 rounded-[var(--radius-xl)] border border-[var(--border-default)]"
                  style={{ background: color }}
                />
                <p className="mt-2 text-sm font-medium">{name}</p>
                <p className="text-xs text-[var(--text-tertiary)]">{color}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-10">
          <SectionTitle
            eyebrow="Typography"
            title="Type hierarchy"
            description="System typography keeps the interface fast and familiar."
          />

          <Surface className="mt-6 space-y-6 p-6">
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-[var(--text-tertiary)] uppercase">
                Display
              </p>
              <p className="mt-1 text-5xl font-semibold tracking-[-0.04em]">
                Guild Command Center
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-[var(--text-tertiary)] uppercase">
                Heading
              </p>
              <p className="mt-1 text-2xl font-semibold">Guild League</p>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-[var(--text-tertiary)] uppercase">
                Body
              </p>
              <p className="mt-1 max-w-2xl leading-7 text-[var(--text-secondary)]">
                Organize Characters, build Event rosters, and publish official
                assignments without losing control of Guild history.
              </p>
            </div>
          </Surface>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-10">
          <SectionTitle
            eyebrow="Actions"
            title="Buttons"
            description="Shared action hierarchy for management and Event workflows."
          />

          <Surface className="mt-6 flex flex-wrap gap-3 p-6">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Destructive</Button>
            <Button disabled>Disabled</Button>
          </Surface>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-10">
          <SectionTitle
            eyebrow="States"
            title="Status chips"
            description="Semantic state remains separate from Guild branding."
          />

          <Surface className="mt-6 flex flex-wrap gap-3 p-6">
            <StatusChip>Draft</StatusChip>
            <StatusChip tone="accent">Selected</StatusChip>
            <StatusChip tone="success">Published</StatusChip>
            <StatusChip tone="warning">Warning</StatusChip>
            <StatusChip tone="danger">Offline</StatusChip>
          </Surface>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-10">
          <SectionTitle
            eyebrow="Guild Branding"
            title="Guild accent"
            description="Guild identity can change without rewriting component styles."
          />

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Surface className="p-6">
              <p className="text-sm font-semibold">Product Accent</p>
              <div className="mt-4">
                <Button>Primary Action</Button>
              </div>
            </Surface>

            <Surface className="guild-accent p-6">
              <p className="text-sm font-semibold">IMMORTALS fixture accent</p>
              <div className="mt-4">
                <Button>Guild Action</Button>
              </div>
            </Surface>
          </div>
        </section>

        <section className="border-t border-[var(--border-subtle)] py-10">
          <SectionTitle
            eyebrow="Material"
            title="Functional glass"
            description="Glass is reserved for functional chrome and overlays."
          />

          <div className="mt-6 rounded-[var(--radius-2xl)] bg-[var(--bg-canvas)] p-8">
            <div className="glass-chrome rounded-[var(--radius-xl)] p-6">
              <p className="font-semibold">Event Command Bar</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                A functional glass surface, not a decorative content card.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.16em] text-[var(--guild-accent)] uppercase">
        {eyebrow}
      </p>

      <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {description}
      </p>
    </div>
  );
}