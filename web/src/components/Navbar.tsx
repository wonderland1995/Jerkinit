'use client';

import { usePathname } from 'next/navigation';

export default function Navbar() {
  const pathname = usePathname();

  const isActive = (path: string) => {
    return pathname?.startsWith(path);
  };

  const navItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'Batches', path: '/batches' },
    { name: 'Recipes', path: '/recipes' },
    { name: 'Inventory', path: '/inventory' },
    { name: 'QA', path: '/qa' },
    { name: 'Reports', path: '/reports' },
  ];

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <a href="/" className="flex items-center px-2 text-xl font-bold text-gray-900">
              🥩 Jerky Production
            </a>
            
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <a
                  key={item.path}
                  href={item.path as any}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                    (item.path === '/' ? pathname === '/' : isActive(item.path))
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {item.name}
                </a>
              ))}
            </div>
          </div>
          
          <div className="flex items-center">
            <span className="text-sm text-gray-600">Welcome, User</span>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className="sm:hidden">
        <div className="pt-2 pb-3 space-y-1">
          {navItems.map((item) => (
            <a
              key={item.path}
              href={item.path as any}
              className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                (item.path === '/' ? pathname === '/' : isActive(item.path))
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              }`}
            >
              {item.name}
            </a>
          ))}
        </div>
      </div>
    </nav>
  );
}