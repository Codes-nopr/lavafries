/* eslint-disable prefer-destructuring */
/* eslint-disable no-case-declarations */
/* eslint-disable no-promise-executor-return */
import { request } from "undici";
import BigNumber from "bignumber.js";
import LavaFries from "./FriesLava";
import Queue from "./FriesQueue";
import Utils from "../utils/Utils";
import check from "../utils/Check";

export default class FriesPlayer<T = unknown> {
    public lavafries: any;

    public options: any;

    public node: any | any[];

    public vol?: number;

    public queue: Queue;

    public bands: { band?: number; gain?: number; }[];

    public isPlaying: boolean;

    public isPaused: boolean;

    public position: number;

    public connected: boolean;

    public volume?: number;

    public constructor(lavafries: LavaFries, options: any | any[], queueOption?: any) {
        this.lavafries = lavafries;
        this.options = options;
        this.node = this.lavafries.leastLoadNode;
        this.vol = options?.volume ?? 100;
        this.queue = new Queue(this, queueOption || {});
        // eslint-disable-next-line no-array-constructor
        this.bands = new Array<{ band: number; gain: number }>();
        this.isPlaying = false;
        this.isPaused = false;
        this.position = 0;
        this.connected = false;
        this.connect();

        this.lavafries.playerCollection.set(options.guild.id, this);
        this.lavafries.emit("nodeCreate", this.node.options.host, this);
    }

    public get isConnected(): boolean {
        return this.connected;
    }

    public get playing(): boolean {
        return this.isPlaying;
    }

    public get paused(): boolean {
        return this.isPaused;
    }

    public connect(): void {
        this.lavafries.post({
            op: 4,
            d: {
                guild_id: this.options.guild.id,
                channel_id: this.options.voiceChannel.id,
                self_deaf: this.options?.deafen ?? false,
                self_mute: this.options?.mute ?? false,
            },
        });
        this.connected = true;
    }

    public play(): void {
        if (this.queue.empty) throw new RangeError("Queue is empty.");
        if (this.connected === false) this.connect();
        const track = this.queue.first;
        this.isPlaying = true;
        this.node.post({
            op: "play",
            track: track.trackString,
            guildId: this.options.guild.id,
            volume: this?.volume ?? 100,
        });
    }

