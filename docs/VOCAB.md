# Reviewed vocabulary integration

The RPG menu's 單字學習 opens **3,000 unique playable headwords**, including all original 80 records, with **3,000 English/Chinese example pairs**. The dictionary draft is not counted as taught content. Editorial review is by AI, not a human teacher certification.

Search and filters cover 11 topics and four editorial learning bands. Sets of up to 10 words include study cards, listening/spelling and example gap exercises. The first answer is recorded through Learn, the existing card book and XP. A retry gives practice without duplicate rewards; hearing must finish before spelling becomes available. Each word has a 跟讀這個單字 entry into the recorded practice panel, which returns to the vocabulary page. Drive word/mixed modes use the same reviewed bank, and Drive sentence modes can use its examples alongside the original 42 sentences. General recording sessions sample 20 eligible items; choosing a specific word practises that word directly.

Words without a recording use explicitly labelled device speech. Missing KK remains missing; learning bands are editorial groupings, not certified CEFR or TOEIC scores. The original `data/words.json` and `data/sentences.json` remain unchanged so legacy picture, sentence-order and KK questions keep their verified data. New reviewed words are available to tapped-word definitions and acquired cards. Lists paginate 20 rows. No new localStorage namespace is introduced.

## Rebuild and provenance

Run `python tools/build_vocab_registry.py`, then `python tools/audit_vocab.py`.

The complete external editorial delivery is `content/core-3000/reviewed/words-reviewed.json`, reproducible from `modules/curriculum-review/reviews/*.tsv` using that module's README. It supplies 2,999 accepted entries and one row held for coordinator review. The coordinator's individually reviewed supplement in `reviewed-batches/coordinator-approved.json` supplies that remaining entry. `editorial-corrections.json` clarifies the pronunciation rule for an and the parts of speech for sentence. Original 80-word fields always override incoming data.

A complete delivery supersedes provisional parallel batches. Replaced seed headwords are removed rather than counted alongside their replacement. The seed draft and early audit batches remain as provenance; they are not runtime teaching content. Source attribution and ECDICT MIT licensing remain in `content/core-3000/sources/`.

`registry-checks.json` reports 3,000 accepted unique entries, zero remaining, no rejected rows, and all 80 originals preserved. `integration-quality.json` independently checks canonical IDs, first-answer data links, example target words and supported inflections, original fields, missing/invented KK and provenance. All 3,000 entries have examples; its final errors and warnings are both empty. Automated validation does not certify pronunciation or teaching quality.

## Verification

`tests/vocab.cjs` checks validation, filtering, audio gating and answer lifecycle with explicit test fixtures. `tests/vocab-integration.cjs` uses the actual production registry and real RPG/Pron/Learn/card-save hooks: dictionary lookup, spelling, XP, duplicate guard, returning to the same map position and persistence after reload. `tests/vocab-drive.cjs` checks new-word selection in Drive, shared example sentences, selected-word recorded-practice entry, nested-panel return and no listening-only reward. Microphone testing is separate; these tests do not certify real phone recording.

`tests/pron.cjs` deliberately uses the original bank to retain coverage of the labelled draft fallback. `tests/content.cjs`, `tests/drive.cjs` and `tests/platform.cjs` cover the old question bank, spoken practice and save/worker contracts. The web build excludes source artwork and draft curriculum. KK N04–N11 and the 30-question novice boss remain a separate incomplete deliverable.
