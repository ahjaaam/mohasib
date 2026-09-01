from __future__ import annotations

import base64
from pathlib import Path

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
LOGO = ROOT / "public" / "logo.png"
HTML_OUT = ROOT / "output" / "sales" / "mohasib-offre-tpme-2026-08-13.html"
PDF_OUT = ROOT / "output" / "pdf" / "mohasib-offre-tpme-2026-08-13.pdf"

NAVY = HexColor("#0D1526")
INK = HexColor("#172033")
MUTED = HexColor("#5E6675")
CREAM = HexColor("#F6F0E7")
PAPER = HexColor("#FFFCF7")
GOLD = HexColor("#C8924A")
GOLD_DARK = HexColor("#8B6233")
LINE = HexColor("#D9D1C5")
GREEN = HexColor("#176B56")
WHITE = HexColor("#FFFFFF")

WHATSAPP_DISPLAY = "+212 7 77 88 40 56"
WHATSAPP_URL = "https://wa.me/212777884056?text=Bonjour%20Abdelhamid%2C%20je%20souhaite%20voir%20comment%20Mohasib%20peut%20simplifier%20la%20gestion%20de%20mon%20entreprise."
EMAIL = "a.ahjame@gmail.com"
WEBSITE = "mohasibai.com"


def register_fonts() -> tuple[str, str]:
    candidates = [
        ("/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
        ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ]
    for regular, bold in candidates:
        if Path(regular).exists() and Path(bold).exists():
            pdfmetrics.registerFont(TTFont("TpmeRegular", regular))
            pdfmetrics.registerFont(TTFont("TpmeBold", bold))
            return "TpmeRegular", "TpmeBold"
    return "Helvetica", "Helvetica-Bold"


REGULAR, BOLD = register_fonts()


def para(c: canvas.Canvas, text: str, x: float, y_top: float, width: float, size: float,
         leading: float | None = None, color=INK, font: str = REGULAR) -> float:
    style = ParagraphStyle(
        "tpme",
        fontName=font,
        fontSize=size,
        leading=leading or size * 1.28,
        textColor=color,
        alignment=TA_LEFT,
        spaceAfter=0,
    )
    p = Paragraph(text, style)
    _, height = p.wrap(width, 1000)
    p.drawOn(c, x, y_top - height)
    return height


def rounded_box(c: canvas.Canvas, x: float, y: float, w: float, h: float, fill, stroke=LINE, radius=8):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(0.7)
    c.roundRect(x, y, w, h, radius, stroke=1, fill=1)


def draw_pdf() -> None:
    PDF_OUT.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(PDF_OUT), pagesize=A4)
    width, height = A4
    c.setTitle("Mohasib - Gérez votre entreprise, pas l'administratif")
    c.setAuthor("Mohasib AI")
    c.setSubject("Proposition Mohasib pour TPE et PME marocaines")

    c.setFillColor(PAPER)
    c.rect(0, 0, width, height, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.rect(0, height - 220, width, 220, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.rect(0, height - 6, width, 6, stroke=0, fill=1)

    c.drawImage(ImageReader(str(LOGO)), 38, height - 52, width=137, height=26, mask="auto", preserveAspectRatio=True)
    c.setFillColor(HexColor("#D8C6AB"))
    c.setFont(BOLD, 8.2)
    c.drawRightString(width - 38, height - 38, "POUR LES TPE ET PME MAROCAINES")

    para(c, "GÉREZ VOTRE ENTREPRISE.<br/><font color='#C8924A'>PAS L'ADMINISTRATIF.</font>",
         38, height - 76, width - 76, 27, 29.5, WHITE, BOLD)
    para(c, "Factures, paiements, pièces, TVA et comptabilité réunis dans un seul espace clair.",
         38, height - 148, width - 76, 11.8, 16, HexColor("#E7E2DB"), REGULAR)
    para(c, "Mohasib organise le travail. Vous gardez la visibilité et la décision.",
         38, height - 191, width - 76, 10.2, 13, HexColor("#D8B781"), BOLD)

    top = height - 240
    para(c, "VOTRE ENTREPRISE NE DEVRAIT PAS ÊTRE PILOTÉE À L'AVEUGLE.", 38, top, width - 76, 8.4, 10, GOLD_DARK, BOLD)
    para(c, "Savoir ce qui est facturé, encaissé, dû et prêt pour votre comptable - sans courir après l'information.",
         38, top - 17, width - 76, 14.2, 18, NAVY, BOLD)
    para(c, "Mohasib relie la gestion quotidienne à la préparation comptable, pour que chaque document et chaque paiement suivent un parcours clair.",
         38, top - 59, width - 76, 9.7, 13, MUTED, REGULAR)

    col_gap = 14
    col_w = (width - 76 - col_gap) / 2
    box_y = height - 478
    box_h = 142
    rounded_box(c, 38, box_y, col_w, box_h, CREAM)
    rounded_box(c, 38 + col_w + col_gap, box_y, col_w, box_h, WHITE)

    para(c, "SANS MOHASIB", 54, box_y + box_h - 18, col_w - 32, 8.2, 10, GOLD_DARK, BOLD)
    before = [
        "Devis et factures dans plusieurs outils",
        "Paiements suivis tardivement",
        "Notes de frais dispersées entre email et WhatsApp",
        "TVA préparée dans l'urgence",
        "Échanges répétés avec le comptable",
    ]
    yy = box_y + box_h - 42
    for item in before:
        c.setFillColor(HexColor("#B67B55"))
        c.circle(56, yy + 2.5, 2, stroke=0, fill=1)
        item_h = para(c, item, 64, yy + 8, col_w - 78, 8.65, 11.2, INK, REGULAR)
        yy -= max(20.5, item_h + 7)

    para(c, "AVEC MOHASIB", 54 + col_w + col_gap, box_y + box_h - 18, col_w - 32, 8.2, 10, GREEN, BOLD)
    after = [
        "Du devis à la facture, puis à l'encaissement",
        "Trésorerie, échéances et impayés visibles",
        "Pièces reçues, lues, classées et retrouvées",
        "TVA et écritures préparées en continu",
        "Votre comptable accède au dossier organisé",
    ]
    yy = box_y + box_h - 42
    for item in after:
        c.setFillColor(GREEN)
        c.circle(56 + col_w + col_gap, yy + 2.5, 2, stroke=0, fill=1)
        item_h = para(c, item, 64 + col_w + col_gap, yy + 8, col_w - 78, 8.65, 11.2, INK, REGULAR)
        yy -= max(20.5, item_h + 7)

    section_y = box_y - 27
    para(c, "UNE NOUVELLE FAÇON DE TRAVAILLER", 38, section_y, width - 76, 8.4, 10, GOLD_DARK, BOLD)

    cards = [
        ("01", "Voir clair", "Une vue immédiate sur vos factures, paiements, échéances et obligations."),
        ("02", "Rester maître", "Vous contrôlez les validations importantes; Mohasib structure l'exécution."),
        ("03", "Mieux collaborer", "Votre équipe et votre comptable travaillent à partir du même dossier organisé."),
    ]
    card_gap = 9
    card_w = (width - 76 - 2 * card_gap) / 3
    card_y = section_y - 103
    for index, (number, title, body) in enumerate(cards):
        x = 38 + index * (card_w + card_gap)
        rounded_box(c, x, card_y, card_w, 80, WHITE)
        c.setFillColor(GOLD)
        c.setFont(BOLD, 7.5)
        c.drawString(x + 12, card_y + 61, number)
        para(c, title, x + 12, card_y + 58, card_w - 24, 10.5, 13, NAVY, BOLD)
        para(c, body, x + 12, card_y + 39, card_w - 24, 7.7, 10.1, MUTED, REGULAR)

    cta_y = 39
    c.setFillColor(NAVY)
    c.roundRect(38, cta_y, width - 76, 92, 10, stroke=0, fill=1)
    c.setFillColor(GOLD)
    c.roundRect(52, cta_y + 57, 132, 19, 9, stroke=0, fill=1)
    c.setFillColor(NAVY)
    c.setFont(BOLD, 7.2)
    c.drawCentredString(118, cta_y + 63.5, "DÉMO PERSONNALISÉE - 20 MIN")
    para(c, "Montrez-moi votre façon de travailler.", 52, cta_y + 48, 300, 12.2, 15, WHITE, BOLD)
    para(c, "Je vous montrerai comment Mohasib peut simplifier un parcours réel de votre entreprise. Sans engagement.",
         52, cta_y + 26, 300, 8.1, 10.5, HexColor("#D9DDE5"), REGULAR)

    c.setStrokeColor(HexColor("#495266"))
    c.line(364, cta_y + 14, 364, cta_y + 78)
    c.setFillColor(HexColor("#D8B781"))
    c.setFont(BOLD, 7.2)
    c.drawString(382, cta_y + 67, "PARLONS DE VOTRE ENTREPRISE")
    c.setFillColor(WHITE)
    c.setFont(BOLD, 9.2)
    c.drawString(382, cta_y + 49, WHATSAPP_DISPLAY)
    c.setFont(REGULAR, 7.8)
    c.drawString(382, cta_y + 34, EMAIL)
    c.drawString(382, cta_y + 20, WEBSITE)
    c.linkURL(WHATSAPP_URL, (378, cta_y + 43, width - 50, cta_y + 62), relative=0)
    c.linkURL(f"mailto:{EMAIL}", (378, cta_y + 29, width - 50, cta_y + 42), relative=0)
    c.linkURL(f"https://{WEBSITE}", (378, cta_y + 14, width - 50, cta_y + 28), relative=0)

    c.showPage()
    c.save()


def draw_html() -> None:
    HTML_OUT.parent.mkdir(parents=True, exist_ok=True)
    logo_b64 = base64.b64encode(LOGO.read_bytes()).decode("ascii")
    html = f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Mohasib - Gérez votre entreprise, pas l'administratif</title>
<style>
:root{{--navy:#0d1526;--ink:#172033;--muted:#5e6675;--paper:#fffcf7;--cream:#f6f0e7;--gold:#c8924a;--line:#d9d1c5;--green:#176b56}}
*{{box-sizing:border-box}}body{{margin:0;background:#e9e7e3;color:var(--ink);font-family:Arial,Helvetica,sans-serif}}.page{{width:min(100%,794px);min-height:1123px;margin:24px auto;background:var(--paper);box-shadow:0 18px 60px #0d152629}}
.hero{{background:var(--navy);color:white;padding:34px 50px 31px;border-top:7px solid var(--gold)}}.brand{{display:flex;align-items:center;justify-content:space-between;gap:20px}}.brand img{{width:178px;height:auto}}.eyebrow{{font-size:10px;letter-spacing:.13em;font-weight:800;color:#d8c6ab;text-align:right}}
h1{{font-size:38px;line-height:1.04;letter-spacing:-.035em;margin:30px 0 13px;max-width:650px}}h1 span{{color:var(--gold)}}.lead{{font-size:16px;line-height:1.45;color:#e7e2db;max-width:665px;margin:0}}.promise{{font-weight:800;color:#d8b781;margin:17px 0 0}}
.content{{padding:27px 50px 34px}}.kicker{{font-size:10px;letter-spacing:.14em;color:#8b6233;font-weight:800;margin:0 0 9px}}h2{{font-size:21px;line-height:1.18;letter-spacing:-.02em;margin:0 0 9px;color:var(--navy)}}.intro{{font-size:13px;line-height:1.5;color:var(--muted);margin:0}}
.compare{{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin:24px 0}}.box{{border:1px solid var(--line);padding:20px 21px;background:white;border-radius:10px}}.box.before{{background:var(--cream)}}.box h3{{font-size:10px;letter-spacing:.13em;margin:0 0 15px;color:#8b6233}}.box.after h3{{color:var(--green)}}ul{{list-style:none;padding:0;margin:0}}li{{position:relative;padding-left:15px;font-size:12px;line-height:1.35;margin:0 0 10px}}li:before{{content:'';position:absolute;left:0;top:.47em;width:5px;height:5px;border-radius:50%;background:#b67b55}}.after li:before{{background:var(--green)}}
.cards{{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:11px 0 25px}}.card{{border:1px solid var(--line);background:white;border-radius:9px;padding:15px}}.num{{color:var(--gold);font-size:10px;font-weight:800}}.card h3{{font-size:15px;margin:7px 0;color:var(--navy)}}.card p{{font-size:10.5px;line-height:1.4;color:var(--muted);margin:0}}
.cta{{display:grid;grid-template-columns:1.7fr 1fr;gap:24px;background:var(--navy);border-radius:12px;padding:21px 23px;color:white}}.pill{{display:inline-block;background:var(--gold);color:var(--navy);font-size:9px;font-weight:800;padding:7px 11px;border-radius:99px}}.cta h2{{color:white;font-size:18px;margin:12px 0 5px}}.cta p{{font-size:11px;line-height:1.45;color:#d9dde5;margin:0}}.contact{{border-left:1px solid #495266;padding-left:22px;display:flex;flex-direction:column;justify-content:center}}.contact b{{color:#d8b781;font-size:9px;letter-spacing:.1em;margin-bottom:8px}}.contact a{{color:white;text-decoration:none;font-size:11px;line-height:1.7}}.contact a:first-of-type{{font-size:13px;font-weight:800}}
@media(max-width:650px){{.page{{margin:0;min-height:100vh}}.hero,.content{{padding-left:24px;padding-right:24px}}.eyebrow{{font-size:8px}}h1{{font-size:31px}}.compare,.cards,.cta{{grid-template-columns:1fr}}.contact{{border-left:0;border-top:1px solid #495266;padding:17px 0 0}}}}@media print{{@page{{size:A4;margin:0}}body{{background:white}}.page{{width:210mm;height:297mm;min-height:0;margin:0;box-shadow:none}}}}
</style></head><body><main class="page"><section class="hero"><div class="brand"><img src="data:image/png;base64,{logo_b64}" alt="Mohasib"><div class="eyebrow">POUR LES TPE ET PME MAROCAINES</div></div><h1>GÉREZ VOTRE ENTREPRISE.<br><span>PAS L'ADMINISTRATIF.</span></h1><p class="lead">Factures, paiements, pièces, TVA et comptabilité réunis dans un seul espace clair.</p><p class="promise">Mohasib organise le travail. Vous gardez la visibilité et la décision.</p></section>
<section class="content"><p class="kicker">VOTRE ENTREPRISE NE DEVRAIT PAS ÊTRE PILOTÉE À L'AVEUGLE.</p><h2>Savoir ce qui est facturé, encaissé, dû et prêt pour votre comptable - sans courir après l'information.</h2><p class="intro">Mohasib relie la gestion quotidienne à la préparation comptable, pour que chaque document et chaque paiement suivent un parcours clair.</p>
<div class="compare"><article class="box before"><h3>SANS MOHASIB</h3><ul><li>Devis et factures dans plusieurs outils</li><li>Paiements suivis tardivement</li><li>Notes de frais dispersées entre email et WhatsApp</li><li>TVA préparée dans l'urgence</li><li>Échanges répétés avec le comptable</li></ul></article><article class="box after"><h3>AVEC MOHASIB</h3><ul><li>Du devis à la facture, puis à l'encaissement</li><li>Trésorerie, échéances et impayés visibles</li><li>Pièces reçues, lues, classées et retrouvées</li><li>TVA et écritures préparées en continu</li><li>Votre comptable accède au dossier organisé</li></ul></article></div>
<p class="kicker">UNE NOUVELLE FAÇON DE TRAVAILLER</p><div class="cards"><article class="card"><span class="num">01</span><h3>Voir clair</h3><p>Une vue immédiate sur vos factures, paiements, échéances et obligations.</p></article><article class="card"><span class="num">02</span><h3>Rester maître</h3><p>Vous contrôlez les validations importantes; Mohasib structure l'exécution.</p></article><article class="card"><span class="num">03</span><h3>Mieux collaborer</h3><p>Votre équipe et votre comptable travaillent à partir du même dossier organisé.</p></article></div>
<section class="cta"><div><span class="pill">DÉMONSTRATION PERSONNALISÉE - 20 MIN</span><h2>Montrez-moi comment vous travaillez aujourd'hui.</h2><p>Je vous montrerai comment Mohasib peut simplifier un parcours réel de votre entreprise. Sans engagement.</p></div><div class="contact"><b>PARLONS DE VOTRE ENTREPRISE</b><a href="{WHATSAPP_URL}">{WHATSAPP_DISPLAY}</a><a href="mailto:{EMAIL}">{EMAIL}</a><a href="https://{WEBSITE}">{WEBSITE}</a></div></section></section></main></body></html>"""
    HTML_OUT.write_text(html, encoding="utf-8")


if __name__ == "__main__":
    draw_html()
    draw_pdf()
    print(HTML_OUT)
    print(PDF_OUT)
