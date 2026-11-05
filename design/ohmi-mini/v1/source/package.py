"""Package vector renders, inspect export properties, and build visual proof sheets."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
import json, math, hashlib, zipfile

ROOT = Path(__file__).resolve().parent.parent
FONT = Path('C:/Windows/Fonts/segoeui.ttf')
def font(size): return ImageFont.truetype(str(FONT), size)
records = json.loads((ROOT/'source/exports.json').read_text())
checks=[]
for record in records:
    p=ROOT/record['file']
    im=Image.open(p)
    assert im.size == (record['size'],record['size'])
    if not record['transparent']:
        # Apple marketing PNG: genuinely RGB, not an opaque RGBA container.
        im.convert('RGBA' if 'google-play-' in p.name else 'RGB').save(p)
    else:
        assert im.mode=='RGBA' and im.getextrema()[3][0]==0
    checks.append({'file':record['file'],'size':im.size,'mode':Image.open(p).mode,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})

for theme in ['light','dark']:
    frames=[Image.open(ROOT/f'favicon/favicon-{theme}-{s}.png').convert('RGBA') for s in [16,32,48]]
    # Append actual optical masters rather than letting Pillow rescale one frame.
    frames[2].save(ROOT/f'favicon/favicon-{theme}.ico',format='ICO',sizes=[(16,16),(32,32),(48,48)],append_images=frames[:2])
    ico=Image.open(ROOT/f'favicon/favicon-{theme}.ico')
    assert ico.ico.sizes()=={(16,16),(32,32),(48,48)}
    for size,expected in zip([16,32,48],frames):
        assert ImageChops.difference(ico.ico.getimage((size,size)).convert('RGBA'),expected).getbbox() is None
    for size in [192,512]:
        im=Image.open(ROOT/f'pwa/maskable-{theme}-{size}.png').convert('RGB')
        background=im.getpixel((0,0))
        radii=[math.hypot(x+.5-size/2,y+.5-size/2) for y in range(size) for x in range(size) if im.getpixel((x,y))!=background]
        radius=max(radii)/size
        assert radius < .4, radius
        checks.append({'file':f'pwa/maskable-{theme}-{size}.png','max_art_radius_fraction':round(radius,5),'safe_radius_fraction':.4})

# Human review proof: every PNG at its real size, with downsampled large images.
sheet=Image.new('RGB',(1200,1480),'#F7F8F4'); d=ImageDraw.Draw(sheet)
d.text((48,28),'OHMI Mini',font=font(34),fill='#203E3A')
d.text((48,78),'Vector identity / light + dark / export proof',font=font(18),fill='#53746D')
for col,theme in enumerate(['light','dark']):
    x=48+col*590
    for row,folder in enumerate(['app','logo']):
        p=ROOT/f'{folder}/ohmi-mini-{theme}-1024.png'
        im=Image.open(p).convert('RGBA'); im.thumbnail((300,300),Image.Resampling.LANCZOS)
        bg=Image.new('RGBA',(300,300),'#E4F0E9' if theme=='light' else '#152E2B');bg.alpha_composite(im)
        sheet.paste(bg.convert('RGB'),(x,130+row*350))
        d.text((x,438+row*350),f'{theme} / {"full bleed" if folder=="app" else "transparent logo"}',font=font(16),fill='#203E3A')
    y=850
    d.text((x,y),'Favicons: native pixels / 4x nearest-neighbor',font=font(16),fill='#203E3A')
    for i,s in enumerate([16,32,48]):
        im=Image.open(ROOT/f'favicon/favicon-{theme}-{s}.png')
        xx=x+i*160
        backing=Image.new('RGBA',im.size,'#FFFFFF' if theme=='light' else '#152E2B');backing.alpha_composite(im)
        sheet.paste(backing.convert('RGB'),(xx,y+34))
        enlarged=backing.resize((s*4,s*4),Image.Resampling.NEAREST)
        sheet.paste(enlarged.convert('RGB'),(xx,y+100))
        d.text((xx,y+300),f'{s}px / 4x',font=font(14),fill='#203E3A')
    # Circle masking is preview only. Exports always remain full square.
    im=Image.open(ROOT/f'pwa/maskable-{theme}-192.png').convert('RGB')
    mask=Image.new('L',(192,192));ImageDraw.Draw(mask).ellipse((0,0,191,191),fill=255)
    sheet.paste(im,(x,1230),mask)
    d.text((x+210,1290),'Maskable / circle crop',font=font(15),fill='#203E3A')
sheet.save(ROOT/'preview/export-proof.png')

hero=Image.new('RGB',(1200,720),'#F7F8F4');d=ImageDraw.Draw(hero)
d.text((60,40),'OHMI Mini',font=font(32),fill='#203E3A')
d.text((60,88),'Your circuit buddy. A little simpler.',font=font(18),fill='#53746D')
for x,theme in [(100,'light'),(660,'dark')]:
    im=Image.open(ROOT/f'app/ohmi-mini-{theme}-1024.png').resize((440,440),Image.Resampling.LANCZOS)
    mask=Image.new('L',(440,440));ImageDraw.Draw(mask).rounded_rectangle((0,0,439,439),radius=94,fill=255)
    hero.paste(im,(x,170),mask)
    d.text((x,634),f'{theme.capitalize()} appearance',font=font(18),fill='#203E3A')
hero.save(ROOT/'preview/ohmi-mini-presentation.png')
grid=Image.new('RGB',(1200,1500),'#F7F8F4');gd=ImageDraw.Draw(grid)
gd.text((28,20),'Every PNG export / native small sizes, large images fit to 150px',font=font(21),fill='#203E3A')
for i,record in enumerate(records):
    x=28+(i%4)*296;y=90+(i//4)*230
    im=Image.open(ROOT/record['file']).convert('RGBA');im.thumbnail((150,150),Image.Resampling.LANCZOS)
    tile=Image.new('RGBA',im.size,'#152E2B' if '-dark-' in record['file'] else '#FFFFFF');tile.alpha_composite(im)
    grid.paste(tile.convert('RGB'),(x,y))
    gd.text((x,y+160),Path(record['file']).name,font=font(12),fill='#203E3A')
    gd.text((x,y+180),f"{record['size']} x {record['size']}",font=font(12),fill='#53746D')
grid.save(ROOT/'preview/all-png-exports.png')
(ROOT/'source/validation.json').write_text(json.dumps({'renderer':'Chromium SVG to canvas; native size renders','checks':checks,'ico_frames':[16,32,48],'status':'passed'},indent=2)+'\n')
print(f'Validated {len(records)} PNG exports, two multi-frame ICO files, and four maskable safe zones.')
