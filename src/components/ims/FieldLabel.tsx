"use client";

import type { ReactNode } from "react";

type FieldLabelProps = {
  children: ReactNode;
  required?: boolean;
  info?: string;
  infoPlacement?: "top" | "bottom";
  htmlFor?: string;
  check?: boolean;
  className?: string;
};

export function FieldLabel({
  children,
  required = false,
  info,
  infoPlacement = "bottom",
  htmlFor,
  check = false,
  className = "",
}: FieldLabelProps) {
  const labelText = typeof children === "string" ? children : "Field";
  const baseClass = check ? "form-check-label" : "form-label";

  return (
    <label htmlFor={htmlFor} className={`${baseClass} small d-inline-flex align-items-center gap-1 ${className}`.trim()}>
      <span>
        {children} {required ? <span className="text-danger">*</span> : null}
      </span>
      {info ? (
        <span className={`ims-info-hint ims-info-hint-${infoPlacement}`}>
          <button className="ims-info-button" type="button" aria-label={`${labelText} help`}>
            i
          </button>
          <span className="ims-info-tooltip" role="tooltip">
            {info}
          </span>
        </span>
      ) : null}
    </label>
  );
}
