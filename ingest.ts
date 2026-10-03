import { readCommissionHtml } from "./commission-html.ts";
import { cleanEdition, layoutPageJoins, quoteListRunOns, contentsEntries, endnotes, numberedSections, pageBreakContinuations, pipeline, runningFurniture, shortSubheads, unlistedHeadingsMinor, type SplitPage } from "@rtm/ingest";

/**
 * Every page of this PDF opens with an Adobe InDesign output slug the
 * Commission's typesetter left switched on — e.g.
 *
 *   Final1-4.4pp   7/17/04   9:12 AM   Page 13
 *
 * It is not running furniture in the `runningFurniture()` sense: the date,
 * time and page token differ on every page, so nothing recurs verbatim and
 * the repeated-line test never fires. It is also where this document's
 * printed page number lives — there is no bare page-number line anywhere —
 * so a pass that only deleted it would cost every page anchor.
 *
 * This reads the trailing `Page N` off the slug into `printed` (front-matter
 * pages carry a roman numeral and are left without one, as elsewhere in the
 * archive) and drops the line. Shape-anchored, first body line only: no
 * sentence of the report begins "Final … 9:12 AM Page 13".
 */
const PRODUCTION_SLUG =
  /^\s*Final\S*(?:\s+\S+)*\s+\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2}\s+[AP]M\s+Page\s+([0-9ivxlcdm]+)\s*$/i;

function productionSlug(): {
  readonly name: string;
  readonly stage: "volume";
  run(pages: SplitPage[]): SplitPage[];
} {
  return {
    name: "productionSlug",
    stage: "volume",
    run(pages) {
      return pages.map((page) => {
        const firstContent = page.body.findIndex((line) => line.trim() !== "");
        if (firstContent === -1) return page;
        const match = page.body[firstContent].match(PRODUCTION_SLUG);
        if (!match) return page;
        const printed = Number.parseInt(match[1], 10);
        return {
          ...page,
          printed: Number.isNaN(printed) ? page.printed : printed,
          body: page.body.filter((_, i) => i !== firstContent),
        };
      });
    },
  };
}

/**
 * How this report is built. Owned by the report: every decision that shaped
 * its text is named here, and the passes it composes are library code, so a
 * fix to a shared pass reaches every report that calls it.
 */
