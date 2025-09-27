// src/app/qa/[batchId]/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { 
  Batch,
  BatchIngredient,
  QACheckpoint,
  QADocument,
  BatchQACheck,
  BatchRelease 
} from '@/types/qa';

interface ComplianceData {
  batch: Batch & {
    product_name: string;
    tolerance_compliance: number;
  };
  ingredients: BatchIngredient[];
  checkpoints: (QACheckpoint & { check?: BatchQACheck })[];
  documents: (QADocument & { document_type_name: string })[];
  release?: BatchRelease;
}

export default function QAManagementPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.batchId as string;
  
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'checkpoints' | 'documents' | 'testing'>('ingredients');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (batchId) {
      fetchBatchData();
    }
  }, [batchId]);

  const fetchBatchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/qa/batch/${batchId}`);
      if (!response.ok) throw new Error('Failed to fetch batch data');
      
      const data = await response.json();
      setData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckpointUpdate = async (checkpointId: string, status: string, notes: string) => {
    try {
      setSaving(true);
      const response = await fetch(`/api/qa/checkpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batchId,
          checkpoint_id: checkpointId,
          status,
          notes,
          checked_by: 'Current User' // TODO: Get from auth
        })
      });
      
      if (!response.ok) throw new Error('Failed to update checkpoint');
      await fetchBatchData(); // Refresh data
    } catch (err) {
      alert('Failed to update checkpoint');
    } finally {
      setSaving(false);
    }
  };

  const handleDocumentUpload = async (file: File, documentTypeId: string) => {
    try {
      setSaving(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('batch_id', batchId);
      formData.append('document_type_id', documentTypeId);
      
      const response = await fetch('/api/qa/documents', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) throw new Error('Failed to upload document');
      await fetchBatchData();
    } catch (err) {
      alert('Failed to upload document');
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteBatch = async () => {
    if (!confirm('Complete this batch and submit for QA release? This action cannot be undone.')) {
      return;
    }
    
    try {
      setSaving(true);
      const response = await fetch(`/api/qa/batch/${batchId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          completed_by: 'Current User' // TODO: Get from auth
        })
      });
      
      if (!response.ok) throw new Error('Failed to complete batch');
      
      const result = await response.json();
      if (result.success) {
        alert(result.message);
        router.push('/batches');
      } else {
        alert(`Cannot complete: ${result.message}`);
      }
    } catch (err) {
      alert('Failed to complete batch');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-800">Error</h2>
            <p className="mt-2 text-red-600">{error || 'Batch not found'}</p>
          </div>
        </div>
      </div>
    );
  }

  const complianceScore = calculateComplianceScore(data);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">QA Management</h1>
              <p className="mt-1 text-sm text-gray-600">Batch: {data.batch.batch_id}</p>
              <p className="text-sm text-gray-600">Product: {data.batch.product_name}</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600">{complianceScore}%</div>
              <p className="text-sm text-gray-600">Compliance Score</p>
              {data.release && (
                <span className={`mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  data.release.release_status === 'approved' ? 'bg-green-100 text-green-800' :
                  data.release.release_status === 'hold' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {data.release.release_status.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {(['ingredients', 'checkpoints', 'documents', 'testing'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 px-6 text-sm font-medium capitalize ${
                    activeTab === tab
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                  {tab === 'checkpoints' && (
                    <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100">
                      {data.checkpoints.filter(c => c.check?.status === 'passed').length}/
                      {data.checkpoints.length}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'ingredients' && (
              <IngredientsTab ingredients={data.ingredients} />
            )}
            
            {activeTab === 'checkpoints' && (
              <CheckpointsTab 
                checkpoints={data.checkpoints}
                onUpdate={handleCheckpointUpdate}
                saving={saving}
              />
            )}
            
            {activeTab === 'documents' && (
              <DocumentsTab 
                documents={data.documents}
                onUpload={handleDocumentUpload}
                saving={saving}
              />
            )}
            
            {activeTab === 'testing' && (
              <TestingTab batchId={batchId} />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex justify-between items-center">
            <button
              onClick={() => router.push(`/recipe/print/${batchId}`)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Print Batch Record
            </button>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/recipe/new')}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                New Batch
              </button>
              <button
                onClick={handleCompleteBatch}
                disabled={saving || complianceScore < 100}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Complete Batch & Release
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to calculate compliance score
function calculateComplianceScore(data: ComplianceData): number {
  let totalPoints = 0;
  let earnedPoints = 0;
  
  // Ingredients compliance (40% weight)
  const ingredientsInTolerance = data.ingredients.filter(i => i.in_tolerance === true).length;
  const ingredientsMeasured = data.ingredients.filter(i => i.actual_amount !== null).length;
  if (ingredientsMeasured > 0) {
    earnedPoints += (ingredientsInTolerance / ingredientsMeasured) * 40;
  }
  totalPoints += 40;
  
  // Checkpoints compliance (40% weight)
  const requiredCheckpoints = data.checkpoints.filter(c => c.required).length;
  const passedCheckpoints = data.checkpoints.filter(c => c.check?.status === 'passed').length;
  if (requiredCheckpoints > 0) {
    earnedPoints += (passedCheckpoints / requiredCheckpoints) * 40;
  }
  totalPoints += 40;
  
  // Documents compliance (20% weight)
  const requiredDocs = data.documents.length; // Assuming all listed are required
  const approvedDocs = data.documents.filter(d => d.status === 'approved').length;
  if (requiredDocs > 0) {
    earnedPoints += (approvedDocs / requiredDocs) * 20;
  }
  totalPoints += 20;
  
  return Math.round((earnedPoints / totalPoints) * 100);
}

// Ingredients Tab Component
function IngredientsTab({ ingredients }: { ingredients: BatchIngredient[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 text-sm font-semibold text-gray-700">Ingredient</th>
            <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">Target</th>
            <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">Actual</th>
            <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">Tolerance</th>
            <th className="text-center py-2 px-3 text-sm font-semibold text-gray-700">Status</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.map((ing) => (
            <tr key={ing.id} className="border-b hover:bg-gray-50">
              <td className="py-3 px-3">
                {ing.ingredient_name}
                {ing.is_cure && (
                  <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                    CURE
                  </span>
                )}
              </td>
              <td className="text-center py-3 px-3 font-mono text-sm">
                {ing.target_amount.toFixed(2)} {ing.unit}
              </td>
              <td className="text-center py-3 px-3 font-mono text-sm">
                {ing.actual_amount ? `${ing.actual_amount.toFixed(2)} ${ing.unit}` : '-'}
              </td>
              <td className="text-center py-3 px-3 text-sm">
                ±{ing.tolerance_percentage}%
              </td>
              <td className="text-center py-3 px-3">
                {ing.in_tolerance === true && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">✓ Pass</span>
                )}
                {ing.in_tolerance === false && (
                  <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">✗ Fail</span>
                )}
                {ing.in_tolerance === null && (
                  <span className="text-gray-400 text-sm">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Checkpoints Tab Component
function CheckpointsTab({ 
  checkpoints, 
  onUpdate,
  saving 
}: { 
  checkpoints: (QACheckpoint & { check?: BatchQACheck })[];
  onUpdate: (checkpointId: string, status: string, notes: string) => void;
  saving: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempStatus, setTempStatus] = useState<string>('');
  const [tempNotes, setTempNotes] = useState<string>('');
  
  const handleEdit = (checkpoint: QACheckpoint & { check?: BatchQACheck }) => {
    setEditingId(checkpoint.id);
    setTempStatus(checkpoint.check?.status || 'pending');
    setTempNotes(checkpoint.check?.notes || '');
  };
  
  const handleSave = (checkpointId: string) => {
    onUpdate(checkpointId, tempStatus, tempNotes);
    setEditingId(null);
  };
  
  const stages = ['preparation', 'mixing', 'marination', 'drying', 'packaging', 'final'];
  
  return (
    <div className="space-y-6">
      {stages.map(stage => {
        const stageCheckpoints = checkpoints.filter(c => c.stage === stage);
        if (stageCheckpoints.length === 0) return null;
        
        return (
          <div key={stage}>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              {stage}
            </h3>
            <div className="space-y-3">
              {stageCheckpoints.map(checkpoint => (
                <div key={checkpoint.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{checkpoint.name}</h4>
                      <p className="text-sm text-gray-600 mt-1">{checkpoint.description}</p>
                      {checkpoint.check?.notes && (
                        <p className="text-sm text-gray-700 mt-2 italic">
                          Notes: {checkpoint.check.notes}
                        </p>
                      )}
                    </div>
                    <div className="ml-4 flex items-center gap-2">
                      {editingId === checkpoint.id ? (
                        <>
                          <select
                            value={tempStatus}
                            onChange={(e) => setTempStatus(e.target.value)}
                            className="px-3 py-1 border rounded text-sm"
                          >
                            <option value="pending">Pending</option>
                            <option value="passed">Passed</option>
                            <option value="failed">Failed</option>
                            <option value="skipped">Skipped</option>
                          </select>
                          <button
                            onClick={() => handleSave(checkpoint.id)}
                            disabled={saving}
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            checkpoint.check?.status === 'passed' ? 'bg-green-100 text-green-800' :
                            checkpoint.check?.status === 'failed' ? 'bg-red-100 text-red-800' :
                            checkpoint.check?.status === 'skipped' ? 'bg-gray-100 text-gray-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {checkpoint.check?.status || 'Pending'}
                          </span>
                          <button
                            onClick={() => handleEdit(checkpoint)}
                            className="px-3 py-1 border rounded text-sm hover:bg-gray-100"
                          >
                            Update
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {editingId === checkpoint.id && (
                    <div className="mt-3">
                      <textarea
                        value={tempNotes}
                        onChange={(e) => setTempNotes(e.target.value)}
                        placeholder="Add notes..."
                        className="w-full px-3 py-2 border rounded text-sm"
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Documents Tab Component
function DocumentsTab({ 
  documents,
  onUpload,
  saving
}: { 
  documents: (QADocument & { document_type_name: string })[];
  onUpload: (file: File, documentTypeId: string) => void;
  saving: boolean;
}) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, typeId: string) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file, typeId);
    }
  };
  
  return (
    <div className="space-y-4">
      {documents.map(doc => (
        <div key={doc.id} className="border rounded-lg p-4">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium text-gray-900">{doc.document_type_name}</h4>
              <p className="text-sm text-gray-600 mt-1">
                Document #: {doc.document_number}
              </p>
              {doc.file_name && (
                <p className="text-sm text-gray-600">
                  File: {doc.file_name}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                doc.status === 'approved' ? 'bg-green-100 text-green-800' :
                doc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {doc.status}
              </span>
              {!doc.file_name && (
                <label className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 cursor-pointer">
                  Upload
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileChange(e, doc.document_type_id)}
                    disabled={saving}
                  />
                </label>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Testing Tab Component
function TestingTab({ batchId }: { batchId: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-gray-600">Testing results will be displayed here</p>
      <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
        Add Test Result
      </button>
    </div>
  );
}