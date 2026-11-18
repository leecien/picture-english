#!/usr/bin/env python3
"""Build content/learning-profile-v1/*.json from the game's content (read only) and tag_source.py.

usage: python3 build_profile_data.py --root <game source root> --out <dir>
"""
import argparse, json, os, sys
from collections import Counter, defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import tag_source as T
from grammar_detect import detect

VERSION = "lp-v1-batch04"

# ---------------------------------------------------------------- grammar map
def F(aff, neg, yn, wh, ex):
    return {"affirmative": aff, "negative": neg, "yes-no-question": yn, "wh-question": wh, "examples": ex}

GRAMMAR = [
    # present
    {"id": "tense:present-simple", "zh": "現在簡單式", "time": "present", "order": 1, "v1": True, "prereq": [],
     "use": "習慣、事實、時刻表、喜好與狀態", "forms": F("S + V / V-s（be：am/is/are）", "S + don't/doesn't + V", "Do/Does + S + V?", "Wh + do/does + S + V?",
     ["I need a spoon.", "She doesn't eat meat.", "Does this train go downtown?", "What do you recommend?"]),
     "errors": ["第三人稱單數漏 -s", "doesn't 後面又加 -s", "be 動詞和一般動詞並用（I am agree）"]},
    {"id": "tense:present-continuous", "zh": "現在進行式", "time": "present", "order": 2, "v1": True, "prereq": ["tense:present-simple"],
     "use": "說話當下或這段期間正在做的事", "forms": F("S + am/is/are + V-ing", "S + am/is/are + not + V-ing", "Am/Is/Are + S + V-ing?", "Wh + am/is/are + S + V-ing?",
     ["We're still waiting for our food.", "The air conditioner isn't working.", "Are you traveling alone?", "Where are you staying?"]),
     "errors": ["漏 be 動詞（I waiting）", "狀態動詞用進行式（I am knowing）"]},
    {"id": "tense:present-perfect", "zh": "現在完成式", "time": "present", "order": 7, "v1": False, "prereq": ["tense:past-simple"],
     "use": "過去發生、與現在有關；到目前為止的經驗或持續", "forms": F("S + have/has + p.p.", "S + haven't/hasn't + p.p.", "Have/Has + S + p.p.?", "Wh + have/has + S + p.p.?",
     ["My suitcase hasn't arrived.", "I've worked here for three years."]), "errors": ["和明確過去時間連用（I have seen it yesterday）"]},
    {"id": "tense:present-perfect-continuous", "zh": "現在完成進行式", "time": "present", "order": 11, "v1": False,
     "prereq": ["tense:present-perfect", "tense:present-continuous"], "use": "從過去持續到現在、仍在進行的動作",
     "forms": F("S + have/has been + V-ing", "S + haven't/hasn't been + V-ing", "Have/Has + S + been + V-ing?", "How long have/has + S + been + V-ing?",
     ["She has been working here for ten years."]), "errors": []},
    # past
    {"id": "tense:past-simple", "zh": "過去簡單式", "time": "past", "order": 3, "v1": True, "prereq": ["tense:present-simple"],
     "use": "過去某時間已完成的事", "forms": F("S + V-ed / 不規則過去式（be：was/were）", "S + didn't + V（原形）", "Did + S + V（原形）?", "Wh + did + S + V?",
     ["Sales went up last quarter.", "I didn't order this.", "Did you find us easily?", "How was your weekend?"]),
     "errors": ["didn't 後面用過去式（didn't went）", "不規則動詞加 -ed（goed）", "漏掉過去式"]},
    {"id": "tense:past-continuous", "zh": "過去進行式", "time": "past", "order": 6, "v1": False, "prereq": ["tense:past-simple", "tense:present-continuous"],
     "use": "過去某時刻正在進行；被另一件事打斷", "forms": F("S + was/were + V-ing", "S + wasn't/weren't + V-ing", "Was/Were + S + V-ing?", "Wh + was/were + S + V-ing?",
     ["I was waiting when the bus came."]), "errors": []},
    {"id": "tense:past-perfect", "zh": "過去完成式", "time": "past", "order": 12, "v1": False, "prereq": ["tense:past-simple", "tense:present-perfect"],
     "use": "比另一個過去時間更早發生", "forms": F("S + had + p.p.", "S + hadn't + p.p.", "Had + S + p.p.?", "Wh + had + S + p.p.?",
     ["The train had already left when we arrived."]), "errors": []},
    {"id": "tense:used-to", "zh": "used to（過去習慣）", "time": "past", "order": 10, "v1": False, "prereq": ["tense:past-simple"],
     "use": "過去的習慣或狀態，現在已不是", "forms": F("S + used to + V", "S + didn't use to + V", "Did + S + use to + V?", "Wh + did + S + use to + V?",
     ["I used to live in Tainan."]), "errors": ["didn't used to"]},
    # future
    {"id": "tense:going-to", "zh": "be going to（計畫、跡象）", "time": "future", "order": 4, "v1": True, "prereq": ["tense:present-continuous"],
     "use": "已有的計畫；從眼前跡象推測", "forms": F("S + am/is/are going to + V", "S + am/is/are not going to + V", "Am/Is/Are + S + going to + V?", "Wh + am/is/are + S + going to + V?",
     ["We are going to fly to Japan tomorrow.", "It looks like it's going to rain."]),
     "errors": ["漏 be 動詞（I going to）", "going to 後面用 V-ing", "和現在進行式『going to the airport（去機場）』混淆"]},
    {"id": "tense:will", "zh": "will（決定、承諾、預測）", "time": "future", "order": 5, "v1": True, "prereq": ["tense:present-simple"],
     "use": "當下決定、承諾、提議與一般預測", "forms": F("S + will ('ll) + V", "S + won't + V", "Will + S + V?", "Wh + will + S + V?",
     ["I'll have the same.", "I'll get back to you by Friday.", "How long will it take?"]),
     "errors": ["will 後面加 to 或 -s（will to go / will goes）"]},
    {"id": "tense:present-continuous-future", "zh": "現在進行式表未來（已安排）", "time": "future", "order": 8, "v1": False,
     "prereq": ["tense:present-continuous", "tense:going-to"], "use": "已排定的個人安排",
     "forms": F("S + am/is/are + V-ing + 未來時間", "S + am/is/are not + V-ing", "Am/Is/Are + S + V-ing?", "Wh + am/is/are + S + V-ing?",
     ["I'm flying to Tokyo.", "We're meeting the client on Monday."]), "errors": []},
    {"id": "tense:present-simple-timetable", "zh": "現在簡單式表時刻表未來", "time": "future", "order": 9, "v1": False,
     "prereq": ["tense:present-simple"], "use": "班表、時刻表上的未來事件",
     "forms": F("S + V-s + 未來時間", "S + doesn't + V", "Does/Do + S + V?", "What time does + S + V?", ["The train leaves at seven."]), "errors": []},
    {"id": "tense:future-continuous", "zh": "未來進行式", "time": "future", "order": 13, "v1": False, "prereq": ["tense:will", "tense:present-continuous"],
     "use": "未來某時刻正在進行", "forms": F("S + will be + V-ing", "S + won't be + V-ing", "Will + S + be + V-ing?", "Wh + will + S + be + V-ing?",
     ["I'll be waiting at the gate."]), "errors": []},
    {"id": "tense:future-perfect", "zh": "未來完成式", "time": "future", "order": 14, "v1": False, "prereq": ["tense:will", "tense:present-perfect"],
     "use": "未來某時間之前會完成", "forms": F("S + will have + p.p.", "S + won't have + p.p.", "Will + S + have + p.p.?", "Wh + will + S + have + p.p.?",
     ["I'll have finished the report by Friday."]), "errors": []},
]
FORMS = [
    {"id": "form:negative", "zh": "否定句", "applies": "每個時態都有自己的否定寫法（見各時態 forms.negative）"},
    {"id": "form:yes-no-question", "zh": "是非問句", "applies": "助動詞／be 移到主詞前"},
    {"id": "form:wh-question", "zh": "疑問詞問句", "applies": "疑問詞＋助動詞／be＋主詞"},
]
SUPPORT = [
    {"id": "support:modal", "zh": "情態助動詞（can / could / may / should / must）"},
    {"id": "support:would-like", "zh": "would like（禮貌請求）"},
    {"id": "support:would", "zh": "would（條件、轉述）"},
    {"id": "support:lets", "zh": "Let's（提議）"},
    {"id": "support:imperative", "zh": "祈使句"},
    {"id": "support:there-be", "zh": "there is / are"},
    {"id": "support:passive", "zh": "被動語態"},
    {"id": "support:conditional", "zh": "條件句"},
    {"id": "support:fragment", "zh": "省略句／短回答（沒有完整動詞）"},
]

