#!/usr/bin/env python3
"""B-WORDS3000-01：3,000 詞校對合併與驗證工具（只讀種子包，輸出到 reviewed/）。

  python3 words3000.py dump     --seed <種子包根> --from 1 --to 300          # 列出待校對詞（給人／AI 校對）
  python3 words3000.py build    --seed <種子包根> --reviews reviews/ --out <輸出資料夾>
        → words-reviewed.json（累加，只含已校對且通過驗證的詞）、validation.json、issues.json、changes.json

校對檔 reviews/batch-NN.tsv，每行一詞（# 開頭為註解），Tab 分隔 9 欄：
  word  pos  zh  topic  learningBand  example_en  example_zh  status  note
  - word：草稿中的詞；若要換詞寫「新詞<舊詞」（例如 hello<thee），舊詞從清單移除、新詞 id 為 word:新詞、source 標 editorial。
  - status：reviewed（本輪 AI 教學檢查通過）／needs-review（不確定，不計入可用數）／drop（移除且不補，會列入 issues）。
  - 原 80 詞（legacy）：zh／KK／音檔／ID／難度一律沿用原遊戲 data/words.json，校對檔只提供 pos、topic、例句；即使填了 zh 也不覆蓋。
"""
import argparse, collections, csv, glob, json, os, re, sys

