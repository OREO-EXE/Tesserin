/**
 * PPT Generator — Creates PowerPoint presentations from structured JSON
 * using PptxGenJS. Runs in the Electron main process.
 *
 * The AI agent outputs a JSON slide deck spec, and this module renders
 * it into a .pptx file saved locally — fully offline, no cloud needed.
 */

import PptxGenJS from "pptxgenjs"

// ── Slide Spec Types ──────────────────────────────────────────────────────

export interface SlideElement {
  type: "title" | "text" | "bullets" | "image" | "shape" | "code" | "table" | "chart"
  // Common positioning (inches, optional — defaults applied)
  x?: number
  y?: number
  w?: number
  h?: number
  // Content
  text?: string
  items?: string[]                  // for bullets
  src?: string                      // for image (local path or data URI)
  rows?: string[][]                 // for table
  code?: string                     // for code block
  lang?: string                     // language label for code
  chartType?: "bar" | "line" | "pie" | "doughnut"
  chartData?: { name: string; labels: string[]; values: number[] }[]
  shapeType?: "rect" | "roundRect" | "ellipse" | "line" | "arrow"
  // Styling
  fontSize?: number
  fontFace?: string
  color?: string                    // hex without # (e.g. "FFFFFF")
  bold?: boolean
  italic?: boolean
  align?: "left" | "center" | "right"
  fill?: string                     // background fill hex
  borderColor?: string
  borderWidth?: number
}

export interface SlideSpec {
  layout?: "title" | "content" | "section" | "two-column" | "blank" | "image-full"
  background?: string               // hex color or gradient
  backgroundImage?: string           // local path or data URI
  elements: SlideElement[]
  notes?: string                     // speaker notes
  transition?: "fade" | "push" | "wipe" | "none"
}

export interface DeckSpec {
  title: string
  author?: string
  subject?: string
  theme?: {
    primary?: string        // hex
    secondary?: string      // hex
    accent?: string         // hex
    background?: string     // hex
    text?: string           // hex
    fontTitle?: string
    fontBody?: string
  }
  slides: SlideSpec[]
}

// ── Theme Defaults ────────────────────────────────────────────────────────

const DEFAULT_THEME = {
  primary: "1A1A2E",
  secondary: "16213E",
  accent: "E94560",
  background: "0F0F1A",
  text: "EAEAEA",
  fontTitle: "Helvetica Neue",
  fontBody: "Helvetica Neue",
}

// ── Generator ─────────────────────────────────────────────────────────────

export function generatePptx(spec: DeckSpec): PptxGenJS {
  const theme = { ...DEFAULT_THEME, ...spec.theme }
  const pptx = new PptxGenJS()

  pptx.author = spec.author || "Tesserin"
  pptx.title = spec.title
  if (spec.subject) pptx.subject = spec.subject

  // Define slide master layouts
  pptx.defineSlideMaster({
    title: "TESSERIN_MASTER",
    background: { color: theme.background },
    objects: [
      // Subtle accent bar at the bottom
      {
        rect: {
          x: 0, y: "93%", w: "100%", h: "7%",
          fill: { color: theme.primary },
        },
      },
    ],
  })

  for (const slideSpec of spec.slides) {
    const slide = pptx.addSlide({ masterName: "TESSERIN_MASTER" })

    // Per-slide background override
    if (slideSpec.background) {
      slide.background = { color: slideSpec.background }
    }
    if (slideSpec.backgroundImage) {
      slide.background = { path: slideSpec.backgroundImage }
    }

    // Speaker notes
    if (slideSpec.notes) {
      slide.addNotes(slideSpec.notes)
    }

    // Render each element
    for (const el of slideSpec.elements) {
      renderElement(slide, el, theme)
    }
  }

  return pptx
}

