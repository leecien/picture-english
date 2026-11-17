# Reviewed vocabulary integration

The RPG menu's 單字學習 opens the reviewed vocabulary registry. `data/vocab-reviewed.json` currently contains **1,399 unique usable words**, including all original 80 records; **1,601 remain** before the 3,000 target. The dictionary draft is not counted as taught content. Editorial review is by AI and is not a human teacher certification.

Search, topic and editorial learning bands lead to sets of up to 10 words. Study cards show meaning and an example; listening/spelling and example gap exercises record the first answer through Learn, the existing card book and XP. A retry gives practice without duplicate rewards. Hearing must finish before spelling becomes available. Words without a recording use device speech; missing KK remains missing. Bands are editorial groupings, not certified CEFR or TOEIC scores.

The original `data/words.json` remains unchanged so legacy picture and KK questions keep their verified bank. New reviewed words are available to tapped-word definitions and acquired cards. The list paginates 20 rows and does not render thousands of cards at once. No new localStorage namespace is introduced.

## Rebuild

Run `python tools/build_vocab_registry.py content/core-3000/audit/reviewed-first300.json content/core-3000/reviewed-batches/batch-b.json content/core-3000/reviewed-batches/batch-c.json content/core-3000/reviewed-batches/batch-d.json`. The builder validates review metadata and required fields, deduplicates by word, and preserves every original field on the original 80 records. Counts and rejected rows are written to `content/core-3000/registry-checks.json`.

The partial batches cover selection orders 1–300 (299 accepted), 301–750 (450), 1201–1500 (299), and 2101–2400 (295). Remaining ranges and rejected headwords require editorial work; copying a draft does not satisfy review.

## Verification

`tests/vocab.cjs` checks validation, filtering, audio gating and answer lifecycle with explicit fixtures. `tests/vocab-integration.cjs` uses the actual production registry and real RPG/Pron/Learn/card-save hooks: dictionary lookup, spelling, XP, duplicate guard, returning to the same map position, and persistence after reload. `tests/pron.cjs` deliberately uses the original bank to retain coverage of the labelled draft fallback.
