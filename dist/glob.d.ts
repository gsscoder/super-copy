export declare function globPattern(pattern: string): RegExp;
export declare function hasGlobstar(pattern: string): boolean;
export declare function matchGlobstar(pattern: string, relativePath: string): boolean;
export interface FlattenCandidate {
    name: string;
    sourcePath: string;
}
export declare function assertNoFlattenCollisions(candidates: FlattenCandidate[]): void;
//# sourceMappingURL=glob.d.ts.map