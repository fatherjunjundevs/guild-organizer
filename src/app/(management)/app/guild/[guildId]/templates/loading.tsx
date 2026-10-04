import { Surface } from "@/components/ui/surface";

export default function TemplatesLoading() {
  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[90rem]">
        <div className="h-7 w-28 animate-pulse rounded-full bg-[var(--surface-3)]" />
        <div className="mt-4 h-10 w-64 animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-2)]" />
        <div className="mt-3 h-5 max-w-2xl animate-pulse rounded-[var(--radius-md)] bg-[var(--surface-2)]" />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Surface key={index} level={2} className="h-24 animate-pulse" />
          ))}
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => (
            <Surface key={index} level={2} className="h-56 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}
