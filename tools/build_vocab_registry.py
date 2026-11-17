"""Merge actually reviewed batches, keeping all original 80 word records intact.

This validates an editorial handoff; it does not label dictionary drafts reviewed.
The output count is the number of usable unique records, never the target 3000.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOPICS = {"core", "home", "food", "travel", "work", "school", "health", "nature", "social", "technology", "arts"}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("batches", nargs="*", type=Path)
    args = parser.parse_args()
    if not args.batches:
        supplement = ROOT / "content/core-3000/reviewed-batches/coordinator-approved.json"
        candidates = [ROOT / "content/core-3000/reviewed/words-reviewed.json", supplement,
                      ROOT / "content/core-3000/audit/reviewed-first300.json",
                      *sorted((ROOT / "content/core-3000/reviewed-batches").glob("batch-*.json"))]
        args.batches = [p for p in candidates if p.exists()]
        delivery_report = candidates[0].with_name("validation.json")
        complete_delivery = delivery_report.exists() and json.loads(delivery_report.read_text()).get("remainingUnreviewed") == 0
        if candidates[0].exists() and (complete_delivery or len(json.loads(candidates[0].read_text()).get("words", [])) >= 3000):
            # A complete editorial delivery supersedes the provisional parallel batches.
            args.batches = [p for p in [candidates[0], supplement] if p.exists()]
        if not args.batches:
            parser.error("No reviewed batches found; existing production registry was not changed.")
    legacy = json.loads((ROOT / "data/words.json").read_text())
    source = json.loads((ROOT / "content/core-3000/words-3000.draft.json").read_text())
    orders = {w["word"].lower(): w["selectionOrder"] for w in source["words"]}
    words, rejected, conflicts, replacements = {}, [], [], set()
    for path in args.batches:
        pack = json.loads(path.read_text())
        if pack.get("schemaVersion") != 1 or not isinstance(pack.get("words"), list):
            raise ValueError(f"Invalid reviewed pack: {path}")
        for raw in pack["words"]:
            row = dict(raw)
            word = str(row.get("word", "")).strip()
            key = word.lower()
            # The first editorial batch used named metadata; normalize its names,
            # without changing its reviewed meaning, example or reviewer identity.
            editorial_topics = {"grammar":"core", "time":"core", "position":"core", "description":"core", "quantity":"core", "numbers":"core", "degree":"core", "comparison":"core", "people":"social", "communication":"social", "society":"social", "feelings":"social", "daily":"home", "shopping":"home", "places":"travel", "movement":"travel", "learning":"school", "leisure":"arts", "senses":"health", "body":"health", "colors":"nature"}
            if row.get("topic") in editorial_topics:
                row["editorialTopic"] = row["topic"]
                row["topic"] = editorial_topics[row["topic"]]
            if row.get("learningBand") == "core-frequency-1":
                row["learningBand"] = 1
            row.setdefault("image", "")
            row.setdefault("audio", "")
            row.setdefault("kk", None)
            example = row.get("example") or {}
            valid = (
                bool(re.fullmatch(r"[A-Za-z]+(?:[ '\u2019-][A-Za-z]+)*", word))
                and row.get("id") == "word:" + key
                and row.get("reviewStatus") == "reviewed"
                and bool(row.get("reviewer")) and bool(row.get("source"))
                and isinstance(row.get("zh"), str) and 0 < len(row["zh"]) <= 300
                and isinstance(row.get("pos"), str) and 0 < len(row["pos"]) <= 60
                and row.get("topic") in TOPICS
                and row.get("learningBand") in [1, 2, 3, 4]
                and isinstance(example.get("en"), str) and 0 < len(example["en"]) <= 600
                and isinstance(example.get("zh"), str) and 0 < len(example["zh"]) <= 600
                and (row["kk"] is None or isinstance(row["kk"], str))
                and isinstance(row["audio"], str) and isinstance(row["image"], str)
            )
            if not valid:
                rejected.append({"word": word, "batch": str(path), "reason": "invalid-reviewed-contract"})
                continue
            if key in words:
                conflicts.append({"word": word, "kept": words[key]["reviewer"], "duplicate": row["reviewer"]})
                continue
            if row.get("displayWord") == "I":
                row["word"] = "I"
            if isinstance(row.get("replaces"), str):
                old = row["replaces"].strip().lower()
                if old in orders and old not in {w["word"].lower() for w in legacy}:
                    replacements.add(old)
            row.setdefault("selectionOrder", orders.get(key))
            words[key] = row
    # Editorial replacements are not extra words on top of the obsolete seed entries.
    # This also removes a replaced headword from an older partial batch.
    for old in replacements:
        words.pop(old, None)
    correction_file = ROOT / "content/core-3000/editorial-corrections.json"
    applied_corrections = []
    if correction_file.exists():
        for correction in json.loads(correction_file.read_text())["corrections"]:
            row = words.get(correction["word"].lower())
            if row:
                for field, value in correction["set"].items():
                    if field not in {"zh", "example", "pos", "reviewNote"}:
                        raise ValueError(f"Unsupported editorial correction field: {field}")
                    row[field] = value
                row["coordinatorReview"] = correction["reason"]
                applied_corrections.append(correction["word"])
    topic_map = {"food": "food", "animal": "nature", "nature": "nature", "transport": "travel", "things": "home"}
    for original in legacy:
        key = original["word"].lower()
        # Extra editorial examples may enrich an original record; none of its
        # old fields, paths or meanings are replaced by an incoming batch.
        row = {**words.get(key, {}), **original}
        row.update(id="word:" + key, reviewStatus="legacy-verified", reviewer="original-80", source="data/words.json",
                   topic=topic_map[original["theme"]], learningBand=original["level"])
        words[key] = row
    ordered = sorted(words.values(), key=lambda x: (x.get("selectionOrder") or orders.get(x["word"].lower(), 100000), x["word"].lower()))
    output = {"schemaVersion": 1, "count": len(ordered), "target": 3000, "status": "partial-reviewed" if len(ordered) < 3000 else "reviewed",
              "reviewNote": "AI editorial review plus original project records; not a human-teacher certification. No unverified KK is inferred.", "words": ordered}
    destination = ROOT / "data/vocab-reviewed.json"
    temporary = destination.with_suffix(".tmp")
    temporary.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    temporary.replace(destination)
    report = {"acceptedUnique": len(ordered), "legacyPreserved": len(legacy), "remainingTo3000": max(0, 3000-len(ordered)),
              "rejected": rejected, "duplicates": conflicts, "replacedSeedWords": sorted(replacements), "coordinatorCorrections": applied_corrections, "humanTeacherReviewed": False}
    (ROOT / "content/core-3000/registry-checks.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({k: v for k, v in report.items() if k not in ["rejected", "duplicates"]}, ensure_ascii=False))
    if rejected:
        print(json.dumps({"rejected": rejected}, ensure_ascii=False))

if __name__ == "__main__":
    main()
