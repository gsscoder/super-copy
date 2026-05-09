import chalk from 'chalk'

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
