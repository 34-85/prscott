#!/usr/bin/env python3
"""Mise en Place (MeP) — positioning one-pager. The sponsored wine/beer/bourbon & table companion
to Scenic City Insider. Captures the pressure-test verdict, money model, sponsor map & guardrails."""
import os
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

WINE="6E2B39"; AMBER="B5722E"; HOPS="5E7444"; CREAM="FAF4E9"; INK="2A2420"; SLATE="6b5f53"; GREY="8a7f70"
doc=Document(); sec=doc.sections[0]
for m in ("top_margin","bottom_margin"): setattr(sec,m,Inches(0.7))
for m in ("left_margin","right_margin"): setattr(sec,m,Inches(0.85))
nm=doc.styles["Normal"]; nm.font.name="Georgia"; nm.font.size=Pt(10.3); nm.paragraph_format.space_after=Pt(6); nm.paragraph_format.line_spacing=1.16
def sca(r,h): r.font.color.rgb=RGBColor.from_string(h)
def shade(c,h):
    p=c._tc.get_or_add_tcPr(); s=OxmlElement("w:shd"); s.set(qn("w:val"),"clear"); s.set(qn("w:color"),"auto"); s.set(qn("w:fill"),h); p.append(s)
def ctext(c,t,bold=False,color=None,size=8.6,white=False,align="left"):
    c.text=""; p=c.paragraphs[0]; p.alignment={"left":WD_ALIGN_PARAGRAPH.LEFT,"center":WD_ALIGN_PARAGRAPH.CENTER}[align]
    for i,ch in enumerate(t.split("**")):
        if not ch: continue
        r=p.add_run(ch); r.font.size=Pt(size); r.font.bold=bold or (i%2==1)
        if white: r.font.color.rgb=RGBColor.from_string("FFFFFF")
        elif color: r.font.color.rgb=RGBColor.from_string(color)
def H(t,level=1,color=None):
    p=doc.add_paragraph(); p.paragraph_format.space_before=Pt(12 if level==1 else 7); p.paragraph_format.space_after=Pt(3)
    r=p.add_run(t); r.font.bold=True
    if level==1:
        r.font.size=Pt(14.5); sca(r,color or WINE)
        pPr=p._p.get_or_add_pPr(); b=OxmlElement("w:pBdr"); bt=OxmlElement("w:bottom")
        bt.set(qn("w:val"),"single"); bt.set(qn("w:sz"),"6"); bt.set(qn("w:space"),"2"); bt.set(qn("w:color"),AMBER); b.append(bt); pPr.append(b)
    else: r.font.size=Pt(11.5); sca(r,color or INK)
def P(t,italic=False,color=None,size=10.3):
    p=doc.add_paragraph(); p.paragraph_format.space_after=Pt(6)
    for i,ch in enumerate(t.split("**")):
        if not ch: continue
        r=p.add_run(ch); r.font.size=Pt(size); r.font.italic=italic
        if i%2==1: r.font.bold=True
        if color: sca(r,color)
def BUL(items,size=9.8):
    for it in items:
        p=doc.add_paragraph(style="List Bullet"); p.paragraph_format.space_after=Pt(3)
        for i,ch in enumerate(it.split("**")):
            if not ch: continue
            r=p.add_run(ch); r.font.size=Pt(size)
            if i%2==1: r.font.bold=True
def TABLE(headers,rows,widths,fontsize=8.6,hdr=WINE):
    t=doc.add_table(rows=1,cols=len(headers)); t.alignment=WD_TABLE_ALIGNMENT.CENTER; t.style="Table Grid"
    for i,h in enumerate(headers):
        shade(t.rows[0].cells[i],hdr); ctext(t.rows[0].cells[i],h,bold=True,white=True,size=fontsize+0.2)
    for r,row in enumerate(rows):
        cells=t.add_row().cells; base=CREAM if r%2==0 else "FFFFFF"
        for i,val in enumerate(row):
            ctext(cells[i],val,size=fontsize,color=INK if i==0 else None,bold=(i==0)); shade(cells[i],base)
    for i,w in enumerate(widths):
        for row in t.rows: row.cells[i].width=Inches(w)
    doc.add_paragraph().paragraph_format.space_after=Pt(2)

# Title
doc.add_paragraph()
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
r=p.add_run("Mise en Place"); r.font.size=Pt(34); r.font.bold=True; sca(r,WINE)
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
r=p.add_run("Chattanooga's wine, beer, bourbon & the table"); r.font.size=Pt(14); r.font.italic=True; sca(r,INK)
p=doc.add_paragraph(); p.alignment=WD_ALIGN_PARAGRAPH.CENTER
r=p.add_run("Positioning one-pager  ·  the openly-sponsored companion to Scenic City Insider  ·  project name “MeP” (pending name vetting)")
r.font.size=Pt(9); r.font.italic=True; sca(r,GREY)
doc.add_paragraph()

H("The verdict, and the pivot",1)
P("A pressure-test of the Chattanooga market says: **a general food newsletter is a weak bet** — that lane is already taken (Food as a Verb, the Times Free Press's paid 'What to Eat Next,' and NOOGAtoday's daily food coverage). But **drinks are wide open**: there is no dedicated local wine, beer, or bourbon publication, despite a city that genuinely loves all three. So MeP leads with **the glass and the table** — wine, beer, bourbon, and the food and hosting around them — not restaurant reviews. The market gap and the founder's real passion point at the same place.")
P("**The promise, true to the name:** everything in its place. The weekly that gets you ready to drink well, pair well, and host well — calm readiness for the good life at the table.",italic=True,color=SLATE)

