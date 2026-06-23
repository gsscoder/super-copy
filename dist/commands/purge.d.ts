import { Command } from 'commander';
interface PurgeLogOptions {
    dryRun: boolean;
    force: boolean;
}
export declare function handlePurgeLog(dest: string | undefined, opts: PurgeLogOptions): Promise<void>;
export default function registerPurge(program: Command): void;
export {};
//# sourceMappingURL=purge.d.ts.map