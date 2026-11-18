#!/usr/bin/env python3
"""Build content/learning-profile-v1/grammar-items.json from grammar_items_source.py and check every item.
usage: build_grammar_items.py --out <data dir>"""
import argparse, json, os, sys
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import grammar_items_source as G
from grammar_detect import detect
import tag_source as T

ap = argparse.ArgumentParser(); ap.add_argument("--out", required=True); a = ap.parse_args()
gm = json.load(open(os.path.join(a.out, "grammar-map.json"), encoding="utf-8"))
v1 = {n["id"] for n in gm["nodes"] if n["v1"]}
errors, items = [], []
for (sid, target, form, topic, sub, ctx_zh, stem, opts, en, zh, explain) in G.ITEMS:
    iid = "g:" + sid
    e = lambda m: errors.append(f"{iid}: {m}")
    if target not in v1: e("target not v1")
    if form not in G.FORM: e("bad form")
    if topic not in T.TOPICS or (sub not in T.TOPICS[topic]["sub"] and sub != "general"): e("bad topic")
    if stem.count("___") != 1: e("stem needs exactly one ___")
    if len(opts) != 3 or len(set(o.lower() for o in opts)) != 3: e("need 3 different options")
    if stem.replace("___", opts[0]) != en: e(f"stem+answer != en: {stem.replace('___', opts[0])!r}")
    for o in opts[1:]:
        if stem.replace("___", o) == en: e("distractor yields the answer sentence")
    tags = [t.rstrip("?") for t in detect(en)["tags"]]
    if target != "tense:present-simple" and target not in tags: e(f"detector does not see {target} in en ({tags})")
    if G.FORM[form] and G.FORM[form] not in tags: e(f"detector does not see {G.FORM[form]} ({tags})")
    for o in opts[1:]:
        if target in detect(stem.replace("___", o))["tags"] and target != "tense:present-simple" and form == "aff":
            pass  # wrong-form distractors may still contain the target pattern (e.g. agreement errors); answer key decides
    items.append({"id": iid, "qtype": "grammar:form-choice", "target": target, "form": G.FORM[form],
                  "topics": [{"topic": topic, "sub": sub}], "ctx": f"grammar:{topic}/{sub}",
                  "situation": ctx_zh, "stem": stem, "answer": opts[0], "options": opts, "en": en, "zh": zh, "explain": explain,
                  "reviewStatus": "reviewed", "reviewer": "external-ai"})
c_t = Counter(i["target"] for i in items); c_f = Counter((i["target"], i["form"]) for i in items); c_topic = Counter(i["topics"][0]["topic"] for i in items)
for t in v1:
    if c_t[t] < 12: errors.append(f"{t}: only {c_t[t]} items")
    for f in G.FORM.values():
        if not c_f[(t, f)]: errors.append(f"{t}: no {f} item")
ids = [i["id"] for i in items]
if len(set(ids)) != len(ids): errors.append("duplicate ids")
meta = {"schemaVersion": 1, "version": "lp-v1-batch02", "task": "LEARNING-PROFILE-01", "reviewer": "external-ai", "status": "ai-edited-not-teacher-reviewed",
        "note": "文法形式選擇題（grammar:form-choice）。三個選項只差在文法形式，只有一個正確；options[0] 是正解，出題時請打亂順序。作答前不要顯示時態名稱（會洩漏答案）；作答後再顯示 explain。ctx 建議用 grammar:<主題>/<次主題>，讓跨情境門檻可以計算。",
        "counts": {"items": len(items), "byTarget": dict(c_t), "byTopic": dict(c_topic),
                   "byForm": dict(Counter(str(i["form"]) for i in items))}}
json.dump({**meta, "items": items}, open(os.path.join(a.out, "grammar-items.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(json.dumps(meta["counts"], ensure_ascii=False))
for x in errors: print("ERROR", x)
sys.exit(1 if errors else 0)
