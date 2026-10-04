/**
 * Reads the Commission's own HTML edition (reference/raw/911Report_*.htm, the
 * UNT CyberCemetery mirror of 9-11commission.gov) into the blocks the hybrid
 * source mode serves (@rtm/ingest `cleanEdition`).
 *
 * What the markup means is a property of this source, so it lives here:
 *
 * - One file per part, in reading order: front matter (contents, list of
 *   illustrations, members, staff), preface, chapters 1-13, appendices,
 *   notes. The executive summary is a separate publication, not in the PDF,
 *   and is left out.
 * - The text sits between the archive's navigation (`class="navText"`) and
 *   its side navigation (`<!-- SideNav -->`).
 * - `<h2>` is a chapter or part title ("1<p>"WE HAVE SOME PLANES"": the
 *   number is dropped, as the PDF build does); `<h4>` a numbered section,
 *   titled as the contents titles it ("1.1 INSIDE THE FOUR FLIGHTS" becomes
 *   "1.1 Inside the Four Flights"); `<h3>` a minor heading in the appendices.
 * - A bold head ending in `<br>` ("<strong>The Hijacking of American 11</strong><br>")
 *   is a minor heading; a bold run-in head without one ("<strong>Newark:
 *   United 93</strong>. Between…") stays in its paragraph, bold.
 * - A bordered table is a box of prose; a table whose cells hold paragraphs is
 *   layout; any other table is data (the flight timelines, appendices A and
 *   B), and the list of illustrations is contents entries.
 * - `<sup>N</sup>` in chapter C is note N of chapter C in Notes, labelled
 *   `N-C` (rendered as N): the link is positional in the HTML, and the label
 *   makes it explicit, so a repeated number can never open another chapter's
 *   note.
 * - In Notes, "N. text" under chapter C's heading opens note N-C, and every
 *   other paragraph continues the note before it.
 */
import { htmlEvents, inlineMarkdown, inlineText, type Edition, type EditionBlock, type EditionNote, type HtmlEvent, type InlinePiece } from "@rtm/ingest";

/**
 * Section titles the HTML's contents gets wrong, checked against the PDF's
 * contents (printed p. v): "Adaptation-and Nonadaptation-in" lost both em
 * dashes and the ellipsis that runs it into 3.3-3.7's ". . . and in".
 */
const ERRATA: Record<string, string> = {
  "3.2": "Adaptation\u2014and Nonadaptation\u2014 . . . in the Law Enforcement Community",
};

export const PARTS = ["FM", "Pref", ...Array.from({ length: 13 }, (_, i) => `Ch${i + 1}`), "App", "Notes"];

type Table = { kind: "box" | "layout" | "data"; float: boolean; rows: InlinePiece[][][]; header: boolean[]; row: InlinePiece[][] | null; cell: InlinePiece[] | null; align?: string };

function bodyOf(html: string): string {
  const nav = html.indexOf('class="navText"');
  const start = html.indexOf("</div>", nav) + "</div>".length;
  const end = html.indexOf("<!-- SideNav -->");
  if (nav < 0 || end < 0) throw new Error("commission-html: page layout not recognised");
  return html.slice(start, end);
}

/** A table's kind, read ahead to its closing tag. */
/** Whether a table holds an image (a photo grid or a captioned figure). */
function hasImage(events: HtmlEvent[], at: number): boolean {
  let depth = 0;
  for (let i = at; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "start" && e.tag === "table") depth++;
    else if (e.kind === "end" && e.tag === "table" && --depth === 0) return false;
    else if (e.kind === "start" && e.tag === "img") return true;
  }
  return false;
}

/** The next event that is not whitespace. */
function nextContent(events: HtmlEvent[], at: number): HtmlEvent | undefined {
  for (let i = at + 1; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "text" && !e.text.trim()) continue;
    return e;
  }
  return undefined;
}

