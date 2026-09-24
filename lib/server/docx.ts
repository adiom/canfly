import { createZip } from '@/lib/server/zip'

/**
 * Сборка `.docx` (WordprocessingML) без внешних зависимостей.
 *
 * Модель документа — блоки (заголовки, абзацы, списки, цитаты, код, таблицы),
 * внутри блока — runs с инлайн-разметкой. Этого достаточно, чтобы отдать
 * книгу как настоящий документ Word: со стилями заголовков, сноской-колонтитулом
 * и нумерованными списками, а не «html с расширением .doc».
 */

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const R_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const CONTENT_TYPES_NS = 'http://schemas.openxmlformats.org/package/2006/content-types'
const CORE_NS = 'http://schemas.openxmlformats.org/package/2006/metadata/core-properties'

export interface DocxRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  code?: boolean
  href?: string
}

export interface DocxTableRow {
  header: boolean
  cells: DocxRun[][]
}

export type DocxBlock =
  | { type: 'heading'; level: number; runs: DocxRun[]; pageBreakBefore?: boolean }
  | { type: 'paragraph'; runs: DocxRun[]; quote?: boolean }
  | { type: 'listItem'; runs: DocxRun[]; ordered: boolean; level: number }
  | { type: 'code'; lines: string[] }
  | { type: 'caption'; runs: DocxRun[] }
  | { type: 'divider' }
  | { type: 'image'; alt: string; src: string }
  | { type: 'table'; rows: DocxTableRow[] }

export interface DocxDocument {
  title: string
  subtitle?: string
  author?: string
  blocks: DocxBlock[]
}

/** Гиперссылки — единственные внешние связи документа, их id выдаём по порядку. */
interface HyperlinkRegistry {
  id: (url: string) => string
  entries: () => { id: string; url: string }[]
}

