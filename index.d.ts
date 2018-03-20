declare const _default: {
    new <V extends object>(options?: {
        timeout?: number;
        capacity?: number;
        retimeOnAccess?: boolean;
    }): {
        accesses: {
            [index: string]: number;
        };
        timeouts: {
            [index: string]: number;
        };
        destructors: {
            [index: string]: Function;
        };
        generateQueue: {
            [index: string]: ((err: Error, value?: V) => void)[];
        };
        retimeOnAccess: boolean;
        capacity: number;
        timeout: number;
        clear(): void;
        delete(key: string): boolean;
        makeDestruct(key: string): () => void;
        set(key: string, value: V): any;
        get(key: string): V;
        generate(key: string, generator: (key: string, callback: (err: Error, value?: V) => void) => void, callback: (err: Error, value?: V) => void): void;
        forEach(callbackfn: (value: V, key: string, map: Map<string, V>) => void, thisArg?: any): void;
        has(key: string): boolean;
        readonly size: number;
        [Symbol.iterator](): IterableIterator<[string, V]>;
        entries(): IterableIterator<[string, V]>;
        keys(): IterableIterator<string>;
        values(): IterableIterator<V>;
        readonly [Symbol.toStringTag]: "Map";
    };
};
export = _default;
