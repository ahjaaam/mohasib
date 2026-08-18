import { describe, expect, it } from "vitest";
import { simpleParser } from "mailparser";
import {
  inboundAttachmentKey,
  inboundMessageKey,
  safeInboundFileName,
  senderRateLimitKey,
  utf8Bytes,
} from "./inbound-email";

describe("inbound email safeguards", () => {
  it("uses the provider message id when present", () => {
    expect(inboundMessageKey("raw", " <ABC@example.com> ")).toBe("<abc@example.com>");
  });

  it("falls back to a deterministic raw-message digest", () => {
    expect(inboundMessageKey("same message")).toBe(inboundMessageKey("same message"));
    expect(inboundMessageKey("same message")).not.toBe(inboundMessageKey("different message"));
  });

  it("deduplicates attachments by dossier, message, and bytes", () => {
    const first = inboundAttachmentKey("dossier", "message", Buffer.from("invoice"));
    expect(first).toBe(inboundAttachmentKey("dossier", "message", Buffer.from("invoice")));
    expect(first).not.toBe(inboundAttachmentKey("other", "message", Buffer.from("invoice")));
  });

  it("sanitizes attachment names and counts UTF-8 bytes", () => {
    expect(safeInboundFileName("../../facture\n.pdf", "document.pdf")).toBe(".._.._facture_.pdf");
    expect(utf8Bytes("é")).toBe(2);
  });

  it("does not expose sender addresses in rate-limit keys", () => {
    const key = senderRateLimitKey("dossier", "Client@Example.com");
    expect(key).toMatch(/^dossier:[a-f0-9]{24}$/);
    expect(key).not.toContain("client@example.com");
  });

  it("parses MIME attachments with HTML conversion disabled", async () => {
    const raw = [
      "From: client@example.com",
      "To: factures-demo@mohasibai.com",
      "Message-ID: <invoice-1@example.com>",
      "MIME-Version: 1.0",
      "Content-Type: multipart/mixed; boundary=invoice",
      "",
      "--invoice",
      "Content-Type: text/html; charset=utf-8",
      "",
      "<p>Invoice attached</p>",
      "--invoice",
      "Content-Type: application/pdf",
      "Content-Disposition: attachment; filename=invoice.pdf",
      "Content-Transfer-Encoding: base64",
      "",
      "JVBERi0xLjQ=",
      "--invoice--",
      "",
    ].join("\r\n");

    const parsed = await simpleParser(raw, {
      skipHtmlToText: true,
      skipTextToHtml: true,
      maxHtmlLengthToParse: 1024,
    });
    expect(parsed.messageId).toBe("<invoice-1@example.com>");
    expect(parsed.attachments).toHaveLength(1);
    expect(parsed.attachments[0].filename).toBe("invoice.pdf");
  });
});
