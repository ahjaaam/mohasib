#!/usr/bin/env python3
"""Generate the code-informed Mohasib technical product and workflow guide."""

from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, Image, Flowable, NextPageTemplate,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output" / "pdf" / "mohasib-technical-product-and-workflow-guide.pdf"

NAVY = colors.HexColor("#0D1526")
GOLD = colors.HexColor("#C8924A")
CREAM = colors.HexColor("#FAFAF6")
INK = colors.HexColor("#172033")
MUTED = colors.HexColor("#657084")
LINE = colors.HexColor("#D9DDE5")
PALE_GOLD = colors.HexColor("#F7EBD8")
PALE_BLUE = colors.HexColor("#EAF1FA")
PALE_GREEN = colors.HexColor("#E8F5EF")
PALE_RED = colors.HexColor("#FCEBEC")
WHITE = colors.white

pdfmetrics.registerFont(TTFont("Mohasib", "/System/Library/Fonts/Supplemental/Arial.ttf"))
pdfmetrics.registerFont(TTFont("Mohasib-Bold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="BodyM", fontName="Mohasib", fontSize=9.1, leading=13.2, textColor=INK, spaceAfter=5))
styles.add(ParagraphStyle(name="SmallM", fontName="Mohasib", fontSize=7.7, leading=10.3, textColor=MUTED))
styles.add(ParagraphStyle(name="TinyM", fontName="Mohasib", fontSize=6.7, leading=8.6, textColor=MUTED))
styles.add(ParagraphStyle(name="H1M", fontName="Mohasib-Bold", fontSize=22, leading=26, textColor=NAVY, spaceAfter=9))
styles.add(ParagraphStyle(name="H2M", fontName="Mohasib-Bold", fontSize=14.5, leading=18, textColor=NAVY, spaceBefore=7, spaceAfter=7))
styles.add(ParagraphStyle(name="H3M", fontName="Mohasib-Bold", fontSize=10.8, leading=14, textColor=NAVY, spaceBefore=6, spaceAfter=4))
styles.add(ParagraphStyle(name="BulletM", parent=styles["BodyM"], leftIndent=12, firstLineIndent=-7, bulletIndent=2, spaceAfter=3))
styles.add(ParagraphStyle(name="CellM", fontName="Mohasib", fontSize=7.2, leading=9.2, textColor=INK))
styles.add(ParagraphStyle(name="CellBoldM", fontName="Mohasib-Bold", fontSize=7.2, leading=9.2, textColor=NAVY))
styles.add(ParagraphStyle(name="CellHeadM", fontName="Mohasib-Bold", fontSize=7.2, leading=9.2, textColor=WHITE))
styles.add(ParagraphStyle(name="CodeM", fontName="Courier", fontSize=7.2, leading=9.6, textColor=INK, backColor=colors.HexColor("#F1F3F6"), borderPadding=5))
styles.add(ParagraphStyle(name="CoverTitle", fontName="Mohasib-Bold", fontSize=29, leading=34, textColor=WHITE, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="CoverSub", fontName="Mohasib", fontSize=12, leading=17, textColor=colors.HexColor("#E6EAF0")))
styles.add(ParagraphStyle(name="ChapterNo", fontName="Mohasib-Bold", fontSize=8, leading=10, textColor=GOLD, spaceAfter=4))


def P(text, style="BodyM"):
    return Paragraph(text, styles[style])


def B(text):
    return Paragraph("• " + text, styles["BulletM"])


def H1(no, title, subtitle=None):
    items = [P(f"CHAPTER {no}", "ChapterNo"), P(title, "H1M")]
    if subtitle:
        items.append(P(subtitle, "SmallM"))
    items.append(Spacer(1, 3 * mm))
    return items


def H2(title):
    return P(title, "H2M")


def H3(title):
    return P(title, "H3M")


def callout(title, text, fill=PALE_GOLD):
    t = Table([[P(title, "CellBoldM"), P(text, "CellM")]], colWidths=[38 * mm, 132 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), fill),
        ("BOX", (0, 0), (-1, -1), 0.6, GOLD),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return KeepTogether([t, Spacer(1, 3 * mm)])


def grid_table(headers, rows, widths=None, small=False):
    style_name = "TinyM" if small else "CellM"
    data = [[P(str(h), "CellHeadM") for h in headers]]
    for row in rows:
        data.append([P(str(c), style_name) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
        ("GRID", (0, 0), (-1, -1), 0.35, LINE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [WHITE, colors.HexColor("#F7F8FA")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    return KeepTogether([t, Spacer(1, 3 * mm)])


class FlowDiagram(Flowable):
    def __init__(self, steps, width=170 * mm, box_h=18 * mm, title=None):
        super().__init__()
        self.steps = steps
        self.width = width
        self.box_h = box_h
        self.title = title
        self.height = box_h + (12 * mm if title else 5 * mm)

    def wrap(self, availWidth, availHeight):
        self.width = min(self.width, availWidth)
        return self.width, self.height

    def draw(self):
        c = self.canv
        title_offset = 8 * mm if self.title else 0
        if self.title:
            c.setFont("Mohasib-Bold", 8)
            c.setFillColor(NAVY)
            c.drawString(0, self.height - 5 * mm, self.title)
        n = len(self.steps)
        gap = 5 * mm
        bw = (self.width - gap * (n - 1)) / n
        y = 2 * mm
        for i, step in enumerate(self.steps):
            x = i * (bw + gap)
            fill = [PALE_BLUE, PALE_GOLD, PALE_GREEN, colors.HexColor("#F0ECF8")][i % 4]
            c.setFillColor(fill)
            c.setStrokeColor(NAVY)
            c.setLineWidth(0.55)
            c.roundRect(x, y, bw, self.box_h, 4, fill=1, stroke=1)
            text = step
            p = Paragraph(text, ParagraphStyle(name=f"fd{i}", fontName="Mohasib-Bold", fontSize=7.2, leading=8.6, textColor=NAVY, alignment=TA_CENTER))
            pw, ph = p.wrap(bw - 5, self.box_h - 4)
            p.drawOn(c, x + (bw - pw) / 2, y + (self.box_h - ph) / 2)
            if i < n - 1:
                ax1 = x + bw + 1
                ax2 = x + bw + gap - 1
                ay = y + self.box_h / 2
                c.setStrokeColor(GOLD)
                c.setFillColor(GOLD)
                c.line(ax1, ay, ax2, ay)
                c.line(ax2, ay, ax2 - 3, ay + 2)
                c.line(ax2, ay, ax2 - 3, ay - 2)


class LinkDiagram(Flowable):
    def __init__(self):
        super().__init__()
        self.width = 170 * mm
        self.height = 84 * mm

    def wrap(self, availWidth, availHeight):
        self.width = min(self.width, availWidth)
        return self.width, self.height

    def draw_box(self, x, y, w, h, title, lines, fill):
        c = self.canv
        c.setFillColor(fill); c.setStrokeColor(NAVY); c.setLineWidth(.6)
        c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
        c.setFillColor(NAVY); c.setFont("Mohasib-Bold", 8)
        c.drawString(x + 6, y + h - 11, title)
        c.setFont("Mohasib", 6.5); c.setFillColor(INK)
        yy = y + h - 21
        for line in lines:
            c.drawString(x + 6, yy, line); yy -= 9

    def arrow(self, x1, y1, x2, y2, label=""):
        c = self.canv; c.setStrokeColor(GOLD); c.setFillColor(GOLD); c.setLineWidth(1)
        c.line(x1, y1, x2, y2)
        import math
        a = math.atan2(y2-y1, x2-x1)
        for d in (2.6, -2.6):
            c.line(x2, y2, x2-6*math.cos(a+d), y2-6*math.sin(a+d))
        if label:
            c.setFont("Mohasib", 6.2); c.setFillColor(MUTED)
            c.drawCentredString((x1+x2)/2, (y1+y2)/2+3, label)

    def draw(self):
        w = self.width; bw = 48 * mm; bh = 23 * mm
        self.draw_box(0, 54*mm, bw, bh, "DOCUMENT", ["receipt / invoice", "OCR data, amount, due date"], PALE_GOLD)
        self.draw_box(w-bw, 54*mm, bw, bh, "TRANSACTION", ["income / expense", "bank reference, date, amount"], PALE_BLUE)
        self.draw_box((w-bw)/2, 28*mm, bw, bh, "PAYMENT ALLOCATION", ["document + transaction", "allocated amount, confidence"], PALE_GREEN)
        self.draw_box(0, 0, bw, bh, "JOURNAL ENTRY", ["journal, account", "debit, credit, source_id"], colors.HexColor("#F0ECF8"))
        self.draw_box(w-bw, 0, bw, bh, "BANK LINE", ["statement line", "reconciliation status"], colors.HexColor("#FCEBEC"))
        self.arrow(bw, 64*mm, (w-bw)/2, 44*mm, "settled by")
        self.arrow(w-bw, 64*mm, (w+bw)/2, 44*mm, "allocates")
        self.arrow((w-bw)/2, 30*mm, bw, 14*mm, "supports")
        self.arrow(w-bw, 14*mm, (w+bw)/2, 30*mm, "origin")
        self.arrow(bw, 11*mm, w-bw, 11*mm, "bank reconciliation")


class GraphDiagram(Flowable):
    """A compact directed workflow graph using normalized node coordinates."""
    def __init__(self, nodes, edges, width=170*mm, height=168*mm, lanes=None):
        super().__init__()
        self.nodes = nodes
        self.edges = edges
        self.width = width
        self.height = height
        self.lanes = lanes or []

    def wrap(self, availWidth, availHeight):
        self.width = min(self.width, availWidth)
        self.height = min(self.height, availHeight)
        return self.width, self.height

    def _geom(self, node):
        x, y, w, h = node[0], node[1], node[2], node[3]
        return x*self.width, y*self.height, w*self.width, h*self.height

    def _anchor(self, a, b):
        ax, ay, aw, ah = self._geom(a)
        bx, by, bw, bh = self._geom(b)
        acx, acy = ax+aw/2, ay+ah/2
        bcx, bcy = bx+bw/2, by+bh/2
        dx, dy = bcx-acx, bcy-acy
        if abs(dy) >= abs(dx):
            if dy < 0:
                return (acx, ay), (bcx, by+bh)
            return (acx, ay+ah), (bcx, by)
        if dx > 0:
            return (ax+aw, acy), (bx, bcy)
        return (ax, acy), (bx+bw, bcy)

    def _arrow(self, p1, p2, label="", dashed=False):
        import math
        c = self.canv
        x1, y1 = p1; x2, y2 = p2
        c.setStrokeColor(GOLD); c.setFillColor(GOLD); c.setLineWidth(0.85)
        if dashed: c.setDash(3, 2)
        c.line(x1, y1, x2, y2)
        c.setDash()
        a = math.atan2(y2-y1, x2-x1)
        size = 5
        c.line(x2, y2, x2-size*math.cos(a-0.55), y2-size*math.sin(a-0.55))
        c.line(x2, y2, x2-size*math.cos(a+0.55), y2-size*math.sin(a+0.55))
        if label:
            mx, my = (x1+x2)/2, (y1+y2)/2
            c.setFont("Mohasib", 6.1)
            tw = c.stringWidth(label, "Mohasib", 6.1)
            c.setFillColor(WHITE); c.rect(mx-tw/2-2, my-4, tw+4, 9, fill=1, stroke=0)
            c.setFillColor(MUTED); c.drawCentredString(mx, my-1.5, label)

    def draw(self):
        c = self.canv
        for lane in self.lanes:
            x, y, w, h, title = lane
            c.setFillColor(colors.HexColor("#F7F8FA")); c.setStrokeColor(LINE)
            c.roundRect(x*self.width, y*self.height, w*self.width, h*self.height, 5, fill=1, stroke=1)
            c.setFont("Mohasib-Bold", 6.7); c.setFillColor(MUTED)
            c.drawString(x*self.width+5, (y+h)*self.height-10, title.upper())

        lookup = {n[4]: n for n in self.nodes}
        for edge in self.edges:
            src, dst = lookup[edge[0]], lookup[edge[1]]
            p1, p2 = self._anchor(src, dst)
            self._arrow(p1, p2, edge[2] if len(edge) > 2 else "", edge[3] if len(edge) > 3 else False)

        fills = {
            "source": PALE_BLUE,
            "process": PALE_GOLD,
            "decision": colors.HexColor("#F0ECF8"),
            "auto": PALE_GREEN,
            "review": PALE_RED,
            "data": colors.HexColor("#EEF1F4"),
            "result": colors.HexColor("#E7F3F7"),
        }
        for node in self.nodes:
            x, y, w, h = self._geom(node)
            kind = node[6] if len(node) > 6 else "process"
            fill = fills.get(kind, PALE_GOLD)
            c.setFillColor(fill); c.setStrokeColor(NAVY); c.setLineWidth(.65)
            if kind == "decision":
                c.saveState(); c.translate(x+w/2, y+h/2); c.rotate(45)
                side = min(w, h)*0.70
                c.rect(-side/2, -side/2, side, side, fill=1, stroke=1); c.restoreState()
            else:
                c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
            p = Paragraph(node[5], ParagraphStyle(
                name=f"graph-{node[4]}", fontName="Mohasib-Bold", fontSize=6.8,
                leading=8.1, textColor=NAVY, alignment=TA_CENTER,
            ))
            pw, ph = p.wrap(max(w-8, 20), max(h-6, 10))
            p.drawOn(c, x+(w-pw)/2, y+(h-ph)/2)

def diagram_page(chapter, title, intro, nodes, edges, caption, lanes=None, height=168*mm):
    return [
        *H1(chapter, title),
        P(intro, "SmallM"),
        Spacer(1, 2*mm),
        GraphDiagram(nodes, edges, height=height, lanes=lanes),
        Spacer(1, 2*mm),
        callout("How to read it", caption, PALE_BLUE),
        PageBreak(),
    ]


def page_header_footer(canvas, doc):
    canvas.saveState()
    if doc.page > 1:
        canvas.setStrokeColor(LINE); canvas.setLineWidth(.4)
        canvas.line(20*mm, A4[1]-15*mm, A4[0]-20*mm, A4[1]-15*mm)
        canvas.setFont("Mohasib", 7.2); canvas.setFillColor(MUTED)
        canvas.drawString(20*mm, A4[1]-11.5*mm, "MOHASIB - TECHNICAL PRODUCT AND WORKFLOW GUIDE")
        canvas.drawRightString(A4[0]-20*mm, 11*mm, f"Page {doc.page}")
    canvas.restoreState()


def cover_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY); canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(GOLD); canvas.rect(0, 0, 15*mm, A4[1], fill=1, stroke=0)
    canvas.restoreState()


class GuideDocTemplate(BaseDocTemplate):
    pass


def build_story():
    s = []
    logo = ROOT / "public" / "logo.png"
    if logo.exists():
        img = Image(str(logo), width=59*mm, height=11.3*mm)
        s += [Spacer(1, 28*mm), img, Spacer(1, 22*mm)]
    s += [
        P("Technical Product and Workflow Guide", "CoverTitle"),
        Spacer(1, 5*mm),
        P("A code-informed explanation of Mohasib, pre-accounting, document management, payment allocation, customer collections, bank reconciliation, automatic journal entries, controls, security, and auditability.", "CoverSub"),
        Spacer(1, 65*mm),
        P("Version 1.1  |  3 August 2026", "CoverSub"),
        Spacer(1, 4*mm),
        P("Audience: product, engineering, accounting, implementation, operations, and audit teams", "CoverSub"),
        NextPageTemplate("body"),
        PageBreak(),
    ]

    s += H1("00", "How to read this guide")
    s += [
        P("This document explains the product as a chain of business events. A source document or bank movement enters Mohasib, becomes normalized data, is linked to the correct business object, produces accounting consequences, passes controls, and remains traceable to its origin."),
        callout("Important distinction", "A payment allocation is not an accounting entry, and a bank reconciliation is not a payment allocation. Allocation explains which invoice or supplier document a payment settles. Reconciliation proves that the bank statement agrees with the bank-side record or journal. Posting records the debit and credit consequences.", PALE_BLUE),
        H2("Document status"),
        B("Implemented describes behavior found in the current repository and migrations."),
        B("Control requirement describes behavior the complete production workflow should enforce, even if enforcement is not yet centralized everywhere."),
        B("Accounting examples use the accounts currently mapped by Mohasib. Account and tax configuration must remain reviewable by a qualified accountant."),
        H2("Contents"),
        grid_table(["Part", "Subject"], [
            ["1-4", "System model, terminology, architecture, and data relationships"],
            ["5-8", "Document ingestion, pre-accounting, bank import, and payment allocation"],
            ["9-12", "Bank reconciliation, customer collections, supplier payments, and automatic entries"],
            ["13-17", "Sales, purchases, TVA, credit notes, payroll, and reporting"],
            ["18-22", "Controls, exceptions, security, audit, integrations, and operations"],
            ["23-27", "APIs, state machines, examples, limitations, detailed workflow atlas, and glossary"],
        ], [20*mm, 150*mm]),
        PageBreak(),
    ]

    s += H1("01", "The one-page system model", "What Mohasib is doing from an accounting perspective")
    s += [
        FlowDiagram(["Capture source", "Extract and normalize", "Classify and link", "Generate consequences", "Validate, post, audit"], title="END-TO-END BUSINESS PIPELINE"),
        Spacer(1, 4*mm),
        P("Mohasib is a multi-tenant accounting SaaS for Moroccan businesses and accounting firms. The application combines commercial documents, supplier expense reports, payments, bank statements, accounting journals, tax and payroll support, reporting, collaboration, and an AI assistant."),
        H2("The five layers"),
        grid_table(["Layer", "Responsibility", "Examples"], [
            ["Capture", "Acquire original evidence", "Gmail/Outlook attachment, upload, photo, generated invoice, bank file"],
            ["Understanding", "Turn evidence into normalized fields", "OCR, PDF text extraction, dates, supplier, TTC, TVA, category"],
            ["Business linkage", "Explain what a money movement settles", "Transaction-to-invoice allocation, supplier-document allocation"],
            ["Accounting", "Translate business events into double entry", "VT, AC and BQ journal lines; debit equals credit"],
            ["Control", "Make the result reviewable and auditable", "Permissions, period locks, RLS, audit log, append-only accounting events"],
        ], [24*mm, 68*mm, 78*mm]),
        callout("Core principle", "The original file is evidence. The normalized record is operational data. The payment allocation is the settlement link. The journal entry is the accounting representation. The audit event explains who or what caused the change.", PALE_GREEN),
        PageBreak(),
    ]

    s += H1("02", "Terminology and boundaries")
    s += [
        grid_table(["Term", "Meaning in Mohasib", "What it is not"], [
            ["Note de frais", "A supplier invoice, receipt, ticket, or other evidence stored in the receipt/document domain", "It is not automatically a bank transaction or journal entry"],
            ["Transaction", "An operational money movement, manual or originating from a bank import", "It is not itself proof that the expense is valid"],
            ["Payment allocation", "A many-to-many settlement link between a transaction and a commercial document", "It is not bank reconciliation"],
            ["Recouvrement", "Customer collection: monitoring due invoices, reminders, receipt of funds, and allocation to invoices", "It is not only sending reminders"],
            ["Rapprochement bancaire", "Matching statement lines to bank-side records or journal entries and validating the statement", "It does not determine tax deductibility"],
            ["Pre-accounting", "Capture, extraction, normalization, categorization, matching, review, and preparation before final posting", "It is not unsupervised posting"],
            ["Ecriture", "A journal line containing account, debit/credit, date, journal, label, and source", "One business event normally creates multiple lines"],
            ["Lettrage", "Clearing related customer/supplier debit and credit items", "Different from statement reconciliation"],
        ], [28*mm, 82*mm, 60*mm]),
        H2("Three questions answered by three subsystems"),
        B("What is this document? The ingestion and OCR pipeline answers this."),
        B("What does this payment settle? The payment-allocation engine answers this."),
        B("Does the bank agree with the books? The bank-reconciliation engine answers this."),
        PageBreak(),
    ]

    s += H1("03", "Technical architecture")
    s += [
        FlowDiagram(["Next.js App Router UI", "Server routes and domain services", "Supabase Auth + PostgreSQL", "Private storage / Google Drive", "Anthropic + email/bank providers"], title="RUNTIME ARCHITECTURE"),
        H2("Current technology stack"),
        grid_table(["Area", "Implementation"], [
            ["Web application", "Next.js 16 App Router, React 18, TypeScript, Tailwind CSS"],
            ["Identity and database", "Supabase Auth, PostgreSQL, Row Level Security, server and admin clients"],
            ["AI", "Anthropic SDK for OCR-assisted extraction, bank-file understanding, and chat workflows"],
            ["Files", "Private Supabase storage for receipts/company documents; optional Google Drive archives"],
            ["Observability", "Sentry integration plus application audit records and accounting events"],
            ["Exports", "React PDF, jsPDF, PDF-lib, XLSX, and dedicated reporting routes"],
        ], [38*mm, 132*mm]),
        H2("Tenancy model"),
        P("A business owner operates in a company scope. An accounting-firm user can operate across dossier scopes. Core rows carry company_id, dossier_id, or ownership fields. API authorization resolves the effective owner and checks resource/action permission before sensitive accounting operations."),
        callout("Trust boundary", "The browser is not trusted to define accounting scope. Server routes authenticate the user, resolve company or dossier context, apply permissions, and rely on database RLS as a second boundary.", PALE_RED),
        PageBreak(),
    ]

    s += H1("04", "Core data model and how everything is linked")
    s += [LinkDiagram(), Spacer(1, 3*mm),
        grid_table(["Entity", "Purpose", "Important links"], [
            ["invoices", "Customer invoices, credit notes, totals, due dates, collection status", "client_id; payment allocations; journal source_id"],
            ["receipts", "Supplier expense reports and OCR data", "transaction_id legacy link; payment allocations; purchase journal source_id"],
            ["transactions", "Income/expense movement with manual or bank_import source", "invoice_id legacy link; bank_line_id; payment allocations"],
            ["invoice_payments", "Many-to-many allocation between transaction and exactly one document type", "transaction_id plus invoice_id or inbox_item_id"],
            ["bank_statements", "Imported statement header and balances", "contains bank_statement_lines"],
            ["bank_statement_lines", "Individual bank movements", "transaction_id, match score/status, matched metadata"],
            ["ecritures_comptables", "Double-entry journal lines", "source_type and source_id trace back to business event"],
            ["documents/document_links", "General evidence archive and polymorphic links", "invoice, transaction, declaration, payroll, entry, employee"],
            ["audit_logs", "Actor/action/request metadata and checksums", "company/dossier/entity scope"],
            ["accounting_events", "Append-only event chain with hashes", "entity, previous event, reversal metadata"],
        ], [31*mm, 69*mm, 70*mm], small=True),
        callout("Canonical settlement link", "The newer invoice_payments structure is the correct conceptual home for allocations. It supports partial payments, one transaction across several documents, and several transactions against one document. Legacy direct invoice_id/receipt_id fields should be treated as compatibility shortcuts, not the complete relationship model.", PALE_BLUE),
        PageBreak(),
    ]

    s += H1("05", "Document ingestion and OCR workflow")
    s += [
        FlowDiagram(["Receive file", "Validate type and size", "Store private original", "Extract fields + confidence", "Review and confirm"], title="EXPENSE REPORT INGESTION"),
        H2("Supported capture channels"),
        B("Manual upload or camera/photo from the inbox/receipt workflow."),
        B("Inbound or synchronized Gmail/Outlook attachments. Supported attachment types include PDF, JPEG, PNG, WebP, and GIF; current email logic uses a 10 MB limit."),
        B("Generated customer invoices originate as structured data and PDF output, so they do not require OCR."),
        H2("Extraction strategy"),
        P("For PDFs, Mohasib first attempts text extraction. Visual extraction is available for image-like or difficult documents. The OCR engine requests supplier, date, invoice number, HT, TVA rate, TVA amount, TTC, description, payment method, category, due date, document type, and supplier-invoice classification."),
        grid_table(["Normalization", "Rule currently represented in code"], [
            ["Amounts", "French and international separators are normalized; supplier documents are stored as negative operational amounts"],
            ["Dates", "DD/MM/YYYY and ISO dates are normalized to ISO; if no due date is found, OCR currently defaults to invoice date + 60 days"],
            ["TVA", "Recognized rates are 7, 10, 14, and 20; rate may be inferred from HT/TTC/TVA"],
            ["Description", "A concise French bookkeeping label is generated instead of copying a raw product line"],
            ["Confidence", "Field-level high/medium/low plus overall confidence mapped approximately to 0.9/0.6/0.3"],
        ], [38*mm, 132*mm]),
        H2("Failure behavior"),
        P("If extraction fails, the original document remains useful and the record can stay pending for manual completion. OCR output is a proposal, not authoritative accounting evidence. The original file must remain retrievable."),
        PageBreak(),
    ]

    s += H1("06", "Pre-accounting workflow")
    s += [
        FlowDiagram(["Evidence acquired", "Data normalized", "Counterparty/category proposed", "Document-payment relationship resolved", "Draft accounting event prepared"], title="PRE-ACCOUNTING LIFECYCLE"),
        P("Pre-accounting reduces manual data entry while keeping accounting judgment visible. It ends when information is complete enough for a controlled posting decision."),
        H2("Required stages"),
        grid_table(["Stage", "Automatic work", "Human responsibility"], [
            ["Capture", "Collect file and metadata", "Confirm the file belongs to the correct company/dossier"],
            ["Extraction", "Read amounts, dates, identities, references and tax clues", "Correct uncertain or unreadable values"],
            ["Classification", "Suggest document type, counterparty, category and account", "Approve non-routine classification"],
            ["Settlement matching", "Find candidate bank transactions or documents", "Resolve ambiguous, split, combined, or exceptional payments"],
            ["Entry preparation", "Apply an accounting template and generate balanced lines", "Review account, TVA, date, period and description"],
            ["Validation", "Run balance, duplicate, permission and period checks", "Approve or reject according to policy"],
        ], [29*mm, 72*mm, 69*mm]),
        callout("Do not collapse the stages", "A high-confidence OCR result does not imply a high-confidence payment match. A high-confidence payment match does not prove the account or TVA treatment. Each stage needs its own confidence and validation outcome.", PALE_RED),
        H2("Suggested record state"),
        P("received -> extracted -> needs_review or ready -> matched/partially_matched/unmatched -> draft_entry -> validated -> posted -> reconciled -> archived"),
        PageBreak(),
    ]

    s += H1("07", "Bank statement import")
    s += [
        FlowDiagram(["Upload PDF/CSV/Excel/image", "Parse or AI-extract lines", "Normalize sign/date/reference", "Create bank-origin transactions", "Start allocation + reconciliation"], title="BANK INGESTION"),
        H2("Implemented import boundary"),
        B("Accepted formats include PDF, CSV, XLS/XLSX, JPEG, PNG and WebP, with a 10 MB request limit."),
        B("Structured spreadsheets are converted to CSV text. PDF and image inputs use document/vision extraction."),
        B("The imported operational transaction receives source = bank_import; manual records use source = manual."),
        B("A bank statement header stores bank, account, period, opening/closing balances, file and status. Lines store date, description, reference, signed amount, balance, status, and match metadata."),
        H2("Normalization rules"),
        grid_table(["Bank concept", "Mohasib representation"], [
            ["Money entering the account", "Positive statement amount; operational transaction type income"],
            ["Money leaving the account", "Negative statement amount; operational transaction type expense"],
            ["Statement identity", "File/header plus individual lines and their references"],
            ["Duplicate protection", "Should use a deterministic fingerprint of bank account, date, amount, reference and normalized description"],
            ["Traceability", "transaction.bank_line_id and bank_statement_lines.transaction_id provide origin linkage"],
        ], [42*mm, 128*mm]),
        callout("Two downstream jobs", "After import, Mohasib can (1) allocate the transaction to customer/supplier documents and (2) reconcile the statement line against the bank-side transaction or journal. These jobs can use similar signals but produce different records.", PALE_BLUE),
        PageBreak(),
    ]

    s += H1("08", "Automatic transaction-to-document assignment")
    s += [
        FlowDiagram(["Select unallocated transaction", "Find same-scope documents", "Score remaining amount + identity + date", "Require one reliable candidate", "Confirm allocation atomically"], title="PAYMENT ALLOCATION"),
        H2("Current candidate scoring for suggestions"),
        grid_table(["Signal", "Score", "Meaning"], [
            ["Exact remaining amount", "+60", "Document outstanding balance equals transaction remaining amount within 0.01"],
            ["Reference appears in bank text", "+25", "Invoice/receipt reference occurs in normalized description/reference"],
            ["Counterparty appears in bank text", "+20", "Customer or supplier identity occurs in bank text"],
            ["Date difference <= 7 days", "+10", "Payment is close to document date"],
            ["Date difference <= 45 days", "+5", "Payment date is still plausible"],
        ], [51*mm, 18*mm, 101*mm]),
        H2("Current automatic confirmation is stricter"),
        P("The automatic route requires an exact remaining amount and a strong identity signal from document reference or counterparty. It confirms only when exactly one candidate exists. Multiple candidates are intentionally left for review."),
        H2("Atomic allocation rules"),
        B("The sum newly allocated cannot exceed the unallocated absolute transaction amount."),
        B("A transaction can allocate to several documents, but duplicate allocation of the same document in one request is rejected."),
        B("A customer invoice requires an income transaction. A supplier document requires an expense transaction."),
        B("The cumulative allocation cannot exceed the document outstanding balance."),
        B("The database function locks the transaction/document rows, records the allocation, updates received/paid amounts and status, and stores confirmation metadata."),
        callout("Result", "A confirmed allocation answers: this exact amount of this transaction settles this exact commercial document. It does not by itself validate the accounting category or reconcile the statement closing balance.", PALE_GREEN),
        PageBreak(),
    ]

    s += H1("09", "Bank reconciliation")
    s += [
        FlowDiagram(["Statement line", "Candidate bank entry/transaction", "Amount/date/text/direction score", "Auto, suggestion, or unmatched", "Validate session and differences"], title="RAPPROCHEMENT BANCAIRE"),
        H2("Implemented journal-entry matching score"),
        grid_table(["Signal", "Points"], [
            ["Exact amount", "40"], ["Amount within 1%", "25"], ["Same date", "30"],
            ["Within 2 days", "20"], ["Within 5 days", "10"], ["Description similarity", "Up to 20"],
            ["Compatible debit/credit direction", "10"],
        ], [85*mm, 35*mm]),
        P("Only journal lines on account 5141 are considered by the current rapprochement engine. A score of at least 90 is automatic; 70-89 is a suggestion; below 70 is unmatched. An automatically consumed journal line is not reused in the same run."),
        H2("Alternative transaction matching rules"),
        P("The repository also contains a transaction-oriented reconciliation matcher: exact amount and date within 3 days can score 0.95-1.00; exact amount within 7 days scores around 0.90; description similarity and fuzzy amount produce lower-confidence suggestions. This is conceptually separate from payment allocation."),
        H2("Session validation"),
        B("Every statement line must be matched, explicitly ignored with a reason, or converted to a transaction before a session is complete."),
        B("Opening balance + signed movements should explain closing balance within the configured rounding tolerance."),
        B("Validation records who matched what, how, when, and with which confidence/reason."),
        callout("Accounting meaning", "Reconciliation proves completeness and agreement of bank-side records. It should not silently create revenue or expense when an existing receivable, payable, transfer, tax, payroll, or suspense account is the correct counterpart.", PALE_RED),
        PageBreak(),
    ]

    s += H1("10", "Customer collections - recouvrement")
    s += [
        FlowDiagram(["Invoice issued", "Due date monitored", "Reminder sent", "Payment received", "Payment allocated", "Receivable cleared"], title="CUSTOMER COLLECTION"),
        H2("Commercial state"),
        P("Invoices carry issue date, due date, total, montant_recu, payment history and a status. The payment-tracking interface derives waiting, due soon, overdue, partially paid, and paid views. Reminder history includes count and last reminder timestamp."),
        H2("Collection lifecycle"),
        grid_table(["Event", "Operational effect", "Accounting effect"], [
            ["Invoice issued", "Customer owes TTC; due date begins", "Debit 3421 Clients; credit revenue and 4455 TVA"],
            ["Reminder sent", "Communication history updated", "No journal entry"],
            ["Payment imported", "Income transaction exists", "Bank entry may remain draft until classified"],
            ["Payment allocated", "montant_recu increases; partial/paid status recalculated", "Settlement entry debits 5141 and credits 3421"],
            ["Credit note", "Customer balance is reduced or refunded", "Reverse revenue/TVA and credit 3421"],
            ["Reconciliation", "Payment is proven against bank statement", "Bank-side entry is cleared/reconciled"],
        ], [31*mm, 69*mm, 70*mm]),
        H2("Partial and grouped payments"),
        P("A 12,000 MAD receipt can settle invoices of 5,000 and 7,000. A 10,000 MAD invoice can be settled by two receipts of 4,000 and 6,000. The allocation table is therefore many-to-many; invoice status derives from confirmed allocations, not from a single invoice_id shortcut."),
        callout("Collection is not revenue recognition", "Revenue is recorded when the invoice/business event is recognized. Collection clears the customer receivable. Booking the receipt directly to revenue would duplicate revenue when the invoice was already posted.", PALE_RED),
        PageBreak(),
    ]

    s += H1("11", "Supplier payables and expense report settlement")
    s += [
        FlowDiagram(["Supplier document captured", "Purchase validated", "Payable recognized", "Expense transaction imported", "Payment allocated", "Payable cleared"], title="SUPPLIER PAYMENT"),
        H2("Supplier-document state"),
        P("OCR data contains supplier identity, amount, document date, due date, reference and paid amount. The supplier tracking view computes outstanding balance and due/overdue state from these fields and confirmed allocations."),
        H2("Accounting sequence"),
        grid_table(["Step", "Debit", "Credit"], [
            ["Supplier invoice", "Expense/asset HT and recoverable TVA", "4411 Suppliers TTC"],
            ["Supplier payment", "4411 Suppliers", "5141 Bank"],
            ["Supplier credit note", "4411 Suppliers", "Reverse expense/asset and recoverable TVA"],
        ], [54*mm, 58*mm, 58*mm]),
        H2("Receipt versus invoice"),
        P("A cash receipt or card ticket may prove an expense that was paid immediately, while a supplier invoice can create a payable before payment. The document classifier and payment method should determine whether Mohasib uses a payable-clearing sequence or a direct cash/bank counterpart. Treating every receipt as an unpaid supplier invoice would distort payables."),
        callout("Required review", "Tax recoverability, business purpose, supplier identity, invoice validity and period are accounting judgments. OCR can propose them but should not create an irrevocable posting without controls.", PALE_GOLD),
        PageBreak(),
    ]

    s += H1("12", "Automatic accounting-entry engine")
    s += [
        FlowDiagram(["Validated business event", "Choose template", "Resolve CGNC accounts", "Create debit/credit lines", "Balance + idempotency check", "Insert and audit"], title="BOOKING ENGINE"),
        H2("Implemented safeguards"),
        B("Idempotency: before booking, the engine searches ecritures_comptables for the same source_id and returns if entries already exist."),
        B("Balance: the sum of debit lines must equal the sum of credit lines within 0.01 before insertion."),
        B("Rounding: stored debit and credit values are rounded to two decimal places."),
        B("Traceability: journal lines store source_type, source_id, journal, account, label, date and piece number where available."),
        H2("Journals and source types"),
        grid_table(["Business event", "Journal", "source_type"], [
            ["Customer invoice", "VT", "invoice"], ["Customer credit note", "VT", "avoir_client"],
            ["Supplier purchase", "AC", "purchase"], ["Bank transaction", "BQ", "bank"],
            ["Manual adjustment", "Configured journal", "manual"], ["Payroll", "OD or payroll journal", "salary/payroll when integrated"],
        ], [68*mm, 28*mm, 74*mm]),
        H2("Control sequence around /api/accounting/book"),
        P("The route authenticates the user, checks plan feature where applicable, authorizes accounting:create, resolves company/dossier scope, fetches the source row, applies event-specific validation, calls the booking engine, then writes audit and accounting-event records."),
        callout("Production rule", "Period-lock enforcement and approval policy should be centralized for every booking type, not applied differently by individual call sites. Posting should be transactional with audit/event creation or use an outbox pattern so records cannot diverge.", PALE_RED),
        PageBreak(),
    ]

    s += H1("13", "Sales, purchases, credit notes, and bank mappings")
    s += [
        H2("Customer invoice"),
        grid_table(["Account", "Debit", "Credit", "Basis"], [
            ["3421 Clients", "TTC", "", "Customer receivable"],
            ["7111/7121/7131/7141 etc.", "", "HT", "Revenue based on category"],
            ["4455 Etat TVA facturee", "", "TVA", "Collected tax"],
        ], [52*mm, 25*mm, 25*mm, 68*mm]),
        H2("Supplier invoice"),
        grid_table(["Account", "Debit", "Credit", "Basis"], [
            ["6xxx or 2xxx", "HT", "", "Expense or asset category"],
            ["3455 Etat TVA recuperable", "TVA", "", "Recoverable tax"],
            ["4411 Fournisseurs", "", "TTC", "Supplier payable"],
        ], [52*mm, 25*mm, 25*mm, 68*mm]),
        H2("Customer receipt linked to an invoice"),
        grid_table(["Account", "Debit", "Credit"], [["5141 Banques", "Amount", ""], ["3421 Clients", "", "Amount"]], [70*mm, 50*mm, 50*mm]),
        H2("Unlinked bank income or expense"),
        P("Current code maps unlinked income to bank debit and a revenue credit; an expense maps expense debit and bank credit. This is convenient but high risk: loans, owner funds, transfers, tax refunds, deposits, and suspense items are not revenue. Production classification should recognize these event types before defaulting to P&L accounts."),
        H2("Credit note"),
        P("A customer credit note reverses the original sale: credit 3421 for TTC, debit the revenue accounts for HT, and debit 4455 for the reversed TVA. Deleting an issued invoice is not a substitute for a credit note."),
        PageBreak(),
    ]

    s += H1("14", "Account categorization and CGNC mapping")
    s += [
        grid_table(["Category", "Current account"], [
            ["Ventes / Marchandises", "7111"], ["Services", "7131"], ["Honoraires", "7121"], ["Travaux", "7141"],
            ["Achats", "6111"], ["Fournitures", "6123"], ["Loyer", "6132"], ["Transport", "6142"],
            ["Communication / Telecom", "6147"], ["Fiscalite", "6161"], ["Salaires", "6171"],
            ["Charges bancaires", "6311"], ["Equipement", "2340"], ["Informatique", "2350"], ["Autre depense", "6111/6182 fallback depending workflow"],
        ], [95*mm, 55*mm]),
        H2("Categorization hierarchy"),
        FlowDiagram(["Explicit user account", "Company-specific supplier rule", "Document/category mapping", "AI suggestion", "Safe suspense/review fallback"], title="ACCOUNT RESOLUTION PRIORITY"),
        H2("Design requirements"),
        B("Account mappings must be configurable per company/dossier and effective-dated."),
        B("The engine must record why an account was selected: explicit, learned supplier rule, category map, AI suggestion, or manual correction."),
        B("A default should not erase uncertainty. Unknown transactions should be held for review or placed in a controlled suspense account."),
        B("Asset-versus-expense classification, deductibility, mixed-use and capitalization thresholds require accounting policy."),
        PageBreak(),
    ]

    s += H1("15", "TVA workflow")
    s += [
        FlowDiagram(["Read HT/TTC/rate", "Recompute and compare", "Apply collected/recoverable treatment", "Aggregate period lines", "Review declaration", "Lock period + archive evidence"], title="TVA PIPELINE"),
        H2("Data origin"),
        P("Customer invoices provide structured subtotal, tax rate, tax amount and total. Supplier documents provide OCR-extracted or user-corrected values. Mohasib can infer TVA from TTC and rate or from TTC minus HT, but explicit document values take priority after validation."),
        H2("Controls"),
        B("HT + TVA must equal TTC within rounding tolerance."),
        B("The applied rate must be allowed for the date, item and legal treatment; the current OCR recognizer uses 7, 10, 14 and 20."),
        B("Collected TVA comes from sales. Recoverable TVA comes only from eligible purchase evidence."),
        B("Credit notes reverse the same tax logic as the original document."),
        B("A declaration should retain links to source entries and documents, plus version and submission evidence."),
        callout("Compliance note", "Rates, thresholds and payroll/tax rules change. The application must version configuration and obtain professional validation rather than treating constants in code as permanent law.", PALE_RED),
        H2("Period close"),
        P("accounting_periods stores month/year, company or dossier scope, lock type, actor, reason and unlock metadata. Once a period is locked, mutations that affect the declaration or ledger should be rejected or posted as controlled adjustments in an open period."),
        PageBreak(),
    ]

    s += H1("16", "Payroll and adjacent modules")
    s += [
        P("Payroll is an adjacent source of accounting events. The current repository includes employee records, bulletin generation, CNSS declaration exports and a calculation engine. These calculations must be versioned by effective date and professionally reviewed."),
        FlowDiagram(["Employee master data", "Gross pay + variable inputs", "CNSS/AMO/IR calculation", "Payslip and declarations", "Payroll journal", "Payment and reconciliation"], title="PAYROLL FLOW"),
        H2("Expected accounting integration"),
        grid_table(["Component", "Typical accounting role"], [
            ["Gross salary and employer charges", "Expense accounts"],
            ["Employee deductions and net payable", "Employee/social/tax liabilities"],
            ["CNSS, AMO and IR", "Separate payable accounts, later cleared by payment"],
            ["Net salary bank batch", "Clears employee payable against bank"],
            ["Declaration/PDF/Excel", "Evidence linked to payroll period and journal event"],
        ], [62*mm, 108*mm]),
        H2("Other modules"),
        B("Quotes can be accepted/refused and converted to invoices; conversion becomes the sales-event boundary."),
        B("Archive records company documents and can target Supabase or named Google Drive folders."),
        B("Reports derive balance, general ledger and management views from journal/operational data."),
        B("The chat assistant can help create or find records, but server-side tools must reapply authorization and validation."),
        PageBreak(),
    ]

    s += H1("17", "Validation, posting, reversal, and close")
    s += [
        FlowDiagram(["Draft lines", "Structural controls", "Accounting controls", "Permission + period controls", "Approval", "Immutable event + posting"], title="POSTING GATE"),
        grid_table(["Control", "Failure behavior"], [
            ["Debit equals credit", "Block insertion"],
            ["Positive, finite amounts", "Block or request correction"],
            ["Allowed account and journal", "Block until mapping is corrected"],
            ["Source not already booked", "Return idempotently; do not duplicate"],
            ["Correct company/dossier scope", "Return forbidden/not found"],
            ["Accounting:create permission", "Return HTTP 403"],
            ["Period open", "Return HTTP 423 with lock reason"],
            ["Evidence required by policy", "Hold in review queue"],
            ["High-risk AI decision", "Require explicit approval"],
        ], [72*mm, 98*mm]),
        H2("Correction model"),
        P("A posted accounting event should not be silently overwritten. Corrections should create a reversal event and a new corrected event, preserving source linkage, actor, reason, prior event reference and hashes. The accounting_events table already supports previous-event and reversal metadata and is protected by an append-only trigger."),
        H2("Close model"),
        P("Before period lock: resolve unmatched bank lines, missing expense reports, unallocated payments, imbalanced or draft entries, supplier/customer balances, TVA anomalies and payroll/declaration discrepancies. After lock: only authorized unlock or controlled adjustment procedures should be permitted."),
        PageBreak(),
    ]

    s += H1("18", "Exception handling and confidence")
    s += [
        grid_table(["Exception", "Correct response"], [
            ["Unreadable document", "Retain original, request better copy or manual fields; never invent an amount"],
            ["Duplicate document", "Compare file hash, supplier, reference, date and total; merge/reject with audit reason"],
            ["Multiple payment candidates", "Rank candidates but require selection or split allocation"],
            ["Partial payment", "Allocate only paid amount and keep remaining balance open"],
            ["One payment for several invoices", "Create several allocation rows whose sum does not exceed transaction"],
            ["Bank fee netted from receipt", "Split bank fee from customer settlement and preserve gross invoice clearing"],
            ["Foreign currency", "Keep source currency, transaction currency, exchange rate and realized difference"],
            ["Internal transfer", "Match both bank accounts; do not classify as income/expense"],
            ["Unknown counterparty", "Use review/suspense workflow, not automatic revenue/expense"],
            ["Closed period", "Reject posting or use authorized adjustment in an open period"],
        ], [56*mm, 114*mm]),
        H2("Confidence should be multidimensional"),
        B("Extraction confidence: can the document values be read?"),
        B("Identity confidence: is the counterparty/document reference reliable?"),
        B("Allocation confidence: does this payment settle this document?"),
        B("Accounting confidence: is the event type/account/tax treatment correct?"),
        B("Reconciliation confidence: does this statement line correspond to this bank record?"),
        callout("Automation policy", "Auto-post only when all required dimensions exceed policy thresholds and no hard contradiction exists. A weighted score must never override a hard rule such as wrong sign, wrong scope, over-allocation, locked period, or duplicate source.", PALE_RED),
        PageBreak(),
    ]

    s += H1("19", "Security, permissions, and tenancy")
    s += [
        FlowDiagram(["Authenticate", "Resolve owner and scope", "Check plan entitlement", "Check RBAC action", "Apply RLS", "Audit request outcome"], title="AUTHORIZATION PATH"),
        H2("Permission model"),
        P("Owners have direct scope rights. Other users receive memberships with role presets and per-membership overrides. The application distinguishes business and comptable_pro access, can restrict collaborators to dossier lists, and authorizes resource/action pairs such as accounting:create."),
        H2("Data isolation"),
        B("Core tables enable RLS and filter ownership by auth.uid(), company membership, or dossier relationship."),
        B("Private documents should be served through authenticated routes or short-lived signed URLs."),
        B("OAuth tokens are encrypted and accessed server-side; Google Drive OAuth state is HMAC-signed, time-limited and compared with a cookie."),
        B("Admin/service-role clients bypass RLS and therefore belong only in server-only modules with explicit authorization."),
        H2("Threats that matter"),
        grid_table(["Threat", "Control"], [
            ["Cross-tenant ID substitution", "Server scope query + RBAC + RLS"],
            ["Malicious/oversized uploads", "MIME/extension validation, size limits, safe parsing, private storage"],
            ["Prompt injection in documents/email", "Treat extracted text as data; restrict AI tools and validate outputs"],
            ["Duplicate financial side effects", "Idempotency key/source check and database transaction"],
            ["Unauthorized period changes", "Period locks, role checks, append-only events and alerts"],
        ], [58*mm, 112*mm]),
        PageBreak(),
    ]

    s += H1("20", "Auditability and evidence")
    s += [
        FlowDiagram(["User/system action", "Business row mutation", "Audit log", "Accounting event hash chain", "Entity version / reversal", "Exportable evidence"], title="AUDIT TRAIL"),
        H2("Audit records"),
        P("audit_logs records actor, email, company/dossier, action, entity, old/new values, changed fields, IP, user agent, request metadata, success/error and checksum. Database triggers also protect important financial-table changes."),
        H2("Accounting events"),
        P("accounting_events stores event type, scope, actor, entity, amount, period, event payload, event hash, previous event, and reversal data. The table is append-only: updates and deletes are rejected by a trigger."),
        H2("Evidence chain"),
        P("A reviewer should be able to start from any journal line and navigate to its source event, operational transaction, allocation, bank line, original document, extraction output, user correction, approval and audit event. The reverse navigation should also work from the original file to all downstream effects."),
        callout("Audit completeness", "Logging is best-effort in parts of the current application. For legally significant posting, the journal insert and durable event/outbox creation should succeed atomically; silent audit-log failure is not sufficient for a complete control environment.", PALE_RED),
        PageBreak(),
    ]

    s += H1("21", "Integrations and background workflows")
    s += [
        grid_table(["Integration", "Workflow", "Important controls"], [
            ["Gmail / Outlook", "OAuth connection, scan/read attachment, filter accounting documents, import and OCR", "Token refresh, allowlisted file types, size/usage limits, message ID dedupe"],
            ["Inbound email", "Webhook receives accounting attachment for a company/dossier inbox", "Webhook authentication, routing, dedupe, malware/content handling"],
            ["Google Drive", "OAuth drive.file scope, named archive folder, upload and store external IDs/URLs", "Encrypted token, signed state, tenant ownership, retry and orphan handling"],
            ["Anthropic", "Document extraction, bank statement interpretation, accounting assistant", "Schema validation, timeouts, retry limits, prompt-injection resistance, human review"],
            ["Supabase Storage", "Private original files and archives", "RLS path ownership, signed access, retention and backup"],
            ["Email sending", "Invoice delivery and collection reminders", "Recipient validation, delivery status, template history, rate limits"],
        ], [32*mm, 76*mm, 62*mm], small=True),
        H2("Job semantics"),
        B("Every import job needs an idempotency key: provider message ID, attachment ID, file hash or statement fingerprint."),
        B("Retries must be safe. A retry may repeat extraction but must not duplicate transactions, allocations or journal entries."),
        B("Long-running jobs should expose pending/running/succeeded/failed states and a retryable failure reason."),
        B("Provider access tokens and service secrets never belong in the browser or logs."),
        PageBreak(),
    ]

    s += H1("22", "API and service map")
    s += [
        grid_table(["Domain", "Representative endpoints/services", "Responsibility"], [
            ["OCR", "/api/ocr; ocr-engine; ocr-pipeline", "Extract and normalize supplier document data"],
            ["Email", "/api/email/inbound; /api/email/sync; OAuth routes", "Acquire attachments and route them to inbox"],
            ["Bank import", "/api/import/bank-statement", "Parse statement and create normalized bank movements"],
            ["Allocation", "/api/payment-allocations; /auto-match", "Suggest and atomically confirm settlement links"],
            ["Reconciliation", "/api/rapprochement/*; rapprochement-engine", "Manage sessions, matches, ignore/create actions and reports"],
            ["Booking", "/api/accounting/book; accounting-engine", "Create balanced VT/AC/BQ entries from source events"],
            ["Invoices", "invoice/devis/avoir routes and PDF/email routes", "Commercial-document lifecycle"],
            ["Collections", "/api/invoice-payments and payment tracking UI", "Record receipts, balances, reminders and statuses"],
            ["TVA", "/api/tva/declaration", "Build and manage tax declaration data"],
            ["Payroll", "/api/paie/*", "Payslips, bulk generation, CNSS declarations and exports"],
            ["Archive", "/api/archive/*; /api/google-drive/archives", "Evidence storage and retrieval"],
            ["Audit", "audit service and DB triggers", "Record actions, versions, hashes and period locks"],
        ], [29*mm, 72*mm, 69*mm], small=True),
        H2("Service design rule"),
        P("UI code should request a domain action; it should not assemble accounting lines directly. Domain services validate state and scope, database functions enforce atomic invariants, and asynchronous integrations publish durable events/results."),
        PageBreak(),
    ]

    s += H1("23", "State machines")
    s += [
        H2("Document"),
        P("received -> extracting -> extracted -> needs_review/ready -> matched/partially_matched/unmatched -> booked -> archived. Terminal exception states include ignored, duplicate and rejected."),
        H2("Invoice and collection"),
        P("draft -> issued/sent -> partially_paid -> paid. Time-based presentation can mark an issued invoice overdue without changing the underlying settlement facts. cancelled should be reserved for valid cancellation rules; an issued accounting event normally requires a credit note/reversal."),
        H2("Transaction allocation"),
        P("unallocated -> suggested -> partially_allocated -> fully_allocated. A suggestion is non-authoritative. Confirmed and rejected allocations preserve method, evidence, confidence, actor and time."),
        H2("Bank reconciliation"),
        P("imported -> unmatched -> suggested/auto_matched -> confirmed or ignored -> session_validated. Reopening a validated session must be privileged and audited."),
        H2("Accounting entry"),
        P("draft -> validation_failed/ready -> approved -> posted -> reconciled/lettered. Correction occurs through reversal + replacement, not destructive edit."),
        H2("Period"),
        P("open -> soft_locked -> hard_locked -> exceptionally_unlocked -> locked_again. Unlock reason and actor are mandatory."),
        PageBreak(),
    ]

    s += H1("24", "End-to-end worked examples")
    s += [
        H2("Example A: customer invoice collected in full"),
        P("1. User creates invoice FAC-2026-0100 for 12,000 MAD TTC. Mohasib posts Dr 3421 12,000; Cr revenue 10,000; Cr 4455 2,000. 2. Bank import receives +12,000 with the invoice number. 3. Allocation engine finds one exact outstanding invoice and confirms 12,000. 4. Invoice montant_recu becomes 12,000 and status becomes paid. 5. Bank booking posts Dr 5141 12,000; Cr 3421 12,000. 6. Statement line is reconciled against the bank record. The invoice, payment, allocation, bank line and four journal lines remain navigable."),
        H2("Example B: one customer payment covers two invoices"),
        P("A +15,000 transaction pays invoices of 6,000 and 9,000. Automatic exact-one-candidate logic must not guess. The user selects both documents; the database confirms two allocation rows totaling 15,000. Each invoice becomes paid. The single bank settlement entry clears 15,000 from the aggregate customer receivable; subledger allocation explains which invoices were cleared."),
        H2("Example C: supplier invoice then payment"),
        P("A PDF is imported from email. OCR proposes supplier, reference, 8,000 HT, 1,600 TVA and 9,600 TTC. User validates category. Purchase booking posts Dr expense 8,000; Dr 3455 1,600; Cr 4411 9,600. Later a -9,600 bank transaction is allocated to the supplier document and posts Dr 4411 9,600; Cr 5141 9,600. Reconciliation proves the bank movement."),
        H2("Example D: bank fee with no invoice"),
        P("A -55 bank line is identified as a bank charge. It is not forced to match a supplier invoice. Mohasib posts Dr 6311 55; Cr 5141 55, retains the statement line as evidence, and reconciles it. If tax details exist, they require an explicit fee/tax rule."),
        PageBreak(),
    ]

    s += H1("25", "Current implementation constraints and production hardening")
    s += [
        grid_table(["Area", "Current code-informed observation", "Hardening direction"], [
            ["Allocation", "Automatic confirmation is exact amount + strong identity + unique candidate", "Add configurable thresholds, date/currency rules and controlled split suggestions"],
            ["Reconciliation", "Multiple matching engines and data paths coexist", "Choose canonical entities and migrate legacy links"],
            ["Booking", "Source-level idempotency and balance checks exist", "Use database transaction/idempotency constraint; centralize period/approval controls"],
            ["Unlinked bank items", "Defaults may map directly to revenue/expense", "Classify transfers, financing, taxes, payroll, deposits and suspense first"],
            ["Audit", "Audit logging can fail without blocking the business action", "Durable transactional outbox or atomic event write"],
            ["Tax/payroll", "Some rates and rules are constants", "Effective-dated configuration, legal review and regression fixtures"],
            ["Documents", "receipts, documents and company_documents overlap", "Define canonical evidence model and explicit migration/retention policy"],
            ["Statuses", "Legacy and newer status fields coexist", "Single state machine and derived status calculations"],
        ], [29*mm, 70*mm, 71*mm], small=True),
        H2("Minimum production acceptance criteria"),
        B("No cross-tenant access in API or storage tests."),
        B("No duplicate financial side effects under retries or concurrent requests."),
        B("Every posted event balances and has a source, actor/system identity, scope and durable audit event."),
        B("Every allocation respects sign, scope, document outstanding amount and transaction remaining amount."),
        B("Every reconciled statement proves line disposition and opening-to-closing balance."),
        B("Every locked-period mutation is rejected or follows an audited exception path."),
        B("AI uncertainty is visible and never overrides hard accounting invariants."),
        PageBreak(),
    ]

    s += H1("26", "Detailed workflow diagram atlas", "Full workflow maps for product, accounting, engineering, and implementation teams")
    s += [
        P("The earlier chapters explain rules and data. This atlas shows the complete operating logic visually. Each arrow is a state transition or data dependency; green nodes are safe automatic outcomes, red nodes require review, and grey nodes represent stored records."),
        grid_table(["Diagram", "Question answered"], [
            ["26.1", "How does every source become a posted, reconciled and archived result?"],
            ["26.2", "How is a supplier document captured, extracted and validated?"],
            ["26.3", "How does a bank file become normalized transactions?"],
            ["26.4", "How does automatic transaction-to-document assignment decide?"],
            ["26.5", "How do partial, split and grouped payments work?"],
            ["26.6", "How is the correct accounting template selected?"],
            ["26.7", "Which entries are created for sales, purchases and payments?"],
            ["26.8", "Which controls must pass before posting?"],
            ["26.9", "How does customer recouvrement work end to end?"],
            ["26.10", "How does bank reconciliation differ from allocation?"],
            ["26.11", "How are exceptions corrected and future suggestions improved?"],
        ], [24*mm, 146*mm]),
        callout("Recommended use", "Use these pages during product design, onboarding, engineering implementation, accounting review, test-case creation, and customer explanation. The diagrams are deliberately repetitive where the same control must exist in several workflows.", PALE_GREEN),
        PageBreak(),
    ]

    s += diagram_page(
        "26.1", "Complete end-to-end operating workflow",
        "The master workflow connects documents, bank movements, AI assistance, human validation, accounting, reconciliation and evidence retention.",
        [
            (.04,.84,.24,.09,"supplier","Supplier invoice / receipt","source"),
            (.38,.84,.24,.09,"customer","Customer invoice / credit note","source"),
            (.72,.84,.24,.09,"bank","Bank statement / transaction","source"),
            (.04,.66,.24,.09,"doccap","Gmail, upload, photo or inbound email","process"),
            (.38,.66,.24,.09,"structured","Structured invoice creation","process"),
            (.72,.66,.24,.09,"bankcap","API, PDF, CSV, Excel or image import","process"),
            (.04,.48,.24,.09,"extract","OCR, extraction, normalization and dedupe","process"),
            (.38,.48,.24,.09,"classify","Counterparty, category, tax and account proposal","process"),
            (.72,.48,.24,.09,"normalizebank","Normalize date, sign, amount and reference","process"),
            (.18,.29,.26,.09,"allocate","Payment allocation: transaction to document","decision"),
            (.56,.29,.26,.09,"reconcile","Bank reconciliation: statement to books","decision"),
            (.18,.12,.26,.09,"entry","Balanced accounting entry generated","auto"),
            (.56,.12,.26,.09,"review","Exception / approval queue","review"),
            (.37,.01,.26,.07,"ledger","Ledger + audit event + linked evidence","data"),
        ],
        [
            ("supplier","doccap"),("customer","structured"),("bank","bankcap"),
            ("doccap","extract"),("structured","classify"),("bankcap","normalizebank"),
            ("extract","classify"),("classify","allocate"),("normalizebank","allocate"),
            ("normalizebank","reconcile"),("allocate","entry","matched"),("allocate","review","ambiguous"),
            ("reconcile","entry","confirmed"),("reconcile","review","difference"),
            ("review","entry","approved"),("entry","ledger"),
        ],
        "Allocation explains settlement; reconciliation proves bank agreement; posting records accounting consequences. All three converge on a durable ledger and evidence chain.",
    )

    s += diagram_page(
        "26.2", "Supplier document ingestion and OCR",
        "The workflow preserves the original file, extracts structured fields, checks consistency and makes uncertainty reviewable.",
        [
            (.05,.86,.22,.08,"gmail","Gmail / Outlook attachment","source"),
            (.39,.86,.22,.08,"upload","Upload PDF or image","source"),
            (.73,.86,.22,.08,"photo","Camera / phone photo","source"),
            (.22,.72,.24,.08,"validate","Validate MIME, size, scope and usage limit","process"),
            (.55,.72,.24,.08,"store","Store private original + source metadata","data"),
            (.38,.58,.24,.08,"duplicate","Duplicate fingerprint found?","decision"),
            (.06,.43,.24,.08,"flag","Flag duplicate for review","review"),
            (.38,.43,.24,.08,"extract","PDF text extraction or visual OCR","process"),
            (.70,.43,.24,.08,"fields","Extract supplier, dates, reference, HT, TVA, TTC","process"),
            (.22,.27,.24,.08,"normalize","Normalize amounts, dates, TVA and description","process"),
            (.55,.27,.24,.08,"check","HT + TVA = TTC and confidence acceptable?","decision"),
            (.12,.11,.24,.08,"manual","Highlight uncertain fields for correction","review"),
            (.44,.11,.24,.08,"ready","Document ready for matching / booking","auto"),
            (.74,.11,.20,.08,"record","Receipt/document record + OCR payload","data"),
        ],
        [
            ("gmail","validate"),("upload","validate"),("photo","store"),("validate","store"),
            ("store","duplicate"),("duplicate","flag","yes"),("duplicate","extract","no"),
            ("extract","fields"),("fields","normalize"),("normalize","check"),
            ("check","manual","no"),("check","ready","yes"),("manual","ready","corrected"),("ready","record"),
        ],
        "The original file remains the evidence of record. OCR output is proposed operational data and must never replace the file or hide low-confidence fields.",
    )

    s += diagram_page(
        "26.3", "Bank statement ingestion and normalization",
        "Structured files are parsed directly; scanned statements use document extraction. Both paths produce a common transaction model.",
        [
            (.04,.86,.20,.08,"api","Bank API / future feed","source"),
            (.29,.86,.20,.08,"csv","CSV / OFX / CAMT / Excel","source"),
            (.54,.86,.20,.08,"pdf","PDF statement","source"),
            (.79,.86,.17,.08,"image","Scanned image","source"),
            (.10,.70,.25,.08,"parse","Parse structured rows","process"),
            (.61,.70,.25,.08,"vision","AI / visual extraction","process"),
            (.37,.54,.26,.08,"normal","Normalize date, sign, amount, currency, text","process"),
            (.17,.39,.25,.08,"fingerprint","Generate deterministic line fingerprint","process"),
            (.58,.39,.25,.08,"dupe","Existing statement line / transaction?","decision"),
            (.08,.22,.22,.08,"ignore","Ignore or flag duplicate","review"),
            (.39,.22,.22,.08,"create","Create bank statement + lines","data"),
            (.70,.22,.22,.08,"tx","Create source=bank_import transaction","data"),
            (.23,.07,.24,.08,"allocation","Start document allocation","process"),
            (.55,.07,.24,.08,"reconciliation","Start bank reconciliation","process"),
        ],
        [
            ("api","parse"),("csv","parse"),("pdf","vision"),("image","vision"),
            ("parse","normal"),("vision","normal"),("normal","fingerprint"),("fingerprint","dupe"),
            ("dupe","ignore","yes"),("dupe","create","no"),("create","tx"),
            ("tx","allocation"),("create","reconciliation"),
        ],
        "The normalized bank transaction feeds allocation, while the statement line feeds reconciliation. A single import therefore starts two related but different workflows.",
    )

    s += diagram_page(
        "26.4", "Automatic transaction-to-document assignment",
        "The assignment engine compares the unallocated transaction amount with outstanding customer invoices or supplier documents in the same scope.",
        [
            (.38,.88,.24,.08,"tx","Unallocated transaction","source"),
            (.12,.73,.24,.08,"scope","Filter same company / dossier and compatible sign","process"),
            (.64,.73,.24,.08,"candidates","Load unpaid invoices or supplier documents","data"),
            (.12,.56,.20,.08,"amount","Exact remaining amount +60","process"),
            (.40,.56,.20,.08,"identity","Reference +25 / counterparty +20","process"),
            (.68,.56,.20,.08,"date","Date proximity +10 or +5","process"),
            (.38,.39,.24,.08,"score","Score, evidence and hard-rule evaluation","decision"),
            (.05,.22,.24,.08,"auto","One exact strong candidate: confirm automatically","auto"),
            (.38,.22,.24,.08,"review","Several or medium candidates: ranked review","review"),
            (.71,.22,.24,.08,"none","No reliable candidate: remain unallocated","review"),
            (.05,.07,.24,.08,"rpc","Atomic allocation database function","process"),
            (.38,.07,.24,.08,"partial","Update paid amount and partial / paid status","data"),
            (.71,.07,.24,.08,"evidence","Store method, confidence, evidence, actor and time","data"),
        ],
        [
            ("tx","scope"),("tx","candidates"),("scope","amount"),("candidates","date"),
            ("amount","score"),("identity","score"),("date","score"),
            ("score","auto","unique + strong"),("score","review","ambiguous"),("score","none","weak"),
            ("auto","rpc"),("review","rpc","user confirms"),("rpc","partial"),("rpc","evidence"),
        ],
        "Hard contradictions such as wrong sign, wrong tenant, over-allocation, duplicate document, or closed scope reject the candidate regardless of score.",
    )

    s += diagram_page(
        "26.5", "Complex payment allocation patterns",
        "The many-to-many allocation model handles partial payments, combined invoices and instalments without losing the original transaction.",
        [
            (.38,.87,.24,.08,"start","Transaction + candidate documents","source"),
            (.38,.72,.24,.08,"relation","Which settlement relationship exists?","decision"),
            (.02,.53,.18,.08,"one","1 transaction : 1 document","process"),
            (.22,.53,.18,.08,"split","1 transaction : many documents","process"),
            (.42,.53,.18,.08,"instal","Many transactions : 1 document","process"),
            (.62,.53,.18,.08,"partial","Transaction below document balance","process"),
            (.82,.53,.16,.08,"over","Transaction above document balance","review"),
            (.08,.34,.22,.08,"allocrows","Create one allocation row per document amount","data"),
            (.39,.34,.22,.08,"totals","Recalculate transaction and document remaining amounts","process"),
            (.70,.34,.22,.08,"difference","Classify fee, advance, credit or unresolved difference","review"),
            (.20,.17,.24,.08,"valid","Allocated total within both balances?","decision"),
            (.56,.17,.24,.08,"status","Set unallocated / partial / fully allocated statuses","data"),
            (.20,.04,.24,.07,"reject","Reject invalid over-allocation","review"),
            (.56,.04,.24,.07,"confirm","Confirm settlement and trigger accounting checks","auto"),
        ],
        [
            ("start","relation"),("relation","one"),("relation","split"),("relation","instal"),
            ("relation","partial"),("relation","over"),("one","allocrows"),("split","allocrows"),
            ("instal","totals"),("partial","totals"),("over","difference"),("allocrows","valid"),
            ("totals","valid"),("difference","valid","resolved"),("valid","reject","no"),
            ("valid","status","yes"),("status","confirm"),
        ],
        "The sum of confirmed allocation rows is the settlement truth. Invoice and supplier-document payment statuses are derived from those confirmed amounts.",
    )

    s += diagram_page(
        "26.6", "Automatic accounting-template selection",
        "A validated event is classified before journal lines are generated. This prevents every bank movement from defaulting to revenue or expense.",
        [
            (.38,.88,.24,.08,"event","Validated business event","source"),
            (.38,.73,.24,.08,"type","Determine event type","decision"),
            (.02,.54,.16,.08,"sale","Customer invoice","process"),
            (.19,.54,.16,.08,"purchase","Supplier invoice","process"),
            (.36,.54,.16,.08,"receipt","Customer receipt","process"),
            (.53,.54,.16,.08,"payment","Supplier payment","process"),
            (.70,.54,.13,.08,"fee","Bank fee","process"),
            (.84,.54,.14,.08,"transfer","Transfer / tax / payroll","process"),
            (.06,.36,.25,.08,"commercial","Resolve client/supplier, revenue/expense and TVA","process"),
            (.38,.36,.25,.08,"settlement","Resolve receivable/payable settlement","process"),
            (.69,.36,.25,.08,"special","Resolve special counterpart or suspense","process"),
            (.20,.19,.24,.08,"accounts","Apply explicit/company/category account hierarchy","process"),
            (.56,.19,.24,.08,"lines","Generate balanced debit and credit lines","auto"),
            (.20,.05,.24,.07,"review","Unknown/high-risk classification review","review"),
            (.56,.05,.24,.07,"draft","Draft journal entry with source linkage","data"),
        ],
        [
            ("event","type"),("type","sale"),("type","purchase"),("type","receipt"),("type","payment"),
            ("type","fee"),("type","transfer"),("sale","commercial"),("purchase","commercial"),
            ("receipt","settlement"),("payment","settlement"),("fee","special"),("transfer","special"),
            ("commercial","accounts"),("settlement","accounts"),("special","review","uncertain"),
            ("special","accounts","known"),("accounts","lines"),("review","lines","approved"),("lines","draft"),
        ],
        "Event type comes before account mapping. Financing, transfers, deposits, refunds, taxes and payroll are not ordinary revenue or expense even when they appear in the bank.",
    )

    s += diagram_page(
        "26.7", "Automatic entries for commercial and payment events",
        "The diagram shows the two-stage accounting pattern: recognize the invoice first, then clear the receivable or payable when money moves.",
        [
            (.03,.84,.20,.08,"cinv","Customer invoice","source"),
            (.28,.84,.20,.08,"crec","Customer receipt","source"),
            (.53,.84,.20,.08,"sinv","Supplier invoice","source"),
            (.78,.84,.19,.08,"spay","Supplier payment","source"),
            (.03,.65,.20,.09,"sales","Dr 3421 TTC<br/>Cr revenue HT<br/>Cr 4455 TVA","auto"),
            (.28,.65,.20,.09,"collect","Dr 5141 bank<br/>Cr 3421 client","auto"),
            (.53,.65,.20,.09,"buy","Dr expense/asset HT<br/>Dr 3455 TVA<br/>Cr 4411 TTC","auto"),
            (.78,.65,.19,.09,"settle","Dr 4411 supplier<br/>Cr 5141 bank","auto"),
            (.10,.46,.24,.08,"clientbalance","Customer subledger: invoice open / partial / paid","data"),
            (.66,.46,.24,.08,"supplierbalance","Supplier subledger: payable open / partial / paid","data"),
            (.19,.28,.24,.08,"bankentry","Bank journal BQ and account 5141","data"),
            (.57,.28,.24,.08,"commercialentry","Sales VT / purchase AC journals","data"),
            (.38,.10,.24,.08,"controls","Balance, source idempotency, scope and period controls","decision"),
            (.19,.00,.24,.06,"review","Failed controls: review","review"),
            (.57,.00,.24,.06,"post","Passed controls: post and audit","auto"),
        ],
        [
            ("cinv","sales"),("crec","collect"),("sinv","buy"),("spay","settle"),
            ("sales","clientbalance"),("collect","clientbalance"),("buy","supplierbalance"),("settle","supplierbalance"),
            ("collect","bankentry"),("settle","bankentry"),("sales","commercialentry"),("buy","commercialentry"),
            ("bankentry","controls"),("commercialentry","controls"),("controls","review","fail"),("controls","post","pass"),
        ],
        "Collection clears 3421; supplier payment clears 4411. Posting a linked payment directly to revenue or expense would duplicate the commercial event.",
    )

    s += diagram_page(
        "26.8", "Validation and posting gate",
        "Every automatic or user-approved entry passes structural, accounting, authorization and audit controls before becoming final.",
        [
            (.38,.90,.24,.07,"draft","Draft journal entry","data"),
            (.38,.79,.24,.07,"balance","Debit equals credit?","decision"),
            (.38,.68,.24,.07,"amount","Finite positive amounts and allowed accounts?","decision"),
            (.38,.57,.24,.07,"duplicate","Source already booked?","decision"),
            (.38,.46,.24,.07,"scope","Correct company/dossier and RBAC permission?","decision"),
            (.38,.35,.24,.07,"period","Accounting period open?","decision"),
            (.38,.24,.24,.07,"tax","Tax, evidence and confidence acceptable?","decision"),
            (.05,.08,.26,.08,"blocked","Block posting and record failure reason","review"),
            (.38,.08,.24,.08,"human","User corrects / approves exception","review"),
            (.69,.08,.26,.08,"posted","Insert entries + audit + accounting event","auto"),
            (.69,.00,.26,.05,"locked","Durable source-linked ledger result","data"),
        ],
        [
            ("draft","balance"),("balance","amount","yes"),("amount","duplicate","yes"),
            ("duplicate","scope","no"),("scope","period","yes"),("period","tax","yes"),
            ("balance","blocked","no"),("amount","blocked","no"),("duplicate","blocked","yes"),
            ("scope","blocked","no"),("period","blocked","no"),("tax","human","review"),
            ("tax","posted","pass"),("blocked","human","correctable"),("human","draft","retry"),("posted","locked"),
        ],
        "A weighted AI score cannot override a hard invariant. Wrong scope, duplicate source, imbalance, over-allocation and locked periods are blocking conditions.",
    )

    s += diagram_page(
        "26.9", "Customer recouvrement and payment lifecycle",
        "Recouvrement starts with an issued invoice and ends when the receivable is collected, allocated, posted and reconciled.",
        [
            (.06,.86,.22,.08,"invoice","Issue customer invoice and due date","source"),
            (.39,.86,.22,.08,"receivable","Post customer receivable 3421","auto"),
            (.72,.86,.22,.08,"monitor","Monitor outstanding balance and ageing","process"),
            (.06,.67,.22,.08,"due","Due soon / overdue?","decision"),
            (.39,.67,.22,.08,"reminder","Send email / WhatsApp reminder and log history","process"),
            (.72,.67,.22,.08,"promise","Customer promise / dispute / no response","review"),
            (.06,.48,.22,.08,"payment","Income transaction received","source"),
            (.39,.48,.22,.08,"match","Match reference, customer, amount and date","decision"),
            (.72,.48,.22,.08,"allocate","Confirm full, partial or split allocation","auto"),
            (.06,.29,.22,.08,"status","Update montant_recu and invoice status","data"),
            (.39,.29,.22,.08,"entry","Dr bank 5141 / Cr client 3421","auto"),
            (.72,.29,.22,.08,"bankrec","Reconcile payment with statement line","process"),
            (.22,.10,.24,.08,"open","Remaining balance stays open and reminders continue","review"),
            (.56,.10,.24,.08,"closed","Invoice paid, receivable cleared, evidence linked","result"),
        ],
        [
            ("invoice","receivable"),("receivable","monitor"),("monitor","due"),("due","reminder","yes"),
            ("reminder","promise"),("payment","match"),("match","allocate","reliable"),("match","promise","ambiguous"),
            ("allocate","status"),("allocate","entry"),("entry","bankrec"),("status","open","partial"),
            ("status","closed","full"),("bankrec","closed","confirmed"),("open","monitor","next cycle"),
        ],
        "Reminder activity has no accounting entry. Revenue is recorded from the invoice; the collected payment clears the receivable and reconciliation proves it reached the bank.",
    )

    s += diagram_page(
        "26.10", "Bank reconciliation versus payment allocation",
        "The two workflows share transaction data but answer different control questions and store different results.",
        [
            (.38,.89,.24,.08,"import","Imported statement line + bank transaction","source"),
            (.07,.72,.28,.08,"allocationq","What commercial document does this payment settle?","decision"),
            (.65,.72,.28,.08,"reconq","Does the bank statement agree with the books?","decision"),
            (.07,.54,.28,.08,"docs","Search invoices / supplier documents","process"),
            (.65,.54,.28,.08,"entries","Search transaction or 5141 journal lines","process"),
            (.07,.36,.28,.08,"allocscore","Outstanding amount + identity + date score","process"),
            (.65,.36,.28,.08,"reconscore","Amount + date + description + direction score","process"),
            (.07,.18,.28,.08,"allocresult","invoice_payments allocation rows","data"),
            (.65,.18,.28,.08,"reconresult","bank line match status / session result","data"),
            (.07,.04,.28,.08,"settlement","Invoice/supplier balance updated","result"),
            (.65,.04,.28,.08,"agreement","Statement difference resolved and validated","result"),
        ],
        [
            ("import","allocationq"),("import","reconq"),("allocationq","docs"),("reconq","entries"),
            ("docs","allocscore"),("entries","reconscore"),("allocscore","allocresult"),
            ("reconscore","reconresult"),("allocresult","settlement"),("reconresult","agreement"),
        ],
        "Allocation changes document settlement state. Reconciliation changes bank agreement state. One may be complete while the other is still pending.",
    )

    s += diagram_page(
        "26.11", "Exception review and learning loop",
        "User corrections resolve the current case and can improve future proposals without silently rewriting historical accounting records.",
        [
            (.38,.89,.24,.08,"exception","Low confidence, contradiction or failed control","review"),
            (.03,.72,.18,.08,"ocr","OCR uncertainty","review"),
            (.22,.72,.18,.08,"match","Ambiguous match","review"),
            (.41,.72,.18,.08,"account","Unknown account / tax","review"),
            (.60,.72,.18,.08,"duplicate","Possible duplicate","review"),
            (.79,.72,.18,.08,"missing","Missing document","review"),
            (.09,.53,.22,.08,"correct","Correct extracted fields / upload evidence","process"),
            (.39,.53,.22,.08,"select","Select, split or reject candidate","process"),
            (.69,.53,.22,.08,"approve","Approve account, tax or exception reason","process"),
            (.22,.34,.24,.08,"validate","Re-run hard rules and controls","decision"),
            (.55,.34,.24,.08,"feedback","Store structured correction event","data"),
            (.22,.17,.24,.08,"resolved","Post / allocate / reconcile current case","auto"),
            (.55,.17,.24,.08,"rules","Update supplier mapping, identity alias or category preference","process"),
            (.22,.03,.24,.07,"audit","Preserve actor, reason, before/after and source","data"),
            (.55,.03,.24,.07,"future","Improve future suggestions; never mutate history","result"),
        ],
        [
            ("exception","ocr"),("exception","match"),("exception","account"),("exception","duplicate"),("exception","missing"),
            ("ocr","correct"),("missing","correct"),("match","select"),("duplicate","select"),("account","approve"),
            ("correct","validate"),("select","validate"),("approve","validate"),("validate","resolved","pass"),
            ("validate","exception","fail"),("correct","feedback"),("select","feedback"),("approve","feedback"),
            ("feedback","rules"),("resolved","audit"),("rules","future"),
        ],
        "Learning changes future suggestions, not posted history. Corrections to posted accounting use reversal and replacement events with an explicit reason.",
    )

    s += H1("27", "Glossary and implementation references")
    s += [
        grid_table(["Term", "Definition"], [
            ["HT", "Amount before TVA"], ["TTC", "Amount including TVA"], ["TVA", "Value-added tax"],
            ["CGNC", "Moroccan accounting normalization framework used for account mapping"],
            ["VT / AC / BQ", "Sales, purchase and bank journals"], ["RLS", "Database row-level security"],
            ["RBAC", "Role-based access control"], ["Idempotency", "Repeating the same request does not repeat the financial effect"],
            ["Allocation", "Settlement amount linking a transaction to a commercial document"],
            ["Reconciliation", "Proof that bank statement and bank-side books agree"],
            ["Reversal", "New accounting event that negates a prior posted event"],
            ["Suspense", "Controlled temporary account/state for unresolved classification"],
        ], [42*mm, 128*mm]),
        H2("Primary repository references used"),
        P("README.md; src/lib/ocr-engine.ts; src/lib/ocr-pipeline.ts; src/lib/accounting-engine.ts; src/lib/cgnc-mapping.ts; src/lib/rapprochement-engine.ts; src/lib/reconciliation.ts; src/lib/document-service.ts; src/lib/email-sync.ts; src/lib/audit.ts; src/lib/period-check.ts; src/lib/rbac.ts; src/app/api/accounting/book/route.ts; src/app/api/payment-allocations/*; src/app/api/rapprochement/*; src/app/api/import/bank-statement/route.ts; and Supabase migrations 001, 002, 004, 010, 016, 034, 037, 051, 075, 076 and 078."),
        Spacer(1, 8*mm),
        callout("Final mental model", "Documents prove business events. Transactions prove money movement. Allocations explain settlement. Journal entries explain accounting impact. Reconciliation proves agreement with the bank. Audit records prove who or what caused every result.", PALE_GREEN),
    ]
    return s


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = GuideDocTemplate(str(OUT), pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=18*mm,
                           title="Mohasib Technical Product and Workflow Guide", author="Mohasib")
    cover_frame = Frame(24*mm, 20*mm, A4[0]-45*mm, A4[1]-40*mm, id="cover")
    body_frame = Frame(20*mm, 18*mm, A4[0]-40*mm, A4[1]-38*mm, id="body")
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=cover_page),
        PageTemplate(id="body", frames=[body_frame], onPage=page_header_footer, autoNextPageTemplate="body"),
    ])
    doc.build(build_story())
    print(OUT)


if __name__ == "__main__":
    main()
