import type { Source, Destination } from './types.js';
export declare const LABEL_WIDTH = 12;
export declare function heading(title: string): void;
export declare function keyValue(label: string, value: string): void;
export declare function listItem(label: string, value: string, width?: number): void;
export declare function printSourceList(sources: Source[]): void;
export declare function printDestinationList(destinations: Destination[]): void;
export declare function success(msg: string): void;
export declare function error(msg: string): void;
export declare function dim(msg: string): void;
export declare function blank(): void;
//# sourceMappingURL=ui.d.ts.map