import type { Command } from 'commander';
export interface ResyncOptions {
    dryRun: boolean;
    unghost: boolean;
}
export declare function handleResync(dest: string, opts: ResyncOptions): Promise<void>;
export default function registerResync(program: Command): void;
//# sourceMappingURL=resync.d.ts.map