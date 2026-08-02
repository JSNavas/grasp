import math, os, subprocess

C = 64.0
R_OUT = 44.0
R_IN  = 25.5
GAP_A = -55.0

WT, WB = 48.0, 76.0
WR, WL = 122.0, 57.0
WBEV = 82.0
BLEED = 2.0

WINE_HI, WINE_LO = "#B4325A", "#78182F"
GRAY_HI, GRAY_LO = "#DDE2E8", "#9AA3AF"
BG = "#1B1D23"

def pt(deg, r):
    a = math.radians(deg)
    return (C + r * math.cos(a), C + r * math.sin(a))

def f(p):
    return f"{p[0]:.2f},{p[1]:.2f}"

GAP_B = math.degrees(math.asin((WB - C) / R_OUT)) - BLEED

o_a, o_b = pt(GAP_A, R_OUT), pt(GAP_B, R_OUT)
i_a, i_b = pt(GAP_A, R_IN),  pt(GAP_B, R_IN)
ring = (
    f"M {f(o_a)} "
    f"A {R_OUT} {R_OUT} 0 1 0 {f(o_b)} "
    f"L {f(i_b)} "
    f"A {R_IN} {R_IN} 0 1 1 {f(i_a)} Z"
)

wedge = f"M {WBEV},{WT} L {WR},{WT} L {WR},{WB} L {WL},{WB} Z"

DEFS = f"""  <defs>
    <linearGradient id="wine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{WINE_HI}"/><stop offset="1" stop-color="{WINE_LO}"/>
    </linearGradient>
    <linearGradient id="gray" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="{GRAY_HI}"/><stop offset="1" stop-color="{GRAY_LO}"/>
    </linearGradient>
    <!-- La cuna se dibuja mas larga de la cuenta y se recorta contra el disco,
         asi su borde derecho coincide exactamente con la silueta del anillo. -->
    <clipPath id="disc">
      <circle cx="{C}" cy="{C}" r="{R_OUT}"/>
    </clipPath>
  </defs>"""

def mark(bg=True):
    parts = []
    if bg:
        parts.append(f'  <rect width="128" height="128" rx="28" fill="{BG}"/>')
    parts.append(f'  <path d="{ring}" fill="url(#wine)"/>')
    parts.append(f'  <g clip-path="url(#disc)">')
    parts.append(f'    <path d="{wedge}" fill="url(#gray)"/>')
    parts.append(f'  </g>')
    return "\n".join(parts)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")
os.makedirs(OUT, exist_ok=True)

icon = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
{DEFS}
{mark(bg=True)}
</svg>
"""
bare = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
{DEFS}
{mark(bg=False)}
</svg>
"""

TB_DEFS = DEFS.replace(WINE_HI, "#D14A6E").replace(WINE_LO, "#A02547") \
              .replace(GRAY_HI, "#C6CDD6").replace(GRAY_LO, "#7E8794")
toolbar = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="14 14 100 100" width="128" height="128">
{TB_DEFS}
{mark(bg=False)}
</svg>
"""
logo = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 300" width="520" height="300">
{DEFS}
  <rect width="520" height="300" rx="0" fill="{BG}"/>
  <g transform="translate(196 46)">
{mark(bg=False)}
  </g>
  <text x="252" y="228" text-anchor="middle" fill="{GRAY_HI}"
        font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
        font-size="44" letter-spacing="16">Grasp</text>
  <text x="255" y="258" text-anchor="middle" fill="{GRAY_LO}" opacity="0.7"
        font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif"
        font-size="12" letter-spacing="5">BLOQUES SEMANTICOS</text>
</svg>
"""

for name, content in [("icon.svg", icon), ("mark.svg", bare), ("toolbar.svg", toolbar), ("logo.svg", logo)]:
    with open(f"{OUT}/{name}", "w") as fh:
        fh.write(content)

import cairosvg
PUB = os.path.join(ROOT, "public", "icons")
os.makedirs(PUB, exist_ok=True)
for size in (16, 32, 48, 128):
    cairosvg.svg2png(url=f"{OUT}/icon.svg", write_to=f"{PUB}/icon{size}.png",
                     output_width=size, output_height=size)
    cairosvg.svg2png(url=f"{OUT}/toolbar.svg", write_to=f"{PUB}/tb{size}.png",
                     output_width=size, output_height=size)
cairosvg.svg2png(url=f"{OUT}/logo.svg", write_to=f"{OUT}/logo.png",
                 output_width=1040, output_height=600)
print(subprocess.run(["ls", "-1", OUT], capture_output=True, text=True).stdout)
