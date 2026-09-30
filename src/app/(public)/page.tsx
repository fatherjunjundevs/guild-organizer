import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { Surface } from "@/components/ui/surface";

export default function HomePage() {
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center">
        <div className="grid w-full gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <section>
            <StatusChip tone="accent">FatherJunJun RTNW Tools</StatusChip>

            <p className="mt-7 text-sm font-semibold tracking-[0.18em] text-[var(--guild-accent)] uppercase">
              Ragnarok: The New World
            </p>

            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-[var(--text-primary)] sm:text-5xl lg:text-6xl">
              Guild Organizer
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--text-secondary)]">
              Import your guild once, organize event rosters, publish official
              assignments, and give every member one clear place to see where
              they belong.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg">Guild Organizer</Button>
              <Button variant="secondary" size="lg">
                Design Foundation
              </Button>
            </div>

            <p className="mt-8 text-sm text-[var(--text-tertiary)]">
              Unofficial community tool. Not affiliated with the game
              publisher.
            </p>
          </section>

          <Surface className="overflow-hidden p-2 shadow-2xl shadow-black/20">
            <div className="glass-chrome rounded-[calc(var(--radius-xl)-4px)] p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold tracking-[0.16em] text-[var(--text-tertiary)] uppercase">
                    Command Center
                  </p>
                  <h2 className="mt-1 text-xl font-semibold">Guild League</h2>
                </div>

                <StatusChip tone="success">Published</StatusChip>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <Surface level={2} className="p-4">
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Characters
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">145</p>
                </Surface>

                <Surface level={2} className="p-4">
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Assigned
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">142</p>
                </Surface>

                <Surface level={2} className="p-4">
                  <p className="text-xs text-[var(--text-tertiary)]">
                    Warnings
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-[var(--warning)]">
                    2
                  </p>
                </Surface>
              </div>
            </div>
          </Surface>
        </div>
      </div>
    </main>
  );
}