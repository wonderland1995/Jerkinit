// src/app/page.tsx
import Link from "next/link";

export default function HomePage() {
  const quickStats = [
    { label: "Today’s Batches", value: "12", help: "+3 vs yesterday" },
    { label: "Active Products", value: "3", help: "All available" },
    { label: "Week Total", value: "67", help: "+15% vs last week" },
    { label: "Compliance", value: "98.5%", help: "Within tolerance" },
  ];

  const recentBatches = [
    { id: "JI-20241201-003", product: "Lucky 88", status: "Completed", compliance: 100 },
    { id: "JI-20241201-002", product: "7 Pot Punch", status: "Completed", compliance: 97.5 },
    { id: "JI-20241201-001", product: "Desert Spice", status: "In Progress", compliance: null },
    { id: "JI-20241130-008", product: "Lucky 88", status: "Completed", compliance: 98.8 },
    { id: "JI-20241130-007", product: "7 Pot Punch", status: "Completed", compliance: 100 },
  ];

  // Shared brutalist card class
  const brutalCard =
    "rounded-none border-4 border-black bg-white p-6 shadow-[8px_8px_0_0_#ec4899] active:translate-x-[2px] active:translate-y-[2px] transition-transform";

  // Pill/status helper
  const pill = (tone: "green" | "amber") =>
    `px-3 py-1 border-2 border-black rounded-full text-xs font-extrabold ${
      tone === "green" ? "bg-green-300" : "bg-amber-300"
    }`;

  return (
    <main className="min-h-dvh bg-pink-50 pb-28">
      {/* Header */}
      <header className="border-b-4 border-black bg-yellow-300">
        <div className="mx-auto max-w-7xl px-5 py-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-12 grid place-items-center font-extrabold text-white bg-black border-4 border-black shadow-[8px_8px_0_0_#ec4899]">
              JI
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Jerky Manufacture</h1>
              <p className="font-mono text-sm">Neo-Brutalist Traceability & QA</p>
            </div>
          </div>

          <nav className="hidden md:flex gap-3">
            {[
              { href: "/recipe/new", label: "New Batch" },
              { href: "/batches", label: "Batches" },
              { href: "/products", label: "Products" },
              { href: "/reports", label: "Reports" },
            ].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-none border-4 border-black bg-white px-4 py-2 font-bold shadow-[6px_6px_0_0_#ec4899] hover:translate-x-[2px] hover:translate-y-[2px] active:translate-x-[3px] active:translate-y-[3px] transition-transform"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8 space-y-10">
        {/* Intro */}
        <section className="space-y-1">
          <h2 className="text-2xl md:text-3xl font-extrabold">Good to go 👊</h2>
          <p className="font-mono text-sm md:text-base">Quick actions and today’s status at a glance.</p>
        </section>

        {/* Quick Stats */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {quickStats.map((s) => (
            <div key={s.label} className={brutalCard}>
              <p className="text-xs md:text-sm font-extrabold uppercase">{s.label}</p>
              <p className="mt-2 text-4xl md:text-5xl font-extrabold tracking-tight">{s.value}</p>
              <p className="mt-2 font-mono text-xs">{s.help}</p>
            </div>
          ))}
        </section>

        {/* Main Actions */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/recipe/new" className={`${brutalCard} bg-green-200`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl md:text-2xl font-extrabold">Create New Batch</h3>
                <p className="mt-2 text-sm md:text-base">Auto ID, scaled recipe, weigh-by-line workflow.</p>
              </div>
              <div className="hidden md:block">
                <svg className="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
                </svg>
              </div>
            </div>
          </Link>

          <Link href="/batches" className={`${brutalCard} bg-blue-200`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl md:text-2xl font-extrabold">Batch History</h3>
                <p className="mt-2 text-sm md:text-base">Review, print, and verify compliance.</p>
              </div>
              <div className="hidden md:block">
                <svg className="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12h6m-6 4h6m2 5H7V5h5.6L19 9v12z" />
                </svg>
              </div>
            </div>
          </Link>

          <Link href="/products" className={`${brutalCard} bg-purple-200`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl md:text-2xl font-extrabold">Products & Recipes</h3>
                <p className="mt-2 text-sm md:text-base">Ingredients, tolerances, curing rules.</p>
              </div>
              <div className="hidden md:block">
                <svg className="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M20 7l-8-4-8 4v10l8 4 8-4V7z" />
                </svg>
              </div>
            </div>
          </Link>

          <Link href="/reports" className={`${brutalCard} bg-yellow-200`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl md:text-2xl font-extrabold">Reports & Analytics</h3>
                <p className="mt-2 text-sm md:text-base">Compliance trends, CSV/PDF export.</p>
              </div>
              <div className="hidden md:block">
                <svg className="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 19v-6H5v6h4zm6 0V9h-4v10h4zm6 0V5h-4v14h4z" />
                </svg>
              </div>
            </div>
          </Link>
        </section>

        {/* Recent Batches */}
        <section>
          <h2 className="text-2xl md:text-3xl font-extrabold mb-4">Recent Batches</h2>
          <ul className="space-y-4">
            {recentBatches.map((b) => (
              <li key={b.id} className={`${brutalCard} p-4`}>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm md:text-base font-extrabold">{b.id}</span>
                    <span className="text-sm md:text-base">{b.product}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={pill(b.status === "Completed" ? "green" : "amber")}>
                      {b.status}
                    </span>
                    <span className="font-mono text-xs md:text-sm">
                      {typeof b.compliance === "number" ? `Compliance: ${b.compliance}%` : "—"}
                    </span>
                    <Link
                      href={`/batches/${b.id}`}
                      className="rounded-none border-4 border-black bg-white px-4 py-2 font-bold shadow-[6px_6px_0_0_#ec4899] hover:translate-x-[2px] hover:translate-y-[2px] transition-transform"
                    >
                      View →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Sticky bottom action bar (thumb-reachable) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-black bg-pink-100">
        <div className="mx-auto max-w-7xl px-5 py-3 grid grid-cols-3 gap-4">
          <Link
            href="/recipe/new"
            className="flex items-center justify-center gap-2 rounded-none border-4 border-black bg-white py-3 font-extrabold shadow-[8px_8px_0_0_#ec4899] active:translate-x-[2px] active:translate-y-[2px] transition-transform"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
            </svg>
            New Batch
          </Link>

          <Link
            href="/scan"
            className="flex items-center justify-center gap-2 rounded-none border-4 border-black bg-white py-3 font-extrabold shadow-[8px_8px_0_0_#ec4899] active:translate-x-[2px] active:translate-y-[2px] transition-transform"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M4 6h4M4 18h4M16 6h4M16 18h4M4 10h16M4 14h16" />
            </svg>
            Scan
          </Link>

          <Link
            href="/batches"
            className="flex items-center justify-center gap-2 rounded-none border-4 border-black bg-white py-3 font-extrabold shadow-[8px_8px_0_0_#ec4899] active:translate-x-[2px] active:translate-y-[2px] transition-transform"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 12h6m-6 4h6m2 5H7V5h5.6L19 9v12z" />
            </svg>
            Batches
          </Link>
        </div>
      </div>
    </main>
  );
}
