# -*- coding: utf-8 -*-
"""Heuristic grammar detector for 'contains' tags (what a sentence shows), NOT for what a question tests.

Output is marked tagStatus="auto" unless a manual override in tag_source.py confirms or corrects it.
"""
import re

IRREGULAR_PAST = set("""went had made lost left forgot took got saw came said ate bought paid found gave told thought
felt kept met ran sat sent spent stood understood wrote broke brought caught chose drank drove fell flew grew heard hit
knew led lent meant put read rode rang rose sang sold shut slept spoke stole swam taught threw woke wore won was were did
began became built""".split())
BE_PRES = r"(?:am|is|are|'m|'s|'re)"
WH = ("what", "where", "when", "which", "who", "whom", "whose", "why", "how")
AUX_START = ("do", "does", "did", "is", "are", "am", "was", "were", "can", "could", "may", "might", "will", "would",
             "shall", "should", "have", "has", "must")
DETERMINERS = {"the", "a", "an", "my", "your", "his", "her", "our", "their", "this", "that", "some", "to", "home", "bed",
               "school", "work", "there", "here", "back"}


def words(s):
    return re.findall(r"[a-z']+", s.lower())


def detect(sentence: str) -> dict:
    s = sentence.strip()
    lo = " " + s.lower().replace("’", "'") + " "
    w = words(s)
    tags = set()
    # questions / negatives
    clauses = [c for c in re.split(r"(?<=[.?!])\s+", s) if c]
    for c in clauses:
        cw = words(c)
        if c.endswith("?") and cw:
            if cw[0] in WH or (cw[0] in ("how",)):
                tags.add("form:wh-question")
            elif cw[0] in AUX_START or cw[0] in ("isn't", "aren't", "don't", "doesn't", "didn't", "can't", "won't"):
                tags.add("form:yes-no-question")
            else:
                tags.add("form:other-question")
    if re.search(r"\b(not|n't|never)\b|n't\b", lo):
        tags.add("form:negative")
    # future
    m_going = re.search(r"\b(?:am|is|are|isn't|aren't)\b(?:\s+[a-z']+){0,2}?\s+(?:not\s+)?going to\s+([a-z]+)|'(?:m|s|re)\s+(?:not\s+)?going to\s+([a-z]+)", lo)
    if m_going and (m_going.group(1) or m_going.group(2)) in DETERMINERS:
        m_going = None
    if m_going:
        tags.add("tense:going-to")
    if re.search(r"\b(will|won't)\b|'ll\b", lo):
        tags.add("tense:will")
    # continuous (exclude 'going to + verb')
    for m in re.finditer(r"\b(am|is|are|was|were|isn't|aren't|wasn't|weren't)\b(?:\s+[a-z']+){0,2}?\s+(?:not\s+)?([a-z]+ing)\b|'(m|s|re)\s+(?:not\s+)?([a-z]+ing)\b", lo):
        aux = m.group(1) or m.group(3)
        ving = m.group(2) or m.group(4)
        if ving in ("going",) and m_going:
            continue
        if ving in ("something", "nothing", "anything", "everything", "morning", "evening", "thing", "king", "ring", "sing", "spring", "string", "bring",
                    "fitting", "shopping", "parking", "building", "meeting", "ceiling", "clothing", "wedding", "pudding", "sightseeing", "washing", "dining", "banking", "camping"):
            continue
        tags.add("tense:past-continuous" if aux in ("was", "were", "wasn't", "weren't") else "tense:present-continuous")
    # perfect
    if re.search(r"\b(have|has|'ve|'s)\s+(?:not\s+|never\s+|already\s+|just\s+)?(been|[a-z]+ed|gone|done|seen|eaten|made|lost|left|forgotten|taken|got|gotten|had|found|bought|paid|finished)\b", lo) \
            and not re.search(r"\b(have|has)\s+(?:a|an|the|some|any|my|your|it|one|two|three|lunch|dinner)\b", lo):
        tags.add("tense:present-perfect")
    # past simple
    if re.search(r"\b(did|didn't|was|were|wasn't|weren't)\b", lo) or any(t in IRREGULAR_PAST - {"put", "read", "hit", "shut", "cut", "let", "set"} for t in w):
        if not ({"tense:past-continuous"} & tags and not re.search(r"\b(did|didn't)\b", lo)):
            tags.add("tense:past-simple")
    for t in w:
        if re.fullmatch(r"[a-z]+ed", t) and t not in ("need", "speed", "feed", "seed", "bed", "red", "shed", "bored", "tired", "interested",
                                                      "excited", "attached", "included", "located", "married", "parked", "closed", "used", "fried",
                                                      "scared", "worried", "surprised", "pleased", "allowed", "supposed", "delayed", "cooked", "canceled", "cancelled"):
            tags.add("tense:past-simple?")
    # modal / supporting
    if re.search(r"\b(can|could|may|might|should|must|shall)\b|can't|couldn't|shouldn't", lo):
        tags.add("support:modal")
    if re.search(r"\bwould like\b|'d like\b", lo):
        tags.add("support:would-like")
    if re.search(r"\blet's\b|\blet us\b", lo):
        tags.add("support:lets")
    if re.search(r"\bthere (is|are|was|were|'s)\b|\bthere's\b", lo):
        tags.add("support:there-be")
    return {"tags": sorted(tags)}


if __name__ == "__main__":
    import sys
    for line in sys.stdin:
        print(line.strip(), detect(line)["tags"])
