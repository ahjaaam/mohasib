from __future__ import annotations

from pathlib import Path

from PIL import Image
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "mohasib-offre-cabinets-remplie-2026-08-15.pdf"
TMP_DIR = ROOT / "tmp" / "pdfs" / "cabinet-filled"
LOGO = ROOT / "public" / "logo2.png"
DASHBOARD_GIF = ROOT / "public" / "images" / "mohasib-dashboard-demo-v3.gif"
DASHBOARD_PNG = TMP_DIR / "dashboard.png"

NAVY = HexColor("#0D1526")
INK = HexColor("#172033")
MUTED = HexColor("#667080")
PAPER = HexColor("#FFFCF7")
CREAM = HexColor("#F6F0E7")
WHITE = HexColor("#FFFFFF")
GOLD = HexColor("#C8924A")
GOLD_DARK = HexColor("#8A6030")
GREEN = HexColor("#16745E")
LINE = HexColor("#D9D1C5")
SOFT_GOLD = HexColor("#F4E7D2")

WHATSAPP = "+212 7 77 88 40 56"
WHATSAPP_URL = "https://wa.me/212777884056?text=Bonjour%20Abdelhamid%2C%20je%20souhaite%20organiser%20une%20demonstration%20Mohasib%20pour%20mon%20cabinet."
EMAIL = "a.ahjame@gmail.com"
WEBSITE = "mohasibai.com"


def register_fonts() -> tuple[str, str]:
    candidates = [
        ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ]
    for regular, bold in candidates:
        if Path(regular).exists() and Path(bold).exists():
            pdfmetrics.registerFont(TTFont("FilledRegular", regular))
            pdfmetrics.registerFont(TTFont("FilledBold", bold))
            return "FilledRegular", "FilledBold"
    return "Helvetica", "Helvetica-Bold"


REGULAR, BOLD = register_fonts()


def paragraph(c: canvas.Canvas, text: str, x: float, y_top: float, width: float,
              size: float, leading: float | None = None, color=INK,
              font: str = REGULAR) -> float:
    style = ParagraphStyle(
        "copy",
        fontName=font,
        fontSize=size,
        leading=leading or size * 1.25,
        textColor=color,
        alignment=TA_LEFT,
        spaceAfter=0,
    )
    block = Paragraph(text, style)
    _, height = block.wrap(width, 1000)
    block.drawOn(c, x, y_top - height)
    return height


def card(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill=WHITE,
         stroke=LINE, radius=9) -> None:
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.75)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def icon_inbox(c: canvas.Canvas, cx: float, cy: float) -> None:
    c.setStrokeColor(GOLD_DARK)
    c.setLineWidth(1.4)
    c.roundRect(cx - 8, cy - 6, 16, 11, 2, stroke=1, fill=0)
    c.line(cx - 8, cy + 2, cx, cy - 2)
    c.line(cx + 8, cy + 2, cx, cy - 2)
    c.line(cx, cy + 11, cx, cy + 4)
    c.line(cx, cy + 4, cx - 3, cy + 7)
    c.line(cx, cy + 4, cx + 3, cy + 7)


def icon_document(c: canvas.Canvas, cx: float, cy: float) -> None:
    c.setStrokeColor(GOLD_DARK)
    c.setLineWidth(1.35)
    c.roundRect(cx - 7, cy - 8, 14, 18, 2, stroke=1, fill=0)
    c.line(cx - 3, cy + 4, cx + 3, cy + 4)
    c.line(cx - 3, cy, cx + 4, cy)
    c.line(cx - 3, cy - 4, cx + 1, cy - 4)
    c.setFillColor(GOLD)
    c.circle(cx + 8, cy + 8, 2.5, stroke=0, fill=1)


def icon_control(c: canvas.Canvas, cx: float, cy: float) -> None:
    c.setStrokeColor(GOLD_DARK)
    c.setLineWidth(1.3)
    for dx, dy in [(-6, 5), (3, 5), (-6, -4), (3, -4)]:
        c.roundRect(cx + dx, cy + dy, 6, 6, 1, stroke=1, fill=0)
    c.setStrokeColor(GREEN)
    c.setLineWidth(1.7)
    c.line(cx + 4, cy - 1, cx + 6, cy - 3)
    c.line(cx + 6, cy - 3, cx + 10, cy + 2)


def bullet_list(c: canvas.Canvas, items: list[str], x: float, y_top: float,
                width: float, color, font_size: float = 7.9) -> None:
    y = y_top
    for item in items:
        c.setFillColor(color)
        c.circle(x + 2, y - 4.2, 1.8, stroke=0, fill=1)
        height = paragraph(c, item, x + 10, y, width - 10, font_size, 10.2, INK, REGULAR)
        y -= max(17.5, height + 6)


