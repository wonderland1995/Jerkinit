// src/components/Navbar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';
import { useState } from 'react';

type NavItem = {
  name: string;
  path: Route;
  variant?: 'default' | 'action';
};

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (p: Route) => (p === '/' ? pathname === '/' : pathname.startsWith(p));

  const navItems: readonly NavItem[] = [
    { name: 'Dashboard', path: '/' },
    { name: 'Batches', path: '/batches' },
    { name: 'Recipes', path: '/recipes' },
    { name: 'Inventory', path: '/inventory' },
    { name: 'QA', path: '/qa' },
    { name: 'Reports', path: '/reports' },
    { name: 'Receive Beef', path: '/inventory/beef/receive', variant: 'action' },
  ] as const;

  const mainItems = navItems.filter((n) => n.variant !== 'action');
  const actionItems = navItems.filter((n) => n.variant === 'action');

  const linkBase =
    'inline-flex items-center border-b-2 text-xs font-medium transition px-1 pt-1';
  const linkActive = 'border-blue-500 text-gray-900';
  const linkIdle = 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700';

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
      <div className="mx-auto max-w-7xl px-3 sm:px-4 lg:px-6">
        <div className="flex h-12 items-center justify-between">
          {/* Left: brand */}
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm sm:text-base font-semibold text-gray-900">
              Jerkin It Production
            </Link>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <div className="flex items-center gap-4">
              {mainItems.map((item) => {
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

            {/* Desktop CTA(s) */}
            {actionItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 transition"
              >
                {item.name}
              </Link>
            ))}
          </div>

          {/* Mobile hamburger */}
          <div className="md:hidden">
            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center rounded-md p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {/* Icon */}
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
          <div className="space-y-1 p-2">
            {mainItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={`block rounded-md px-3 py-2 text-sm font-medium ${
                    active
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}

            {actionItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                onClick={() => setOpen(false)}
                className="mt-1 block rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white text-center hover:bg-emerald-700"
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
