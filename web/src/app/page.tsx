'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  TrendingUp,
  Beef,
  ClipboardCheck,
  Archive,
  Calendar
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
 XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';

interface DashboardStats {
  total_batches: number;
  in_progress: number;
  completed: number;
  released: number;
  inventory: {
    total_materials: number;
    low_stock_count: number;
    expiring_soon_count: number;
    total_lot_value: number;
    materials_by_category: Record<string, number>;
  };
}

interface RecentBatch {
  id: string;
  batch_id: string;
  status: string;
  created_at: string;
  beef_weight_kg: number;
  product?: {
    name: string;
  };
}

export default function HomePage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentBatches, setRecentBatches] = useState<RecentBatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsRes, batchesRes] = await Promise.all([
        fetch('/api/dashboard/stats'),
        fetch('/api/batches/history?limit=10'),
      ]);

      const statsData = await statsRes.json();
      const batchesData = await batchesRes.json();

      setStats(statsData);
      setRecentBatches(batchesData.batches || []);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate batch trend data (last 7 days)
  const batchTrendData = recentBatches
    .slice(0, 7)
    .reverse()
    .map((batch, idx) => ({
      day: new Date(batch.created_at).toLocaleDateString('en-AU', { weekday: 'short' }),
      batches: idx + 1,
      weight: batch.beef_weight_kg || 0,
    }));

  // Status distribution for pie chart
  const statusData = [
    { name: 'In Progress', value: stats?.in_progress || 0, color: '#f59e0b' },
    { name: 'Completed', value: stats?.completed || 0, color: '#10b981' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      {/*<header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center">
                <Beef className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Jerky Production</h1>
                <p className="text-sm text-gray-500">FSANZ Compliant Manufacturing</p>
              </div>
            </div>
            <nav className="hidden md:flex gap-2">
              <Link href="/recipe/new" className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition">
                <Package className="w-4 h-4" />
                New Batch
              </Link>
              <Link href="/batches" className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition">
                <Archive className="w-4 h-4" />
                Batches
              </Link>
              <Link href="/inventory" className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition">
                <Package className="w-4 h-4" />
                Inventory
              </Link>
              <Link href="/qa" className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition">
                <ClipboardCheck className="w-4 h-4" />
                QA
              </Link>
            </nav>
          </div>
        </div>
      </header>*/}

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Production Overview</h2>
          <p className="text-gray-600">Monitor your production metrics and quality assurance</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            title="Total Batches"
            value={stats?.total_batches || 0}
            icon={Package}
            color="blue"
            trend="+12%"
          />
          <StatCard
            title="In Progress"
            value={stats?.in_progress || 0}
            icon={Clock}
            color="amber"
          />
          <StatCard
            title="Completed"
            value={stats?.completed || 0}
            icon={CheckCircle2}
            color="green"
          />
          <StatCard
            title="Low Stock Items"
            value={stats?.inventory.low_stock_count || 0}
            icon={AlertTriangle}
            color="red"
            alert={stats?.inventory.low_stock_count ? stats.inventory.low_stock_count > 0 : false}
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Batch Trend Chart */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Production Trend</h3>
                <p className="text-sm text-gray-500">Last 7 batches</p>
              </div>
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={batchTrendData}>
                <defs>
                  <linearGradient id="colorBatches" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }} 
                />
                <Area 
                  type="monotone" 
                  dataKey="batches" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorBatches)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Status Distribution */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Batch Status</h3>
                <p className="text-sm text-gray-500">Current distribution</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }} 
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Beef Weight Chart */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Beef Usage</h3>
                <p className="text-sm text-gray-500">Weight per batch (kg)</p>
              </div>
              <Beef className="w-5 h-5 text-red-600" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={batchTrendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="day" stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#fff', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }} 
                />
                <Bar dataKey="weight" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl shadow-lg p-6 text-white">
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link 
                href="/recipe/new"
                className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg transition backdrop-blur-sm"
              >
                <Package className="w-5 h-5" />
                <span className="font-medium">Create New Batch</span>
              </Link>
              <Link 
                href="/qa"
                className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg transition backdrop-blur-sm"
              >
                <ClipboardCheck className="w-5 h-5" />
                <span className="font-medium">QA Management</span>
              </Link>
              <Link 
                href="/inventory/receive"
                className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg transition backdrop-blur-sm"
              >
                <Archive className="w-5 h-5" />
                <span className="font-medium">Receive Materials</span>
              </Link>
              <Link 
                href="/recipes"
                className="flex items-center gap-3 p-3 bg-white/10 hover:bg-white/20 rounded-lg transition backdrop-blur-sm"
              >
                <Calendar className="w-5 h-5" />
                <span className="font-medium">Manage Recipes</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Recent Batches Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Recent Batches</h3>
              <p className="text-sm text-gray-500">Latest production runs</p>
            </div>
            <Link 
              href="/batches"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Batch ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Weight
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentBatches.slice(0, 5).map((batch) => (
                  <tr key={batch.id} className="hover:bg-gray-50 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {batch.batch_id}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {batch.product?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                        batch.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {batch.status === 'completed' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {batch.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {batch.beef_weight_kg ? `${batch.beef_weight_kg} kg` : '—'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(batch.created_at).toLocaleDateString('en-AU')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <Link
                        href={`/qa/${batch.id}` as any}
                        className="text-blue-600 hover:text-blue-700 font-medium mr-3"
                      >
                        QA
                      </Link>
                      <Link
                        href={`/batches/${batch.id}` as any}
                        className="text-gray-600 hover:text-gray-900 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'amber' | 'green' | 'red';
  trend?: string;
  alert?: boolean;
}

function StatCard({ title, value, icon: Icon, color, trend, alert }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    amber: 'from-amber-500 to-amber-600',
    green: 'from-green-500 to-green-600',
    red: 'from-red-500 to-red-600',
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-6 ${alert ? 'ring-2 ring-red-400' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl bg-gradient-to-br ${colorClasses[color]}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
        {trend && (
          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
}