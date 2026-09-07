import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TransactionAssetSelect } from "./TransactionAssetSelect";

const get = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { get } }));
vi.mock("./SearchableSelect", () => ({ SearchableSelect: ({ value, options, onChange }: {
  value: string; options: { value: string; label: string }[]; onChange: (value: string) => void;
}) => <select aria-label="Asset" value={value} onChange={(event) => onChange(event.target.value)}>
  <option value="">Choose</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
</select> }));

const props = { id: "asset", itemId: "1", value: "", transactionType: "issue", departmentId: "2", storeId: "3", employeeId: "4", projectId: "", fundingSourceId: "" };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("voucher asset selection", () => {
  it("shows serials and specifications and submits the selected asset ID", async () => {
    get.mockResolvedValue({ data: { data: [{ id: 10, asset_id: "TAG-10", serial_number: "HP001", brand: "HP", model: "EliteBook 840 G7", status: "in_store", attribute_details: [{ label: "RAM", value: "16GB" }, { label: "Storage", value: "1TB SSD" }] }] } });
    const onChange = vi.fn();
    render(<TransactionAssetSelect {...props} onChange={onChange} />);
    await screen.findByRole("option", { name: "TAG-10 | SN: HP001 | HP EliteBook 840 G7 | RAM: 16GB | Storage: 1TB SSD" });
    fireEvent.change(screen.getByLabelText("Asset"), { target: { value: "10" } });
    expect(onChange).toHaveBeenCalledWith("10");
    expect(get).toHaveBeenCalledWith("/assets", expect.objectContaining({ params: expect.objectContaining({ item_id: "1", department_id: "2", store_id: "3", status: "in_store" }) }));
  });

  it("scopes returns to the employee and excludes assets already in store", async () => {
    get.mockResolvedValue({ data: { data: [
      { id: 10, asset_id: "TAG-10", serial_number: "HP001", status: "issued" },
      { id: 11, asset_id: "TAG-11", serial_number: "HP002", status: "in_store" },
    ] } });
    render(<TransactionAssetSelect {...props} transactionType="return" onChange={() => {}} />);
    await screen.findByRole("option", { name: "TAG-10 | SN: HP001" });
    expect(screen.queryByRole("option", { name: "TAG-11 | SN: HP002" })).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith("/assets", expect.objectContaining({ params: expect.objectContaining({ custodian_user_id: "4", store_id: undefined }) }));
  });

  it("reports lookup failures rather than offering unverified assets", async () => {
    get.mockRejectedValue(new Error("offline"));
    render(<TransactionAssetSelect {...props} value="10" onChange={() => {}} />);
    await waitFor(() => expect(screen.getByText(/Could not load assets/)).toBeInTheDocument());
  });
});
