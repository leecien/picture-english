#!/usr/bin/env python3
"""Build content/kk-v1/{kk-sounds-reviewed.json, words-reviewed.json} from kk_source.py.

usage: python3 build_kk.py --root <development source package root> --out <dir>
The root is only read (data/words.json for the 80 original words, data/vocab-reviewed.json for Chinese,
assets/voice/words/ for which recordings really exist). Nothing in the root is written.
"""
import argparse, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kk_source as K

MULTI = ["aɪ", "aʊ", "ɔɪ", "tʃ", "dʒ"]
VOWELS = ["i", "ɪ", "e", "ɛ", "æ", "ɑ", "ɔ", "o", "ʊ", "u", "ʌ", "ə", "ɝ", "ɚ", "aɪ", "aʊ", "ɔɪ"]
REVIEWER = "external-ai"
SRC_WORD = "external-ai hand-checked American KK (not converted from ECDICT)"
SRC_LEGACY = "data/words.json (original 80; KK/zh/audio unchanged, re-checked)"


def kk_tokens(kk):
    s = kk.replace("[", "").replace("]", "").replace("ˋ", "").replace("ˏ", "")
    out, i = [], 0
    while i < len(s):
        two = s[i:i + 2]
        if two in MULTI:
            out.append(two); i += 2
        else:
            out.append(s[i]); i += 1
    return out


