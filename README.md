# The 9/11 Commission Report

Final report of the National Commission on Terrorist Attacks Upon the United
States, transmitted to the President and Congress on 22 July 2004.

## Source

`archive/911Report.pdf` — the authorised full-text PDF published by the
Commission at <https://www.9-11commission.gov/report/911Report.pdf>. Public
domain (work of the U.S. Government). See `datapackage.json` for details.

## Build

`ingest.ts` declares how the report is turned into Markdown. Rebuild from the
site repo with `pnpm ingest run us-911-commission`.

The text and structure come from the Commission's own HTML edition, mirrored
under `reference/raw/` (SHA-256 of each page in `ingest.ts` and
`reference/manifest.json`); `commission-html.ts` says what its markup means.
The PDF supplies the printed page numbers and the fidelity check, and is still
read in full by every pass as the shadow ingest (`cleanEdition` in
`@rtm/ingest`, reportsthatmatter-ivg.1). `PROCESSING.md` is the reader-facing
account; `fidelity.md` lists every stretch where the HTML and the PDF
disagree; `aliases.yaml` maps the paragraph ids of the PDF build to the
paragraphs that now hold their text.

## Reference texts

`reference/wikisource/` mirrors the volunteer-proofread Wikisource transcription of the 9/11 Commission Report (Official Government Edition), one file per printed page (350 of its pages are proofread or validated (310 proofread, 40 validated; 7 blank, 5 problematic)), as served by the MediaWiki API: `pages/<n>.wiki` (the wikitext), `manifest.json` (page and revision ids, proofread levels, SHA-256 of every file, proofreaders credited, licence) and `pagemap.json` (each page's PDF page, measured against the PDF's text). The underlying text is public; Wikisource's transcription and formatting are CC BY-SA 4.0, so this is a measurement reference for `pnpm score` in the site repo (word error rate and footnote-marker accuracy per page, see docs/scoring.md there), not served text. Rebuild with `scripts/wikisource/fetch.mjs` and `map.mjs` in the site repo.
