"use client";

import { useMemo, useState } from "react";
import { DataTable, FilterBar, PageHeader, StatusBadge } from "@/components/ims";

type ItemRow = Record<string, unknown> & {
  id: number;
  code: string;
  name: string;
  category: string;
  uom: string;
  type: "Fixed Asset" | "Consumable" | "Software License" | "Controlled Item";
  min: number;
  serial: boolean;
  tag: boolean;
  status: "Active";
};

const itemRows: ItemRow[] = [
  { id: 1, code: "IT-LAP-001", name: "Dell Latitude 5440", category: "Computer Hardware", uom: "Each", type: "Fixed Asset", min: 2, serial: true, tag: true, status: "Active" },
  { id: 2, code: "IT-PRT-002", name: "HP LaserJet Pro M404", category: "Computer Hardware", uom: "Each", type: "Fixed Asset", min: 1, serial: true, tag: true, status: "Active" },
  { id: 3, code: "FUR-CHR-010", name: "Executive Chair", category: "Furniture", uom: "Each", type: "Fixed Asset", min: 5, serial: false, tag: true, status: "Active" },
  { id: 4, code: "STA-A4-001", name: "A4 Paper Ream", category: "Stationery", uom: "Ream", type: "Consumable", min: 50, serial: false, tag: false, status: "Active" },
  { id: 5, code: "STA-PEN-003", name: "Ball Point Pen (Blue)", category: "Stationery", uom: "Pack", type: "Consumable", min: 30, serial: false, tag: false, status: "Active" },
  { id: 6, code: "LAB-BKR-001", name: "Glass Beaker 250ml", category: "Lab Equipment", uom: "Each", type: "Consumable", min: 20, serial: false, tag: false, status: "Active" },
  { id: 7, code: "LAB-MIC-002", name: "Olympus Microscope CX23", category: "Lab Equipment", uom: "Each", type: "Fixed Asset", min: 1, serial: true, tag: true, status: "Active" },
  { id: 8, code: "NET-SW-001", name: "Cisco Catalyst 2960 Switch", category: "Networking", uom: "Each", type: "Fixed Asset", min: 1, serial: true, tag: true, status: "Active" },
  { id: 9, code: "SW-OFC-365", name: "Microsoft 365 Education", category: "Software License", uom: "License", type: "Software License", min: 10, serial: true, tag: false, status: "Active" },
  { id: 10, code: "CS-ANS-001", name: "Examination Answer Book", category: "Controlled Stationery", uom: "Book", type: "Controlled Item", min: 200, serial: true, tag: false, status: "Active" },
  { id: 11, code: "CS-DEG-001", name: "Degree Certificate Form", category: "Controlled Stationery", uom: "Sheet", type: "Controlled Item", min: 100, serial: true, tag: false, status: "Active" },
];

const typeOptions = ["Fixed Asset", "Consumable", "Software License", "Controlled Item"];

export default function ItemsPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return itemRows.filter((item) => {
      const matchesSearch = query.length === 0 || `${item.code} ${item.name}`.toLowerCase().includes(query);
      const matchesType = type.length === 0 || item.type === type;
      const matchesStatus = status.length === 0 || item.status === status;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [search, status, type]);

  const resetFilters = () => {
    setSearch("");
    setType("");
    setStatus("");
  };

  const columns = [
    {
      key: "code",
      header: "Code",
      render: (row: ItemRow) => (
        <a className="ims-code-link" href={`#${row.code}`}>
          {row.code}
        </a>
      ),
    },
    { key: "name", header: "Name" },
    { key: "category", header: "Category" },
    { key: "uom", header: "UoM" },
    {
      key: "type",
      header: "Type",
      render: (row: ItemRow) => <span className="badge text-bg-light border text-dark">{row.type}</span>,
    },
    { key: "min", header: "Min", className: "text-end" },
    {
      key: "serial",
      header: "Serial",
      className: "text-center",
      render: (row: ItemRow) =>
        row.serial ? <i className="bi bi-check-lg text-success" aria-label="Serial tracked" /> : <span className="text-secondary">&mdash;</span>,
    },
    {
      key: "tag",
      header: "Tag",
      className: "text-center",
      render: (row: ItemRow) =>
        row.tag ? <i className="bi bi-qr-code text-primary" aria-label="Tag enabled" /> : <span className="text-secondary">&mdash;</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (row: ItemRow) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <main className="min-vh-100 bg-body-tertiary">
      <div className="container-fluid p-4">
        <PageHeader
          title="Item Master"
          subtitle="Consumables, fixed assets, controlled items, licenses, project inventory"
          breadcrumbs={[{ label: "Inventory" }, { label: "Items" }]}
          actions={
            <button className="btn btn-primary" type="button">
              <i className="bi bi-plus-lg me-2" />
              New Item
            </button>
          }
        />

        <FilterBar onReset={resetFilters}>
          <div className="col-12 col-lg-4">
            <label className="form-label fw-semibold">Search</label>
            <input
              className="form-control"
              placeholder="Name or code"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Type</label>
            <select className="form-select" value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">All</option>
              {typeOptions.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="col-12 col-lg-3">
            <label className="form-label fw-semibold">Status</label>
            <select className="form-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All</option>
              <option>Active</option>
            </select>
          </div>
        </FilterBar>

        <DataTable
          columns={columns}
          rows={rows}
          empty="No items found."
          rowClassName={(row) => (row.code === "LAB-MIC-002" ? "table-active" : "")}
        />
      </div>
    </main>
  );
}
