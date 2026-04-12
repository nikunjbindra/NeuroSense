from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from io import BytesIO
import datetime

def parse_color(color_str):
    """Safely convert hex or rgba strings to ReportLab colors."""
    if not color_str:
        return colors.black
    if color_str.startswith('#'):
        return colors.HexColor(color_str)
    if color_str.startswith('rgba'):
        try:
            # rgba(249,115,22,.1) -> [249, 115, 22, .1]
            parts = color_str.replace('rgba(', '').replace(')', '').split(',')
            return colors.Color(
                red=int(parts[0])/255.0,
                green=int(parts[1])/255.0,
                blue=int(parts[2])/255.0,
                alpha=float(parts[3])
            )
        except:
            return colors.lightgrey
    return colors.black

def generate_pdf(results, user_info, assessment_data):
    """
    Generate a professional PDF report for NeuroSense Pro.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter,
                           rightMargin=72, leftMargin=72,
                           topMargin=72, bottomMargin=72)
    
    styles = getSampleStyleSheet()
    
    # Define custom styles
    title_style = ParagraphStyle(
        'MainTitle',
        parent=styles['Title'],
        fontSize=24,
        textColor=colors.HexColor('#2d2540'),
        alignment=1,
        spaceAfter=14
    )
    
    risk_label_style = ParagraphStyle(
        'RiskLabel',
        parent=styles['Heading2'],
        fontSize=18,
        textColor=parse_color(results['risk']['c']),
        alignment=1,
        borderPadding=10,
        backgroundColor=parse_color(results['risk']['bg']),
        spaceBefore=12,
        spaceAfter=12
    )
    
    section_style = ParagraphStyle(
        'SectionHeader',
        parent=styles['Heading3'],
        fontSize=14,
        textColor=colors.HexColor('#7c6fcf'),
        spaceBefore=14,
        spaceAfter=8
    )

    elements = []
    
    # Header Branding
    elements.append(Paragraph("NEUROSENSE PRO", title_style))
    elements.append(Paragraph("Screening Assessment Report", styles['Heading4']))
    elements.append(Spacer(1, 12))
    
    # Patient Summary Table
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    patient_data = [
        ["Patient Name", user_info.get('name', 'Anonymous')],
        ["Email Address", user_info.get('email', 'N/A')],
        ["Report ID", f"NS-{datetime.datetime.now().strftime('%m%d%y%H%M')}"],
        ["Generated Date", now]
    ]
    t_patient = Table(patient_data, colWidths=[120, 300])
    t_patient.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_patient)
    elements.append(Spacer(1, 20))
    
    # Overall Assessment
    elements.append(Paragraph(f"Analysis Summary: {results['risk']['label']}", risk_label_style))
    elements.append(Paragraph(f"<b>Consolidated Risk Score: {results['score']} / 100</b>", styles['Normal']))
    elements.append(Paragraph(results['risk']['desc'], styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Key Factors Table
    elements.append(Paragraph("Key Risk Factors Detected", section_style))
    if results.get('factors'):
        factor_rows = [["Risk Factor Source", "Impact Value", "Severity Index"]]
        for f in results['factors']:
            factor_rows.append([f['label'], f"+{f['v']} pts", f"{round((f['v']/f['max'])*100)}%"])
        
        t_factors = Table(factor_rows, colWidths=[200, 100, 100])
        t_factors.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f4f2fb')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.HexColor('#7c6fcf')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(t_factors)
    else:
        elements.append(Paragraph("No major risk factors were identified during this evaluation period.", styles['Italic']))
    
    elements.append(Spacer(1, 20))
    
    # Clinical Metrics
    elements.append(Paragraph("Raw Test Metrics", section_style))
    rt_list = assessment_data.get('rts', [])
    avg_rt = f"{round(sum(rt_list)/len(rt_list))} ms" if rt_list else "Not Recorded"
    
    mem_list = assessment_data.get('memRes', [])
    mem_val = f"{sum(1 for x in mem_list if x)} / {len(mem_list)}" if mem_list else "Not Recorded"
    
    metric_rows = [
        ["Biological Age", f"{assessment_data.get('demo', {}).get('age', 'N/A')} years"],
        ["Mean Reaction Speed", avg_rt],
        ["Working Memory Score", mem_val],
    ]
    t_metrics = Table(metric_rows, colWidths=[180, 220])
    t_metrics.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_metrics)
    
    # Disclaimer
    elements.append(Spacer(1, 40))
    elements.append(Paragraph("IMPORTANT MEDICAL NOTICE", styles['Heading4']))
    
    muted_style = ParagraphStyle(
        'Muted',
        parent=styles['Normal'],
        fontSize=8,
        textColor=colors.grey,
        leading=10
    )
    
    elements.append(Paragraph(
        "This report was generated by NeuroSense Pro, an experimental AI screening prototype. "
        "THIS IS NOT A CLINICAL DIAGNOSIS. The findings displayed are based on self-reported data and "
        "algorithmic estimates. Please consult a licensed neurologist or healthcare provider to review "
        "these results and perform a comprehensive clinical evaluation. If you are experiencing an "
        "emergency, please contact your local emergency services immediately.",
        muted_style
    ))

    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    return buffer
