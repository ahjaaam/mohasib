import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { mohasibDemoCorpus, verifiedSupplierInvoice } from "./mohasib-demo-corpus";

const sampleRoot = resolve(process.env.MOHASIB_E2E_SAMPLE_ROOT ?? `${homedir()}/Downloads/Mohasib Demo Samples`);
const runAuthenticated = process.env.MOHASIB_E2E_AUTHENTICATED === "1";
const productionProjectRef = "keukfqryqsubbjvzvtqs";

function sample(relativePath: string) {
  return resolve(sampleRoot, relativePath);
}

function money(value: unknown) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function requireEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required for authenticated accounting E2E tests.`);
  return value;
}

function assertSafeTarget() {
  const kind = requireEnvironment("MOHASIB_E2E_ENVIRONMENT");
  const supabaseUrl = new URL(requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"));
  const appUrl = new URL(requireEnvironment("PLAYWRIGHT_BASE_URL"));
  expect(["local", "test", "preview"]).toContain(kind);
  expect(supabaseUrl.hostname).not.toContain(productionProjectRef);
  expect(appUrl.hostname).not.toMatch(/(^|\.)mohasibai\.com$/i);
}

async function login(page: Page, email: string, password: string) {
  await page.goto("/auth/login");
  await page.getByRole("textbox", { name: /e-?mail/i }).fill(email);
  await page.getByLabel("Mot de passe", { exact: true }).fill(password);
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST");
  await page.getByRole("button", { name: /se connecter/i }).click();
  const response = await responsePromise;
  const payload = await response.json();
  expect(response.status(), JSON.stringify(payload)).toBe(200);
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

async function userIdForEmail(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1_000 });
  if (error) throw error;
  const user = data.users.find((candidate) => candidate.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`No test user exists for ${email}. Seed the isolated test project first.`);
  return user.id;
}

test.describe("Mohasib demo sample corpus", () => {
  test("inventory is complete, readable, and has only the documented exact duplicate", async () => {
    expect(mohasibDemoCorpus).toHaveLength(46);
    const missing = mohasibDemoCorpus.filter(({ path }) => !existsSync(sample(path))).map(({ path }) => path);
    expect(missing, `Missing corpus files under ${sampleRoot}`).toEqual([]);

    const hashes = new Map<string, string[]>();
    for (const entry of mohasibDemoCorpus) {
      const digest = createHash("sha256").update(readFileSync(sample(entry.path))).digest("hex");
      hashes.set(digest, [...(hashes.get(digest) ?? []), entry.path]);
    }
    const duplicates = [...hashes.values()].filter((paths) => paths.length > 1);
    expect(duplicates).toEqual([[
      "Non Trade/Purchase Order_MAECPO250500037_23_05_2025 17_10 (1).pdf",
      "Non Trade/Purchase Order_MAECPO250500037_23_05_2025 17_10.pdf",
    ]]);
  });

  test("classification includes the supported accounting document families", async () => {
    const counts = Object.groupBy(mohasibDemoCorpus, ({ classification }) => classification);
    expect(counts.supplier_invoice?.length).toBe(16);
    expect(counts.supplier_invoice_packet?.length).toBe(8);
    expect(counts.expense_receipt?.length).toBe(12);
    expect(counts.purchase_order?.length).toBe(7);
    expect(counts.bank_statement?.length).toBe(3);
  });
});

test.describe("authenticated accounting corpus", () => {
  test.skip(!runAuthenticated, "Set MOHASIB_E2E_AUTHENTICATED=1 and provide an isolated local/test/preview target.");
  test.skip(({ isMobile }) => isMobile, "Mutation corpus scenarios run once on desktop Chromium.");

  let admin: SupabaseClient;
  let primaryUserId: string;
  const cleanupReceiptIds: string[] = [];
  const cleanupStoragePaths: string[] = [];

  test.beforeAll(async () => {
    assertSafeTarget();
    admin = createClient(
      requireEnvironment("NEXT_PUBLIC_SUPABASE_URL"),
      requireEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    primaryUserId = await userIdForEmail(admin, requireEnvironment("MOHASIB_E2E_USER_EMAIL"));
  });

  test.afterAll(async () => {
    if (!admin || cleanupReceiptIds.length === 0) return;
    await admin.from("ecritures_comptables").delete().in("source_id", cleanupReceiptIds);
    await admin.from("accounting_booking_batches").delete().in("source_id", cleanupReceiptIds);
    if (cleanupStoragePaths.length > 0) await admin.storage.from("receipts").remove(cleanupStoragePaths);
    await admin.from("receipts").delete().in("id", cleanupReceiptIds);
  });

  test("UI upload -> OCR -> API booking is balanced, VAT-correct, and idempotent", async ({ page }) => {
    test.setTimeout(180_000);
    await login(page, requireEnvironment("MOHASIB_E2E_USER_EMAIL"), requireEnvironment("MOHASIB_E2E_USER_PASSWORD"));
    await page.goto("/inbox");

    const ocrResponsePromise = page.waitForResponse((response) => response.url().endsWith("/api/ocr") && response.request().method() === "POST", { timeout: 150_000 });
    await page.locator('input[type="file"][accept*="application/pdf"]').first().setInputFiles(sample(verifiedSupplierInvoice.path));
    const ocrResponse = await ocrResponsePromise;
    const payload = await ocrResponse.json();
    expect(ocrResponse.status(), JSON.stringify(payload)).toBe(200);
    const receiptId = String(payload.receipt.id);
    cleanupReceiptIds.push(receiptId);

    const { data: receipt, error: receiptError } = await admin
      .from("receipts")
      .select("id,user_id,status,file_name,storage_path,ocr_data")
      .eq("id", receiptId)
      .single();
    expect(receiptError).toBeNull();
    expect(receipt.user_id).toBe(primaryUserId);
    expect(receipt.status).toBe("pending");
    expect(receipt.file_name).toBe("INV-63755 (1).pdf");
    expect(receipt.storage_path).toContain(primaryUserId);
    cleanupStoragePaths.push(receipt.storage_path);
    expect(String(receipt.ocr_data.vendor_name)).toMatch(verifiedSupplierInvoice.vendorPattern);
    expect(receipt.ocr_data.receipt_number).toBe(verifiedSupplierInvoice.invoiceNumber);
    expect(receipt.ocr_data.date).toBe(verifiedSupplierInvoice.date);
    expect(receipt.ocr_data.due_date).toBe(verifiedSupplierInvoice.dueDate);
    expect(money(receipt.ocr_data.amount_ht)).toBe(verifiedSupplierInvoice.amountHt);
    expect(money(receipt.ocr_data.tva_amount)).toBe(verifiedSupplierInvoice.vatAmount);
    expect(money(receipt.ocr_data.amount_ttc)).toBe(verifiedSupplierInvoice.amountTtc);
    expect(money(receipt.ocr_data.tva_rate)).toBe(verifiedSupplierInvoice.vatRate);

    const bookingRequest = () => page.request.post("/api/accounting/book", { data: { type: "purchase", receiptId } });
    const [firstBooking, retryBooking] = await Promise.all([bookingRequest(), bookingRequest()]);
    expect(firstBooking.status(), await firstBooking.text()).toBe(200);
    expect(retryBooking.status(), await retryBooking.text()).toBe(200);

    const { data: entries, error: entriesError } = await admin
      .from("ecritures_comptables")
      .select("company_id,dossier_id,journal,compte,debit,credit,source_type,source_id")
      .eq("source_type", "purchase")
      .eq("source_id", receiptId);
    expect(entriesError).toBeNull();
    expect(entries).toHaveLength(3);
    expect(entries.every((entry) => entry.journal === "AC" && entry.source_id === receiptId)).toBeTruthy();
    expect(money(entries.reduce((sum, entry) => sum + Number(entry.debit), 0))).toBe(verifiedSupplierInvoice.amountTtc);
    expect(money(entries.reduce((sum, entry) => sum + Number(entry.credit), 0))).toBe(verifiedSupplierInvoice.amountTtc);
    expect(entries.some((entry) => money(entry.debit) === verifiedSupplierInvoice.vatAmount)).toBeTruthy();
    expect(entries.some((entry) => money(entry.credit) === verifiedSupplierInvoice.amountTtc)).toBeTruthy();

    const { count: batchCount, error: batchError } = await admin
      .from("accounting_booking_batches")
      .select("id", { count: "exact", head: true })
      .eq("source_type", "purchase")
      .eq("source_id", receiptId);
    expect(batchError).toBeNull();
    expect(batchCount).toBe(1);
  });

  test("RLS prevents either authenticated tenant from reading the other's document", async () => {
    const primaryEmail = requireEnvironment("MOHASIB_E2E_USER_EMAIL");
    const primaryPassword = requireEnvironment("MOHASIB_E2E_USER_PASSWORD");
    const secondaryEmail = requireEnvironment("MOHASIB_E2E_OTHER_USER_EMAIL");
    const secondaryPassword = requireEnvironment("MOHASIB_E2E_OTHER_USER_PASSWORD");
    const secondaryUserId = await userIdForEmail(admin, secondaryEmail);

    const { data: inserted, error: insertError } = await admin.from("receipts").insert([
      { user_id: primaryUserId, file_name: "rls-primary.pdf", mime_type: "application/pdf", status: "pending", ocr_data: {} },
      { user_id: secondaryUserId, file_name: "rls-secondary.pdf", mime_type: "application/pdf", status: "pending", ocr_data: {} },
    ]).select("id,user_id");
    expect(insertError).toBeNull();
    expect(inserted).toHaveLength(2);
    cleanupReceiptIds.push(...inserted.map(({ id }) => id));

    const anonKey = requireEnvironment("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const url = requireEnvironment("NEXT_PUBLIC_SUPABASE_URL");
    const primary = createClient(url, anonKey, { auth: { persistSession: false } });
    const secondary = createClient(url, anonKey, { auth: { persistSession: false } });
    expect((await primary.auth.signInWithPassword({ email: primaryEmail, password: primaryPassword })).error).toBeNull();
    expect((await secondary.auth.signInWithPassword({ email: secondaryEmail, password: secondaryPassword })).error).toBeNull();

    const primaryRow = inserted.find((row) => row.user_id === primaryUserId)!;
    const secondaryRow = inserted.find((row) => row.user_id === secondaryUserId)!;
    const [primaryOwn, primaryOther, secondaryOwn, secondaryOther] = await Promise.all([
      primary.from("receipts").select("id").eq("id", primaryRow.id),
      primary.from("receipts").select("id").eq("id", secondaryRow.id),
      secondary.from("receipts").select("id").eq("id", secondaryRow.id),
      secondary.from("receipts").select("id").eq("id", primaryRow.id),
    ]);
    expect(primaryOwn.data).toHaveLength(1);
    expect(secondaryOwn.data).toHaveLength(1);
    expect(primaryOther.data).toEqual([]);
    expect(secondaryOther.data).toEqual([]);
  });

  test.skip("bank-statement UI import, payment allocation, and reconciliation require an approved matching fixture ledger", async () => {});
  test.skip("purchase orders must remain supporting documents and must not create purchase journal entries", async () => {});
  test.skip("ambiguous supplier VAT must require review instead of defaulting to 20 percent", async () => {});
});
