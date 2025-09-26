// src/app/page.tsx

import Link from 'next/link';

export default function HomePage() {
  const quickStats = [
    { label: 'Today\'s Batches', value: '12', change: '+3 from yesterday' },
    { label: 'Active Products', value: '3', change: 'All available' },
    { label: 'Week Total', value: '67', change: '+15% from last week' },
    { label: 'Compliance Rate', value: '98.5%', change: 'Within tolerance' },
  ];

  const mainActions = [
    {
      title: 'Create New Batch',
      description: 'Start a new beef jerky batch with auto-generated ID and scaled recipe',
      href: '/recipe/new',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      title: 'Batch History',
      description: 'View and manage all previous batches, check compliance and print reports',
      href: '/batches',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      title: 'Product Management',
      description: 'Manage products and recipes, update ingredients and tolerances',
      href: '/products',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      title: 'Reports & Analytics',
      description: 'Generate compliance reports, analyze trends and export data',
      href: '/reports',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      color: 'bg-orange-500 hover:bg-orange-600',
    },
  ];

  const recentBatches = [
    { id: 'JI-20241201-003', product: 'Original Beef Jerky', status: 'completed', compliance: 100 },
    { id: 'JI-20241201-002', product: 'Teriyaki Beef Jerky', status: 'completed', compliance: 97.5 },
    { id: 'JI-20241201-001', product: 'Spicy Beef Jerky', status: 'in_progress', compliance: null },
    { id: 'JI-20241130-008', product: 'Original Beef Jerky', status: 'completed', compliance: 98.8 },
    { id: 'JI-20241130-007', product: 'Teriyaki Beef Jerky', status: 'completed', compliance: 100 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Beef Jerky Traceability System
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Manufacturing compliance and recipe management dashboard
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {quickStats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">{stat.change}</p>
            </div>
          ))}
        </div>

        {/* Main Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {mainActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="group relative bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
            >
              <div className="p-6">
                <div className="flex items-start space-x-4">
                  <div className={`${action.color} text-white rounded-lg p-3 transition-colors`}>
                    {action.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {action.title}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {action.description}
                    </p>
                  </div>
                  <div className="text-gray-400 group-hover:text-gray-600 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Recent Batches Table */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">Recent Batches</h2>
              <Link 
                href="/batches" 
                className="text-sm font-medium text-blue-600 hover:text-blue-500"
              >
                View all →
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Batch ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Compliance
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentBatches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {batch.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {batch.product}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        batch.status === 'completed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {batch.status === 'completed' ? 'Completed' : 'In Progress'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                      {batch.compliance !== null ? (
                        <span className={`font-medium ${
                          batch.compliance === 100 
                            ? 'text-green-600' 
                            : batch.compliance >= 95 
                            ? 'text-yellow-600' 
                            : 'text-red-600'
                        }`}>
                          {batch.compliance}%
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button className="text-blue-600 hover:text-blue-900 text-sm font-medium">
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Links Footer */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/recipe/new" className="text-blue-600 hover:text-blue-800 text-sm">
              → New Batch
            </Link>
            <Link href="/batches" className="text-blue-600 hover:text-blue-800 text-sm">
              → View All Batches
            </Link>
            <Link href="/products" className="text-blue-600 hover:text-blue-800 text-sm">
              → Manage Products
            </Link>
            <Link href="/reports" className="text-blue-600 hover:text-blue-800 text-sm">
              → Generate Reports
            </Link>
            <Link href="/settings" className="text-blue-600 hover:text-blue-800 text-sm">
              → System Settings
            </Link>
            <Link href="/users" className="text-blue-600 hover:text-blue-800 text-sm">
              → User Management
            </Link>
            <Link href="/help" className="text-blue-600 hover:text-blue-800 text-sm">
              → Help & Support
            </Link>
            <Link href="/api-docs" className="text-blue-600 hover:text-blue-800 text-sm">
              → API Documentation
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}