function createHyperlinkRegistry(): HyperlinkRegistry {
  const ids = new Map<string, string>()
  return {
    id(url) {
      const existing = ids.get(url)
      if (existing) return existing
      const next = `rId${ids.size + 4}` // rId1-3 заняты стилями, нумерацией и колонтитулом
      ids.set(url, next)
      return next
    },
    entries() {
      return [...ids.entries()].map(([url, id]) => ({ id, url }))
    },
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function runsXml(runs: DocxRun[], hyperlinks: HyperlinkRegistry): string {
  return runs.map((run) => runXml(run, hyperlinks)).join('')
}

function runXml(run: DocxRun, hyperlinks: HyperlinkRegistry): string {
  const props: string[] = []
  if (run.code) props.push('<w:rStyle w:val="CodeChar"/>')
  if (run.bold) props.push('<w:b/>')
  if (run.italic) props.push('<w:i/>')
  if (run.strike) props.push('<w:strike/>')
  if (run.href) props.push('<w:color w:val="0B5FFF"/>')
  if (run.href) props.push('<w:u w:val="single"/>')
  if (run.underline && !run.href) props.push('<w:u w:val="single"/>')

  const rPr = props.length ? `<w:rPr>${props.join('')}</w:rPr>` : ''
  // `w:t` по схеме содержит только текст, поэтому перенос строки — это отдельный
  // `w:br` между текстовыми узлами, а не символ внутри `w:t`.
  const text = run.text
    .split('\n')
    .map((segment, index) => `${index > 0 ? '<w:br/>' : ''}<w:t xml:space="preserve">${escapeXml(segment)}</w:t>`)
    .join('')
  const xml = `<w:r>${rPr}${text}</w:r>`

  if (!run.href) return xml
  return `<w:hyperlink r:id="${hyperlinks.id(run.href)}" w:history="1">${xml}</w:hyperlink>`
}

interface ParagraphOptions {
  style?: string
  numbering?: { numId: number; level: number }
  keepNext?: boolean
  pageBreakBefore?: boolean
  divider?: boolean
  center?: boolean
}

function paragraphXml(runs: DocxRun[], hyperlinks: HyperlinkRegistry, options: ParagraphOptions = {}): string {
  const props: string[] = []
  if (options.style) props.push(`<w:pStyle w:val="${options.style}"/>`)
  if (options.keepNext) props.push('<w:keepNext/>')
  if (options.pageBreakBefore) props.push('<w:pageBreakBefore/>')
  if (options.numbering) {
    props.push(
      `<w:numPr><w:ilvl w:val="${Math.min(options.numbering.level, 8)}"/><w:numId w:val="${options.numbering.numId}"/></w:numPr>`,
    )
  }
  if (options.divider) {
    props.push('<w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="C9C9C9"/></w:pBdr>')
  }
  if (options.center) props.push('<w:jc w:val="center"/>')

  const pPr = props.length ? `<w:pPr>${props.join('')}</w:pPr>` : ''
  return `<w:p>${pPr}${runsXml(runs, hyperlinks)}</w:p>`
}

function cellXml(cell: DocxRun[], header: boolean, hyperlinks: HyperlinkRegistry): string {
  const shading = header ? '<w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>' : ''
  const body = cell.length
    ? paragraphXml(cell, hyperlinks)
    : paragraphXml([], hyperlinks)
  return `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/>${shading}<w:vAlign w:val="top"/></w:tcPr>${body}</w:tc>`
}

function tableXml(row: DocxTableRow, hyperlinks: HyperlinkRegistry, columns: number): string {
  const cells: string[] = []
  for (let index = 0; index < columns; index += 1) {
    cells.push(cellXml(row.cells[index] ?? [], row.header, hyperlinks))
  }
  return `<w:tr>${row.header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.join('')}</w:tr>`
}

function blockXml(block: DocxBlock, hyperlinks: HyperlinkRegistry): string {
  switch (block.type) {
    case 'heading':
      return paragraphXml(block.runs, hyperlinks, {
        style: `Heading${Math.min(Math.max(block.level, 1), 6)}`,
        keepNext: true,
        pageBreakBefore: block.pageBreakBefore,
      })
    case 'paragraph':
      return paragraphXml(block.runs, hyperlinks, block.quote ? { style: 'Quote' } : {})
    case 'listItem':
      return paragraphXml(block.runs, hyperlinks, {
        style: 'ListParagraph',
        numbering: { numId: block.ordered ? 2 : 1, level: block.level },
      })
    case 'code':
      return block.lines.map((line) => paragraphXml([{ text: line }], hyperlinks, { style: 'CodeBlock' })).join('')
    case 'caption':
      return paragraphXml(block.runs, hyperlinks, { style: 'Caption' })
    case 'divider':
      return paragraphXml([], hyperlinks, { divider: true })
    case 'image': {
      // Картинки не встраиваем: это внешние URL, а тянуть их в бинарные части
      // пакета на каждом запросе — лишний риск. Отдаём подпись и ссылку.
      const runs: DocxRun[] = []
      if (block.alt) runs.push({ text: block.alt, italic: true })
      if (block.src) {
        if (runs.length) runs.push({ text: ' — ' })
        runs.push({ text: block.src, href: block.src })
      }
      return runs.length ? paragraphXml(runs, hyperlinks, { style: 'Caption', center: true }) : ''
    }
    case 'table': {
      if (!block.rows.length) return ''
      const columns = block.rows.reduce((max, row) => Math.max(max, row.cells.length), 0)
      const grid = `<w:tblGrid>${Array.from({ length: columns }, () => '<w:gridCol w:w="0"/>').join('')}</w:tblGrid>`
      const rows = block.rows.map((row) => tableXml(row, hyperlinks, columns)).join('')
      const table = `<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:tblBorders><w:top w:val="single" w:sz="6" w:space="0" w:color="999999"/><w:left w:val="single" w:sz="6" w:space="0" w:color="999999"/><w:bottom w:val="single" w:sz="6" w:space="0" w:color="999999"/><w:right w:val="single" w:sz="6" w:space="0" w:color="999999"/><w:insideH w:val="single" w:sz="6" w:space="0" w:color="999999"/><w:insideV w:val="single" w:sz="6" w:space="0" w:color="999999"/></w:tblBorders><w:tblLayout w:type="autofit"/></w:tblPr>${grid}${rows}</w:tbl>`
      // Word склеивает соседние таблицы, если между ними нет абзаца.
      return `${table}${paragraphXml([], hyperlinks)}`
    }
  }
}

function numberingLevelsXml(kind: 'bullet' | 'decimal'): string {
  return Array.from({ length: 9 }, (_, level) => {
    const indent = 720 + level * 360
    const rPr =
      kind === 'bullet'
        ? '<w:rPr><w:rFonts w:ascii="Symbol" w:hAnsi="Symbol" w:hint="default"/></w:rPr>'
        : ''
    const lvlText = kind === 'bullet' ? '•' : `%${level + 1}.`
    return `<w:lvl w:ilvl="${level}"><w:start w:val="1"/><w:numFmt w:val="${kind === 'bullet' ? 'bullet' : 'decimal'}"/><w:lvlText w:val="${lvlText}"/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="${indent}" w:hanging="360"/></w:pPr>${rPr}</w:lvl>`
  }).join('')
}

/** Статичный набор стилей: Word показывает их как встроенные (Title, Heading 1–6, Quote…). */
function stylesXml(): string {
  const headings = [1, 2, 3, 4, 5, 6]
    .map((level) => {
      const size = [32, 28, 26, 24, 24, 24][level - 1]
      return `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="${level === 1 ? 240 : 320}" w:after="120"/><w:outlineLvl w:val="${level - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="${W_NS}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="ru-RU" w:eastAsia="ru-RU" w:bidi="ar-SA"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="320" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/><w:pPr><w:jc w:val="both"/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="120"/><w:jc w:val="center"/></w:pPr><w:rPr><w:b/><w:sz w:val="48"/><w:szCs w:val="48"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="360"/><w:jc w:val="center"/></w:pPr><w:rPr><w:i/><w:color w:val="595959"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:style>${headings}<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="120" w:after="200"/><w:ind w:left="567" w:right="284"/><w:jc w:val="left"/></w:pPr><w:rPr><w:i/><w:color w:val="404040"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="ListParagraph"><w:name w:val="List Paragraph"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="80"/><w:ind w:left="720"/><w:contextualSpacing/></w:pPr></w:style><w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/><w:basedOn w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="0" w:after="0"/><w:ind w:left="284"/><w:jc w:val="left"/><w:shd w:val="clear" w:color="auto" w:fill="F5F5F5"/></w:pPr><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style><w:style w:type="character" w:styleId="CodeChar"><w:name w:val="Code Char"/><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Caption"><w:name w:val="Caption"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:after="200"/></w:pPr><w:rPr><w:i/><w:color w:val="595959"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:style><w:style w:type="character" w:styleId="Hyperlink"><w:name w:val="Hyperlink"/><w:rPr><w:color w:val="0B5FFF"/><w:u w:val="single"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Footer"><w:name w:val="footer"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="0"/><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="808080"/><w:sz w:val="18"/><w:szCs w:val="18"/></w:rPr></w:style><w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:tblPr/></w:style></w:styles>`
}

function numberingXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="${W_NS}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="hybridMultilevel"/>${numberingLevelsXml('bullet')}</w:abstractNum><w:abstractNum w:abstractNumId="1"><w:multiLevelType w:val="hybridMultilevel"/>${numberingLevelsXml('decimal')}</w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num></w:numbering>`
}

function footerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="${W_NS}"><w:p><w:pPr><w:pStyle w:val="Footer"/></w:pPr><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve">PAGE</w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>1</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p></w:ftr>`
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="${CONTENT_TYPES_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
}

function rootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${RELS_NS}"><Relationship Id="rId1" Type="${R_NS}/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="${R_NS}/extended-properties" Target="docProps/app.xml"/></Relationships>`
}

function documentRelsXml(hyperlinks: { id: string; url: string }[]): string {
  const links = hyperlinks
    .map(
      (link) =>
        `<Relationship Id="${link.id}" Type="${R_NS}/hyperlink" Target="${escapeXml(link.url)}" TargetMode="External"/>`,
    )
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="${RELS_NS}"><Relationship Id="rId1" Type="${R_NS}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${R_NS}/numbering" Target="numbering.xml"/><Relationship Id="rId3" Type="${R_NS}/footer" Target="footer1.xml"/>${links}</Relationships>`
}

function coreXml({ title, author }: { title: string; author: string }): string {
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="${CORE_NS}" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(title)}</dc:title><dc:creator>${escapeXml(author)}</dc:creator><cp:lastModifiedBy>canfly</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${timestamp}</dcterms:modified><dc:language>ru-RU</dc:language></cp:coreProperties>`
}

function appXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>canfly</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0000</AppVersion></Properties>`
}

