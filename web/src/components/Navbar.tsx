// src/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Package } from 'lucide-react';

type NavItem = {
  name: string;
  path: Route;
};

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const userDisplay = session?.user?.name || session?.user?.email || 'User';

  const isActive = (p: Route) => (p === '/' ? pathname === '/' : pathname.startsWith(p));

  const navItems: readonly NavItem[] = [
    { name: 'Dashboard', path: '/' },
    { name: 'Batches', path: '/batches' },
    { name: 'Recipes', path: '/recipes' },
    { name: 'Inventory', path: '/inventory' },
    { name: 'QA', path: '/qa' },
    { name: 'Reports', path: '/reports' },
  ] as const;

  const linkBase =
    'inline-flex items-center border-b-2 text-sm font-medium transition px-1 pt-1 h-14';
  const linkActive = 'border-emerald-500 text-gray-900';
  const linkIdle = 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-800';

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-14 items-center justify-between">
          {/* Left: brand */}
          <div className="flex items-center gap-6">
            <Link href="/" className="text-base font-bold text-gray-900 tracking-tight">
              Jerkin It
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    aria-current={active ? 'page' : undefined}
                    className={`${linkBase} ${active ? linkActive : linkIdle}`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Right: CTA + user */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/recipe/new"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition"
            >
              <Package className="h-4 w-4" />
              New Batch
            </Link>

            <div className="flex items-center gap-3 pl-3 border-l border-gray-200">
              <span className="text-sm font-medium text-gray-700">{userDisplay}</span>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                {open ? (
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          <div className="space-y-1 p-3">
            {navItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${
                    active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}

            <Link
              href="/recipe/new"
              onClick={() => setOpen(false)}
              className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Package className="h-4 w-4" />
              New Batch
            </Link>

            <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-3">
              <span className="text-sm text-gray-600">{userDisplay}</span>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  signOut({ callbackUrl: '/login' });
                }}
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
