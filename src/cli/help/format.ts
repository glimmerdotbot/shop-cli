import type { FlagSpec } from './spec'

const wrapText = (text: string, width: number) => {
  const words = text.split(/\s+/).filter(Boolean)
  if (words.length === 0) return ['']
  const lines: string[] = []
  let line = words[0]!
  for (let i = 1; i < words.length; i++) {
    const word = words[i]!
    if (line.length + 1 + word.length > width) {
      lines.push(line)
      line = word
    } else {
      line += ` ${word}`
    }
  }
  lines.push(line)
  return lines
}

export const formatFlags = ({
  flags,
  indent = '  ',
  gap = 2,
  width = 88,
}: {
  flags: FlagSpec[]
  indent?: string
  gap?: number
  width?: number
}) => {
  if (flags.length === 0) return []
  const maxLabel = Math.min(
    Math.max(...flags.map((flag) => flag.label.length)),
    36,
  )
  const lines: string[] = []
  for (const flag of flags) {
    const label = flag.label.padEnd(maxLabel)
    if (!flag.description) {
      lines.push(`${indent}${label}`)
      continue
    }
    const descriptionWidth = Math.max(20, width - indent.length - maxLabel - gap)
    const wrapped = wrapText(flag.description, descriptionWidth)
    lines.push(`${indent}${label}${' '.repeat(gap)}${wrapped[0]}`)
    for (let i = 1; i < wrapped.length; i++) {
      lines.push(`${indent}${' '.repeat(maxLabel)}${' '.repeat(gap)}${wrapped[i]}`)
    }
  }
  return lines
}

export const formatSection = (title: string, lines: string[]) => {
  if (lines.length === 0) return []
  return [title, ...lines]
}
