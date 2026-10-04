import { Surface } from "@/components/ui/surface";

export default function TemplateStructureLoading() {
  return (
    <div className="px-5 py-8 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[90rem]">
        <div className="h-5 w-36 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="mt-5 h-8 w-80 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="mt-3 h-5 max-w-2xl animate-pulse rounded bg-[var(--surface-2)]" />

        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Surface
              key={index}
              level={2}
              className="h-24 animate-pulse"
            />
          ))}
        </div>

        <Surface level={2} className="mt-8 h-72 animate-pulse" />
      </div>
    </div>
  );
}