H("The bright line with Scenic City Insider",1)
P("MeP sits **next to** SCI, never inside it. **SCI is the reader-funded soul** of the company — no ads, the reader is the customer. **MeP is the openly-sponsored, joyful passion title** — clearly labeled sponsors and ticketed events. Two mastheads, two honest models. SCI may mention a restaurant as part of knowing the city; MeP is the dedicated drinks-and-table obsession with events. Keep them distinct or both blur.")

H("Why it works here — three real advantages",1)
BUL([
 "**A structural sponsor moat: Tennessee bans liquor-store chains.** No Total Wine, no Costco wine — so the ~20–30 metro bottle shops are *all locally owned*, competing on curation, and need exactly this curated audience. Several already run tastings (Riverside, Imbibe, Kanku's). That anchor sponsor base wouldn't exist in a chain market.",
 "**A deep beer & bourbon scene** — 12–16 craft breweries plus Chattanooga Whiskey and Gate 11 distillery — widens the sponsor and event-partner base well beyond wine.",
 "**A vibrant, credentialed food scene** (4 Michelin nods; James Beard 2026 semifinalists Niedlov's & Calliope; a packed festival calendar) supplies endless 'where to drink well' content and event partners.",
])
P("And the multiplier: MeP is one of three surfaces of a single personal brand — **the book (authority), the podcast (reach + relationships), the newsletter (the hub that owns the list and monetizes it).** Every winemaker, brewer, and shop owner is a guest, a sponsor, and a story.")

H("The money model — three legs, in priority order",1)
TABLE(["Leg","What it is","Why / how it pays"],
[["1 · Events (the engine)","Ticketed tasting dinners, wine/whiskey classes, brewery & maker collaborations","Highest margin, most on-brand; partner with a bottle shop + chef who supply at cost or rev-share. Illustrative: a 24-seat dinner at ~$125 ≈ $3K gross."],
 ["2 · Sponsorship (recurring 2nd)","Presenting sponsor + category slots, anchored by bottle shops","~15–30 realistic local buyers at modest regional rates; bottle shops are the spine, with cookware, cheese, coffee, a distillery in support."],
 ["3 · The flywheel","Book + podcast feeding the newsletter","Authority, reach, and the relationships that become sponsors and event partners. The list is the owned asset."]],
[1.3,2.6,2.8],fontsize=8.5)
P("**Honest scale:** a lifestyle-scale business — a devoted few-thousand list, 15–30 modest sponsors, and **events as the real income.** Pure sponsorship alone rates Moderate; the blend (esp. events) rates Moderate-to-Strong.",italic=True,color=SLATE,size=9.8)

H("The sponsor & event-partner map",1)
TABLE(["Tier","Role","Who (real local examples)"],
[["Tier 1","Recurring cash sponsors","Bottle shops (Riverside, Imbibe, Kanku's, Northshore, East Brainerd) · distilleries (Chattanooga Whiskey, Gate 11) · cookware (Good Kinsmen, The Kitchen Collection) · Bleu Fox cheese · coffee roasters (Velo, Goodman) · Niedlov's"],
 ["Tier 2","Paid-event co-hosts","Breweries (Chattanooga Brewing, Hutton & Smith, Naked River…) · wineries (Lookout, Georgia Winery, Beans Creek) · cooking schools (PastaNooga, Sweet & Savory) · caterers/private chefs · festivals (SIPTN Wine Fest, Bacon & Barrel)"],
 ["Tier 3","Content / relationship partners","Farms & CSAs, Chattanooga Market & Main Street Farmers Market, Crabtree Farms, micro-makers — credibility & stories, not reliable cash"]],
[0.7,1.7,4.3],fontsize=8.3)

H("The weekly — content architecture",1)
TABLE(["Section","The point of view"],
[["The Pour","The wine, beer, or bourbon worth seeking this week — a pick or a theme, with a real reason"],
 ["The Shop / The Maker","The people behind the counter and the bottle — a featured bottle shop, brewer, distiller, or monger (the founder's 'got out of the house' joy)"],
 ["What's Pouring","Seasonal — what to drink now, and what's new on local shelves & taps"],
 ["The Table","The food halo — a pairing, a dish, or where to drink well (Michelin/Beard rooms)"],
 ["Host This","A hosting/pairing tip for entertaining — 'mise en place' made practical"],
 ["The Calendar","Upcoming tastings, dinners, releases & festivals — the events that also monetize"]],
[1.4,5.3],fontsize=8.6)

H("Guardrails",1)
BUL([
 "**Alcohol advertising is regulated (TABC).** Good news: the rules **explicitly permit email-list promotion** by wine/spirits retailers — favorable for the bottle-shop model. Cautions: keep **manufacturer (brewery/distillery) money separate from retailer (bottle-shop) slots** (tied-house rules); host tastings **through the licensed partner** so the license sits with them. A short TN-attorney check before launch.",
 "**Don't drift back to general food.** The moment MeP becomes 'another Chattanooga food newsletter,' it's the weakest of four. Drinks-and-table, with food as the halo.",
 "**Small-market ceiling** — lean on the events margin, not premium ad rates.",
 "**Name vetting** — 'Mise en Place' is a common culinary term (catering/meal-prep businesses use it). Run the same domain + USPTO/TESS pass we used for SCI before committing; 'MeP' is a working name only.",
])

out="/home/user/prscott/Mise_en_Place_One_Pager.docx"
doc.save(out); print("saved",out)