def stress_index(kk):
    s = kk.replace("[", "").replace("]", "")
    vowels_before, i = 0, 0
    stress = 0
    while i < len(s):
        if s[i] == "ˋ":
            stress = vowels_before + 1; i += 1; continue
        if s[i] == "ˏ":
            i += 1; continue
        two = s[i:i + 2]
        tok = two if two in MULTI else s[i]
        if tok in VOWELS:
            vowels_before += 1
        i += len(tok)
    n = vowels_before
    return stress or (1 if n == 1 else 0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    legacy = {w["word"]: w for w in json.load(open(os.path.join(a.root, "data/words.json")))}
    vocab = {w["word"]: w for w in json.load(open(os.path.join(a.root, "data/vocab-reviewed.json")))["words"]}
    rec_dir = os.path.join(a.root, "assets/voice/words")
    order = {}
    chap_index = {}
    n = 0
    for ci, (cid, title, sounds) in enumerate(K.CHAPTERS):
        for s in sounds:
            n += 1
            order[s] = n
            chap_index[s] = (ci, cid)

    words = []
    for (w, kk, ch, sd, syl, opt) in K.W:
        texts = ch.split("|"); snds = sd.split("|")
        assert len(texts) == len(snds), w
        chunks = []
        for t, s in zip(texts, snds):
            toks = [] if s == "-" else s.split(" ")
            c = {"text": t, "soundTokens": toks}
            if not toks:
                c["silent"] = True
            chunks.append(c)
        toks = kk_tokens(kk)
        vow = [t for t in toks if t in VOWELS]
        leg = legacy.get(w)
        voc = vocab.get(w)
        zh = leg["zh"] if leg else (voc["zh"] if voc else None)
        file = f"assets/voice/words/{w}.mp3"
        has_rec = os.path.exists(os.path.join(a.root, file))
        if leg:
            assert leg["kk"] == kk, f"legacy KK changed: {w} {leg['kk']} != {kk}"
        status = "needs-review" if opt.get("needsReview") else "reviewed"
        positions = {"first": toks[0], "last": toks[-1],
                     "vowel": vow[0] if (len(vow) == 1 and not opt.get("noVowelQ")) else None}
        cnt = {}
        for t in toks:
            cnt[t] = cnt.get(t, 0) + 1
        avoid = list(opt.get("avoid", []))
        if opt.get("merger"):
            avoid.append("ɑ")
        ready = max(chap_index[t][0] for t in toks)
        e = {
            "id": "kk-word:" + w, "word": w, "zh": zh, "kk": kk, "sounds": toks, "chunks": chunks,
            "syllables": {"count": len(vow), "stress": stress_index(kk), "spelling": syl.split("|") if syl else [w]},
            "positions": positions,
            "uniqueSounds": [t for t in toks if cnt[t] == 1],
            "readyChapter": K.CHAPTERS[ready][0],
            "audio": ({"mode": "recording", "file": file} if has_rec else
                      {"mode": "device-whole-word", "file": None,
                       "note": "來源包沒有這個字的錄音；只能用裝置整字朗讀，不是單音示範，也不可用 TTS 念 KK 符號。"}),
            "inVocab3000": bool(voc), "legacy": bool(leg),
            "reviewStatus": status, "reviewer": REVIEWER, "source": SRC_LEGACY if leg else SRC_WORD,
        }
        if avoid:
            e["avoidDistractors"] = avoid
        if opt.get("merger"):
            e["accentNote"] = K.MERGER
        if opt.get("note"):
            e["note"] = opt["note"]
        if opt.get("needsReview"):
            e["reviewNote"] = opt["needsReview"]
        words.append(e)
    W = {e["word"]: e for e in words}

    sounds = []
    for cid, title, ss in K.CHAPTERS:
        for s in ss:
            cat, voiced, how, sp, exc, ex, acc, conf = K.S[s]
            rec = [x for x in ex if W[x]["audio"]["mode"] == "recording"]
            e = {
                "id": "kk-sound:" + s, "symbol": s, "chapter": cid, "order": order[s],
                "category": cat, "kindZh": "母音" if cat == "vowel" else "子音", "voiced": voiced,
                "how": how,
                "spellings": [{"grapheme": g, "words": ws, **({"note": nt} if nt else {})} for g, ws, nt in sp],
                "exceptions": exc, "examples": ex, "recordedExamples": rec,
                "confusableWith": conf,
                "demo": {"singleSoundRecording": None,
                         "wholeWord": [{"word": x, "file": W[x]["audio"]["file"]} for x in rec],
                         "note": "沒有單音錄音。示範按鈕只能播放例字的整字錄音（或整字放慢）；沒有錄音的例字只能用裝置整字朗讀。不要讓裝置語音念 KK 符號。"},
                "reviewStatus": "reviewed", "reviewer": REVIEWER,
                "source": ("novice.js@fbfb7f9 口形說明（內部 Claude）＋external-ai 拼字／例字複核" if cid in ("N01", "N02", "N03")
                           else "external-ai 編寫（美式 KK、手動核對）"),
            }
            if acc:
                e["accentNote"] = acc
            sounds.append(e)

    def chunk_idx(word, grapheme, toks):
        ws = W[word]["chunks"]
        if "_" in grapheme:
            v, tail = grapheme.split("_")
            for i, c in enumerate(ws):
                if c["text"] == v and c["soundTokens"] == toks:
                    if ws[-1]["text"] == tail and ws[-1].get("silent") and i + 3 == len(ws):
                        return [i, len(ws) - 1]
            raise SystemExit(f"split pattern not found: {grapheme} in {word}")
        for i, c in enumerate(ws):
            if c["text"] == grapheme and c["soundTokens"] == toks:
                return [i]
        raise SystemExit(f"grapheme not found: {grapheme} → {toks} in {word}")

    chapters = []
    taught = []
    for cid, title, ss in K.CHAPTERS:
        taught = taught + ss
        ms = []
        for (mc, g, w, snd, note) in K.MATCHES:
            if mc != cid:
                continue
            toks = snd.split(" ")
            m = {"grapheme": g, "word": w, "chunks": chunk_idx(w, g, toks), "soundTokens": toks}
            if note:
                m["note"] = note
            others = sorted({" ".join(x[3].split(" ")) for x in K.MATCHES if x[1] == g and x[3] != snd})
            if others:
                m["contextDependent"] = True
            ms.append(m)
        pool = []
        for e in words:
            if e["reviewStatus"] != "reviewed":
                continue
            for place in ("first", "last", "vowel"):
                t = e["positions"][place]
                if t and t in ss:
                    pool.append({"word": e["word"], "place": place, "sound": t, "audio": e["audio"]["mode"]})
        chapters.append({"id": cid, "title": title, "sounds": ss, "taughtAfter": len(taught),
                         "matches": ms, "builds": K.BUILDS.get(cid, []), "positionQuestions": pool})

    meta = {"schemaVersion": 1, "task": "B-KK-DATA-01", "baseRef": "fbfb7f958ad5eb3762a43a7777d60c0645f09f47",
            "reviewer": REVIEWER,
            "status": "ai-edited-not-teacher-reviewed",
            "note": "AI 教材編輯，非真人教師審核、非真人錄音。KK 為本遊戲傳統美式 KK（/e/、/o/ 記法；字尾 -y 記 /ɪ/），不從 ECDICT 英式音標轉換。",
            "places": {"first": "開頭", "last": "結尾", "vowel": "母音（只用在只有一個母音的字）"}}
    os.makedirs(a.out, exist_ok=True)
    json.dump({**meta, "counts": {"sounds": len(sounds), "vowels": sum(1 for s in sounds if s["category"] == "vowel"),
                                  "consonants": sum(1 for s in sounds if s["category"] == "consonant")},
               "chapters": chapters, "sounds": sounds},
              open(os.path.join(a.out, "kk-sounds-reviewed.json"), "w"), ensure_ascii=False, indent=1)
    json.dump({**meta, "counts": {"words": len(words), "reviewed": sum(1 for e in words if e["reviewStatus"] == "reviewed"),
                                  "needsReview": sum(1 for e in words if e["reviewStatus"] != "reviewed"),
                                  "recorded": sum(1 for e in words if e["audio"]["mode"] == "recording")},
               "words": words},
              open(os.path.join(a.out, "words-reviewed.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps({"sounds": len(sounds), "words": len(words)}))


if __name__ == "__main__":
    main()
