from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.enums import TA_CENTER


def generate_document_pdf(document: dict, concepts: list, relationships: list) -> bytes:

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.75 * inch, bottomMargin=0.75 * inch)
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("DocTitle", parent=styles["Title"], fontSize=22, spaceAfter=20, alignment=TA_CENTER)
    heading_style = ParagraphStyle("SectionHeading", parent=styles["Heading2"], fontSize=14, spaceBefore=16, spaceAfter=8,
                                   textColor=HexColor("#1e40af"))
    body_style = styles["BodyText"]
    small_style = ParagraphStyle("SmallText", parent=styles["Normal"], fontSize=9, textColor=HexColor("#6b7280"))

    elements = []

    elements.append(Paragraph(document.get("document_name", "Untitled Document"), title_style))
    elements.append(Paragraph(f"Type: {document.get('document_type', 'N/A')} | Status: {document.get('processing_status', 'N/A')}", small_style))
    elements.append(Spacer(1, 20))

    ai_summary = document.get("ai_summary")
    if ai_summary:
        elements.append(Paragraph("AI Summary", heading_style))
        elements.append(Paragraph(ai_summary, body_style))
        elements.append(Spacer(1, 12))

    elements.append(Paragraph(f"Concepts ({len(concepts)})", heading_style))

    if concepts:
        table_data = [["Title", "Type", "Difficulty"]]
        for c in concepts:
            c_dict = dict(c) if not isinstance(c, dict) else c
            title = c_dict.get("title", "")
            ctype = c_dict.get("concept_type", "")
            diff = c_dict.get("difficulty_level", "") or ""
            table_data.append([
                Paragraph(str(title)[:80], body_style),
                str(ctype),
                str(diff)])

        t = Table(table_data, colWidths=[3.5 * inch, 1.5 * inch, 1.5 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#dbeafe")),
            ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#1e3a5f")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#d1d5db")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        elements.append(t)
    else:
        elements.append(Paragraph("No concepts extracted.", small_style))

    elements.append(Spacer(1, 16))

    elements.append(Paragraph(f"Relationships ({len(relationships)})", heading_style))

    if relationships:
        table_data = [["Source", "Relationship", "Target"]]
        for r in relationships:
            r_dict = dict(r) if not isinstance(r, dict) else r
            table_data.append([
                Paragraph(str(r_dict.get("source_concept_title", ""))[:60], body_style),
                str(r_dict.get("relationship_type", "")),
                Paragraph(str(r_dict.get("target_concept_title", ""))[:60], body_style)])

        t = Table(table_data, colWidths=[2.5 * inch, 1.5 * inch, 2.5 * inch])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), HexColor("#f3e8ff")),
            ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#581c87")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, HexColor("#d1d5db")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
        elements.append(t)
    else:
        elements.append(Paragraph("No relationships extracted.", small_style))

    doc.build(elements)
    return buffer.getvalue()
