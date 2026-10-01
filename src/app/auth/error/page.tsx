import Link from "next/link";
import { Surface } from "@/components/ui/surface";

export default function AuthErrorPage() {
  return (
    <main className="min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center">
        <Surface className="w-full p-6 sm:p-8">
          <p className="text-xs font-semibold tracking-[0.16em] text-[var(--danger)] uppercase">
            Authentication
          </p>

          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">
            Sign-in could not be completed
          </h1>

          <p className="mt-3 leading-7 text-[var(--text-secondary)]">
            Your session was not created. Return to the Guild Organizer and
            try signing in again.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--surface-2)] px-4 text-sm font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-3)]"
          >
            Return home
          </Link>
        </Surface>
      </div>
    </main>
  );
}
