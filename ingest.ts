import { pipeline, runningFurniture, type SplitPage } from "@rtm/ingest";

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
  // Strip the InDesign slug (and recover the page number from it) before the
  // running-furniture test looks at the page edges.
  passes: [productionSlug(), runningFurniture()],
});
