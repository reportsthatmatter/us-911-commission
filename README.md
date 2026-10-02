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