function renderElement(
  slide: PptxGenJS.Slide,
  el: SlideElement,
  theme: typeof DEFAULT_THEME,
) {
  switch (el.type) {
    case "title":
      slide.addText(el.text || "", {
        x: el.x ?? 0.5,
        y: el.y ?? 0.5,
        w: el.w ?? 9,
        h: el.h ?? 1.2,
        fontSize: el.fontSize ?? 36,
        fontFace: el.fontFace ?? theme.fontTitle,
        color: el.color ?? theme.text,
        bold: el.bold ?? true,
        align: el.align ?? "left",
      })
      break

    case "text":
      slide.addText(el.text || "", {
        x: el.x ?? 0.5,
        y: el.y ?? 2,
        w: el.w ?? 9,
        h: el.h ?? 1,
        fontSize: el.fontSize ?? 18,
        fontFace: el.fontFace ?? theme.fontBody,
        color: el.color ?? theme.text,
        bold: el.bold,
        italic: el.italic,
        align: el.align ?? "left",
      })
      break

    case "bullets": {
      const bulletItems = (el.items || []).map(item => ({
        text: item,
        options: {
          fontSize: el.fontSize ?? 16,
          color: el.color ?? theme.text,
          bullet: { code: "2022" as const, color: theme.accent },
          paraSpaceAfter: 8,
        },
      }))
      slide.addText(bulletItems, {
        x: el.x ?? 0.5,
        y: el.y ?? 2,
        w: el.w ?? 9,
        h: el.h ?? 4,
        fontFace: el.fontFace ?? theme.fontBody,
        valign: "top",
      })
      break
    }

    case "code": {
      // Render code as a monospace text box with dark background
      const codeLabel = el.lang ? `  ${el.lang.toUpperCase()}` : ""
      const codeContent = el.code || el.text || ""

      if (codeLabel) {
        slide.addText(codeLabel, {
          x: el.x ?? 0.5,
          y: (el.y ?? 2.5) - 0.3,
          w: el.w ?? 9,
          h: 0.3,
          fontSize: 10,
          fontFace: "Courier New",
          color: theme.accent,
          bold: true,
          fill: { color: "1E1E2E" },
          align: "left",
        })
      }

      slide.addText(codeContent, {
        x: el.x ?? 0.5,
        y: el.y ?? 2.5,
        w: el.w ?? 9,
        h: el.h ?? 2.5,
        fontSize: el.fontSize ?? 12,
        fontFace: "Courier New",
        color: el.color ?? "D4D4D4",
        fill: { color: el.fill ?? "1E1E2E" },
        align: "left",
        valign: "top",
        paraSpaceBefore: 4,
        lineSpacingMultiple: 1.2,
      })
      break
    }

    case "table": {
      if (!el.rows || el.rows.length === 0) break
      const tableRows: PptxGenJS.TableRow[] = el.rows.map((row, rowIdx) =>
        row.map(cell => ({
          text: cell,
          options: {
            fontSize: el.fontSize ?? 13,
            fontFace: el.fontFace ?? theme.fontBody,
            color: rowIdx === 0 ? "FFFFFF" : theme.text,
            fill: {
              color: rowIdx === 0 ? theme.accent : (rowIdx % 2 === 0 ? "1A1A2E" : "16213E"),
            },
            border: { type: "solid" as const, color: "333355", pt: 0.5 },
            align: el.align ?? "left",
            valign: "middle" as const,
            margin: [4, 6, 4, 6] as [number, number, number, number],
          },
        }))
      )
      slide.addTable(tableRows, {
        x: el.x ?? 0.5,
        y: el.y ?? 2,
        w: el.w ?? 9,
        colW: el.rows[0] ? Array(el.rows[0].length).fill((el.w ?? 9) / el.rows[0].length) : undefined,
        autoPage: true,
        autoPageRepeatHeader: true,
      })
      break
    }

    case "image":
      if (el.src) {
        const opts: any = {
          x: el.x ?? 1,
          y: el.y ?? 1.5,
          w: el.w ?? 8,
          h: el.h ?? 4.5,
        }
        if (el.src.startsWith("data:")) {
          opts.data = el.src
        } else {
          opts.path = el.src
        }
        slide.addImage(opts)
      }
      break

    case "shape": {
      const shapeMap: Record<string, PptxGenJS.ShapeType> = {
        rect: pptxShapeType("rect"),
        roundRect: pptxShapeType("roundRect"),
        ellipse: pptxShapeType("ellipse"),
        line: pptxShapeType("line"),
        arrow: pptxShapeType("rightArrow"),
      }
      slide.addShape(shapeMap[el.shapeType || "rect"] || shapeMap.rect, {
        x: el.x ?? 1,
        y: el.y ?? 2,
        w: el.w ?? 3,
        h: el.h ?? 2,
        fill: { color: el.fill ?? theme.accent },
        line: el.borderColor ? { color: el.borderColor, width: el.borderWidth ?? 1 } : undefined,
      })
      // Add text inside shape if provided
      if (el.text) {
        slide.addText(el.text, {
          x: el.x ?? 1,
          y: el.y ?? 2,
          w: el.w ?? 3,
          h: el.h ?? 2,
          fontSize: el.fontSize ?? 14,
          fontFace: el.fontFace ?? theme.fontBody,
          color: el.color ?? "FFFFFF",
          align: "center",
          valign: "middle",
        })
      }
      break
    }

    case "chart": {
      if (!el.chartData || el.chartData.length === 0) break
      const chartTypeMap: Record<string, PptxGenJS.CHART_NAME> = {
        bar: pptxChartType("bar"),
        line: pptxChartType("line"),
        pie: pptxChartType("pie"),
        doughnut: pptxChartType("doughnut"),
      }
      slide.addChart(
        chartTypeMap[el.chartType || "bar"] || chartTypeMap.bar,
        el.chartData,
        {
          x: el.x ?? 0.5,
          y: el.y ?? 2,
          w: el.w ?? 9,
          h: el.h ?? 4.5,
          showLegend: true,
          legendPos: "b",
          showValue: el.chartType === "pie" || el.chartType === "doughnut",
          chartColors: [theme.accent, theme.primary, "4ECDC4", "FFD93D", "6C5CE7", "A8E6CF"],
        },
      )
      break
    }
  }
}

