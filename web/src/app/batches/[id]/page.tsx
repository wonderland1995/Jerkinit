// src/app/batches/[id]/page.tsx
export default function BatchDetailPage({ params }: { params: { id: string } }) {
  return (
    <div className="p-6">
      Batch details for <span className="font-mono">{params.id}</span>
    </div>
  );
}

