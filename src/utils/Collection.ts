export default class Collection<K, V> extends Map<K, V> {
    public get first(): V {
        return this.values().next().value;
    }

    public get firstKey(): K {
        return this.keys().next().value;
    }

    public get last(): V {
        const array = this.toArray();
        return array[array.length - 1];
    }

    public get lastKey(): K {
        const array = this.KArray();
        // @ts-ignore: ifnore
        return array[array.length - 1][0];
    }

    public getSome(amount: number, position: "start" | "end"): V[] | undefined {
        const arr = this.toArray();
        if (position === "start") {
            return arr.slice(amount);
        } if (position === "end") {
            return arr.slice(-amount);
        }
        return undefined;
    }

    public toArray(): V[] {
        return [...this.values()];
    }

    public KArray(): K[] {
        return [...this.keys()];
    }

    public map<T>(func: (value: V, key: K) => T): T[] {
        const mapIter = this.entries();
        return Array.from(
            { length: this.size },
            (): T => {
                const [key, val] = mapIter.next().value;
                return func(val, key);
            },
        );
    }
}