// Helper to get PptxGenJS shape type constants
function pptxShapeType(name: string): PptxGenJS.ShapeType {
  const pptx = new PptxGenJS()
  const shapes = pptx.ShapeType as any
  const map: Record<string, string> = {
    rect: "rect",
    roundRect: "roundRect",
    ellipse: "ellipse",
    line: "line",
    rightArrow: "rightArrow",
  }
  return shapes[map[name] || "rect"]
}

function pptxChartType(name: string): PptxGenJS.CHART_NAME {
  const pptx = new PptxGenJS()
  const charts = pptx.ChartType as any
  const map: Record<string, string> = {
    bar: "bar",
    line: "line",
    pie: "pie",
    doughnut: "doughnut",
  }
  return charts[map[name] || "bar"]
}

/**
 * Generate a PPTX and write it to disk.
 * Returns the absolute path to the saved file.
 */
export async function generateAndSavePptx(spec: DeckSpec, outputPath: string): Promise<string> {
  const pptx = generatePptx(spec)
  await pptx.writeFile({ fileName: outputPath })
  return outputPath
}

/**
 * Generate a PPTX and return it as a base64 string (for IPC transfer).
 */
export async function generatePptxBase64(spec: DeckSpec): Promise<string> {
  const pptx = generatePptx(spec)
  const output = await pptx.write({ outputType: "base64" })
  return output as string
}

// ── Markdown-to-DeckSpec Parser ───────────────────────────────────────────
// Converts a simple markdown format into a DeckSpec, so quantized LLMs
// don't have to produce valid JSON. Much more forgiving.
//
// Format:
//   # Deck Title
//
//   ---
//   ## Slide Title
//   Body text paragraph
//
//   - Bullet one
//   - Bullet two
//
//   ```python
//   print("hello")
//   ```
//
//   | Col1 | Col2 |
//   | a    | b    |
//   | c    | d    |
//
//   > Speaker notes go here
//
//   ---
//   ## Next Slide
//   ...

