/* eslint-disable no-plusplus */
import Collection from "../utils/Collection";

export default class Queue extends Collection<number, any> {
    public player: any | any[];

    public repeatTrack?: boolean;

    public repeatQueue?: boolean;

    public skipOnError?: boolean;

    public constructor(player: any, options: any | any[]) {
        super();
        this.player = player;
        this.repeatTrack = options?.repeatTrack ?? false;
        this.repeatQueue = options?.repeatQueue ?? false;
        this.skipOnError = options?.skipOnError ?? false;
    }

    public get duration(): number {
        return this.map((x) => x.length).reduce((acc, cur) => acc + cur);
    }

    public get empty(): boolean {
        return !this.size;
    }

    public toggleRepeat(type?: "track" | "queue" | "disable"): boolean {
        if (type === "track" && !this.repeatTrack) {
            this.repeatTrack = true;
            this.repeatQueue = false;
            return this.repeatTrack;
        }
        if (type === "track" && this.repeatTrack) {
            this.repeatTrack = false;
            return this.repeatTrack;
        }
        if (type === "queue" && !this.repeatQueue) {
            this.repeatQueue = true;
            this.repeatTrack = false;
            return this.repeatQueue;
        }
        if (type === "queue" && this.repeatQueue) {
            this.repeatQueue = false;
            this.repeatTrack = true;
            return this.repeatQueue;
        }
        if (type === "disable") {
            this.repeatTrack = false;
            this.repeatQueue = false;
            return false;
        }
        return false;
    }

    public add(data: any | any[]): void {
        if (!data) throw new TypeError("Provided argument is not of type \"Track\" or \"Track[]\".");

        if (Array.isArray(data)) {
            // eslint-disable-next-line no-plusplus
            for (let i = 0; i < data.length; i++) {
                this.set((this.size < 1 ? 0 : this.lastKey) + 1, data[i]);
            }
        } else {
            this.set((this.size < 1 ? 0 : this.lastKey) + 1, data);
        }
    }

    public remove(pos?: number): any {
        const track: any | any[] = this.KArray()[pos || 0];
        this.delete(track[0]);
        return track[1];
    }

    public wipe(start: number, end: number): any[] {
        if (!start) throw new RangeError("Queue#wipe() \"start\" parameter missing.");
        if (!end) throw new RangeError("Queue#wipe() \"end\" parameter missing.");
        if (start >= end) throw new RangeError("Queue#wipe() Start parameter must be smaller than end.");
        if (start >= this.size) throw new RangeError("Queue#wipe() Start parameter must be smaller than queue length.");

        const bucket: any[] = [];
        const trackArr = this.KArray();
        for (let i = start; i === end; i++) {
            const track: any | any[] = trackArr[i];
            bucket.push(track[1]);
            this.delete(track[0]);
        }
        return bucket;
    }

    public clearQueue(): void {
        const curr = this.first;
        this.clear();
        if (curr) this.set(1, curr);
    }

    public moveTrack(from: number, to: number): void {
        if (!from) throw new RangeError("Queue#moveTrack() \"from\" parameter missing.");
        if (!to) throw new RangeError("Queue#moveTrack() \"to\" parameter missing.");
        if (to > this.size) throw new RangeError(`Queue#moveTrack() The new position cannot be greater than ${this.size}.`);
        if (this.player.playing && (to === 0 || from === 0)) {
            throw new Error("Queue#moveTrack() Cannot change position or replace currently playing track.");
        }

        const arr = [...this.values()];
        const track = arr.splice(from, 1)[0];
        if (!track) {
            throw new RangeError("Queue#moveTrack() No track found at the given position.");
        }

        arr.splice(to, 0, track);
        this.clearQueue();
        for (let i = 0; i < arr.length; i++) {
            this.set(i + 1, arr[i]);
        }
    }
}