export default pipeline({
  id: "us-911-commission",
  title: "The 9/11 Commission Report",
  authors: "National Commission on Terrorist Attacks Upon the United States",
  published_at: "22 July 2004",
  source_url: "https://www.9-11commission.gov/report/911Report.pdf",
  repo: ".",
  volumes: [
    {
      path: "archive/911Report.pdf",
      sha256: "6fa7e90a750a3e1168c06d859369896b1ee377ca314a251c9c6d7db3f87462d8",
    },
  ],
  passes: [
    // The text and structure come from the Commission's own HTML edition
    // (reference/raw/, mirrored from the UNT CyberCemetery copy of
    // 9-11commission.gov; see commission-html.ts for what its markup means).
    // The PDF is still read by every pass below, as the shadow ingest: its
    // page markers say which page carries which printed number, each block is
    // stamped with the page its first word aligns to, and every stretch where
    // the HTML and the PDF disagree is listed in fidelity.md
    // (reportsthatmatter-ivg.1).
    cleanEdition({
      dir: import.meta.dirname,
      encoding: "latin1",
      files: [
    { path: "reference/raw/911Report_FM.htm", sha256: "b4b67bf8b449ea190b052aa9ee381428c9f51aa7c29b397a231656dcc5571c1c" },
    { path: "reference/raw/911Report_Pref.htm", sha256: "f8d70cb3c8b4af4d53370b59296e23931deb7b1d2ae9cf537f979385252056b6" },
    { path: "reference/raw/911Report_Ch1.htm", sha256: "3865478ba5df15474406f6d15b398fc4357c4047abdc604fbe92e101e1cae00b" },
    { path: "reference/raw/911Report_Ch2.htm", sha256: "203889e99e824b6496733b41d1cc77e2bc44ab158bea973c49a843077a8fb66e" },
    { path: "reference/raw/911Report_Ch3.htm", sha256: "dd6b245dcb5633e76bc10de1f083c0fba0b6c5d34c318c62c6ae44fa568a293b" },
    { path: "reference/raw/911Report_Ch4.htm", sha256: "fa28f395b6656279b14d25b43203ddf019c3eb17f7e1771095b86fa29e7004bb" },
    { path: "reference/raw/911Report_Ch5.htm", sha256: "347221b72e728ce32df9a97d12492abe68f42eb149f9fc9a7356cae05cf8b48e" },
    { path: "reference/raw/911Report_Ch6.htm", sha256: "b9662dc0b2726f67074e3a0b626f88eac3c89418b1050efcf64f5fb395b49ac2" },
    { path: "reference/raw/911Report_Ch7.htm", sha256: "0fce676924cce42609aae6ce3b136240ed58c8fbf0a6dc1b85d25189e20ceb90" },
    { path: "reference/raw/911Report_Ch8.htm", sha256: "ad87b106a26cb1e07cb9aeaa86d6001023c1d6219e385713798e27c43b40f3c2" },
    { path: "reference/raw/911Report_Ch9.htm", sha256: "64b6d2529e464611f79e07d8eeae1edb94fa833c6d4b61353f74d5d6b9d6861e" },
    { path: "reference/raw/911Report_Ch10.htm", sha256: "9cd31dd1baacf2d719b466be7ef5e3acb8eef1067245eadaefea957ba8c4802d" },
    { path: "reference/raw/911Report_Ch11.htm", sha256: "0e4a709258e584c26ab6d256766c647ac4d990d8f130f3497aed30797df4dcd1" },
    { path: "reference/raw/911Report_Ch12.htm", sha256: "397157cd31ac22ca781e9f944e95224cbb800b3da7c5a040862329f2332a4651" },
    { path: "reference/raw/911Report_Ch13.htm", sha256: "6c16e75d97a9de2230e62b4668cd005446caf59d66285fdfbd6dffc1c18dff41" },
    { path: "reference/raw/911Report_App.htm", sha256: "1392fa59b29292ec066171f79688b4f0547eff8a3183b7a270bbb4975683e05f" },
    { path: "reference/raw/911Report_Notes.htm", sha256: "336523b57cdb8e1481dc800a87a31c5fcb517928047f9e078a49459825aa7f32" },
      ],
      read: readCommissionHtml,
      // A box that interrupts a paragraph mid-sentence is read before the
      // rejoined paragraph when its notes number it first ("A Case Study in
      // Terrorist Travel", notes 22-25, inside the paragraph ending on note 26;
      // reportsthatmatter-gq4j).
      floats: "by-notes",
    }),
    // A paragraph run over a page break that opens on a capital, a digit or a
    // quotation mark (or follows a full stop on a justified page) joins when the
    // layout says it runs on: no first-line indent, same face (reportsthatmatter-38s.10).
    layoutPageJoins(),
    // A quotation running over a page arrives as two (reportsthatmatter-38s.9).
    quoteListRunOns(),
    // Every note is an endnote, numbered afresh per chapter in the Notes at
    // the back; no page carries a footnote block. Read as page-foot notes,
    // the notes pages' chapter heads ("11 Foresight—and Hindsight") became
    // notes that nothing refers to, swallowing the chapter's first notes.
    endnotes(),
    // The contents numbers every section ("8.1 The Summer of Threat"); the
    // body sets them in capitals under each chapter's banner, and read as
    // caps headings they fused onto the banner or were lost into the prose.
    numberedSections(),
    // Lay the contents pages out as their entries, not headings and quotes.
    contentsEntries(),
    // A heading the contents does not name (a map label, an org-chart box) is minor.
    unlistedHeadingsMinor(),
    // Unnumbered mixed-case subheads ("The Drumbeat Begins") over their paragraph.
    shortSubheads(),
    // Strip the InDesign slug (and recover the page number from it) before
    // the running-furniture test looks at the page edges.
    productionSlug(),
    runningFurniture({ numbersTrackPages: true }),
    pageBreakContinuations(),
  ],
});