POS = {"noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "article", "determiner", "interjection", "number", "modal", "auxiliary"}
TOPICS = {"core", "home", "food", "travel", "work", "school", "health", "nature", "social", "technology", "arts"}
SIMPLIFIED = set("这个们来时说对会过还点开关门问间么没发经现实与东车长书买卖题网边乐气电话见读听写钱让爱样头")
REVIEWER = "external-ai"


def load_seed(seed):
    d = json.load(open(os.path.join(seed, "content/core-3000/words-3000.draft.json"), encoding="utf-8"))
    game = {w["word"]: w for w in json.load(open(os.path.join(seed, "data/words.json"), encoding="utf-8"))}
    return d["words"], game


def cmd_dump(a):
    words, game = load_seed(a.seed)
    rows = sorted((w for w in words if a.frm <= w["selectionOrder"] <= a.to), key=lambda w: w["selectionOrder"])
    for w in rows:
        f = ",".join(f"{k}:{v}" for k, v in (w.get("forms") or {}).items())
        leg = "LEGACY " + game[w["word"]]["zh"] + f" L{game[w['word']]['level']}" if w["source"] == "existing-game" else ""
        print(f"{w['selectionOrder']}\t{w['word']}\t{w['pos']}\t{w['zh'][:60]}\t{f}\t{leg}")


def forms_of(word, forms):
    """目標詞可接受的詞形：草稿的詞形＋規則變化（只用來確認例句有用到目標詞，不拿來湊詞數）。"""
    w = word.lower()
    out = {w}
    for v in (forms or {}).values():
        for x in str(v).split("/"):
            if x and x.isalpha():
                out.add(x.lower())
    stem_e = w[:-1] if w.endswith("e") else w
    out |= {w + "s", w + "es", w + "ed", w + "d", w + "ing", stem_e + "ing", w + "er", w + "est", w + "ly", w + "'s"}
    if w.endswith("y") and len(w) > 2:
        out |= {w[:-1] + "ies", w[:-1] + "ied", w[:-1] + "ier", w[:-1] + "iest", w[:-1] + "ily"}
    if re.match(r".*[^aeiou][aeiou][bdgklmnprt]$", w):
        out |= {w + w[-1] + "ed", w + w[-1] + "ing", w + w[-1] + "er"}
    irregular = {"be": "am is are was were been being", "have": "has had having", "do": "does did done doing", "go": "goes went gone going",
                 "i": "me my mine", "he": "him his", "she": "her hers", "we": "us our ours", "they": "them their theirs", "you": "your yours",
                 "a": "an", "can": "cannot can't", "will": "won't 'll", "not": "n't"}
    out |= set(irregular.get(w, "").split())
    return out


def tokens(s):
    return re.findall(r"[a-z]+(?:'[a-z]+)?", s.lower().replace("’", "'"))


def read_reviews(path):
    rows = []
    for f in sorted(glob.glob(os.path.join(path, "*.tsv"))):
        for n, line in enumerate(open(f, encoding="utf-8"), 1):
            if not line.strip() or line.startswith("#"):
                continue
            p = line.rstrip("\n").split("\t")
            if len(p) < 8:
                rows.append({"_err": f"{os.path.basename(f)}:{n} 欄位不足（{len(p)}）", "_raw": line.strip()})
                continue
            p += [""] * (9 - len(p))
            rows.append({"word": p[0].strip(), "pos": p[1].strip(), "zh": p[2].strip(), "topic": p[3].strip(), "band": p[4].strip(),
                         "en": p[5].strip(), "exzh": p[6].strip(), "status": p[7].strip(), "note": p[8].strip(), "_file": f"{os.path.basename(f)}:{n}"})
    return rows


def cmd_build(a):
    words, game = load_seed(a.seed)
    by_word = {w["word"].lower(): w for w in words}
    reviews = read_reviews(a.reviews)
    out, issues, changes = [], [], []
    seen, reviewed_ids = set(), set()
    fail = collections.Counter()

    def issue(kind, word, msg, file=""):
        issues.append({"type": kind, "word": word, "detail": msg, "where": file})

    for r in reviews:
        if "_err" in r:
            issue("format", None, r["_err"] + "：" + r["_raw"][:80])
            continue
        new, _, old = r["word"].partition("<")
        new, old = new.strip(), old.strip()
        base = by_word.get((old or new).lower())
        if base is None:
            issue("unknown-word", r["word"], "草稿中沒有這個詞", r["_file"])
            continue
        if (old or new).lower() in reviewed_ids:
            issue("duplicate-review", r["word"], "同一詞校對了兩次，採第一筆", r["_file"])
            continue
        reviewed_ids.add((old or new).lower())
        if r["status"] == "drop":
            issue("dropped", base["word"], r["note"] or "移除", r["_file"])
            changes.append({"action": "drop", "word": base["word"], "reason": r["note"]})
            continue
        legacy = base["source"] == "existing-game"
        if old and legacy:
            issue("legacy-replace-refused", r["word"], "原 80 詞不可替換", r["_file"])
            continue
        if old and new.lower() in by_word:
            issue("replace-collides", r["word"], f"替換詞 {new} 已在清單中，會造成重複", r["_file"])
            continue
        word = new if old else base["word"]
        entry = {
            "id": base["id"] if not old else "word:" + word.lower(),
            "word": word,
            "zh": game[base["word"]]["zh"] if legacy else r["zh"],
            "pos": r["pos"],
            "topic": r["topic"],
            "learningBand": int(game[base["word"]]["level"]) if legacy else (int(r["band"]) if r["band"].isdigit() else None),
            "reviewStatus": "reviewed" if r["status"] == "reviewed" else "needs-review",
            "reviewer": REVIEWER,
            "source": "existing-game" if legacy else ("editorial" if old else "ECDICT-MIT+editorial-review"),
            "kk": game[base["word"]].get("kk") if legacy else None,
            "audio": (game[base["word"]].get("audio") or "") if legacy else "",
            "image": (game[base["word"]].get("image") or "") if legacy else "",
            "example": {"en": r["en"], "zh": r["exzh"]},
            "selectionOrder": base["selectionOrder"],
        }
        if not old and not legacy:
            entry["phoneticSource"] = base.get("phoneticSource")
            entry["forms"] = base.get("forms") or {}
            entry["draftZh"] = base["zh"]
        if legacy and r["zh"] and r["zh"] != game[base["word"]]["zh"]:
            issue("legacy-zh-kept", word, f"原遊戲詞義「{game[base['word']]['zh']}」保留；校對建議「{r['zh']}」未套用", r["_file"])
        if legacy and base["zh"] != game[base["word"]]["zh"]:
            entry["draftZh"] = base["zh"]
        if old:
            entry["replaces"] = base["word"]
            changes.append({"action": "replace", "from": base["word"], "to": word, "reason": r["note"]})
        elif not legacy and r["zh"] != base["zh"]:
            changes.append({"action": "zh", "word": word, "from": base["zh"], "to": r["zh"]})
        if r["note"]:
            entry["reviewNote"] = r["note"]

        # ---------- 驗證 ----------
        errs = []
        if word.lower() in seen:
            errs.append("lemma 重複")
        if not entry["zh"] or not re.search(r"[一-鿿]", entry["zh"]):
            errs.append("zh 空白或不是中文")
        if len([x for x in re.split(r"[；;]", entry["zh"]) if x.strip()]) > 3:
            errs.append("zh 超過 3 個義項")
        if len(entry["zh"]) > 30:
            errs.append("zh 太長（>30 字）")
        if any(c in SIMPLIFIED for c in entry["zh"] + entry["example"]["zh"]):
            errs.append("疑似簡體字")
        if not entry["pos"] or any(p not in POS for p in entry["pos"].split(",")):
            errs.append(f"詞性不在清單：{entry['pos']}")
        if entry["topic"] not in TOPICS:
            errs.append(f"topic 不在清單：{entry['topic']}")
        if entry["learningBand"] not in (1, 2, 3, 4):
            errs.append("learningBand 不是 1–4")
        en, ez = entry["example"]["en"], entry["example"]["zh"]
        if not en or not re.search(r"[.?!]$", en) or not en[0].isupper():
            errs.append("英文例句不完整（大寫開頭、標點結尾）")
        if not ez or not re.search(r"[一-鿿]", ez):
            errs.append("中文例句空白")
        fs = forms_of(word, entry.get("forms"))
        if en and not (set(tokens(en)) & fs) and word.lower() not in en.lower():
            errs.append("例句沒有用到目標詞或其詞形")
        if entry["kk"] is not None and not legacy:
            errs.append("非原 80 詞不可填 KK")
        if errs:
            for e in errs:
                fail[e.split("：")[0]] += 1
            issue("validation", word, "；".join(errs), r["_file"])
            entry["reviewStatus"] = "needs-review"
            entry["validationErrors"] = errs
        if entry["reviewStatus"] == "needs-review" and not errs:
            issue("needs-review", word, r["note"] or "校對者標為不確定", r["_file"])
        seen.add(word.lower())
        out.append(entry)

    # 例句模板偵測：把目標詞換成 ___，同一骨架出現 3 次以上視為套模板
    skel = collections.defaultdict(list)
    for e in out:
        s = re.sub(r"\b(" + "|".join(re.escape(f) for f in forms_of(e["word"], e.get("forms"))) + r")\b", "___", e["example"]["en"].lower())
        skel[s].append(e["word"])
    for s, ws in skel.items():
        if len(ws) >= 3:
            for w in ws:
                issue("template-example", w, f"例句骨架重複 {len(ws)} 次：{s}")
    dup_en = [k for k, v in collections.Counter(e["example"]["en"].lower() for e in out).items() if v > 1]
    for d in dup_en:
        issue("duplicate-example", None, d)

    usable = [e for e in out if e["reviewStatus"] == "reviewed"]
    usable.sort(key=lambda e: e["selectionOrder"])
    os.makedirs(a.out, exist_ok=True)
    doc = {"schemaVersion": 1, "reviewer": REVIEWER, "count": len(usable), "status": "batch-delivery-ai-reviewed-not-teacher-reviewed",
           "note": "reviewed = 本輪外部 AI 教學檢查，不是真人教師審核。learningBand 是編輯學習級別 1–4，不是 CEFR／TOEIC。kk 只有原 80 詞有值。",
           "words": usable}
    json.dump(doc, open(os.path.join(a.out, "words-reviewed.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    pending = [e for e in out if e["reviewStatus"] != "reviewed"]
    json.dump({"schemaVersion": 1, "count": len(pending), "words": pending}, open(os.path.join(a.out, "words-needs-review.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"count": len(issues), "byType": collections.Counter(i["type"] for i in issues), "issues": issues},
              open(os.path.join(a.out, "issues.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    json.dump({"count": len(changes), "changes": changes}, open(os.path.join(a.out, "changes.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    allw = [e["word"].lower() for e in out]
    val = {
        "seedWords": len(words), "reviewedRows": len(reviews), "entriesBuilt": len(out), "usableReviewed": len(usable), "needsReview": len(pending),
        "dropped": sum(1 for c in changes if c["action"] == "drop"), "replaced": sum(1 for c in changes if c["action"] == "replace"),
        "uniqueLemmas": len(set(allw)) == len(allw), "legacyIncluded": sum(1 for e in out if e["source"] == "existing-game"),
        "legacyPreserved": all(e["zh"] == game[e["word"]]["zh"] and e["kk"] == game[e["word"]].get("kk") and e["id"] == "word:" + e["word"]
                               for e in out if e["source"] == "existing-game"),
        "topics": collections.Counter(e["topic"] for e in usable), "bands": collections.Counter(e["learningBand"] for e in usable),
        "pos": collections.Counter(p for e in usable for p in e["pos"].split(",")),
        "failuresByRule": fail, "templateExampleFlags": sum(1 for i in issues if i["type"] == "template-example"),
        "duplicateExamples": len(dup_en), "remainingUnreviewed": len(words) - len(reviewed_ids),
    }
    json.dump(val, open(os.path.join(a.out, "validation.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(json.dumps(val, ensure_ascii=False))


def main():
    ap = argparse.ArgumentParser()
    sp = ap.add_subparsers(dest="cmd", required=True)
    d = sp.add_parser("dump"); d.add_argument("--seed", required=True); d.add_argument("--from", dest="frm", type=int, default=1); d.add_argument("--to", type=int, default=300)
    b = sp.add_parser("build"); b.add_argument("--seed", required=True); b.add_argument("--reviews", required=True); b.add_argument("--out", required=True)
    a = ap.parse_args()
    {"dump": cmd_dump, "build": cmd_build}[a.cmd](a)


if __name__ == "__main__":
    main()
