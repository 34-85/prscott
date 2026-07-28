#!/usr/bin/env python3
"""One-time rebrand: 'Scenic City Scout' (product) -> 'Scenic City Insider'.
PRESERVES: the company 'Brief Scout Media', 'The Scout Guide' (competitor),
and the internal lowercase 'scout/scouts' verb + plural 'Scouts' (the finders)."""
import re, glob, sys

# Protect strings that must NOT change (tokenized out, restored at the end).
PROT = {
    "Brief Scout Media": "\x00P0\x00",
    "Brief_Scout_Media": "\x00P1\x00",
    "The Scout Guide":   "\x00P2\x00",
    "Scout Guide":       "\x00P3\x00",
    "Scout_Insights_Spec": "\x00P4\x00",  # output filename handled separately
}

def rebrand(text):
    for k, v in PROT.items():
        text = text.replace(k, v)
    # Ordered, specific product / sub-brand phrases first
    text = text.replace("Scenic City Scout", "Scenic City Insider")
    text = text.replace("Founding Scout", "Founding Insider")
    text = text.replace("Scout Council", "Insider Council")
    text = text.replace("Scout Card", "Insider Card")
    text = text.replace("Scout Insights", "Insider Insights")
    text = text.replace("Scout Insiders", "Insiders")          # onboarding panel
    text = text.replace("Scout's", "Insider's")                # product possessive
    # Remaining standalone singular capital "Scout" = the product.
    # \bScout\b does NOT match "Scouts" (plural finders) or "Scout_..." (underscore).
    text = re.sub(r"\bScout\b", "Insider", text)
    for k, v in PROT.items():
        text = text.replace(v, k)
    return text

files = sorted(set(glob.glob("/home/user/prscott/build_*.py")
                   + glob.glob("/home/user/prscott/scenic_city_scout_*.html")))
files = [f for f in files if not f.endswith("rebrand.py")]
changed = []
for f in files:
    with open(f, encoding="utf-8") as fh:
        src = fh.read()
    out = rebrand(src)
    if out != src:
        with open(f, "w", encoding="utf-8") as fh:
            fh.write(out)
        changed.append((f.split("/")[-1], src.count("Scout") - out.count("Scout")))
for name, delta in changed:
    print(f"  {name}: {delta} 'Scout'->'Insider' replacements")
print(f"Rebranded {len(changed)} files.")