    public friesSearch(query: string, user: any, options: { source?: "yt" | "sc"; add?: boolean }): Promise<any | any[]> {
        check(query, "string", "Query must be a string.");
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            const search = /^https?:\/\//g.test(query)
            ? encodeURI(query)
            : `${options.source || "yt"}search:${query}`;
            const { body } = await request(`http${this.node.options.secure ? "s" : ""}://${this.node.options.host}:${this.node.options.port}/loadtracks?identifier=${search}`, {
                method: "GET",
                headers: {
                    Authorization: this.node.options.password,
                },
                bodyTimeout: this.node.options.requestTimeout!,
                headersTimeout: this.node.options.requestTimeout!,
            });
            const {
                loadType,
                playlistInfo,
                tracks,
            } = await body.json();

            const arr: any[] = [];
            const data = {
                name: playlistInfo.name,
                trackCount: tracks.length,
                // eslint-disable-next-line object-shorthand
                tracks: tracks,
            };

            // eslint-disable-next-line default-case
            switch (loadType) {
                case "NO_MATCHES":
                    reject(new RangeError("No tracks found about the query."));
                break;

                case "LOAD_FAILED":
                    reject(new RangeError("Failed to load the track or playlist."));
                break;

                case "TRACK_LOADED":
                    const trackData = Utils.newTrack(tracks[0], user);
                    arr.push(trackData);
                    if (options.add !== true) return resolve(arr);
                    this.queue.add(trackData);
                    resolve(arr);
                break;

                case "PLAYLIST_LOADED":
                    const playlist = Utils.newPlaylist(data, user);
                    resolve(playlist);
                break;

                case "SEARCH_RESULT":
                    const res = tracks.map((t: any) => Utils.newTrack(t, user));
                    resolve(res);
                break;
            }
            return null;
        });
    }

    public pause(condition: boolean): void {
        check(condition, "boolean", "Pause state must be a boolean.");
        this.node.post({
            op: "pause",
            guildId: this.options.guild.id,
            pause: condition,
        });
        this.isPaused = condition;
    }

    public stop(): void {
        if (!this.playing) throw new RangeError("Player isn't playing in this guild.");
        this.node.post({
            op: "stop",
            guildId: this.options.guild.id,
        });
    }

    public setVolume(level: number): void {
        check(level, "number", "Volume level must be a number (integer).");
        this.vol = Math.max(Math.min(level!, 1000), 0);
        this.node.post({
            op: "volume",
            guildId: this.options.guild.id,
            volume: level,
        });
    }

    public seek(position: number): number {
        check(position, "number", "Position must be a number.");
        if (position < 0 || position > this.queue.first.length) throw new RangeError(`Provided position must be in between 0 and ${this.queue.first.length}.`);
        this.position = position;

        this.node.post({
            op: "seek",
            guildId: this.options.guild.id,
            position,
        });
        return this.position;
    }

    public setTrackRepeat(): boolean {
        this.queue.toggleRepeat("track");
        return !!this.queue.repeatTrack;
    }

    public setQueueRepeat(): boolean {
        this.queue.toggleRepeat("queue");
        return !!this.queue.repeatQueue;
    }

    public disableLoop(): boolean {
        this.queue.toggleRepeat("disable");
        return !!this.queue.repeatTrack
        || !!this.queue.repeatQueue;
    }

    public setEQ(...bands: any[]): void {
        if (!(bands instanceof Array)) throw new TypeError("Bands must be an array.");
        // eslint-disable-next-line no-param-reassign
        if (Array.isArray(bands[0])) bands = bands[0];
        if (!bands.length || !bands.every((band) => JSON.stringify(Object.keys(band).sort()) === "[\"band\",\"gain\"]")) {
            throw new RangeError("Bands must be in a non-empty object containing band and gain properties.");
        }

        // eslint-disable-next-line no-restricted-syntax
        for (const { band, gain } of bands) this.bands[band] = gain;
        this.node.post({
            op: "equalizer",
            guildId: this.options.guild.id,
            bands: this.bands.map((gain, band) => ({ band, gain })),
        });
    }

    public clearEQ(): void {
        this.bands = new Array(15).fill(0.0);
        this.node.post({
            op: "equalizer",
            guildId: this.options.guild.id,
            bands: this.bands.map((gain, band) => ({ band, gain })),
        });
    }

    public setTextChannel(channel: string): void {
        check(channel, "string", "Channel ID must be a string.");
        this.options.textChannel = channel;
    }

    public setVoiceChannel(channel: string, waitForConnect?: number): void {
        check(channel, "string", "Channel ID must be a string.");
        this.options.voiceChannel = channel;
        this.options.voiceChannel.id = new BigNumber(channel);
        setTimeout(() => {
            if (this.isConnected) this.connect();
        }, waitForConnect || 500);
    }

    public destroy(): void {
        this.pause(true);
        this.connected = false;
        this.lavafries.post({
            op: 4,
            d: {
                guild_id: this.options.guild.id,
                channel_id: null,
                self_deaf: false,
                self_mute: false,
            },
        });
        this.options.voiceChannel = null;
        this.options.textChannel = null;
        this.node.post({
            op: "destroy",
            guildId: this.options.guild.id,
        });
        this.lavafries.playerCollection.delete(this.options.guild.id);
    }

    public setKaraoke(
        lvl?: number,
        monoLvl?: number,
        filtBand?: number,
        filtWidth?: number,
        ): void {
        check(lvl, "number", "Level must be a number.");
        check(monoLvl, "number", "Monolevel must be a number.");
        check(filtBand, "number", "Filter band must be a number.");
        check(filtWidth, "number", "Filter width must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            karaoke: {
                level: lvl,
                monoLevel: monoLvl,
                filterBand: filtBand,
                filterWidth: filtWidth,
            },
        });
    }

    public setTimescale(spd?: number, pit?: number, rt?: number): void {
        check(spd, "number", "Speed must be a number.");
        check(pit, "number", "Pitch must be a number.");
        check(rt, "number", "Rate must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            timescale: {
                speed: spd,
                pitch: pit,
                rate: rt,
            },
        });
    }

    public setTremolo(freq?: number, dept?: number): void {
        check(freq, "number", "Frequency must be a number.");
        check(dept, "number", "Depth must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            tremolo: {
                frequency: freq,
                depth: dept,
            },
        });
    }

    public setVibrato(freq?: number, dept?: number): void {
        check(freq, "number", "Frequency must be a number.");
        check(dept, "number", "Depth must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            vibrato: {
                frequency: freq,
                depth: dept,
            },
        });
    }

    public setRotation(rot?: number): void {
        check(rot, "number", "Rotation must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            rotation: {
                rotationHz: rot,
            },
        });
    }

    public setDistortion(
        sinOff?: number,
        sinSc?: number,
        cosOff?: number,
        cosSc?: number,
        tanOff?: number,
        tanSc?: number,
        offS?: number,
        sc?: number,
        ): void {
        check(sinOff, "number", "SinOffSet must be a number.");
        check(sinSc, "number", "SinScale must be a number.");
        check(cosOff, "number", "CosOffSet must be a number.");
        check(cosSc, "number", "CosScale must be a number.");
        check(tanOff, "number", "TanOffSet must be a number.");
        check(tanSc, "number", "TanOffSet must be a number.");
        check(offS, "number", "Offset must be a number.");
        check(sc, "number", "Scale must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            distortion: {
                sinOffset: sinOff,
                sinScale: sinSc,
                cosOffset: cosOff,
                cosScale: cosSc,
                tanOffset: tanOff,
                tanScale: tanSc,
                offset: offS,
                scale: sc,
            },
        });
    }

    public setChannelMix(ltl?: number, ltr?: number, rtl?: number, rtr?: number): void {
        check(ltl, "number", "LeftToLeft must be a number.");
        check(ltr, "number", "LeftToRight must be a number.");
        check(rtl, "number", "RightToLeft must be a number.");
        check(rtr, "number", "RightToRight must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            channelMix: {
                leftToLeft: ltl,
                leftToRight: ltr,
                rightToLeft: rtl,
                rightToRight: rtr,
            },
        });
    }

    public setLowPass(smooth?: number): void {
        check(smooth, "number", "Smooth must be a number.");
        this.node.post({
            op: "filters",
            guildId: this.options.guild.id,
            lowPass: {
                smoothing: smooth,
            },
        });
    }
}
