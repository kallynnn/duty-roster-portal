#!/usr/bin/env python3
"""
generate_order.py — Генератор наказу розподілу добового наряду ВІТІ
Використання: python generate_order.py '<json_data>' output.pdf
"""

import sys
import json
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

# ─── Шрифти (використовуємо вбудовані) ──────────────────────
# ReportLab вбудовані шрифти не підтримують кирилицю напряму,
# тому використовуємо DejaVu якщо є, або Helvetica як fallback

def register_fonts():
    """Реєструємо шрифти з підтримкою кирилиці (Linux + Windows)."""
    import platform

    # Всі можливі шляхи до шрифтів з підтримкою кирилиці
    candidates = [
        # Windows — Times New Roman (є на всіх Windows)
        ('C:/Windows/Fonts/times.ttf',   'C:/Windows/Fonts/timesbd.ttf'),
        ('C:/Windows/Fonts/arial.ttf',   'C:/Windows/Fonts/arialbd.ttf'),
        ('C:/Windows/Fonts/cour.ttf',    'C:/Windows/Fonts/courbd.ttf'),
        # Windows — абсолютні шляхи через змінну середовища
        (os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts/times.ttf'),
         os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts/timesbd.ttf')),
        (os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts/arial.ttf'),
         os.path.join(os.environ.get('WINDIR', 'C:/Windows'), 'Fonts/arialbd.ttf')),
        # Linux — DejaVu
        ('/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
         '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'),
        ('/usr/share/fonts/dejavu/DejaVuSerif.ttf',
         '/usr/share/fonts/dejavu/DejaVuSerif-Bold.ttf'),
        # Linux — Liberation
        ('/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf',
         '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'),
        ('/usr/share/fonts/liberation/LiberationSerif-Regular.ttf',
         '/usr/share/fonts/liberation/LiberationSerif-Bold.ttf'),
        # macOS
        ('/Library/Fonts/Arial.ttf',         '/Library/Fonts/Arial Bold.ttf'),
        ('/System/Library/Fonts/Helvetica.ttc', '/System/Library/Fonts/Helvetica.ttc'),
    ]

    for reg_path, bold_path in candidates:
        if os.path.exists(reg_path) and os.path.exists(bold_path):
            try:
                pdfmetrics.registerFont(TTFont('CyrFont',     reg_path))
                pdfmetrics.registerFont(TTFont('CyrFont-Bold', bold_path))
                return 'CyrFont', 'CyrFont-Bold'
            except Exception:
                continue

    # Якщо нічого не знайдено — повертаємо None (буде Helvetica без кирилиці)
    return None, None

# ─── Стилі ───────────────────────────────────────────────────
def make_styles(font, font_bold):
    f  = font      or 'Helvetica'
    fb = font_bold or 'Helvetica-Bold'
    
    return {
        'center_bold': ParagraphStyle(
            'center_bold', fontName=fb, fontSize=11,
            alignment=TA_CENTER, spaceAfter=2, leading=14
        ),
        'center': ParagraphStyle(
            'center', fontName=f, fontSize=10,
            alignment=TA_CENTER, spaceAfter=2, leading=13
        ),
        'title': ParagraphStyle(
            'title', fontName=fb, fontSize=11,
            alignment=TA_CENTER, spaceAfter=4, spaceBefore=4, leading=15
        ),
        'heading': ParagraphStyle(
            'heading', fontName=fb, fontSize=10,
            alignment=TA_LEFT, spaceAfter=2, spaceBefore=6, leading=13
        ),
        'normal': ParagraphStyle(
            'normal', fontName=f, fontSize=10,
            alignment=TA_LEFT, spaceAfter=2, leading=13,
            leftIndent=1*cm
        ),
        'normal_indent': ParagraphStyle(
            'normal_indent', fontName=f, fontSize=10,
            alignment=TA_LEFT, spaceAfter=1, leading=13,
            leftIndent=2*cm
        ),
        'small': ParagraphStyle(
            'small', fontName=f, fontSize=9,
            alignment=TA_LEFT, spaceAfter=1, leading=12,
            leftIndent=2*cm
        ),
        'sign_left': ParagraphStyle(
            'sign_left', fontName=f, fontSize=10,
            alignment=TA_LEFT, leading=13
        ),
        'sign_right': ParagraphStyle(
            'sign_right', fontName=f, fontSize=10,
            alignment=TA_RIGHT, leading=13
        ),
    }

# ─── Форматування звання у родовому відмінку ─────────────────
RANK_GENITIVE = {
    'Солдат': 'солдату',
    'Старший солдат': 'старшому солдату',
    'Молодший сержант': 'молодшому сержанту',
    'Сержант': 'сержанту',
    'Старший сержант': 'старшому сержанту',
    'Лейтенант': 'лейтенанту',
    'Старший лейтенант': 'старшому лейтенанту',
    'Капітан': 'капітану',
    'Майор': 'майору',
    'Підполковник': 'підполковнику',
    'Полковник': 'полковнику',
    'Курсант': 'курсанту',
}

RANK_NOMINATIVE = {
    'Солдат': 'солдат',
    'Старший солдат': 'старший солдат',
    'Молодший сержант': 'молодший сержант',
    'Сержант': 'сержант',
    'Старший сержант': 'старший сержант',
    'Лейтенант': 'лейтенант',
    'Старший лейтенант': 'старший лейтенант',
    'Капітан': 'капітан',
    'Майор': 'майор',
    'Підполковник': 'підполковник',
    'Полковник': 'полковник',
    'Курсант': 'курсант',
}

def rank_gen(rank: str) -> str:
    return RANK_GENITIVE.get(rank, rank.lower())

def rank_nom(rank: str) -> str:
    return RANK_NOMINATIVE.get(rank, rank.lower())

def name_upper(name: str) -> str:
    """Перетворює ім'я у ВЕРХНІЙ РЕГІСТР для наказу."""
    parts = name.strip().split()
    if len(parts) >= 2:
        # Прізвище та ініціали або повне ім'я
        return ' '.join(p.upper() for p in parts)
    return name.upper()

# ─── Генерація PDF ───────────────────────────────────────────
def generate_order_pdf(data: dict, output_path: str):
    """
    data = {
      "date": "2026-01-27",
      "commander_rank": "Полковник",
      "commander_name": "Іванченко О.В.",
      "institute_name": "Військового інституту телекомунікацій та інформатизації імені Героїв Крут",
      "duties": [
        {
          "duty_type": "Черговий контрольно-пропускного пункту",
          "point": "1.4",
          "is_senior": true,
          "soldiers": [
            {"name": "Терещук М.М.", "rank": "Солдат", "group": "221"}
          ]
        },
        ...
      ]
    }
    """
    font, font_bold = register_fonts()
    styles = make_styles(font, font_bold)
    
    # Дата
    date_str = data.get('date', datetime.now().strftime('%Y-%m-%d'))
    try:
        dt = datetime.strptime(date_str, '%Y-%m-%d')
    except:
        dt = datetime.now()
    
    MONTHS_UA = [
        '', 'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
        'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
    ]
    date_formatted = f"{dt.day} {MONTHS_UA[dt.month]} {dt.year} року"
    date_short     = f"{dt.day:02d}.{dt.month:02d}.{dt.year}"
    
    institute  = data.get('institute_name', 'Військового інституту телекомунікацій та інформатизації імені Героїв Крут')
    cmd_rank   = data.get('commander_rank', 'Полковник')
    cmd_name   = data.get('commander_name', '')
    duties     = data.get('duties', [])
    
    # Документ
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=3*cm,
        rightMargin=1.5*cm,
        topMargin=2*cm,
        bottomMargin=2*cm,
    )
    
    story = []
    fb = font_bold or 'Helvetica-Bold'
    f  = font      or 'Helvetica'
    
    # ── Шапка ──
    story.append(Paragraph('<b>МІНІСТЕРСТВО ОБОРОНИ УКРАЇНИ</b>', styles['center_bold']))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph('<b>НАКАЗ</b>', styles['title']))
    story.append(Paragraph(f'начальника {institute}', styles['center']))
    story.append(Spacer(1, 0.1*cm))
    story.append(Paragraph('(по стройовій частині про склад добового наряду)', styles['center']))
    story.append(Spacer(1, 0.4*cm))
    
    # Дата та місто в одному рядку
    header_table = Table(
        [[
            Paragraph(f'___ {date_formatted}', styles['normal']),
            Paragraph('м. Київ', styles['center']),
            Paragraph(f'№ _______', styles['sign_right']),
        ]],
        colWidths=[5*cm, 5*cm, 5*cm]
    )
    header_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.5*cm))
    
    # ── Вступна частина ──
    intro = (
        f'\t\t<b>1. Добовий наряд в пункті постійної дислокації на {date_formatted} '
        f'призначити в складі:</b>'
    )
    story.append(Paragraph(intro, ParagraphStyle(
        'intro', fontName=fb, fontSize=10,
        alignment=TA_JUSTIFY, leading=14, spaceAfter=4
    )))
    
    # ── Розділи нарядів ──
    duty_counter = 0
    
    for duty in duties:
        duty_type   = duty.get('duty_type', '')
        point       = duty.get('point', '')
        is_senior   = duty.get('is_senior', False)
        soldiers    = duty.get('soldiers', [])
        
        if not soldiers:
            continue
        
        duty_counter += 1
        
        if len(soldiers) == 1:
            # Одна людина — один рядок
            s = soldiers[0]
            group_info = f" навчальної групи " if s.get('group') else " "
            group_num  = s.get('group', '')
            line = (
                f"{point}. {duty_type} – курсант {group_num}{group_info}"
                f"{rank_nom(s['rank'])} {name_upper(s['name'])}."
            )
            story.append(Paragraph(line, styles['normal']))
        else:
            # Декілька людей
            if is_senior:
                # Перша людина — старший
                s = soldiers[0]
                group_num = s.get('group', '')
                header_line = (
                    f"{point}. {duty_type}:"
                )
                story.append(Paragraph(header_line, styles['normal']))
                
                senior_line = (
                    f"\t\tСтарший {duty_type.lower()} – курсант {group_num} навчальної групи "
                    f"{rank_nom(s['rank'])} {name_upper(s['name'])}."
                )
                story.append(Paragraph(senior_line, styles['normal_indent']))
                
                for s in soldiers[1:]:
                    group_num = s.get('group', '')
                    member_line = (
                        f"курсант {group_num} навчальної групи "
                        f"{rank_nom(s['rank'])} {name_upper(s['name'])};"
                    )
                    story.append(Paragraph(member_line, styles['normal_indent']))
            else:
                # Звичайний список
                header_line = f"{point}. {duty_type}:"
                story.append(Paragraph(header_line, styles['normal']))
                for s in soldiers:
                    group_num = s.get('group', '')
                    member_line = (
                        f"курсант {group_num} навчальної групи "
                        f"{rank_nom(s['rank'])} {name_upper(s['name'])};"
                    )
                    story.append(Paragraph(member_line, styles['normal_indent']))
        
        story.append(Spacer(1, 0.2*cm))
    
    # ── Розділ 2: Пожежний наряд ──
    fire_duties = data.get('fire_duties', [])
    if fire_duties:
        story.append(Spacer(1, 0.2*cm))
        fire_intro = (
            f'\t\t<b>2. Пожежний наряд в пункті постійної дислокації на {date_formatted} '
            f'призначити в складі:</b>'
        )
        story.append(Paragraph(fire_intro, ParagraphStyle(
            'fire_intro', fontName=fb, fontSize=10,
            alignment=TA_JUSTIFY, leading=14, spaceAfter=4
        )))
        
        for duty in fire_duties:
            duty_type = duty.get('duty_type', '')
            point     = duty.get('point', '')
            soldiers  = duty.get('soldiers', [])
            
            if not soldiers:
                continue
            
            header_line = f"{point}. {duty_type}:"
            story.append(Paragraph(header_line, styles['normal']))
            for s in soldiers:
                group_num = s.get('group', '')
                member_line = (
                    f"курсант {group_num} навчальної групи "
                    f"{rank_nom(s['rank'])} {name_upper(s['name'])};"
                )
                story.append(Paragraph(member_line, styles['normal_indent']))
            story.append(Spacer(1, 0.2*cm))
    
    # ── Розділ 3: Денний наряд ──
    day_duties = data.get('day_duties', [])
    if day_duties:
        story.append(Spacer(1, 0.2*cm))
        day_intro = (
            f'\t\t<b>3. Денний наряд в пункті постійної дислокації на {date_formatted} '
            f'призначити в складі:</b>'
        )
        story.append(Paragraph(day_intro, ParagraphStyle(
            'day_intro', fontName=fb, fontSize=10,
            alignment=TA_JUSTIFY, leading=14, spaceAfter=4
        )))
        
        for duty in day_duties:
            duty_type = duty.get('duty_type', '')
            point     = duty.get('point', '')
            soldiers  = duty.get('soldiers', [])
            
            if not soldiers:
                continue
            
            if len(soldiers) == 1:
                s = soldiers[0]
                group_num = s.get('group', '')
                line = (
                    f"{point}. {duty_type} – курсант {group_num} навчальної групи "
                    f"{rank_nom(s['rank'])} {name_upper(s['name'])}."
                )
                story.append(Paragraph(line, styles['normal']))
            else:
                header_line = f"{point}. {duty_type}:"
                story.append(Paragraph(header_line, styles['normal']))
                for s in soldiers:
                    group_num = s.get('group', '')
                    member_line = (
                        f"курсант {group_num} навчальної групи "
                        f"{rank_nom(s['rank'])} {name_upper(s['name'])};"
                    )
                    story.append(Paragraph(member_line, styles['normal_indent']))
            story.append(Spacer(1, 0.2*cm))
    
    # ── Підпис ──
    story.append(Spacer(1, 1*cm))
    story.append(HRFlowable(width='100%', thickness=0.5, color=colors.black))
    story.append(Spacer(1, 0.3*cm))
    
    sign_table = Table(
        [[
            Paragraph(
                f'{cmd_rank} {institute.split()[0] if institute else ""}',
                styles['sign_left']
            ),
            Paragraph('', styles['center']),
            Paragraph(cmd_name, styles['sign_right']),
        ]],
        colWidths=[6*cm, 3*cm, 6*cm]
    )
    sign_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (0,0), 'LEFT'),
        ('ALIGN', (2,0), (2,0), 'RIGHT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(sign_table)
    
    story.append(Spacer(1, 0.5*cm))
    story.append(Paragraph(
        f'«____» ______________ {dt.year} р.',
        ParagraphStyle('date_sign', fontName=f, fontSize=10, alignment=TA_LEFT, leftIndent=6*cm)
    ))
    
    doc.build(story)
    sys.stdout.buffer.write(b"PDF generated OK\n")


# ─── CLI ─────────────────────────────────────────────────────
if __name__ == '__main__':
    # Режим 1: python generate_order.py <json_file.json> <output.pdf>
    if len(sys.argv) >= 3 and sys.argv[1].endswith('.json'):
        with open(sys.argv[1], 'r', encoding='utf-8') as f:
            data = json.load(f)
        generate_order_pdf(data, sys.argv[2])
        sys.exit(0)

    # Режим 2 (старий): python generate_order.py '<json_string>' <output.pdf>
    if len(sys.argv) >= 3:
        try:
            data = json.loads(sys.argv[1])
            generate_order_pdf(data, sys.argv[2])
            sys.exit(0)
        except json.JSONDecodeError:
            pass

    # Тестовий режим (без аргументів)
    test_data = {
        "date": "2026-01-27",
        "commander_rank": "Полковник",
        "commander_name": "Новіков М.М.",
        "institute_name": "Військового інституту телекомунікацій та інформатизації імені Героїв Крут",
        "duties": [
            {"duty_type": "Черговий КПП", "point": "1.4", "is_senior": False,
             "soldiers": [{"name": "Терещук М.М.", "rank": "Солдат", "group": "221"}]},
            {"duty_type": "Черговий гуртожитку", "point": "1.16", "is_senior": False,
             "soldiers": [{"name": "Дрига М.В.", "rank": "Сержант", "group": "221"}]},
        ],
        "fire_duties": [
            {"duty_type": "Пожежний наряд", "point": "2.2",
             "soldiers": [
                {"name": "Дубовик В.В.", "rank": "Молодший сержант", "group": "221"},
                {"name": "Харавюк О.В.", "rank": "Солдат", "group": "221"},
             ]}
        ],
        "day_duties": [
            {"duty_type": "Черговий навч. корпусу №1", "point": "3.1",
             "soldiers": [{"name": "Мазур С.В.", "rank": "Молодший сержант", "group": "222"}]},
        ]
    }
    generate_order_pdf(test_data, '/home/claude/test_order2.pdf')
    sys.stdout.buffer.write(b"Test PDF generated OK\n")