def prepare_dashboard() -> None:
    TMP_DIR.mkdir(parents=True, exist_ok=True)
    with Image.open(DASHBOARD_GIF) as source:
        source.seek(0)
        frame = source.convert("RGB")
        frame.save(DASHBOARD_PNG, quality=95)


def build() -> None:
    prepare_dashboard()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUTPUT), pagesize=A4)
    width, height = A4
    c.setTitle("Mohasib - Offre pour cabinets comptables")
    c.setAuthor("Mohasib AI")
    c.setSubject("Automatisation et pilotage pour cabinets comptables marocains")

    c.setFillColor(PAPER)
    c.rect(0, 0, width, height, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.rect(0, height - 5, width, 5, stroke=0, fill=1)

    c.drawImage(ImageReader(str(LOGO)), 37, height - 42, width=118, height=23,
                preserveAspectRatio=True, mask="auto")
    c.setFillColor(GOLD_DARK)
    c.setFont(BOLD, 7.6)
    c.drawRightString(width - 37, height - 31, "POUR LES CABINETS COMPTABLES AU MAROC")

    paragraph(c, "VOTRE CABINET A LE TALENT.<br/><font color='#C8924A'>LIBÉREZ SON TEMPS.</font>",
              37, height - 69, width - 74, 23.5, 25.5, NAVY, BOLD)
    paragraph(c, "Mohasib réunit la collecte des pièces, la préparation des écritures, le rapprochement, la TVA et le pilotage multi-dossiers. Votre équipe traite les exceptions - pas la répétition.",
              37, height - 128, width - 74, 9.6, 13, MUTED, REGULAR)
    paragraph(c, "Mohasib exécute. Vous gardez la décision.",
              37, height - 165, width - 74, 9.1, 11.5, GOLD_DARK, BOLD)

    c.setFillColor(GOLD_DARK)
    c.setFont(BOLD, 7.5)
    c.drawString(37, 650, "TROIS CHANGEMENTS CONCRETS DANS VOTRE QUOTIDIEN")

    cards_y = 547
    cards_h = 88
    gap = 10
    cards_w = (width - 74 - gap * 2) / 3
    propositions = [
        (icon_inbox, "Une entrée unique", "Les pièces arrivent dans le bon dossier, au lieu de rester dispersées entre email, WhatsApp et papier."),
        (icon_document, "Le travail est préparé", "Mohasib lit le document, extrait les données et prépare l'écriture à contrôler."),
        (icon_control, "Votre équipe valide", "Les collaborateurs se concentrent sur les écarts, les exceptions et les décisions utiles."),
    ]
    for index, (draw_icon, title, body) in enumerate(propositions):
        x = 37 + index * (cards_w + gap)
        card(c, x, cards_y, cards_w, cards_h)
        c.setFillColor(SOFT_GOLD)
        c.circle(x + 22, cards_y + 64, 13, stroke=0, fill=1)
        draw_icon(c, x + 22, cards_y + 62)
        paragraph(c, title, x + 43, cards_y + 76, cards_w - 53, 10.1, 12, NAVY, BOLD)
        paragraph(c, body, x + 13, cards_y + 46, cards_w - 26, 7.6, 9.7, MUTED, REGULAR)

    c.setFillColor(GOLD_DARK)
    c.setFont(BOLD, 7.5)
    c.drawString(37, 526, "DE LA PIÈCE REÇUE AU DOSSIER CONTRÔLÉ")

    shot_x, shot_y, shot_w, shot_h = 37, 338, 378, 174
    card(c, shot_x, shot_y, shot_w, shot_h, WHITE, LINE, 9)
    path = c.beginPath()
    path.roundRect(shot_x + 3, shot_y + 3, shot_w - 6, shot_h - 6, 7)
    c.saveState()
    c.clipPath(path, stroke=0, fill=0)
    c.drawImage(ImageReader(str(DASHBOARD_PNG)), shot_x + 3, shot_y + 3,
                width=shot_w - 6, height=shot_h - 6, preserveAspectRatio=False, mask="auto")
    c.restoreState()

    flow_x, flow_y, flow_w, flow_h = 426, 338, width - 463, 174
    card(c, flow_x, flow_y, flow_w, flow_h, CREAM, HexColor("#D8B881"), 12)
    paragraph(c, "COMMENT ÇA SE PASSE", flow_x + 13, flow_y + flow_h - 13,
              flow_w - 26, 7.2, 9, GOLD_DARK, BOLD)
    steps = [
        ("1", "Le client envoie", "Email, espace client ou import."),
        ("2", "Mohasib prépare", "Lecture, classement et proposition."),
        ("3", "Vous contrôlez", "Validation, correction et export."),
    ]
    sy = flow_y + flow_h - 45
    for number, title, body in steps:
        c.setFillColor(GOLD)
        c.circle(flow_x + 19, sy + 3, 9, stroke=0, fill=1)
        c.setFillColor(NAVY)
        c.setFont(BOLD, 7.5)
        c.drawCentredString(flow_x + 19, sy + 0.5, number)
        paragraph(c, title, flow_x + 35, sy + 11, flow_w - 47, 8.3, 10, NAVY, BOLD)
        paragraph(c, body, flow_x + 35, sy - 1, flow_w - 47, 6.8, 8.5, MUTED, REGULAR)
        sy -= 45

    compare_y, compare_h = 163, 153
    compare_gap = 14
    compare_w = (width - 74 - compare_gap) / 2
    card(c, 37, compare_y, compare_w, compare_h, CREAM, LINE, 10)
    card(c, 37 + compare_w + compare_gap, compare_y, compare_w, compare_h, WHITE, LINE, 10)

    paragraph(c, "SANS MOHASIB", 53, compare_y + compare_h - 16,
              compare_w - 32, 8.7, 11, GOLD_DARK, BOLD)
    bullet_list(c, [
        "Pièces dispersées et relances manuelles",
        "Saisie et contrôles répétitifs",
        "Rapprochements traités ligne par ligne",
        "Vision fragmentée des dossiers et échéances",
    ], 53, compare_y + compare_h - 40, compare_w - 32, HexColor("#BD7D52"))

    right_x = 37 + compare_w + compare_gap
    paragraph(c, "AVEC MOHASIB", right_x + 16, compare_y + compare_h - 16,
              compare_w - 32, 8.7, 11, GREEN, BOLD)
    bullet_list(c, [
        "Pièces centralisées dans chaque dossier",
        "Données et écritures préparées",
        "Rapprochements proposés, écarts signalés",
        "Priorités visibles dans un tableau de bord unique",
    ], right_x + 16, compare_y + compare_h - 40, compare_w - 32, GREEN)

    cta_x, cta_y, cta_w, cta_h = 37, 34, width - 74, 108
    c.setFillColor(NAVY)
    c.roundRect(cta_x, cta_y, cta_w, cta_h, 11, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.roundRect(cta_x + 15, cta_y + 74, 144, 20, 10, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.setFont(BOLD, 7.2)
    c.drawCentredString(cta_x + 87, cta_y + 81, "RENDEZ-VOUS DIAGNOSTIC - 30 MIN")
    paragraph(c, "Prenons un dossier type de votre cabinet.", cta_x + 15, cta_y + 67,
              310, 13.1, 16, WHITE, BOLD)
    paragraph(c, "Nous identifions le point de friction, puis je vous montre le workflow Mohasib correspondant. Sans engagement.",
              cta_x + 15, cta_y + 45, 310, 8.1, 10.4, HexColor("#D9DDE5"), REGULAR)

    divider_x = cta_x + 337
    c.setStrokeColor(HexColor("#495266"))
    c.line(divider_x, cta_y + 16, divider_x, cta_y + cta_h - 16)
    paragraph(c, "PARLONS DE VOTRE CABINET", divider_x + 18, cta_y + 83,
              cta_w - 370, 7.2, 9, HexColor("#D8B781"), BOLD)
    paragraph(c, WHATSAPP, divider_x + 18, cta_y + 63, cta_w - 370,
              9.1, 11, WHITE, BOLD)
    paragraph(c, EMAIL, divider_x + 18, cta_y + 45, cta_w - 370,
              7.6, 9.5, WHITE, REGULAR)
    paragraph(c, WEBSITE, divider_x + 18, cta_y + 29, cta_w - 370,
              7.6, 9.5, WHITE, REGULAR)
    c.linkURL(WHATSAPP_URL, (divider_x + 15, cta_y + 55, cta_x + cta_w - 12, cta_y + 73), relative=0)
    c.linkURL(f"mailto:{EMAIL}", (divider_x + 15, cta_y + 38, cta_x + cta_w - 12, cta_y + 54), relative=0)
    c.linkURL(f"https://{WEBSITE}", (divider_x + 15, cta_y + 22, cta_x + cta_w - 12, cta_y + 37), relative=0)

    c.showPage()
    c.save()
    print(OUTPUT)


if __name__ == "__main__":
    build()
