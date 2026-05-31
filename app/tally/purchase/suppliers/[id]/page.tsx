'use client';

import { useParams } from 'next/navigation';
import { SupplierMasterForm } from '@/components/tally/purchase/SupplierMasterForm';
import { useSupplierQuery } from '@/hooks/usePurchaseQueries';

export default function AlterSupplierPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : null;
  const { data: supplier, isLoading } = useSupplierQuery(id);

  if (!id || isLoading) {
    return (
      <div className="p-4 text-[13px]" style={{ background: '#FFF8E7' }}>
        Loading…
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-4 text-[13px] text-red-700" style={{ background: '#FFF8E7' }}>
        Supplier not found.
      </div>
    );
  }

  return <SupplierMasterForm mode="alter" existing={supplier} />;
}
