export interface GitSource {
    type: 'git';
    name: string;
    location: string;
    path?: string;
}
export interface LocalSource {
    type: 'local';
    name: string;
    location: string;
}
export type Source = GitSource | LocalSource;
export interface Destination {
    name: string;
    location: string;
}
export interface CopyRecord {
    source: string;
    destination: string;
    file: string;
    sourcePath?: string;
    copiedAt?: string;
    index?: number;
    ghosted?: boolean;
}
export interface Prefs {
    'sync.allowOverwrite': boolean;
}
export interface AppState {
    tips: Record<string, boolean>;
}
export interface ScopyConfig {
    sources: Source[];
    destinations: Destination[];
    prefs?: Prefs;
    state?: AppState;
}
export interface CopiesConfig {
    copies: CopyRecord[];
}
export interface PackageJson {
    name: string;
    description: string;
    version: string;
}
export declare function isPackageJson(v: unknown): v is PackageJson;
//# sourceMappingURL=types.d.ts.map