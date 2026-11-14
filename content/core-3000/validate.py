"""Validate content contracts; does not certify language accuracy or touchscreen behavior."""
import json
import re
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
BASE = "418e89d12bda271fbc65af333f57c276e604dc02"


def read(path):
    return json.loads(path.read_text())


def check(condition, message):
    if not condition:
        raise ValueError(message)


data = read(HERE / "words-3000.draft.json")
words = data["words"]
ids = {w["id"] for w in words}
names = {w["word"].casefold() for w in words}
check(len(words) == len(ids) == len(names) == data["count"] == 3000, "Need 3,000 distinct words and IDs")
for w in words:
    check(w["id"] == "word:" + w["word"].casefold(), "Unstable word ID: " + w["word"])
    check(bool(re.search("[\u4e00-\u9fff]", w["zh"])), "Missing Chinese: " + w["word"])
    check(w["reviewStatus"] in {"legacy-entry-preserved", "dictionary-draft-needs-teaching-review"}, "Missing review gate")
    if w["source"] != "existing-game":
        check(w["kk"] is None, "Unreviewed source phonetics must not become KK")
    if w["audio"]:
        check((ROOT / w["audio"]).is_file(), "Missing recording: " + w["word"])

legacy_words = read(ROOT / "data/words.json")
legacy_sentences = read(ROOT / "data/sentences.json")
check(len(legacy_words) == 80 and len(legacy_sentences) == 42, "Legacy counts changed")
check({w["word"].casefold() for w in legacy_words} <= names, "Legacy words omitted")
check(sum(w["source"] == "existing-game" for w in words) == 80, "Legacy word references changed")

sentdata = read(HERE / "sentences-222.draft.json")
sentences = sentdata["sentences"]
check(len(sentences) == len({s["id"] for s in sentences}) == len({s["en"].casefold() for s in sentences}) == 222, "Sentence count or duplicates")
check(sum("legacyRecord" in s for s in sentences) == 42, "Legacy sentences omitted")
check(len([s for s in sentences if "legacyRecord" not in s]) == 180, "New sentence count")
for s in sentences:
    check(bool(s["zh"].strip()) and bool(s["en"].strip()), "Empty sentence")
    check(set(s.get("targetWordIds", [])) <= ids, "Unknown sentence target: " + s["en"])
    if "legacyRecord" in s:
        check(s["legacyRecord"] in legacy_sentences, "Modified legacy sentence")

aliases = read(HERE / "word-forms.draft.json")
check(all(v in names and k not in names for k, v in aliases.items()), "Aliases must point to a canonical word without increasing the count")

pack = read(HERE / "images/scenes-batch-02.draft.json")
check(len(pack["scenes"]) == 6, "Need six new scenes")
new_targets = []
for scene in pack["scenes"]:
    check(len(scene["targets"]) == len({t["id"] for t in scene["targets"]}) == 6, "Need six targets per image")
    with Image.open(ROOT / scene["image"]) as image:
        check(image.size == (scene["width"], scene["height"]) == (1536, 1024), "Image size mismatch")
        image.verify()
    for target in scene["targets"]:
        check(target["wordId"] in ids, "Image target missing from word bank")
        polygon = target["polygon"]
        check(len(polygon) >= 3 and all(len(p) == 2 and all(0 <= v <= 1 for v in p) for p in polygon), "Bad polygon")
        new_targets.append(target["word"])
check(len(new_targets) == len(set(new_targets)) == 36, "Duplicate new picture words")

existing = {t["word"] for s in read(ROOT / "data/life-scenes.json")["scenes"] for t in s["targets"]}
check(len(existing) == 35 and not (existing & set(new_targets)), "Picture coverage miscount")
check(len(existing | set(new_targets)) == 71, "Need 71 distinct source-illustrated words")
plan = read(HERE / "image-1000.production-plan.json")
queue = plan["queue"]
check(len(queue) == len({w["wordId"] for w in queue}) == 1000, "Picture queue duplicates")
check(all(w["wordId"] in ids for w in queue), "Picture queue word absent from 3,000")
check(sum(w["countsTowardCompletedImageCoverage"] for w in queue) == 35, "Unintegrated image sources counted as complete")
check(plan["remainingImageWords"] == 965 and plan["remainingSourceImageWords"] == 929, "Remaining coverage miscount")

runtime = ["index.html", "world.js", "rpg.js", "battle.js", "learn.js", "pron.js", "speech.js", "lifescene.js", "novice.js", "shell.css", "rpg.css", "data/words.json", "data/sentences.json", "data/life-scenes.json", "assets/manifest.json"]
for path in runtime:
    original = subprocess.check_output(["git", "show", BASE + ":" + path], cwd=ROOT)
    check((ROOT / path).read_bytes() == original, "Runtime unexpectedly modified: " + path)

print("PASS: 3,000 distinct candidate words; 80 legacy words; 222 sentences including 180 new; 6 new images x 6 targets; 71 source-illustrated words; 35 interactive words; 1,000-item draft queue; valid IDs/paths/coordinates; runtime and saves untouched.")
print("NOT CERTIFIED: teaching accuracy, new KK/audio, draft hotspot geometry, mobile tapping, or 1,000 completed image words.")