function classify(events: HtmlEvent[], at: number): Table["kind"] {
  const open = events[at] as Extract<HtmlEvent, { kind: "start" }>;
  if ((open.attrs.border ?? "0") !== "0") return "box";
  let depth = 0;
  for (let i = at; i < events.length; i++) {
    const e = events[i];
    if (e.kind === "start" && e.tag === "table") depth++;
    else if (e.kind === "end" && e.tag === "table" && --depth === 0) break;
    else if (depth === 1 && e.kind === "start" && e.tag === "p") return "layout";
  }
  return "data";
}

const plain = (pieces: InlinePiece[]) =>
  inlineMarkdown(pieces.map((p) => ("marker" in p ? p : { text: p.text, em: p.em })));
const words = (pieces: InlinePiece[]) => plain(pieces).split(/\s+/).filter(Boolean).length;
const hasText = (pieces: InlinePiece[]) => pieces.some((p) => "text" in p && p.text.trim());

/**
 * A few notes in the HTML run on in the paragraph before them ("…(Sept. 22,
 * 2003). 108. Peter Zalewski interview…"). Only the next number in sequence,
 * after the end of a citation, opens the note it names.
 */
function splitRunOnNotes(notes: EditionNote[], chapter: number): void {
  for (;;) {
    const last = notes[notes.length - 1];
    const [number, ch] = last.label.split("-").map(Number);
    if (ch !== chapter) return;
    const next = number + 1;
    const m = new RegExp(`(?<=[.;)"] )${next}\\.\\s*(?=[A-Z"(])`).exec(last.text);
    if (!m) return;
    notes.push({ label: `${next}-${chapter}`, text: last.text.slice(m.index + m[0].length) });
    last.text = last.text.slice(0, m.index).trimEnd();
  }
}

/**
 * A handful of markers are plain digits in the HTML, not `<sup>`
 * ("…for jihad training.52", "…Inspector General.86We will"). Only the next
 * number in the chapter's sequence, straight after sentence punctuation, is
 * taken for one. A clock time is not: "at 8:42 the United 175 flight crew"
 * fell on Chapter 1's next note, 42 (reportsthatmatter-gq4j).
 */
