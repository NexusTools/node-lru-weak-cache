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
        forEach(callbackfn: (value: V, key: string, map: Map<string, V>) => void, thisArg?: any): void;
        generate(key: string, generator: (key: string, callback: (err: Error, value?: V) => void) => void, callback: (err: Error, value?: V) => void): void;
        entries(): IterableIterator<[string, V]>;
        values(): IterableIterator<V>;
        has(key: string): boolean;
        readonly size: number;
        [Symbol.iterator](): IterableIterator<[string, V]>;
        keys(): IterableIterator<string>;
        readonly [Symbol.toStringTag]: "Map";
    };
};
export = _default;
