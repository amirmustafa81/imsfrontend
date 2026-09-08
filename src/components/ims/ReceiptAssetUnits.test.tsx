import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { AttributeFields, type AttributeDefinition } from "./AttributeFields";
import { ReceiptAssetUnits, type ReceiptAssetUnit } from "./ReceiptAssetUnits";

const definitions: AttributeDefinition[] = [
  { id: 1, category_id: 1, code: "ram", label: "RAM", field_type: "select", options: ["16GB", "32GB"], applies_to: "both", is_required: true },
  { id: 2, category_id: 1, code: "storage", label: "Storage", field_type: "text", applies_to: "both" },
];

const dependentDefinitions: AttributeDefinition[] = [
  { id: 10, category_id: 1, code: "brand", label: "Brand", field_type: "select", options: ["HP", "Dell", "Lenovo"], applies_to: "both" },
  { id: 11, category_id: 1, code: "series", label: "Series", field_type: "select", options: ["HP EliteBook 840", "HP ProBook 450", "Dell Latitude", "Dell OptiPlex", "Lenovo ThinkPad"], applies_to: "both" },
];

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Editor({ count = 2, initial = [] }: { count?: number; initial?: ReceiptAssetUnit[] }) {
  const [units, setUnits] = useState(initial);
  return <>
    <ReceiptAssetUnits units={units} count={count} defaults={{ ram: "16GB", storage: "512GB SSD" }} definitions={definitions}
      categoryId={1} subcategoryId={null} serialRequired onChange={setUnits} />
    <output data-testid="units">{JSON.stringify(units)}</output>
  </>;
}

describe("receipt unit specifications", () => {
  it("copies specs without replacing serials and allows individual overrides", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Prepare 2 unit rows" }));
    fireEvent.change(screen.getByLabelText("Unit 1 serial number *"), { target: { value: "HP001" } });
    fireEvent.change(screen.getByLabelText("Unit 2 serial number *"), { target: { value: "HP002" } });
    fireEvent.change(screen.getAllByLabelText("RAM *")[0], { target: { value: "32GB" } });
    fireEvent.click(screen.getByRole("button", { name: "Copy unit 1 specs to all rows" }));
    fireEvent.change(screen.getAllByLabelText("Storage")[1], { target: { value: "1TB SSD" } });
    expect(JSON.parse(screen.getByTestId("units").textContent ?? "[]")).toEqual([
      { serial_number: "HP001", attributes: { ram: "32GB", storage: "512GB SSD" } },
      { serial_number: "HP002", attributes: { ram: "32GB", storage: "1TB SSD" } },
    ]);
  });

  it("keeps unit details when a quantity reduction is cancelled", () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<Editor count={1} initial={[{ serial_number: "HP001", attributes: {} }, { serial_number: "HP002", attributes: {} }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Prepare 1 unit rows" }));
    expect(screen.getByLabelText("Unit 2 serial number *")).toHaveValue("HP002");
  });

  it("captures one common specification set for non-serial items", () => {
    render(<ReceiptAssetUnits units={[]} count={10} defaults={{}} definitions={definitions}
      categoryId={1} subcategoryId={null} serialRequired={false} onChange={() => {}} />);
    expect(screen.queryByLabelText(/serial number/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Prepare/i })).not.toBeInTheDocument();
    expect(screen.getByText("Common specifications")).toBeInTheDocument();
  });

  it("shows a setup warning when no asset attributes match the selected item scope", () => {
    const Wrapper = () => {
      const [units, setUnits] = useState<ReceiptAssetUnit[]>([]);
      return <ReceiptAssetUnits units={units} count={1} defaults={{}} definitions={definitions}
        categoryId={2} subcategoryId={null} serialRequired onChange={setUnits} />;
    };

    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: "Prepare 1 unit rows" }));
    expect(screen.getByText(/No asset specification attributes are configured/)).toBeInTheDocument();
  });

  it("makes shared item defaults optional and asset values required", () => {
    render(<>
      <section aria-label="Item"><AttributeFields definitions={definitions} categoryId={1} subcategoryId={null} appliesTo="item" values={{}} onChange={() => {}} /></section>
      <section aria-label="Asset"><AttributeFields definitions={definitions} categoryId={1} subcategoryId={null} appliesTo="asset" values={{}} onChange={() => {}} /></section>
    </>);
    expect(within(screen.getByRole("region", { name: "Item" })).getByLabelText("RAM")).not.toBeRequired();
    expect(within(screen.getByRole("region", { name: "Asset" })).getByLabelText("RAM *")).toBeRequired();
  });

  it("filters dependent series options by selected brand and clears stale selections", () => {
    const Wrapper = () => {
      const [values, setValues] = useState<Record<string, string | boolean>>({ brand: "HP", series: "HP EliteBook 840" });
      return <>
        <AttributeFields definitions={dependentDefinitions} categoryId={1} subcategoryId={null} appliesTo="asset" values={values}
          onChange={(code, value, nextValues) => setValues(nextValues ?? { ...values, [code]: value })} />
        <output data-testid="attributes">{JSON.stringify(values)}</output>
      </>;
    };

    render(<Wrapper />);
    const series = screen.getByLabelText("Series");
    expect(within(series).getByRole("option", { name: "HP EliteBook 840" })).toBeInTheDocument();
    expect(within(series).queryByRole("option", { name: "Dell Latitude" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Brand"), { target: { value: "Dell" } });
    expect(JSON.parse(screen.getByTestId("attributes").textContent ?? "{}")).toEqual({ brand: "Dell", series: "" });
    expect(within(screen.getByLabelText("Series")).getByRole("option", { name: "Dell Latitude" })).toBeInTheDocument();
  });
});