function sectPrXml(): string {
  return `<w:sectPr><w:footerReference w:type="default" r:id="rId3"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="709" w:footer="709" w:gutter="0"/><w:cols w:space="708"/><w:docGrid w:linePitch="360"/></w:sectPr>`
}

export function buildDocx({ title, subtitle, author, blocks }: DocxDocument): Buffer {
  const hyperlinks = createHyperlinkRegistry()

  const body: string[] = [paragraphXml([{ text: title }], hyperlinks, { style: 'Title' })]
  if (subtitle) body.push(paragraphXml([{ text: subtitle }], hyperlinks, { style: 'Subtitle' }))
  for (const block of blocks) body.push(blockXml(block, hyperlinks))
  body.push(sectPrXml())

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}" xmlns:r="${R_NS}"><w:body>${body.join('')}</w:body></w:document>`

  return createZip([
    { name: '[Content_Types].xml', data: contentTypesXml() },
    { name: '_rels/.rels', data: rootRelsXml() },
    { name: 'docProps/core.xml', data: coreXml({ title, author: author || 'canfly' }) },
    { name: 'docProps/app.xml', data: appXml() },
    { name: 'word/document.xml', data: documentXml },
    { name: 'word/styles.xml', data: stylesXml() },
    { name: 'word/numbering.xml', data: numberingXml() },
    { name: 'word/footer1.xml', data: footerXml() },
    { name: 'word/_rels/document.xml.rels', data: documentRelsXml(hyperlinks.entries()) },
  ])
}
