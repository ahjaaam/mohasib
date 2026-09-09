"use client";

import { Toaster } from "react-hot-toast";
import { CheckCircle2, XCircle } from "lucide-react";

/**
 * Shared feedback surface for every Mohasib workspace and public flow.
 * Keep toast calls (`toast.success`, `toast.error`, etc.) decoupled from the
 * presentation so new messages automatically inherit the product UI.
 */
export default function MohasibToaster() {
  return (
    <Toaster
      position="top-right"
      containerClassName="mohasib-toaster"
      toastOptions={{
        className: "mohasib-toast mohasib-toast--info",
        success: {
          className: "mohasib-toast mohasib-toast--success",
          icon: <CheckCircle2 size={18} strokeWidth={2} className="text-[#059669]" aria-hidden="true" />,
          ariaProps: { role: "status", "aria-live": "polite" },
        },
        error: {
          className: "mohasib-toast mohasib-toast--error",
          icon: <XCircle size={18} strokeWidth={2} className="text-[#DC2626]" aria-hidden="true" />,
          ariaProps: { role: "alert", "aria-live": "assertive" },
        },
        loading: {
          className: "mohasib-toast mohasib-toast--loading",
          iconTheme: { primary: "#C8924A", secondary: "#E9E5DC" },
        },
      }}
    />
  );
}
