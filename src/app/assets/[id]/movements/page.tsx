"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DataTable, EmptyState, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type AssetMovement = {
  id: number;
  movement_no: string;
  movement_type: string;
  movement_date: string;
  status: string | null;
  verification_status: string | null;
  manual_approval_ref: string | null;
  manual_approved_by: string | null;
  from_department?: {
    id: number;
    name: string;
  } | null;
  to_department?: {
    id: number;
    name: string;
  } | null;
  from_custodian?: {
    id: number;
    name: string;
  } | null;
  to_custodian?: {
    id: number;
    name: string;
  } | null;
  remarks: string | null;
};

type Relation = {
  name: string;
};

const formatDate = (value: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB").format(parsed);
};

const relationName = (relation: Relation | null | undefined) => {
  if (!relation?.name) {
    return "-";
  }

  return relation.name;
};

export default function AssetMovementsPage() {
  const params = useParams<{ id?: string }>();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [rows, setRows] = useState<AssetMovement[]>([]);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("Loading movement history...");
  const [error, setError] = useState("");

  const id = Number(params.id);
  const assetId = Number.isNaN(id) ? null : id;

  const loadRows = useCallback(async () => {
    if (authLoading || !isAuthenticated || assetId === null) {
      if (assetId === null && params.id) {
        setError("Unable to resolve this asset ID.");
        setMessage("");
      }

      return;
    }

    try {
      setMessage("Loading movement history...");
      const response = await api.get<{ data: AssetMovement[] }>("/asset-movements", {
        params: {
          asset_id: assetId,
          ...(search.trim() ? { search: search.trim() } : {}),
        },
      });

      setRows(Array.isArray(response.data?.data) ? response.data.data : []);
      setError("");
      setMessage("");
    } catch {
      setRows([]);
      setError("Unable to load movement history. Check permission scope or API access.");
      setMessage("");
    }
  }, [assetId, authLoading, isAuthenticated, params.id, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadRows();
  }, [loadRows]);

  const columns = [
    { key: "movement_no", header: "Movement" },
    {
      key: "movement_type",
      header: "Type",
      render: (row: AssetMovement) => row.movement_type || "-",
    },
    {
      key: "movement_date",
      header: "Date",
      render: (row: AssetMovement) => formatDate(row.movement_date),
    },
    {
      key: "from_department",
      header: "From → To",
      render: (row: AssetMovement) => `${relationName(row.from_department)} -> ${relationName(row.to_department)}`,
    },
    {
      key: "from_custodian",
      header: "Custodian From / To",
      render: (row: AssetMovement) => `${relationName(row.from_custodian)} -> ${relationName(row.to_custodian)}`,
    },
    {
      key: "status",
      header: "Status",
      render: (row: AssetMovement) => {
        if (row.verification_status) {
          return <StatusBadge status={row.verification_status} />;
        }

        return <StatusBadge status={row.status ?? "draft"} />;
      },
    },
    {
      key: "remarks",
      header: "Remarks",
      render: (row: AssetMovement) => row.remarks || "-",
    },
    {
      key: "approval",
      header: "Approval",
      render: (row: AssetMovement) =>
        row.manual_approval_ref
          ? `${row.manual_approval_ref}${row.manual_approved_by ? ` (${row.manual_approved_by})` : ""}`
          : "-",
    },
  ];

  if (assetId === null) {
    return (
      <main className="min-vh-100 bg-body-tertiary">
        <div className="container-fluid p-4">
          <PageHeader title="Asset Movements" subtitle="View movement history for one asset." />
          <EmptyState title="Invalid asset id" message="Select a valid asset from the fixed asset register first." />
          <div className="mt-3">
            <Link className="btn btn-outline-secondary btn-sm" href="/assets">
              <i className="bi bi-arrow-left me-1" />
              Back to Fixed Asset Register
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (!isAuthenticated && !authLoading) {
    return (
      <main className="min-vh-100 bg-body-tertiary">
        <div className="container-fluid p-4">
          <PageHeader title={`Asset ${id} Movements`} subtitle="Movement history and custody transitions." />
          <div className="alert alert-warning">Please sign in to load movement records.</div>
          <Link className="btn btn-outline-secondary btn-sm" href="/assets">
            <i className="bi bi-arrow-left me-1" />
            Back to Fixed Asset Register
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title={`Asset ${id} Movements`}
          subtitle="Track where this asset has moved and who handled custody changes."
          actions={
            <Link href={`/assets/${id}`} className="btn btn-sm btn-outline-secondary">
              <i className="bi bi-arrow-left me-1" />
              Back to Asset Detail
            </Link>
          }
        />

        {message ? <div className="alert alert-info mb-3">{message}</div> : null}
        {error ? <div className="alert alert-danger mb-3">{error}</div> : null}

        <FilterBar onReset={() => setSearch("")}>
          <div className="col-12 col-lg-5">
            <label className="form-label small fw-semibold">Search movement</label>
            <input
              className="form-control form-control-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Movement no / approval / remarks"
            />
          </div>
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState title="No movement records" message="No matching movement history found for this asset." />
        ) : (
          <DataTable columns={columns} rows={rows} />
        )}
      </div>
    </main>
  );
}
