import WebSocket from "ws";
import type { NodeOptions, PlayerStats, IncomingPayloads } from "../utils/Interfaces";
import Player from "./FriesPlayer";

export interface NodeEvents {
    nodeConnect(func: any): void;
    nodeClose(func: any, message: { code: number, reason?: string }): void;
    nodeError(func: any): void;
    nodeReconnect(func: any): void;
    trackPlay(track: any, player: Player, payload: IncomingPayloads): void;
    queueEnd(track: any, player: Player, payload: IncomingPayloads): void;
    trackStuck(track: any, player: Player, payload: IncomingPayloads): void;
    trackError(track: any, player: Player, payload: IncomingPayloads): void;
    socketClosed(func: any, payload: IncomingPayloads | any): void;
}

export default class Node {
    public lavafries: any;

    public options: NodeOptions;

    public stats: PlayerStats;

    public socket: any;

    public constructor(lavafries: any, options: NodeOptions) {
        this.lavafries = lavafries;
        this.options = options;
        if (!this.options.host) throw new TypeError("Options host is required parameter.");
        if (!this.options.port) throw new TypeError("Options port is required parameter.");
        if (!this.options.password) throw new TypeError("Options password is required parameter.");
        if (!this.options.secure) this.options.secure = false;
        if (!this.options.retryAmount) this.options.retryAmount = 5;
        if (!this.options.retryDelay) this.options.retryDelay = 5000;

        this.stats = {
            players: 0,
            playingPlayers: 0,
            uptime: 0,
            memory: {
                free: 0,
                used: 0,
                allocated: 0,
                reservable: 0,
            },
            cpu: {
                cores: 0,
                systemLoad: 0,
                lavalinkLoad: 0,
            },
            lastUpdated: Date.now(),
        };

        this.socket = null;
        this.connect();
    }

    public get connected(): boolean {
        if (!this.socket) return false;
        return this.socket.readyState === WebSocket.OPEN;
    }

    public connect(): void {
        const headers = {
            Authorization: this.options.password,
            "User-Id": this.lavafries.client.user.id,
            "Num-Shards": this.lavafries.shards,
            "Client-Name": "lavafries",
        };
        this.socket = new WebSocket(`ws${this.options.secure ? "s" : ""}://${this.options!.host}:${this.options.port}/`, { headers });
        this.socket.once("open", this.open.bind(this));
        this.socket.once("close", this.close.bind(this));
        this.socket.on("error", this.error.bind(this));
        this.socket.on("message", this.message.bind(this));
    }

    public open(): void {
        this.lavafries.emit("nodeConnect", this);
    }

    public close(code?: number, reason?: string | undefined): void {
        this.lavafries.emit("nodeClose", this, { code, reason });
        if (code !== 1000 || reason !== "destroy") {
            for (let i = 0; i < this.options.retryAmount!; i += 1) {
                this.reconnect();
                i += 1;
            }
            throw new RangeError(`Can't establish websocket connection after trying ${this.options.retryAmount!} times.`);
        }
    }

    public error(msg?: any | undefined): void {
        this.lavafries.emit("nodeError", this, msg || "");
    }

    public reconnect(): void {
        setTimeout(() => {
            this.lavafries.emit("nodeError", this);
            this.socket.removeAllListeners();
            this.socket = null;
            this.lavafries.emit("nodeReconnect", this);
            this.connect();
        }, this.options.retryDelay!);
    }

    public destroyNode(): void {
        if (!this.connected) return;
        this.socket.close(1000, "destroy");
        this.socket.removeAllListeners();
        this.socket = null;
        this.lavafries.nodeCollection.delete(this.options!.host);
    }

    public message(data: any | any[]): void {
        if (!data) throw new RangeError("No incoming data found.");
        const payload = JSON.parse(data?.toString());
        const {
            op,
            type,
            code,
            guildId,
            state,
        } = payload;

        const player = this.lavafries.playerCollection.get(guildId);

        if (op !== "event") {
            // eslint-disable-next-line default-case
            switch (op) {
                case "stats":
                    this.stats = { ...payload };
                    delete (this.stats as any).op;
                    break;
                case "playerUpdate":
                    if (player) {
                        player.position = state?.position
                        ?? 0;
                    }
                break;
            }
        } else if (op === "event") {
            if (!player) return;
            player.playState = false;
            const track = player.queue.first;

            // eslint-disable-next-line default-case
            switch (type) {
                case "TrackStartEvent":
                    player.playState = true;
                    this.lavafries.emit("trackPlay", track, player, payload);
                break;

                case "TrackEndEvent":
                    if (!track) return;
                    if (track && player.queue.repeatTrack) {
                        player.play();
                    } else if (track && player.queue.repeatQueue) {
                        const toAdd = player.queue.remove();
                        if (toAdd) player.queue.add(toAdd);
                        player.play();
                    } else if (track && player.queue.size > 1) {
                        player.queue.remove();
                        player.play();
                    } else if (track && player.queue.size === 1) {
                        player.queue.remove();
                        this.lavafries.emit("queueEnd", track, player, payload);
                    }
                break;

                case "TrackStuckEvent":
                    if (!track) return;
                    player.queue.remove();
                    if (player.queue.skipOnError) player.play();
                    this.lavafries.emit("trackStuck", track, player, payload);
                break;

                case "TrackExceptionEvent":
                    if (!track) return;
                    player.queue.remove();
                    if (player.queue.skipOnError) player.play();
                    this.lavafries.emit("trackError", track, player, payload);
                break;

                case "WebSocketClosedEvent":
                    if ([4009, 4015].includes(code)) {
                        this.lavafries.post({
                            op: 4,
                            d: {
                                guild_id: guildId,
                                channel_id: player?.options?.voiceChannel.id,
                                self_mute: player?.options?.mute ?? false,
                                self_deaf: player?.options?.deafen ?? false,
                            },
                        });
                    }
                    this.lavafries.emit("socketClosed", this, payload);
                break;
            }
        } else {
            this.lavafries.emit("nodeError", this, `Unknown event with op: ${op} and data: ${payload}`);
        }
    }

    public post(data: any[]): Promise<boolean> {
        return new Promise((res, rej) => {
            if (!this.connected) res(false);
            const formattedData = JSON.stringify(data);
            if (!formattedData || !formattedData.startsWith("{")) {
                rej(new Error("No JSON payloads found in websocket."));
            }
            this.socket.send(formattedData, (err: any) => {
                if (err) {
                    rej(err);
                } else {
                    res(true);
                }
            });
        });
    }
}
