"""Independent checks of the production teaching registry, not a claim of human review.
Run after build_vocab_registry.py. Exit nonzero on contract/content-link failures.
"""
import collections
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
pack = json.loads((ROOT / 'data/vocab-reviewed.json').read_text())
legacy = {w['word'].lower(): w for w in json.loads((ROOT / 'data/words.json').read_text())}
aliases = json.loads((ROOT / 'content/core-3000/word-forms.draft.json').read_text())
reverse = collections.defaultdict(set)
for form, base in aliases.items():
    if isinstance(base, str):
        reverse[base.lower()].add(form.lower())

def forms(row):
    w = row['word'].lower()
    known = {w, w+"'s"} | reverse[w]
    for value in (row.get('forms') or {}).values():
        known.update(v.lower() for v in str(value).split('/') if v.isalpha())
    # Only plausible inflections are considered; no substring matches.
    known |= {w+'s', w+'es', w+'ed', w+'ing', w+'er', w+'est'}
    if w.endswith('e'):
        known |= {w+'d', w[:-1]+'ing'}
    if len(w)>2 and w.endswith('y') and w[-2] not in 'aeiou':
        known |= {w[:-1]+'ies', w[:-1]+'ied', w[:-1]+'ier', w[:-1]+'iest', w[:-1]+'ily'}
    if re.fullmatch(r'.*[^aeiou][aeiou][bdgklmnprt]', w):
        known |= {w+w[-1]+'ed', w+w[-1]+'ing'}
    known |= set({'be':'am is are was were been being', 'i':"i'm i'll i'd i've", 'a':'an',
                  'can':"can't cannot", 'do':"don't doesn't didn't", 'will':"won't", 'not':"don't doesn't didn't isn't aren't wasn't weren't can't couldn't won't wouldn't shouldn't mustn't haven't hasn't hadn't", 'have':"has had having haven't hasn't hadn't"}.get(w,'').split())
    return known

errors, warnings, seen, ids, examples = [], [], set(), set(), collections.defaultdict(list)
for row in pack['words']:
    word = row['word'].lower()
    def fail(reason): errors.append({'word':word,'reason':reason})
    if word in seen: fail('duplicate-headword')
    if row.get('id') in ids: fail('duplicate-id')
    seen.add(word); ids.add(row.get('id'))
    if row.get('id') != 'word:'+word: fail('id-not-canonical')
    if row.get('reviewStatus') not in ('reviewed','legacy-verified'): fail('not-reviewed')
    if not row.get('reviewer') or not row.get('source'): fail('missing-provenance')
    if row.get('learningBand') not in (1,2,3,4): fail('bad-editorial-band')
    if word in legacy:
        for field,value in legacy[word].items():
            if row.get(field) != value: fail('legacy-field-changed:'+field)
    elif row.get('kk') is not None:
        fail('unverified-new-kk')
    ex = row.get('example')
    if not ex:
        if word in legacy: warnings.append({'word':word,'reason':'original-word-awaits-editorial-example'})
        else: fail('missing-example')
        continue
    en,zh = ex.get('en',''),ex.get('zh','')
    tokens = set(re.findall(r"[a-z]+(?:'[a-z]+)?", en.lower().replace('’',"'")))
    if not tokens & forms(row): fail('target-not-present-as-word-or-supported-inflection')
    if not re.search(r'[.!?]$',en) or not en[:1].isupper(): fail('incomplete-example')
    if not re.search(r'[\u4e00-\u9fff]',zh): fail('missing-Chinese-example')
    if re.search(r'<[^>]*>',en+zh+row.get('zh','')): fail('markup-in-teaching-text')
    examples[en.lower()].append(word)
for en,words in examples.items():
    if len(words)>1: warnings.append({'reason':'shared-example','words':words,'example':en})
if not set(legacy)<=seen: errors.append({'reason':'original-words-missing','words':sorted(set(legacy)-seen)})
if pack.get('count') != len(pack['words']): errors.append({'reason':'count-mismatch'})
report = {'actualUniqueWords':len(seen),'target':3000,'examples':sum(bool(r.get('example')) for r in pack['words']),
          'originalWordsPreserved':len(set(legacy)&seen),'newKKInferred':False,'humanTeacherReviewed':False,
          'topics':dict(collections.Counter(r['topic'] for r in pack['words'])),
          'bands':dict(collections.Counter(r['learningBand'] for r in pack['words'])),
          'errors':errors,'warnings':warnings}
(ROOT/'content/core-3000/integration-quality.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ('errors','warnings','topics','bands')},ensure_ascii=False))
print(json.dumps({'errors':errors,'warningsCount':len(warnings)},ensure_ascii=False))
sys.exit(1 if errors else 0)