# ---------------------------------------------------------------- question types
QTYPES = {
    # id: channel, what it really tests, grammar evidence
    "word:pic2word": ("reading", "vocab-meaning", "none", "看圖選字：單字意思"),
    "word:word2pic": ("reading", "vocab-meaning", "none", "看字選圖：單字意思"),
    "word:match": ("reading", "vocab-meaning", "none", "圖字配對：單字意思"),
    "word:zh": ("reading", "vocab-meaning", "none", "中文選英文單字"),
    "word:listen": ("listening", "vocab-meaning", "none", "聽單字選圖"),
    "word:spell": ("building", "vocab-spelling", "none", "看圖拼字（單字層級的組合，不是句子組合）"),
    "vocab:listen-spelling": ("building", "vocab-spelling", "none", "3000 詞：聽單字＋中文線索拼字"),
    "vocab:example-spelling": ("building", "vocab-spelling", "none", "3000 詞：例句挖空拼字"),
    "sent:scene2sent": ("reading", "sentence-meaning", "none", "看圖選句：選項意思不同，不是文法對比"),
    "sent:sent2scene": ("reading", "sentence-meaning", "none", "看句選圖"),
    "sent:blank": ("reading", "vocab-in-sentence", "none", "看圖填空：干擾選項是不同動詞（kicks／eats），測字義不是時態"),
    "sent:order": ("building", "word-order", "form-only", "句子排序：單字都給了，只能證明語序（問句倒裝、否定位置），不能證明時態"),
    "scene:listen": ("listening", "situational-response", "none", "聽對方說話後選合適回答（未開中文提示）"),
    "scene:zh": ("reading", "situational-response", "none", "看中文選英文回答"),
    "life:context-blank": ("reading", "situational-vocab", "none", "生活情境句子填空：依決定 3 記成一筆句子層級事件（item=s:句子，links.word=重點字），測情境中選對字；計入該次主題，不是文法證據"),
    "drive:speak": ("speaking", "spoken-production", "none", "看中文自己說英文；語音辨識吻合只代表說出的字被辨識到，不代表文法或發音正確"),
    "drive:shadow": ("speaking-shadow", "repetition", "none", "跟讀：先聽英文再念，不算獨立口說"),
    "drive:listen": ("none", "exposure", "none", "聆聽模式：不收音、不計分"),
    "life:tap-meaning": ("none", "lookup", "none", "點字查義：查詢，不是作答"),
    # proposed for batch-02 (not in the game yet)
    "grammar:form-choice": ("reading", "grammar-form", "target", "文法形式選擇題（新題型）：干擾選項只差在文法形式。題目見 grammar-items.json（60 題，batch-02）；作答前不顯示時態名稱"),
    "grammar:form-build": ("building", "grammar-form", "target", "（提案）排序題混入錯誤形式的字塊，必須選對形式並排序"),
}
CHANNELS = {
    "reading": "閱讀辨識", "listening": "聽力理解", "building": "句子組合", "speaking": "獨立口說",
    "speaking-shadow": "跟讀（不列入獨立口說）", "none": "不列入評估",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    R = lambda p: json.load(open(os.path.join(a.root, p), encoding="utf-8"))
    scenes = R("data/scenes.json")["categories"]
    life = R("data/life-contexts.json")["scenes"]
    sents = R("data/sentences.json")
    words80 = R("data/words.json")
    vocab = R("data/vocab-reviewed.json")["words"]

    items = {}
    contexts = {}
    scene_ids = Counter(s["id"] for c in scenes for s in c["scenes"])

    def add_sentence(en, zh, src, topic_key, ctx):
        iid = "s:" + en
        it = items.setdefault(iid, {"id": iid, "kind": "sentence", "en": en, "zh": zh, "sources": [], "topics": []})
        it["sources"].append(src)
        tp = T.ITEM_TOPIC.get(topic_key + "/" + en) or T.SCENE_TOPIC.get(topic_key)
        tagged = [(tp, "primary")] if tp else []
        tagged += [(x, "secondary") for x in T.SECONDARY_TOPIC.get(topic_key + "/" + en, [])]
        for (tt, role) in tagged:
            if any(z["topic"] == tt[0] for z in it["topics"]):
                continue  # one subtopic per topic per item: the first source wins, so one event never counts twice in a topic
            it["topics"].append({"topic": tt[0], "sub": tt[1], "role": role})
        if ctx:
            contexts.setdefault(ctx, {"ctx": ctx, "topic": tp[0] if T.SCENE_TOPIC.get(topic_key) else None,
                                      "sub": T.SCENE_TOPIC.get(topic_key, (None, None))[1], "source": topic_key})

    for c in scenes:
        for s in c["scenes"]:
            key = f"{c['id']}/{s['id']}"
            cid = f"{c.get('element') or c['id']}/{c['id']}/{s['id']}/{s.get('lv', 1)}"
            for i, x in enumerate(s["items"]):
                add_sentence(x["en"], x.get("zh", ""), {"file": "data/scenes.json", "scene": key, "index": i, "contentId": cid}, key, f"scene:{s['id']}")
    for sid, arr in life.items():
        key = f"life/{sid}"
        for i, x in enumerate(arr):
            add_sentence(x["en"], x.get("zh", ""), {"file": "data/life-contexts.json", "scene": sid, "index": i, "keyWord": x.get("word")}, key, f"life:{sid}")
    for i, x in enumerate(sents):
        add_sentence(x["en"], x.get("zh", ""), {"file": "data/sentences.json", "index": i, "route": x.get("route"), "level": x.get("level")}, f"sent/{x.get('route')}", None)

    # grammar contains
    missing_rev = []
    for it in items.values():
        auto = detect(it["en"])["tags"]
        forms = [t for t in auto if t.startswith("form:")]
        rev = T.GRAMMAR_REVIEWED.get(it["en"])
        if rev is not None:
            it["grammar"] = {"contains": sorted(set([T.CODE[c] for c in rev.split()] + forms)), "tagStatus": "reviewed"}
        else:
            it["grammar"] = {"contains": sorted(set(forms + [t.rstrip("?") for t in auto if t.startswith(("tense:", "support:"))])),
                             "tagStatus": "auto-unreviewed"}
        if it["topics"] and rev is None:
            missing_rev.append(it["en"])
    unknown_keys = [k for k in T.GRAMMAR_REVIEWED if "s:" + k not in items]
    unknown_topic = [k for k in list(T.ITEM_TOPIC) + list(T.SECONDARY_TOPIC) if "s:" + k.split("/", 2)[2] not in items]

    # words
    for x in words80:
        iid = "w:" + x["word"]
        items[iid] = {"id": iid, "kind": "word", "en": x["word"], "zh": x["zh"], "sources": [{"file": "data/words.json", "theme": x["theme"]}],
                      "topics": [{"topic": "food", "sub": "ingredients", "role": "primary"}] if x["theme"] == "food" else [], "grammar": {"contains": [], "tagStatus": "n/a"}}
    vmap = {"food": "food", "travel": "travel"}
    for x in vocab:
        iid = "w:" + x["word"]
        it = items.setdefault(iid, {"id": iid, "kind": "word", "en": x["word"], "zh": x["zh"], "sources": [], "topics": [],
                                    "grammar": {"contains": [], "tagStatus": "n/a"}})
        it["sources"].append({"file": "data/vocab-reviewed.json", "topic": x.get("topic")})
        if x.get("topic") in vmap and not it["topics"]:
            it["topics"].append({"topic": vmap[x["topic"]], "sub": "unassigned", "role": "primary"})
    # life-context key words are graded as words in the life scene context
    for sid, arr in life.items():
        for x in arr:
            w = items.get("w:" + x.get("word", ""))
            tp = T.ITEM_TOPIC.get(f"life/{sid}/{x['en']}") or T.SCENE_TOPIC.get("life/" + sid)
            if w and tp and tp[1] != "general":
                ex = [z for z in w["topics"] if z["topic"] == tp[0]]
                if not ex:
                    w["topics"].append({"topic": tp[0], "sub": tp[1], "role": "primary"})
                elif ex[0]["sub"] == "unassigned":
                    ex[0]["sub"] = tp[1]  # the life scene gives the word its subtopic

    # coverage
    gi_path = os.path.join(a.out, "grammar-items.json")
    gitems = json.load(open(gi_path, encoding="utf-8"))["items"] if os.path.exists(gi_path) else []
    cov = {"grammar": {}, "topics": {}}
    for g in GRAMMAR + FORMS + SUPPORT:
        rev = [i for i in items.values() if i["kind"] == "sentence" and i["grammar"]["tagStatus"] == "reviewed" and g["id"] in i["grammar"]["contains"]]
        cov["grammar"][g["id"]] = {"reviewedSentences": len(rev), "inTopics": dict(Counter(t["topic"] for i in rev for t in i["topics"] if t.get("role") == "primary")),
                                   "testedByExistingQuestionTypes": "form-only via sent:order" if g["id"].startswith("form:") else "no",
                                   "grammarItems": sum(1 for x in gitems if x["target"] == g["id"] or x.get("form") == g["id"]),
                                   "examples": [i["en"] for i in rev][:5]}
    for tid, tdef in T.TOPICS.items():
        subs = {}
        for sid in list(tdef["sub"]) + ["general", "unassigned"]:
            its = [i for i in items.values() if any(z["topic"] == tid and z["sub"] == sid for z in i["topics"])]
            subs[sid] = {"sentences": sum(1 for i in its if i["kind"] == "sentence"), "words": sum(1 for i in its if i["kind"] == "word")}
        cov["topics"][tid] = subs

    meta = {"schemaVersion": 1, "version": VERSION, "task": "LEARNING-PROFILE-01", "reviewer": "external-ai",
            "status": "ai-edited-not-teacher-reviewed", "contentBase": "picture-english e079ef8f426e0f0f7e5794906bda952ea4af1fee"}
    os.makedirs(a.out, exist_ok=True)
    W = lambda name, obj: json.dump({**meta, **obj}, open(os.path.join(a.out, name), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    W("grammar-map.json", {"note": "文法學習地圖：涵蓋現在、過去、未來。v1=true 是第一版優先標記的五個時態；order 是建議學習順序，prereq 是先備。forms 是同一時態的肯定、否定、是非問句、疑問詞問句。",
                           "nodes": GRAMMAR, "forms": FORMS, "support": SUPPORT})
    W("topic-map.json", {"note": "主題與次主題。general = 屬於該主題但不屬於任何次主題；unassigned = 3000 詞依 topic 歸入主題，尚未細分次主題。work（職場）本版只建立 negotiation（商務談判），依協調人 2026-11-18 決定；其餘職場次主題暫不擴充。題目的 topics 每個主題最多一個次主題；role=primary 是主分類，role=secondary 是確實也用在該情境的附加標籤。",
                         "topics": T.TOPICS, "contexts": sorted(contexts.values(), key=lambda c: c["ctx"]),
                         "contextNote": "ctx 與遊戲 Learn.grade 的 ctx 相同（scene:<場景 id>、life:<場景 id>）；文法題用 grammar:<主題>/<次主題>。生活情境依決定 3 記成句子層級事件（item=s:句子，links.word=重點字）。"})
    W("question-types.json", {"note": "每種題型真正測到的能力。grammarEvidence：none＝不是文法證據；form-only＝只證明語序（問句倒裝、否定位置），不證明時態；target＝證明該題標記的目標文法。",
                              "channels": CHANNELS,
                              "types": {k: {"channel": v[0], "tests": v[1], "grammarEvidence": v[2], "zh": v[3]} for k, v in QTYPES.items()}})
    W("item-tags.json", {"note": "教材 ID 對照。id 與遊戲 Learn 的紀錄 key 相同：s:<英文句子>、w:<單字>。grammar.contains 是句子『出現』的文法，不代表題目『測到』；測到什麼由 question-types.json 決定。tagStatus：reviewed＝人工（AI 編輯）逐句核對；auto-unreviewed＝自動偵測，只供參考，不用於任何評估。",
                         "counts": {"sentences": sum(1 for i in items.values() if i["kind"] == "sentence"),
                                    "sentencesReviewed": sum(1 for i in items.values() if i["kind"] == "sentence" and i["grammar"]["tagStatus"] == "reviewed"),
                                    "words": sum(1 for i in items.values() if i["kind"] == "word")},
                         "items": sorted(items.values(), key=lambda i: i["id"])})
    W("coverage.json", {"note": "現有教材對文法與主題的覆蓋。testedByExistingQuestionTypes＝no 表示遊戲現有題型都不能當作該時態的掌握證據；grammarItems 是 batch-02 文法形式選擇題中以此為目標或句型的題數（遊戲接上新題型後才會產生證據）。", **cov})
    report = {"items": len(items), "sentences": sum(1 for i in items.values() if i["kind"] == "sentence"),
              "topicSentencesWithoutReview": missing_rev, "grammarKeysNotFound": unknown_keys, "topicKeysNotFound": unknown_topic,
              "duplicateSceneIds": [k for k, v in scene_ids.items() if v > 1]}
    print(json.dumps(report, ensure_ascii=False, indent=1))
    if missing_rev or unknown_keys or unknown_topic:
        sys.exit(1)


if __name__ == "__main__":
    main()
