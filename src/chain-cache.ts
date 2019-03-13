export class ChainCache<T> {
    values: T[] = [];

    constructor(public disposer: (d: T) => any) {}

    truncateAt(idx: number) {
        const { values } = this;
        for (var i = values.length - 1; i >= idx; i--) {
            const value = values[i];
            this.disposer(value);
            values[i] = null;
        }
        values.length = idx;
    }

    getAt(idx: number) {
        const { values } = this;
        return values[idx];
    }

    setAt(idx: number, value: T): boolean {
        const { values } = this;
        if (value === values[idx]) {
            return false;
        }
        this.truncateAt(idx);
        if (value) values[idx] = value;
        else debugger;

        return true;
    }
}