export function parseMarkdownToDeck(markdown: string): DeckSpec {
  const lines = markdown.split("\n")
  let deckTitle = "Presentation"
  const slides: SlideSpec[] = []

  // Extract deck title from first # heading
  for (let i = 0; i < lines.length; i++) {
    const h1 = lines[i].match(/^#\s+(.+)/)
    if (h1) {
      deckTitle = h1[1].trim()
      lines.splice(i, 1)
      break
    }
  }

  // Split on --- separators
  const slideBlocks: string[] = []
  let currentBlock = ""
  for (const line of lines) {
    if (/^---+\s*$/.test(line.trim())) {
      if (currentBlock.trim()) slideBlocks.push(currentBlock.trim())
      currentBlock = ""
    } else {
      currentBlock += line + "\n"
    }
  }
  if (currentBlock.trim()) slideBlocks.push(currentBlock.trim())

  // If no --- separators found, treat each ## heading as a slide break
  if (slideBlocks.length <= 1 && markdown.includes("##")) {
    const byHeading = markdown.split(/(?=^##\s)/m).filter(b => b.trim())
    if (byHeading.length > 1) {
      slideBlocks.length = 0
      for (const block of byHeading) {
        if (block.trim() && !block.match(/^#\s+/)) {
          slideBlocks.push(block.trim())
        }
      }
    }
  }

  for (const block of slideBlocks) {
    const elements: SlideElement[] = []
    const blockLines = block.split("\n")
    let yPos = 0.5
    let i = 0

    while (i < blockLines.length) {
      const line = blockLines[i]

      // ## Slide title
      const h2 = line.match(/^##\s+(.+)/)
      if (h2) {
        elements.push({ type: "title", text: h2[1].trim(), y: yPos })
        yPos += 1.3
        i++
        continue
      }

      // ### Subtitle (render as bold text)
      const h3 = line.match(/^###\s+(.+)/)
      if (h3) {
        elements.push({ type: "text", text: h3[1].trim(), y: yPos, bold: true, fontSize: 22 })
        yPos += 0.8
        i++
        continue
      }

      // > Speaker notes
      if (line.trim().startsWith(">")) {
        // Collect contiguous > lines
        const noteLines: string[] = []
        while (i < blockLines.length && blockLines[i].trim().startsWith(">")) {
          noteLines.push(blockLines[i].trim().replace(/^>\s*/, ""))
          i++
        }
        // Store as pseudo-element; extracted into slide.notes after the loop
        elements.push({ type: "text", text: `__NOTES__${noteLines.join(" ")}` } as any)
        continue
      }

      // Code block ```lang
      if (line.trim().startsWith("```")) {
        const lang = line.trim().replace(/^```/, "").trim()
        const codeLines: string[] = []
        i++
        while (i < blockLines.length && !blockLines[i].trim().startsWith("```")) {
          codeLines.push(blockLines[i])
          i++
        }
        i++ // skip closing ```
        elements.push({
          type: "code",
          code: codeLines.join("\n"),
          lang: lang || undefined,
          y: yPos,
        })
        yPos += Math.min(2.5, 0.3 * codeLines.length + 0.5)
        continue
      }

      // Table: | col | col |
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        const tableRows: string[][] = []
        while (i < blockLines.length && blockLines[i].trim().startsWith("|")) {
          const row = blockLines[i].trim()
          // Skip separator rows like |---|---|
          if (/^\|[\s-|]+\|$/.test(row)) {
            i++
            continue
          }
          const cells = row.split("|").filter(c => c.trim()).map(c => c.trim())
          if (cells.length > 0) tableRows.push(cells)
          i++
        }
        if (tableRows.length > 0) {
          elements.push({ type: "table", rows: tableRows, y: yPos })
          yPos += Math.min(3, 0.4 * tableRows.length + 0.5)
        }
        continue
      }

      // Bullet list: - item or * item
      if (/^\s*[-*]\s+/.test(line)) {
        const items: string[] = []
        while (i < blockLines.length && /^\s*[-*]\s+/.test(blockLines[i])) {
          items.push(blockLines[i].replace(/^\s*[-*]\s+/, "").trim())
          i++
        }
        elements.push({ type: "bullets", items, y: yPos })
        yPos += Math.min(3, 0.35 * items.length + 0.3)
        continue
      }

      // Numbered list: 1. item
      if (/^\s*\d+\.\s+/.test(line)) {
        const items: string[] = []
        while (i < blockLines.length && /^\s*\d+\.\s+/.test(blockLines[i])) {
          items.push(blockLines[i].replace(/^\s*\d+\.\s+/, "").trim())
          i++
        }
        elements.push({ type: "bullets", items, y: yPos })
        yPos += Math.min(3, 0.35 * items.length + 0.3)
        continue
      }

      // Empty line — skip
      if (!line.trim()) {
        i++
        continue
      }

      // Regular text paragraph
      const textLines: string[] = [line.trim()]
      i++
      while (i < blockLines.length
        && blockLines[i].trim()
        && !blockLines[i].match(/^##/)
        && !blockLines[i].match(/^[-*]\s/)
        && !blockLines[i].match(/^\d+\.\s/)
        && !blockLines[i].trim().startsWith("|")
        && !blockLines[i].trim().startsWith("```")
        && !blockLines[i].trim().startsWith(">")
      ) {
        textLines.push(blockLines[i].trim())
        i++
      }
      elements.push({ type: "text", text: textLines.join(" "), y: yPos })
      yPos += 0.8
    }

    // Extract speaker notes from the pseudo-element
    let notes: string | undefined
    const realElements = elements.filter(el => {
      if ((el as any).text?.startsWith("__NOTES__")) {
        notes = (el as any).text.replace("__NOTES__", "")
        return false
      }
      return true
    })

    if (realElements.length > 0) {
      slides.push({ elements: realElements, notes })
    }
  }

  // If no slides were parsed, create a single title slide
  if (slides.length === 0) {
    slides.push({
      elements: [
        { type: "title", text: deckTitle, y: 2 },
        { type: "text", text: markdown.slice(0, 500), y: 3.5 },
      ],
    })
  }

  return { title: deckTitle, slides }
}

/**
 * Generate a PPTX from markdown and write it to disk.
 */
export async function generateFromMarkdownAndSave(markdown: string, outputPath: string): Promise<string> {
  const spec = parseMarkdownToDeck(markdown)
  return generateAndSavePptx(spec, outputPath)
}
