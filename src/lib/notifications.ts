export const NOTIFICATION_TYPE_OPTIONS = [
  { value: "low_stock", label: "Low Stock" },
  { value: "asset_verification_due", label: "Assets Due for Verification" },
  { value: "warranty_expiring", label: "Expiring Warranty" },
  { value: "inventory", label: "Inventory" },
  { value: "transaction", label: "Transaction" },
  { value: "system", label: "System" },
];

export function formatNotificationType(value?: string | null) {
  if (!value) return "General";

  const match = NOTIFICATION_TYPE_OPTIONS.find((option) => option.value === value);
  if (match) return match.label;

  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
