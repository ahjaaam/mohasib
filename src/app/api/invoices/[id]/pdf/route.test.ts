import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  createClient: vi.fn(),
  generateInvoicePDF: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/pdf/generateInvoicePDF", () => ({ generateInvoicePDF: mocks.generateInvoicePDF }));
vi.mock("@/lib/api-plan", () => ({ requirePlanFeature: vi.fn() }));
vi.mock("sharp", () => ({ default: vi.fn() }));

import { GET } from "./route";

describe("invoice PDF content disposition", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const invoice = {
      id: "invoice-id",
      user_id: "owner-id",
      dossier_id: null,
      invoice_number: "F-2026-001",
      invoice_type: "facture",
      issue_date: "2026-09-12",
      subtotal: 100,
      tax_rate: 20,
      tax_amount: 20,
      total: 120,
      items: [],
      clients: { name: "Acme" },
    };
    const invoiceQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: invoice, error: null }),
    };
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-id" } } }) },
      from: vi.fn(() => invoiceQuery),
    });

    const companyQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
    };
    mocks.createAdminClient.mockReturnValue({ from: vi.fn(() => companyQuery) });
    mocks.generateInvoicePDF.mockReturnValue(new Uint8Array([37, 80, 68, 70]));
  });

  it("renders inline when the archive requests a preview", async () => {
    const response = await GET(
      new NextRequest("https://app.mohasibai.com/api/invoices/invoice-id/pdf?preview=1"),
      { params: Promise.resolve({ id: "invoice-id" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe(
      'inline; filename="Facture-F-2026-001-Acme.pdf"',
    );
  });

  it("keeps direct PDF requests downloadable", async () => {
    const response = await GET(
      new NextRequest("https://app.mohasibai.com/api/invoices/invoice-id/pdf"),
      { params: Promise.resolve({ id: "invoice-id" }) },
    );

    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="Facture-F-2026-001-Acme.pdf"',
    );
  });
});
