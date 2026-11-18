#!/usr/bin/env python3
"""Consistency checks for content/learning-profile-v1 (read only). usage: validate_data.py <data dir> [--out validation.json]"""
import json, os, sys

d = sys.argv[1]
J = lambda f: json.load(open(os.path.join(d, f), encoding="utf-8"))
gm, tm, qt, tags = J("grammar-map.json"), J("topic-map.json"), J("question-types.json"), J("item-tags.json")
errors, warnings = [], []
gids = {n["id"] for n in gm["nodes"]} | {f["id"] for f in gm["forms"]} | {s["id"] for s in gm["support"]}
# grammar map
v1 = [n["id"] for n in gm["nodes"] if n["v1"]]
if sorted(v1) != sorted(["tense:present-simple", "tense:present-continuous", "tense:past-simple", "tense:going-to", "tense:will"]):
    errors.append(f"v1 tenses: {v1}")
times = {n["time"] for n in gm["nodes"]}
if times != {"present", "past", "future"}:
    errors.append(f"timeframes {times}")
orders = [n["order"] for n in gm["nodes"]]
if len(set(orders)) != len(orders):
    errors.append("duplicate order")
byid = {n["id"]: n for n in gm["nodes"]}
for n in gm["nodes"]:
    for p in n["prereq"]:
        if p not in byid:
            errors.append(f"{n['id']}: unknown prereq {p}")
        elif byid[p]["order"] >= n["order"]:
            errors.append(f"{n['id']}: prereq {p} comes later in order")
    for f in ("affirmative", "negative", "yes-no-question", "wh-question"):
        if not n["forms"].get(f):
            errors.append(f"{n['id']}: form {f} missing")
# topics
subs = {(t, s) for t, v in tm["topics"].items() for s in v["sub"]} | {(t, "general") for t in tm["topics"]} | {(t, "unassigned") for t in tm["topics"]}
want = {"food": {"ingredients", "ordering", "cooking", "dietary"}, "travel": {"airport", "customs", "lodging", "directions", "transport"},
        "meeting": {"scheduling", "opening", "opinions", "confirming", "actions"}, "work": {"negotiation"}}
for t, s in want.items():
    if set(tm["topics"][t]["sub"]) != s:
        errors.append(f"{t} subtopics differ: {set(tm['topics'][t]['sub'])}")
for c in tm["contexts"]:
    if c["topic"] and (c["topic"], c["sub"]) not in subs:
        errors.append(f"context {c['ctx']} → unknown {c['topic']}/{c['sub']}")
# question types
chans = set(qt["channels"])
for k, v in qt["types"].items():
    if v["channel"] not in chans:
        errors.append(f"qtype {k}: channel {v['channel']}")
    if v["tests"].startswith("vocab") and v["grammarEvidence"] != "none":
        errors.append(f"qtype {k}: vocabulary question claims grammar evidence")
    if k == "life:context-blank" and (v["tests"] != "situational-vocab" or v["grammarEvidence"] != "none"):
        errors.append("life:context-blank must be situational-vocab without grammar evidence (decision 3)")
    if k == "sent:order" and v["grammarEvidence"] != "form-only":
        errors.append("sent:order must be form-only")
# items
NEG = {"Could you lower the price a little?", "That's a little over our budget.", "What if we order a larger quantity?", "Can you deliver by the end of the month?",
       "I need to check with my manager.", "I think we have a deal.", "Let's put it in writing."}
ids = [i["id"] for i in tags["items"]]
if len(ids) != len(set(ids)):
    errors.append("duplicate item ids")
nrev = 0
for i in tags["items"]:
    if not (i["id"].startswith("s:") or i["id"].startswith("w:")):
        errors.append(f"bad id {i['id']}")
    if i["kind"] == "sentence" and i["id"] != "s:" + i["en"]:
        errors.append(f"id/en mismatch {i['id']}")
    for t in i["topics"]:
        if (t["topic"], t["sub"]) not in subs:
            errors.append(f"{i['id']}: unknown topic {t}")
        if t.get("role") not in ("primary", "secondary"):
            errors.append(f"{i['id']}: topic role must be primary|secondary")
    tps = [t["topic"] for t in i["topics"]]
    if len(tps) != len(set(tps)):
        errors.append(f"{i['id']}: more than one subtopic in the same topic (would double count)")
    if i["topics"] and sum(1 for t in i["topics"] if t.get("role") == "primary") != 1:
        errors.append(f"{i['id']}: needs exactly one primary topic")
    if i["kind"] == "sentence" and i["en"] in NEG and not any(t["topic"] == "work" and t["sub"] == "negotiation" and t["role"] == "primary" for t in i["topics"]):
        errors.append(f"{i['id']}: negotiation sentence must be filed under work/negotiation (decision 2)")
    for g in i["grammar"]["contains"]:
        if g not in gids and not g.startswith("form:other"):
            (errors if i["grammar"]["tagStatus"] == "reviewed" else warnings).append(f"{i['id']}: unknown grammar {g}")
    if i["kind"] == "sentence" and i["topics"] and i["grammar"]["tagStatus"] != "reviewed":
        errors.append(f"{i['id']}: topic sentence without reviewed grammar")
    nrev += i["grammar"]["tagStatus"] == "reviewed"
gi = os.path.join(d, "grammar-items.json")
ngi = 0
if os.path.exists(gi):
    G = json.load(open(gi, encoding="utf-8"))["items"]
    ngi = len(G)
    for g in G:
        tag = g["id"]
        if g["target"] not in v1: errors.append(f"{tag}: target not v1")
        if g["form"] is not None and g["form"] not in gids: errors.append(f"{tag}: bad form")
        if g["answer"] not in g["options"] or len(set(g["options"])) != 3: errors.append(f"{tag}: options")
        if g["stem"].count("___") != 1 or g["stem"].replace("___", g["answer"]) != g["en"]: errors.append(f"{tag}: stem/answer/en mismatch")
        if g["qtype"] not in qt["types"] or qt["types"][g["qtype"]]["grammarEvidence"] != "target": errors.append(f"{tag}: qtype")
        for t in g["topics"]:
            if (t["topic"], t["sub"]) not in subs: errors.append(f"{tag}: topic {t}")
    for t in v1:
        if sum(1 for g in G if g["target"] == t) < 5: errors.append(f"{t}: fewer than 5 grammar items (cannot reach the evidence minimum)")
out = {"validator": "validate_data.py (LEARNING-PROFILE-01)", "pass": not errors, "errors": errors, "warnings": warnings[:50],
       "warningCount": len(warnings),
       "counts": {"grammarNodes": len(gm["nodes"]), "v1": v1, "forms": len(gm["forms"]), "support": len(gm["support"]),
                  "topics": {t: len(v["sub"]) for t, v in tm["topics"].items()}, "contexts": len(tm["contexts"]),
                  "questionTypes": len(qt["types"]), "items": len(ids), "sentencesReviewed": nrev, "grammarItems": ngi}}
if "--out" in sys.argv:
    json.dump(out, open(sys.argv[sys.argv.index("--out") + 1], "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps({k: out[k] for k in ("pass", "counts", "warningCount")}, ensure_ascii=False))
for e in errors[:30]:
    print("ERROR", e)
sys.exit(1 if errors else 0)
