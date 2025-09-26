import Link from "next/link";

export default function HomePage() {
  const quickStats = [
    { label: "Today’s Batches", value: "12", help: "+3 vs yesterday" },
    { label: "Active Products", value: "3", help: "All available" },
    { label: "Week Total", value: "67", help: "+15% vs last week" },
    { label: "Compliance Rate", value: "98.5%", help: "Within tolerance" },
  ];

  const mainActions = [
    {
      title: "Create New Batch",
      desc: "Start a batch with auto ID & scaled recipe",
      href: "/recipe/new",
      color: "bg-green-600 hover:bg-green-700",
      icon: (
        <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      title: "Batch History",
      desc: "Review batches, print, and verify",
      href: "/batches",
      color: "bg-blue-600 hover:bg-blue-700",
      icon: (
        <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      title: "Products & Recipes",
      desc: "Update ingredients & tolerances",
      href: "/products",
      color: "bg-purple-600 hover:bg-purple-700",
      icon: (
        <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
    {
      title: "Reports",
      desc: "Compliance & trends, export CSV/PDF",
      href: "/reports",
      color: "bg-amber-600 hover:bg-amber-700",
      icon: (
        <svg className="size-7" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
  ];

  const recentBatches = [
    { id: "JI-20241201-003", product: "Lucky 88", status: "completed", compliance: 100 },
    { id: "JI-20241201-002", product: "7 Pot Punch", status: "completed", compliance: 97.5 },
    { id: "JI-20241201-001", product: "Desert Spice", status: "in_progress", compliance: null },
    { id: "JI-20241130-008", product: "Lucky 88", status: "completed", compliance: 98.8 },
    { id: "JI-20241130-007", product: "7 Pot Punch", status: "completed", compliance: 100 },
  ];

  return (
    <main className="min-h-dvh bg-gray-50 pb-28">
      {/* Top App Bar */}
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-7xl px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gray-900 text-white grid place-items-center font-bold">JI</div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Manufacture</h1>
              <p className="text-xs text-gray-500">Beef Jerky Traceability & QA</p>
            </div>
          </div>
          <nav className="hidden md:flex gap-2">
            <Link href="/recipe/new" className="px-4 py-2 rounded-xl border hover:bg-gray-50">New Batch</Link>
            <Link href="/batches" className="px-4 py-2 rounded-xl border hover:bg-gray-50">Batches</Link>
            <Link href="/products" className="px-4 py-2 rounded-xl border hover:bg-gray-50">Products</Link>
            <Link href="/reports" className="px-4 py-2 rounded-xl border hover:bg-gray-50">Reports</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-6">
        {/* Welcome / Context */}
        <section className="mb-6">
          <h2 className="text-3xl font-semibold leading-tight">Let's Get To Work</h2>
          <p className="mt-1 text-gray-600">Quick actions and today’s status at a glance.</p>
        </section>

        {/* Quick Stats — large, tappable cards */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {quickStats.map((s) => (
            <div
              key={s.label}
              className="select-none rounded-2xl border bg-white p-5 shadow-sm active:scale-[0.99] transition"
            >
              <div className="text-sm text-gray-500">{s.label}</div>
              <div className="mt-2 text-3xl font-extrabold tracking-tight">{s.value}</div>
              <div className="mt-1 text-xs text-gray-500">{s.help}</div>
            </div>
          ))}
        </section>

        {/* Primary Actions — big touch targets */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          {mainActions.map((a) => (
            <Link
              key={a.title}
              href={a.href}
              className="group rounded-3xl border bg-white p-5 shadow-sm hover:shadow-md transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <div className="flex items-center gap-4">
                <div className={`${a.color} text-white rounded-2xl p-4 grid place-items-center`}>
                  {a.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{a.title}</h3>
                  <p className="mt-1 text-gray-600">{a.desc}</p>
                </div>
                <svg className="size-6 text-gray-400 group-hover:text-gray-600 transition" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </section>

        {/* Recent Batches — touch-friendly list (bigger rows, no cramped table) */}
        <section className="rounded-3xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between px-2 pb-3">
            <h2 className="text-xl font-semibold">Recent Batches</h2>
            <Link href="/batches" className="text-blue-600 hover:underline text-sm">View all</Link>
          </div>

          <ul className="divide-y">
            {recentBatches.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/batches/${b.id}`}
                  className="flex items-center gap-4 px-3 py-4 hover:bg-gray-50 active:bg-gray-100 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className="min-w-28 font-mono text-sm font-semibold">{b.id}</div>
                  <div className="flex-1">
                    <div className="text-base font-medium">{b.product}</div>
                    <div className="text-xs text-gray-500">
                      {b.status === "completed" ? "Completed" : "In progress"}
                      {typeof b.compliance === "number" && (
                        <> · Compliance: <span className={
                          b.compliance === 100 ? "text-green-700" :
                          b.compliance >= 95 ? "text-amber-700" : "text-red-700"
                        }>{b.compliance}%</span></>
                      )}
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full ${
                    b.status === "completed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {b.status === "completed" ? "Completed" : "In Progress"}
                  </span>
                  <svg className="size-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Sticky bottom action bar — perfect for iPad thumbs */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-7xl px-5 py-3 grid grid-cols-3 gap-3">
          <Link
            href="/recipe/new"
            className="flex items-center justify-center gap-2 rounded-2xl bg-gray-900 text-white py-3 active:scale-[0.99]"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-base font-semibold">New Batch</span>
          </Link>
          <Link
            href="/scan"
            className="flex items-center justify-center gap-2 rounded-2xl border bg-white py-3 active:scale-[0.99]"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7V5a2 2 0 012-2h2m12 4V5a2 2 0 00-2-2h-2M3 17v2a2 2 0 002 2h2m12-4v2a2 2 0 01-2 2h-2M4 12h16" />
            </svg>
            <span className="text-base font-semibold">Scan</span>
          </Link>
          <Link
            href="/batches"
            className="flex items-center justify-center gap-2 rounded-2xl border bg-white py-3 active:scale-[0.99]"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293L20 8.707A1 1 0 0120.293 9V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-base font-semibold">Batches</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
