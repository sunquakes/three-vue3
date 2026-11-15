import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateRawSync } from 'node:zlib'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '../..')
const skillName = 'three-vue3'
const skillDir = join(repoRoot, '.agents', 'skills', skillName)
const outputDir = join(scriptDir, '..', 'docs', '.vuepress', 'public', 'skills')
const outputFile = join(outputDir, `${skillName}.zip`)

// Deterministic ZIP: every entry shares this DOS timestamp (2020-01-01 00:00).
const DOS_TIME = 0
const DOS_DATE = (40 << 9) | (1 << 5) | 1

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

const crc32 = (buffer) => {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const collectFiles = (directory) => {
  const entries = []
  for (const name of readdirSync(directory)) {
    const absolute = join(directory, name)
    if (statSync(absolute).isDirectory()) {
      entries.push(...collectFiles(absolute))
    } else {
      entries.push(absolute)
    }
  }
  return entries
}

const validateSkill = (markdown) => {
  if (markdown.charCodeAt(0) === 0xfeff) {
    throw new Error('SKILL.md must not start with a byte order mark')
  }
  if (!markdown.startsWith('---\n')) {
    throw new Error('SKILL.md must start with YAML frontmatter')
  }
  const end = markdown.indexOf('\n---', 4)
  if (end === -1) {
    throw new Error('SKILL.md frontmatter is not closed')
  }
  const frontmatter = markdown.slice(4, end)
  for (const field of ['name:', 'description:']) {
    if (!frontmatter.includes(field)) {
      throw new Error(`SKILL.md frontmatter is missing ${field}`)
    }
  }
}

const run = () => {
  const skillFile = join(skillDir, 'SKILL.md')
  validateSkill(readFileSync(skillFile, 'utf8'))

  const files = collectFiles(skillDir)
    .map((absolute) => ({
      absolute,
      name: `${skillName}/${relative(skillDir, absolute).split(sep).join('/')}`
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))

  const localParts = []
  const centralParts = []
  let offset = 0

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8')
    const source = readFileSync(file.absolute)
    const compressed = deflateRawSync(source, { level: 9 })
    const checksum = crc32(source)
    const digest = createHash('sha256').update(source).digest('hex')

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(DOS_TIME, 10)
    local.writeUInt16LE(DOS_DATE, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(source.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    localParts.push(local, name, compressed)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(DOS_TIME, 12)
    central.writeUInt16LE(DOS_DATE, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(source.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(offset, 42)

    centralParts.push(central, name)
    console.log(`  ${digest.slice(0, 12)}  ${file.name}`)
    offset += local.length + name.length + compressed.length
  }

  const centralSize = centralParts.reduce((size, part) => size + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)

  mkdirSync(outputDir, { recursive: true })
  writeFileSync(outputFile, Buffer.concat([...localParts, ...centralParts, end]))
  console.log(`Packed ${files.length} file(s) to ${relative(repoRoot, outputFile)}`)
}

run()
