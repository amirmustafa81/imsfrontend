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
  receipt_item_description?: string | null;
  attribute_details?: { label: string; value: string | number | boolean | null }[];
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

  const selectedAsset = assets.find((asset) => String(asset.id) === value);
  const options = assets.map((asset) => {
    const identity = asset.printable_tag_id || asset.asset_id;
    const specifications = (asset.attribute_details ?? []).map((field) => `${field.label}: ${String(field.value)}`);

    return {
      value: String(asset.id),
      displayLabel: identity,
      label: [
        identity,
        asset.receipt_item_description,
        asset.serial_number ? `SN: ${asset.serial_number}` : "",
        [asset.brand, asset.model].filter(Boolean).join(" "),
        ...specifications,
      ].filter(Boolean).join(" | "),
      keywords: [asset.asset_id, asset.receipt_item_description, ...specifications].filter(Boolean).join(" "),
    };
  });

  return (
    <div style={{ minWidth: 240 }}>
      <SearchableSelect id={id} value={value} options={options} onChange={onChange}
        placeholder={loading ? "Loading assets..." : "Choose tag or serial number"} emptyLabel="No available assets in this source." />
      {selectedAsset ? (
        <div className="border rounded bg-light p-2 mt-2 small">
          <div className="fw-semibold text-break">{selectedAsset.printable_tag_id || selectedAsset.asset_id}</div>
          {selectedAsset.printable_tag_id && selectedAsset.asset_id !== selectedAsset.printable_tag_id ? (
            <div className="text-secondary text-break">Asset: {selectedAsset.asset_id}</div>
          ) : null}
          {selectedAsset.receipt_item_description ? (
            <div className="mt-1 text-break">{selectedAsset.receipt_item_description}</div>
          ) : null}
          {selectedAsset.serial_number || selectedAsset.brand || selectedAsset.model ? (
            <div className="text-secondary text-break mt-1">
              {[
                selectedAsset.serial_number ? `Serial: ${selectedAsset.serial_number}` : "",
                [selectedAsset.brand, selectedAsset.model].filter(Boolean).join(" "),
              ].filter(Boolean).join(" | ")}
            </div>
          ) : null}
          {(selectedAsset.attribute_details ?? []).length > 0 ? (
            <div className="d-flex flex-wrap gap-1 mt-2">
              {(selectedAsset.attribute_details ?? []).map((field, index) => (
                <span key={`${field.label}-${index}`} className="badge bg-white border text-dark fw-normal text-wrap text-start">
                  <strong>{field.label}:</strong> {String(field.value)}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {value && !loading && !assets.some((asset) => String(asset.id) === value) ? <div className="small text-danger">Selected asset is unavailable in this source. Choose another asset.</div> : null}
      {error ? <div className="small text-danger">{error}</div> : null}
    </div>
  );
}
