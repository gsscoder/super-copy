import chalk from 'chalk'
import type { Source, Destination } from './types.js'

export const LABEL_WIDTH = 12

export function heading(title: string): void {
  console.log(chalk.bold(title))
}

export function keyValue(label: string, value: string): void {
  console.log(`${chalk.gray((label + ':').padEnd(LABEL_WIDTH))}${chalk.dim(value)}`)
}

export function listItem(label: string, value: string, width = LABEL_WIDTH): void {
  console.log(`${chalk.gray((label + ':').padEnd(width))}${chalk.white(value)}`)
}

export function printSourceList(sources: Source[]): void {
  const w = Math.max(...sources.map((s) => s.name.length)) + 2
  for (const s of sources) {
    const loc = s.type === 'git' && s.path ? `${s.location} [path: ${s.path}]` : s.location
    listItem(s.name, loc, w)
  }
}

export function printDestinationList(destinations: Destination[]): void {
  const w = Math.max(...destinations.map((d) => d.name.length)) + 2
  for (const d of destinations) {
    listItem(d.name, d.location, w)
  }
}

export function success(msg: string): void {
  console.log(`${chalk.green('✓')} ${chalk.white(msg)}`)
}

export function error(msg: string): void {
  console.log(`❌ ${chalk.white(msg)}`)
}

export function dim(msg: string): void {
  console.log(chalk.dim(msg))
}

export function blank(): void {
  console.log('')
}
