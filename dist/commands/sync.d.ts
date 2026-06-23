import type { Command } from 'commander';
interface GitHubFile {
    name: string;
    relativePath: string;
    downloadUrl: string;
}
export declare function fetchGitHubFiles(owner: string, repo: string, subPath: string, fileSpec: string | undefined): Promise<GitHubFile[]>;
export declare function handleSync(sourceSpec: string, destName: string, options: {
    force?: boolean;
    dryRun?: boolean;
}): Promise<void>;
export default function register(program: Command): void;
export {};
//# sourceMappingURL=sync.d.ts.map