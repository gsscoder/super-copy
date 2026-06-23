import chalk from 'chalk';
export const LABEL_WIDTH = 12;
export function heading(title) {
    console.log(chalk.bold(title));
}
export function keyValue(label, value) {
    console.log(`${chalk.gray((label + ':').padEnd(LABEL_WIDTH))}${chalk.dim(value)}`);
}
export function listItem(label, value, width = LABEL_WIDTH) {
    console.log(`${chalk.gray((label + ':').padEnd(width))}${chalk.white(value)}`);
}
export function printSourceList(sources) {
    const w = Math.max(...sources.map((s) => s.name.length)) + 2;
    for (const s of sources) {
        const loc = s.type === 'git' && s.path ? `${s.location} [path: ${s.path}]` : s.location;
        listItem(s.name, loc, w);
    }
}
export function printDestinationList(destinations) {
    const w = Math.max(...destinations.map((d) => d.name.length)) + 2;
    for (const d of destinations) {
        listItem(d.name, d.location, w);
    }
}
export function success(msg) {
    console.log(`${chalk.green('✓')} ${chalk.white(msg)}`);
}
export function error(msg) {
    console.log(`❌ ${chalk.white(msg)}`);
}
export function dim(msg) {
    console.log(chalk.dim(msg));
}
export function blank() {
    console.log('');
}
//# sourceMappingURL=ui.js.map