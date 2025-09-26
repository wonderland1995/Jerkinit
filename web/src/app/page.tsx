export default function Home() {
  return (
    <main className="min-h-dvh bg-gray-50">
      <header className="border-b bg-white">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Manufacture</h1>
          <nav className="flex gap-3 text-sm">
            <a href="/recipe/new" className="px-3 py-2 rounded-md border hover:bg-gray-50">
              Recipe Builder
            </a>
            <a href="/scan" className="px-3 py-2 rounded-md border hover:bg-gray-50">
              Scan
            </a>
            <a href="/receive" className="px-3 py-2 rounded-md border hover:bg-gray-50">
              Receive
            </a>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-6 sm:grid-cols-3">
          <a
            href="/recipe/new"
            className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow transition"
          >
            <h2 className="text-lg font-semibold">Recipe Builder</h2>
            <p className="mt-1 text-sm text-gray-600">
              Create a batch, auto-scale ingredients, and record actuals with tolerances.
            </p>
          </a>

          <a
            href="/receive"
            className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow transition"
          >
            <h2 className="text-lg font-semibold">Meat Receiving</h2>
            <p className="mt-1 text-sm text-gray-600">
              Probe temp, supplier details, photos, and print the lot QR.
            </p>
          </a>

          <a
            href="/scan"
            className="rounded-2xl border bg-white p-6 shadow-sm hover:shadow transition"
          >
            <h2 className="text-lg font-semibold">Scan</h2>
            <p className="mt-1 text-sm text-gray-600">
              Universal scanner for lot, batch, and pack-lot QR codes.
            </p>
          </a>
        </div>

        <div className="mt-10 rounded-2xl border bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold">Status</h3>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <li className="rounded-lg border p-3">
              <div className="text-gray-500">Environment</div>
              <div className="font-medium">Production</div>
            </li>
            <li className="rounded-lg border p-3">
              <div className="text-gray-500">Domain</div>
              <div className="font-medium">manufacture.jerkinit.com.au</div>
            </li>
            <li className="rounded-lg border p-3">
              <div className="text-gray-500">Health</div>
              <a
                href="/api/health"
                className="font-medium text-blue-600 underline underline-offset-2"
              >
                /api/health
              </a>
            </li>
          </ul>
        </div>
      </section>

      <footer className="mt-10 border-t bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-gray-500">
          © {new Date().getFullYear()} Jerkin’ It — Manufacture
        </div>
      </footer>
    </main>
  );
}
