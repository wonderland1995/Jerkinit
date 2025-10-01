'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Checkpoint {
  id: string;
  code: string;
  name: string;
  description: string;
  stage: string;
  required: boolean;
  display_order: number;
}

interface QACheck {
  id: string;
  checkpoint_id: string;
  status: string;
  checked_by: string | null;
  checked_at: string | null;
  temperature_c: number | null;
  humidity_percent: number | null;
  ph_level: number | null;
  water_activity: number | null;
  notes: string | null;
  corrective_action: string | null;
}

interface BatchDetails {
  id: string;
  batch_id: string;
  status: string;
  product?: {
    name: string;
  };
}

export default function BatchQAPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params.batchId as string;

  const [batch, setBatch] = useState<BatchDetails | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [qaChecks, setQAChecks] = useState<Record<string, QACheck>>({});
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<string>('preparation');

  const stages = [
    { key: 'preparation', label: 'Preparation' },
    { key: 'mixing', label: 'Mixing' },
    { key: 'marination', label: 'Marination' },
    { key: 'drying', label: 'Drying' },
    { key: 'packaging', label: 'Packaging' },
    { key: 'final', label: 'Final Inspection' },
  ];

  useEffect(() => {
    fetchData();
  }, [batchId]);

  const fetchData = async () => {
    try {
      const [batchRes, checkpointsRes, checksRes] = await Promise.all([
        fetch(`/api/batches/${batchId}`),
        fetch('/api/qa/checkpoints'),
        fetch(`/api/qa/batch/${batchId}`),
      ]);

      const batchData = await batchRes.json();
      const checkpointsData = await checkpointsRes.json();
      const checksData = await checksRes.json();

      setBatch(batchData.batch);
      setCheckpoints(checkpointsData.checkpoints || []);

      const checksMap: Record<string, QACheck> = {};
      (checksData.checks || []).forEach((check: QACheck) => {
        checksMap[check.checkpoint_id] = check;
      });
      setQAChecks(checksMap);
    } catch (error) {
      console.error('Failed to fetch QA data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckpointUpdate = async (
    checkpointId: string,
    status: string,
    data: Partial<QACheck>
  ) => {
    try {
      const res = await fetch('/api/qa/checkpoint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: batchId,
          checkpoint_id: checkpointId,
          status,
          ...data,
          checked_by: 'User',
        }),
      });

      if (res.ok) {
        fetchData();
      } else {
        const error = await res.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to update checkpoint');
    }
  };

  const stageCheckpoints = checkpoints.filter(cp => cp.stage === activeStage);
  const stageProgress = stageCheckpoints.length > 0
    ? stageCheckpoints.filter(cp => qaChecks[cp.id]?.status === 'passed').length / stageCheckpoints.length * 100
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading QA checkpoints...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-5 py-4">
          <button
            onClick={() => router.push('/qa')}
            className="text-blue-600 hover:text-blue-700 mb-2"
          >
            ← Back to QA List
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">QA Test Sheet</h1>
              <p className="text-gray-600">
                {batch?.batch_id} - {batch?.product?.name}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              batch?.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {batch?.status}
            </span>
          </div>
        </div>
      </header>

      <div className="bg-white border-b sticky top-[89px] z-10">
        <div className="max-w-6xl mx-auto px-5">
          <div className="flex gap-2 overflow-x-auto py-2">
            {stages.map((stage) => {
              const stageChks = checkpoints.filter(cp => cp.stage === stage.key);
              const stagePassed = stageChks.filter(cp => qaChecks[cp.id]?.status === 'passed').length;
              const stageTotal = stageChks.length;

              return (
                <button
                  key={stage.key}
                  onClick={() => setActiveStage(stage.key)}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium transition ${
                    activeStage === stage.key
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {stage.label}
                  <span className="ml-2 text-xs opacity-75">
                    {stagePassed}/{stageTotal}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 py-4">
        <div className="bg-white rounded-xl border p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {stages.find(s => s.key === activeStage)?.label} Progress
            </span>
            <span className="text-sm font-semibold text-gray-900">
              {stageProgress.toFixed(0)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-600 h-2 rounded-full transition-all"
              style={{ width: `${stageProgress}%` }}
            />
          </div>
        </div>

        <div className="space-y-4">
          {stageCheckpoints.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
              No checkpoints defined for this stage
            </div>
          ) : (
            stageCheckpoints.map((checkpoint) => {
              const check = qaChecks[checkpoint.id];
              return (
                <CheckpointCard
                  key={checkpoint.id}
                  checkpoint={checkpoint}
                  check={check}
                  onUpdate={(status, data) => handleCheckpointUpdate(checkpoint.id, status, data)}
                />
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface CheckpointCardProps {
  checkpoint: Checkpoint;
  check: QACheck | undefined;
  onUpdate: (status: string, data: Partial<QACheck>) => void;
}

function CheckpointCard({ checkpoint, check, onUpdate }: CheckpointCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [formData, setFormData] = useState({
    temperature_c: check?.temperature_c?.toString() || '',
    humidity_percent: check?.humidity_percent?.toString() || '',
    ph_level: check?.ph_level?.toString() || '',
    water_activity: check?.water_activity?.toString() || '',
    notes: check?.notes || '',
    corrective_action: check?.corrective_action || '',
  });

  const status = check?.status || 'pending';

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === 'passed' || newStatus === 'skipped') {
      onUpdate(newStatus, {});
    } else {
      setExpanded(true);
    }
  };

  const handleSave = () => {
    onUpdate(status === 'pending' ? 'failed' : status, {
      temperature_c: formData.temperature_c ? parseFloat(formData.temperature_c) : null,
      humidity_percent: formData.humidity_percent ? parseFloat(formData.humidity_percent) : null,
      ph_level: formData.ph_level ? parseFloat(formData.ph_level) : null,
      water_activity: formData.water_activity ? parseFloat(formData.water_activity) : null,
      notes: formData.notes || null,
      corrective_action: formData.corrective_action || null,
    });
    setExpanded(false);
  };

  return (
    <div className={`bg-white rounded-xl border-2 transition ${
      status === 'passed' ? 'border-green-500' :
      status === 'failed' ? 'border-red-500' :
      status === 'conditional' ? 'border-yellow-500' :
      'border-gray-200'
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-lg">{checkpoint.name}</h3>
              {checkpoint.required && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Required</span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1">{checkpoint.description}</p>
            {check?.checked_at && (
              <p className="text-xs text-gray-500 mt-2">
                Checked by {check.checked_by} on {new Date(check.checked_at).toLocaleString()}
              </p>
            )}
          </div>

          <div className="flex gap-2 ml-4">
            <button
              onClick={() => handleStatusChange('passed')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                status === 'passed'
                  ? 'bg-green-600 text-white'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              Pass
            </button>
            <button
              onClick={() => handleStatusChange('failed')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                status === 'failed'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              Fail
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="px-3 py-2 rounded-lg border hover:bg-gray-50"
            >
              {expanded ? '▼' : '▶'}
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temperature (°C)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.temperature_c}
                  onChange={(e) => setFormData({...formData, temperature_c: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Humidity (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.humidity_percent}
                  onChange={(e) => setFormData({...formData, humidity_percent: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  pH Level
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.ph_level}
                  onChange={(e) => setFormData({...formData, ph_level: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Water Activity
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.water_activity}
                  onChange={(e) => setFormData({...formData, water_activity: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>

            {status === 'failed' && (
              <div>
                <label className="block text-sm font-medium text-red-700 mb-1">
                  Corrective Action *
                </label>
                <textarea
                  rows={2}
                  value={formData.corrective_action}
                  onChange={(e) => setFormData({...formData, corrective_action: e.target.value})}
                  className="w-full border-2 border-red-300 rounded-lg px-3 py-2"
                  placeholder="What corrective action was taken?"
                />
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setExpanded(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                Save Details
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}