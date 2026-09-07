"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SearchableSelect } from "./SearchableSelect";

type AssetOption = {
  id: number;
  asset_id: string;
  printable_tag_id: string | null;
  serial_number: string | null;
  brand: string | null;
  model: string | null;
  status: string;
  attribute_details?: { label: string; value: string | boolean }[];
};

export function TransactionAssetSelect({ id, itemId, value, transactionType, departmentId, storeId, employeeId, projectId, fundingSourceId, onChange }: {
  id: string;
  itemId: string;
  value: string;
  transactionType: string;
  departmentId: string;
  storeId: string;
  employeeId: string;
  projectId: string;
  fundingSourceId: string;
  onChange: (value: string) => void;
}) {
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      setAssets([]);
      try {
        const returning = transactionType === "return";
        const response = await api.get<{ data: AssetOption[] }>("/assets", { params: {
          item_id: itemId,
          department_id: departmentId || undefined,
          store_id: returning ? undefined : storeId || undefined,
          custodian_user_id: returning ? employeeId || undefined : undefined,
          status: returning ? undefined : "in_store",
          project_id: projectId || undefined,
          funding_source_id: fundingSourceId || undefined,
        } });
        const rows = Array.isArray(response.data?.data) ? response.data.data : [];
        if (active) setAssets(returning ? rows.filter((asset) => ["issued", "in_use"].includes(asset.status)) : rows);
      } catch {
        if (active) setError("Could not load assets. Check your connection and reopen the voucher.");
      } finally {
        if (active) setLoading(false);
      }
    };
    if (itemId) void load();
    return () => { active = false; };
  }, [itemId, transactionType, departmentId, storeId, employeeId, projectId, fundingSourceId]);

  const options = assets.map((asset) => ({ value: String(asset.id), label: [
    asset.printable_tag_id || asset.asset_id,
    asset.serial_number ? `SN: ${asset.serial_number}` : "",
    [asset.brand, asset.model].filter(Boolean).join(" "),
    ...(asset.attribute_details ?? []).map((field) => `${field.label}: ${String(field.value)}`),
  ].filter(Boolean).join(" | ") }));

  return (
    <div style={{ minWidth: 240 }}>
      <SearchableSelect id={id} value={value} options={options} onChange={onChange}
        placeholder={loading ? "Loading assets..." : "Choose tag or serial number"} emptyLabel="No available assets in this source." />
      {value && !loading && !assets.some((asset) => String(asset.id) === value) ? <div className="small text-danger">Selected asset is unavailable in this source. Choose another asset.</div> : null}
      {error ? <div className="small text-danger">{error}</div> : null}
    </div>
  );
}
