"""Deterministic assignment fixtures; no student data or mascot assets."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

folder = Path(__file__).parent / 'fixtures' / 'phase-4'
folder.mkdir(parents=True, exist_ok=True)
lines = [
    'OHMI TEST ASSIGNMENT: Arduino LED Blink',
    'Use one Arduino Uno, one breadboard, one red LED,',
    'one 220 ohm resistor, and jumper wires.',
    'LED forward voltage: 2 V. Maximum LED current: 20 mA.',
    'Arduino digital pin 9 uses 5 V logic.',
    'Connect D9 through the resistor to LED anode.',
    'Connect LED cathode to Arduino GND.',
    'Program the LED to turn on for 1 second, then off',
    'for 1 second, repeatedly. Explain why the resistor',
    'is in series. Expected result: visible blinking.',
    'This is a fictional assignment, not a tested circuit.',
]
pdf = canvas.Canvas(str(folder / 'led-lab.pdf'), pagesize=A4)
pdf.setTitle('OHMI fictional LED assignment')
for index, line in enumerate(lines):
    pdf.setFont('Helvetica', 12)
    pdf.drawString(40, 790 - index * 25, line)
pdf.save()
image = Image.new('RGB', (1100, 760), 'white')
draw = ImageDraw.Draw(image)
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 24)
for index, line in enumerate(lines):
    draw.text((30, 25 + index * 36), line, fill='#183434', font=font)
draw.text((30, 460), 'Assignment connection diagram:', fill='#183434', font=font)
draw.line([(110, 570), (300, 570)], fill='#075d57', width=5)
draw.rectangle((300, 545, 440, 595), outline='#075d57', width=4)
draw.line([(440, 570), (620, 570)], fill='#075d57', width=5)
draw.ellipse((620, 540, 680, 600), outline='#b22222', width=4)
draw.line([(680, 570), (940, 570)], fill='#075d57', width=5)
for x, label in [(65, 'D9'), (300, '220 ohm'), (610, 'LED'), (925, 'GND')]:
    draw.text((x, 620), label, fill='#183434', font=font)
draw.text((30, 680), 'D9 -> resistor -> LED anode; LED cathode -> GND', fill='#183434', font=font)
image.save(folder / 'led-lab.png')
image.save(folder / 'led-lab.jpg', quality=95)
print('Created three fictional assignment fixtures: PDF, PNG, JPEG.')
