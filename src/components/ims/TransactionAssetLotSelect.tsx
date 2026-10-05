"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SearchableSelect } from "./SearchableSelect";

export type AssetLotOption = {
  receipt_item_id: number;
  receipt_no: string | null;
  receipt_date: string | null;
  description: string | null;
  unit_cost: number | string | null;
  available_asset_count: number;
  available_quantity: number;
  attribute_details?: { label: string; value: string | number | boolean | null }[];
};

const formatQuantity = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/\.?0+$/, "");

export function TransactionAssetLotSelect({
  id,
  itemId,
  value,
  departmentId,
  storeId,
  projectId,
  fundingSourceId,
  onChange,
}: {
  id: string;
  itemId: string;
  value: string;
  departmentId: string;
  storeId: string;
  projectId: string;
  fundingSourceId: string;
  onChange: (value: string, lot?: AssetLotOption) => void;
}) {
  const [lots, setLots] = useState<AssetLotOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!itemId || !departmentId || !storeId) {
        setLots([]);
        return;
      }

      setLoading(true);
      setError("");
      setLots([]);
      try {
        const response = await api.get<{ data: AssetLotOption[] }>("/assets/available-lots", {
          params: {
            item_id: itemId,
            department_id: departmentId,
            store_id: storeId,
            project_id: projectId || undefined,
            funding_source_id: fundingSourceId || undefined,
          },
        });
        if (active) setLots(Array.isArray(response.data?.data) ? response.data.data : []);
      } catch {
        if (active) setError("Could not load stock variants.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [itemId, departmentId, storeId, projectId, fundingSourceId]);

  const options = lots.map((lot) => ({
    value: String(lot.receipt_item_id),
    label: [
      lot.receipt_no || `Receipt line ${lot.receipt_item_id}`,
      lot.description,
      ...(lot.attribute_details ?? []).map((field) => `${field.label}: ${String(field.value)}`),
      `${formatQuantity(Number(lot.available_quantity ?? 0))} available`,
    ]
      .filter(Boolean)
      .join(" | "),
  }));

  return (
    <div className="mt-2" style={{ minWidth: 240 }}>
      <div className="small fw-semibold text-secondary mb-1">Stock variant / GRN</div>
      <SearchableSelect
        id={id}
        value={value}
        options={options}
        onChange={(nextValue) => onChange(nextValue, lots.find((lot) => String(lot.receipt_item_id) === nextValue))}
        placeholder={loading ? "Loading variants..." : "Choose GRN and specifications"}
        emptyLabel="No receipt-backed stock available."
      />
      {value && !loading && !lots.some((lot) => String(lot.receipt_item_id) === value) ? (
        <div className="small text-danger mt-1">Selected variant is no longer available.</div>
      ) : null}
      {error ? <div className="small text-danger mt-1">{error}</div> : null}
    </div>
  );
}