function recoverPlainMarkers(blocks: EditionBlock[], chapter: number): void {
  let expected = 1;
  const fix = (text: string): string =>
    text.replace(/\[\^(\d+)-\d+\]|(?<=[.,;:?!"')*])(?<!\d:)(\d{1,3})(?=\s|$|[A-Z])/g, (whole, marker: string | undefined, plain: string | undefined, at: number, all: string) => {
      if (marker) {
        expected = Number(marker) + 1;
        return whole;
      }
      if (Number(plain) !== expected) return whole;
      expected++;
      // "…Inspector General.86We will recap": the next word lost its space too
      return `[^${plain}-${chapter}]${/[A-Z]/.test(all[at + whole.length] ?? "") ? " " : ""}`;
    });
  for (const block of blocks) {
    if (block.kind === "paragraph" || block.kind === "quote") block.text = fix(block.text);
    else if (block.kind === "list") block.items = block.items.map(fix);
  }
}

export function readCommissionHtml(files: Array<{ path: string; text: string }>): Edition {
  const blocks: EditionBlock[] = [];
  const notes: EditionNote[] = [];
  /** "1.1" → "Inside the Four Flights", from the contents. */
  const sectionTitles = new Map<string, string>();
  /** A numbered section's heading, titled as the contents titles it; undefined if not one. */
  const sectionHeading = (text: string): EditionBlock | undefined => {
    const m = /^(\d{1,2}\.\d{1,2})\s/.exec(text);
    const title = m ? (ERRATA[m[1]] ?? sectionTitles.get(m[1])) : undefined;
    return title ? { kind: "heading", level: 3, text: `${m![1]} ${title}` } : undefined;
  };

  for (const file of files) {
    const part = /911Report_(\w+)\.htm$/.exec(file.path)![1];
    const chapter = part.startsWith("Ch") ? Number(part.slice(2)) : null;
    const events = htmlEvents(bodyOf(file.text));
    const firstBlock = blocks.length;

    let cur: { kind: "paragraph" | "quote" | "item"; pieces: InlinePiece[]; strongOnly: boolean; float?: boolean } | null = null;
    /** A figure's caption paragraph: the PDF set it wherever its page had room. */
    let floatParagraph = false;
    let heading: { tag: string; pieces: InlinePiece[] } | null = null;
    let list: string[] | null = null;
    let quote = 0;
    let strong = 0;
    let em = 0;
    let sup: string | null = null;
    const tables: Table[] = [];
    let notesChapter: number | null = null;
    let inIllustrations = false;

    const table = () => tables[tables.length - 1];
    const inData = () => table()?.kind === "data";
    const inAnyTable = () => tables.length > 0;

    const emit = (block: EditionBlock) => {
      // figures and boxes are floats: assembleEdition rejoins a paragraph one interrupts mid-sentence
      if (floatParagraph || tables.some((t) => t.float)) block.float = true;
      if (notesChapter !== null) {
        // in Notes, under a chapter: "N. text" opens a note, anything else continues one
        const text = block.kind === "list" ? block.items.join(" ") : "text" in block ? block.text : "";
        const m = /^(\d{1,3})\.(?!\d)\s*([\s\S]*)$/.exec(text);
        // only the next number opens a note: "…moving into a motel on April / 30. FBI report" is one note
        const last = notes[notes.length - 1];
        const expected = last && last.label.endsWith(`-${notesChapter}`) ? Number(last.label.split("-")[0]) + 1 : 1;
        if (m && block.kind === "paragraph" && Number(m[1]) === expected) notes.push({ label: `${m[1]}-${notesChapter}`, text: m[2] });
        else if (notes.length && text) notes[notes.length - 1].text += ` ${text}`;
        else if (text) blocks.push(block);
        splitRunOnNotes(notes, notesChapter);
        return;
      }
      blocks.push(block);
    };
    const closeList = () => {
      if (list?.length) emit({ kind: "list", items: list });
      list = null;
    };
    const flush = () => {
      floatParagraph = Boolean(cur?.float);
      try {
        flushBlock();
      } finally {
        floatParagraph = false;
      }
    };
    const flushBlock = () => {
      const c = cur;
      cur = null;
      if (!c || !hasText(c.pieces)) return;
      // notes are set as plain text by the renderer: no emphasis, no escapes
      const render = notesChapter === null ? inlineMarkdown : inlineText;
      if (c.kind === "item") {
        (list ??= []).push(render(c.pieces));
        return;
      }
      closeList();
      const markers = c.pieces.some((p) => "marker" in p);
      if (c.strongOnly && !inAnyTable() && !markers && words(c.pieces) <= 14 && notesChapter === null) {
        // "<p><strong>2.5 AL QAEDA'S RENEWAL IN AFGHANISTAN (1996-1998)</strong>": a section the HTML did not tag <h4>
        emit(sectionHeading(plain(c.pieces)) ?? { kind: "heading", level: 4, text: plain(c.pieces) });
        return;
      }
      const text = render(c.pieces);
      // A transcript line with its speaker in bold ("**American 11:** We have some planes") is a
      // paragraph, as the HTML sets most of them: each line stays citable and markable on its own.
      emit({ kind: c.kind === "quote" && /^\*\*[^*]{1,60}(?::\*\*|\*\*:) ?/.test(text) ? "paragraph" : c.kind, text });
    };
    const open = (kind: "paragraph" | "quote" | "item") => {
      flush();
      cur = { kind, pieces: [], strongOnly: true };
    };
    const add = (piece: InlinePiece) => {
      if (heading) {
        heading.pieces.push(piece);
        return;
      }
      if (inData()) {
        table().cell?.push(piece);
        return;
      }
      if (!cur) {
        if ("text" in piece && !piece.text.trim()) return;
        open(quote ? "quote" : list ? "item" : "paragraph");
      }
      cur!.pieces.push(piece);
      if ("text" in piece && piece.text.trim() && !piece.strong) cur!.strongOnly = false;
      if ("marker" in piece) cur!.strongOnly = false;
    };

    const closeHeading = () => {
      const h = heading!;
      heading = null;
      const text = plain(h.pieces);
      if (!text) return;
      if (part === "Notes" && h.tag === "h2") {
        const m = /^(\d{1,2})\s/.exec(text);
        if (m) {
          notesChapter = Number(m[1]);
          return;
        }
      }
      if (part === "FM" && h.tag === "h4") {
        // a contents entry for a chapter: "1. "WE HAVE SOME PLANES"  1"
        const m = /^(.*?)\s+(\d{1,3})$/.exec(text);
        if (m) {
          emit({ kind: "contents", text: m[1], page: m[2] });
          return;
        }
      }
      if (part === "FM" && h.tag === "h2") inIllustrations = /ILLUSTRATIONS/.test(text);
      if (h.tag === "h4") {
        emit(sectionHeading(text) ?? { kind: "heading", level: 3, text });
        return;
      }
      if (h.tag === "h3") {
        emit({ kind: "heading", level: 4, text });
        return;
      }
      emit({ kind: "heading", level: 2, text: chapter ? text.replace(/^\d{1,2}\s+/, "") : text });
    };

    const endTable = () => {
      const t = tables.pop()!;
      if (t.kind !== "data") return;
      const rows = t.rows
        .map((row) => row.map((cell) => inlineMarkdown(cell)))
        .filter((row) => row.some((cell) => cell));
      if (!rows.length) return;
      if (inIllustrations) {
        // the list of illustrations: "p. 15 | FAA Air Traffic Control Centers"
        for (const [where, title] of rows) emit({ kind: "contents", text: title, page: where.replace(/^p\.\s*/, "") });
        return;
      }
      const width = Math.max(...rows.map((row) => row.length));
      if (width === 1) {
        emit({ kind: "paragraph", text: rows.map((row) => row[0]).join(" ") });
        return;
      }
      const header = t.rows.length > 0 && t.header[t.rows.findIndex((row) => row.some((cell) => hasText(cell)))] === true;
      emit({ kind: "table", rows, header });
    };

    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.kind === "text") {
        if (sup !== null) {
          sup += e.text;
          continue;
        }
        add({ text: e.text, em: em > 0, strong: strong > 0 && !heading });
        continue;
      }
      const tag = e.tag;
      if (e.kind === "start") {
        switch (tag) {
          case "h1":
          case "h2":
          case "h3":
          case "h4":
            flush();
            closeList();
            heading = { tag, pieces: [] };
            break;
          case "p":
            if (heading) add({ text: " " });
            else if (inData()) table().cell?.push({ text: " " });
            else {
              open(quote ? "quote" : "paragraph");
              const next = nextContent(events, i);
              if (next?.kind === "start" && next.tag === "img") cur!.float = true;
            }
            break;
          case "blockquote":
            flush();
            quote++;
            break;
          case "ul":
          case "ol":
            flush();
            closeList();
            list = [];
            break;
          case "li":
            open("item");
            break;
          case "br":
            if (part === "App" && !heading && !inData() && cur && hasText(cur.pieces)) {
              // the hearings: one line per session title, witness and place
              cur.kind = "item";
              flush();
              open("item");
            } else if (!heading && !inData() && cur && cur.strongOnly && hasText(cur.pieces)) {
              // "<strong>Boarding the Flights<br>Boston: …</strong>": the head before the break is a heading
              const head = plain(cur.pieces);
              const kind = cur.kind;
              cur = null;
              closeList();
              if (notesChapter === null) emit({ kind: "heading", level: 4, text: head });
              cur = { kind, pieces: [], strongOnly: true };
            } else if (!heading && !inData() && cur && !hasText(cur.pieces)) {
              // a break before any text
            } else add({ text: " " });
            break;
          case "strong":
          case "b":
            strong++;
            break;
          case "em":
          case "i":
            em++;
            break;
          case "sup":
            sup = "";
            break;
          case "table":
            flush();
            closeList();
            {
              const kind = classify(events, i);
              tables.push({ kind, float: kind === "box" || hasImage(events, i), rows: [], header: [], row: null, cell: null });
            }
            break;
          case "tr":
            if (inData()) {
              table().row = [];
              table().rows.push(table().row!);
              table().header.push(true);
            }
            break;
          case "td":
          case "th":
            if (inData()) {
              const t = table();
              if (!t.row) {
                t.row = [];
                t.rows.push(t.row);
                t.header.push(true);
              }
              t.cell = [];
              t.row.push(t.cell);
              const span = Number(e.attrs.colspan ?? "1");
              for (let k = 1; k < span; k++) t.row.push([]);
            } else flush();
            break;
        }
        continue;
      }
      // end tags
      switch (tag) {
        case "h1":
        case "h2":
        case "h3":
        case "h4":
          if (heading) closeHeading();
          break;
        case "blockquote":
          flush();
          quote = Math.max(0, quote - 1);
          break;
        case "ul":
        case "ol":
          flush();
          closeList();
          break;
        case "strong":
        case "b":
          strong = Math.max(0, strong - 1);
          break;
        case "em":
        case "i":
          em = Math.max(0, em - 1);
          break;
        case "sup": {
          const label = (sup ?? "").trim();
          sup = null;
          if (/^\d{1,3}$/.test(label) && chapter) add({ marker: `${label}-${chapter}` });
          else if (label) add({ text: label, em: em > 0 });
          break;
        }
        case "td":
        case "th":
          if (inData()) {
            const t = table();
            // a header row is one whose every cell is bold
            const cell = t.cell ?? [];
            if (cell.some((p) => "text" in p && p.text.trim() && !p.strong)) t.header[t.header.length - 1] = false;
            t.cell = null;
          } else flush();
          break;
        case "table":
          if (!inData()) flush();
          if (tables.length) endTable();
          break;
      }
    }
    flush();
    closeList();

    if (chapter) recoverPlainMarkers(blocks.slice(firstBlock), chapter);

    if (part === "FM") {
      // the contents lists each section; its titles name the sections' headings
      for (const block of blocks) {
        if (block.kind !== "list") continue;
        for (const item of block.items) {
          const m = /^(\d{1,2}\.\d{1,2})\s+(.*?)\s+(\d{1,3})$/.exec(item);
          if (m) sectionTitles.set(m[1], m[2]);
        }
      }
      // contents entries: "Preface xv", the section items, "Notes 449"
      for (let k = 0; k < blocks.length; k++) {
        const block = blocks[k];
        const entry = (text: string) => /^(.*?)\s+([ivxlc]+(?:-[ivxlc]+)?|\d{1,3}(?:-\d{1,3})?)$/i.exec(text.replace(/\*/g, "").replace(/\\+$/, "").trim());
        if (block.kind === "paragraph") {
          const m = entry(block.text);
          if (m && blocks.slice(k).some((b) => b.kind === "contents" || b.kind === "list")) blocks[k] = { kind: "contents", text: m[1], page: m[2] };
        } else if (block.kind === "list") {
          const entries = block.items.map(entry);
          if (entries.every(Boolean)) {
            blocks.splice(k, 1, ...entries.map((m) => ({ kind: "contents" as const, text: m![1], page: m![2] })));
            k += entries.length - 1;
          }
        }
      }
    }
  }

  return { blocks, notes };
}
