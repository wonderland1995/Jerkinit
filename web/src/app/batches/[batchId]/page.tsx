'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

import Breadcrumbs from '@/components/Breadcrumbs';
import DeleteBatchModal from '@/components/DeleteBatchModal';
import type { BatchLotUsage } from '@/types/inventory';

interface BatchDetails {
  id: string;
  batch_number: string;
  recipe_id: string;
  beef_input_weight: number;
  scaling_factor: number;
  production_date: string;
  status: string;s
  recipe?: {
    name: string;
    recipe_code: string;
  };
  lot_usage?: BatchLotUsage[];
}

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.batchId as string;
  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchBatch = async () => {
    const [batchRes, traceRes] = await Promise.all([
      fetch(`/api/batches/${batchId}`),
      fetch(`/api/batches/${batchId}/traceability`),
    ]);

    const batchData = await batchRes.json();
    const traceData = await traceRes.json();

    setBatch({
      ...batchData.batch,
      lot_usage: traceData.traceability,
    });
    setLoading(false);
  };

  useEffect(() => {
    fetchBatch();
  }, [batchId]);

  const handleDelete = async () => {
    const res = await fetch(`/api/batches/${batchId}/delete`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      throw new Error('Failed to delete batch');
    }

    router.push('/batches');
  };

 if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">Loading batch...</div>
      </div>
    );
  }
 if (!batch) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center py-12">Batch not found</div>
      </div>
    );
  }

  // Group lot usage by material
  const groupedUsage = batch.lot_usage?.reduce((acc, usage) => {
    const materialName = usage.material?.name || 'Unknown';
    if (!acc[materialName]) {
      acc[materialName] = [];
    }
    acc[materialName].push(usage);
    return acc;
  }, {} as Record<string, BatchLotUsage[]>);

  return (
    // REMOVE <Layout> wrapper, just return the content directly
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <Breadcrumbs items={[
          { label: 'Dashboard', href: '/' },
          { label: 'Batches', href: '/batches' },
          { label: batch.batch_number, href: `/batches/${batchId}` }
        ]} />

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">{batch.batch_number}</h1>
            {batch.recipe && (
              <p className="text-gray-600 mt-1">
                Recipe: {batch.recipe.name} ({batch.recipe.recipe_code})
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${
              batch.status === 'completed' ? 'bg-green-100 text-green-800' :
              batch.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
              batch.status === 'released' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {batch.status.replace('_', ' ').toUpperCase()}
            </span>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>

        {/* Batch Info */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Batch Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Production Date</p>
              <p className="font-medium">{new Date(batch.production_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Beef Input Weight</p>
              <p className="font-medium">{batch.beef_input_weight}g</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Scaling Factor</p>
              <p className="font-medium">{batch.scaling_factor?.toFixed(2)}x</p>
            </div>
          </div>
        </div>

        {/* Ingredient Traceability */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Ingredient Traceability</h2>
          
          {!groupedUsage || Object.keys(groupedUsage).length === 0 ? (
            <p className="text-gray-500">No ingredient allocations recorded</p>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedUsage).map(([materialName, usages]) => (
                <div key={materialName} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-3">{materialName}</h3>
                  
                  <div className="space-y-2">
                    {usages.map((usage) => (
                      <div 
                        key={usage.id} 
                        className="flex items-center justify-between bg-gray-50 p-3 rounded"
                      >
                        <div className="flex-1">
                          <p className="font-medium">
                            Lot: {usage.lot?.lot_number || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-600">
                            Internal: {usage.lot?.internal_lot_code}
                          </p>
                          {usage.lot?.supplier && (
                            <p className="text-xs text-gray-500">
                              Supplier: {usage.lot.supplier.name}
                            </p>
                          )}
                        </div>
                        
                        <div className="text-right">
                          <p className="font-semibold">
                            {usage.quantity_used} {usage.unit}
                          </p>
                          {usage.lot?.expiry_date && (
                            <p className="text-xs text-gray-500">
                              Exp: {new Date(usage.lot.expiry_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-2 pt-2 border-t">
                    <p className="text-sm text-gray-600">
                      Total used: <span className="font-medium">
                        {usages.reduce((sum, u) => sum + u.quantity_used, 0).toFixed(2)} g
                      </span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => window.location.href = `/qa/${batchId}`}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            QA Management
          </button>
          <button
            onClick={() => window.location.href = `/recipe/print/${batchId}`}
            className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700"
          >
            Print Batch Record
          </button>
        </div>
      </div>

      {/* Delete Modal */}
      <DeleteBatchModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        batchId={batch.id}
        batchNumber={batch.batch_number}
      />
    </div>
  );
}