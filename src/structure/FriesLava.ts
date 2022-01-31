import { TypedEmitter } from "tiny-typed-emitter";
import Node from "./FriesNode";
import Collection from "../utils/Collection";
import Player from "./FriesPlayer";
import type { NodeOptions } from "../utils/Interfaces";

const states = new Map<string, any>();

export interface FriesEvents<T = unknown> {
    playerMove(player: Player<T>, voiceChannel: string, dataVoiceChannel: string): void;
    playerDisconnect(player: Player<T>, voiceChannel: string): void;
}

export default class LavaFries<T = unknown> extends TypedEmitter<FriesEvents<T>> {
    public client: any;

    public nodeOptions: NodeOptions[];

    public shards: number;

    public nodeCollection: Collection<any, any>;

    public playerCollection: Collection<any, any>;

    public constructor(client: any, node: any[]) {
        super();

        this.client = client;
        this.nodeOptions = node;
        this.shards = client.ws.shards.size;
        this.nodeCollection = new Collection<any, any>();
        this.playerCollection = new Collection<any, any>();

        if (!this.nodeOptions || !this.nodeOptions.length) {
            throw new Error("No nodes are provided.");
        }

        // eslint-disable-next-line no-restricted-syntax
        for (const x of this.nodeOptions) {
            if (!this.nodeCollection.has(x!.host)) {
                const newNode = new Node(this, x);
                this.nodeCollection.set(x!.host, newNode);
            }
        }

        this.client.on("raw", this.handleStateUpdate.bind(this));
    }

    public get leastLoadNode(): any | any[] {
        const sorted = this.nodeCollection
        .toArray()
        .filter((x) => x.connected)
        .sort((a, b) => {
            const loadA = (a.stats.cpu.systemLoad / a.stats.cpu.cores) * 100;
            const loadB = (b.stats.cpu.systemLoad / b.stats.cpu.cores) * 100;
            return loadB - loadA;
        });
        return sorted[0];
    }

    public post(data: any): void {
        if (!data) return;
        const guild = this.client.guilds.cache.get(data.d.guild_id);
        if (guild) {
            guild!.shard.send(data);
        }
    }

    public connect(nodeOptions: any): any {
        if (!nodeOptions || !nodeOptions.host) {
            throw new Error("No nodes are provided!");
        }
        const newNode = new Node(this, nodeOptions);
        this.nodeCollection.set(nodeOptions!.host, newNode);
        return newNode;
    }

    public spawnPlayer(options: any, queueOption?: any): any {
        if (!options.guild) {
            throw new TypeError("spawnPlayer: Guild is null or undefined.");
        }
        if (!options.voiceChannel) {
            throw new TypeError("spawnPlayer: voiceChannel is null or undefined.");
        }
        if (!options.textChannel) {
            throw new TypeError("spawnPlayer: textChannel is null or undefined.");
        }
        const oldPlayer = this.playerCollection.get(options.guild.id);
        if (oldPlayer) return oldPlayer;

        return new Player(this, options, queueOption);
    }

    private handleStateUpdate(data: any): void {
        if (!["VOICE_STATE_UPDATE", "VOICE_SERVER_UPDATE"].includes(data.t)) return;
        if (data.d.user_id && data.d.user_id !== this.client.user.id) return;

        const player = this.playerCollection.get(data.d.guild_id);
        if (!player) return;
        const voiceState = states.get(data?.d?.guild_id) ?? {};

        // eslint-disable-next-line default-case
        switch (data.t) {
            case "VOICE_STATE_UPDATE":
                voiceState.op = "voiceUpdate";
                voiceState.sessionId = data?.d?.session_id ?? null;

                if (data.d.channel_id) {
                    if (player.options.voiceChannel.id !== data.d.channel_id) {
                        const newChannel = this.client.channels.cache.get(data?.d?.channel_id
                            ?? null);
                        this.emit("playerMove", player, player.options.voiceChannel.id, data.d.channel_id);
                        if (newChannel) player.options.voiceChannel = newChannel;
                    }
                } else {
                    this.emit("playerDisconnect", player, player.options.voiceChannel);
                    player.voiceChannel = null;
                    player.voiceState = {};
                    player.pause(true);
                }
            break;

            case "VOICE_SERVER_UPDATE":
                voiceState.guildId = data?.d?.guild_id ?? null;
                voiceState.event = data?.d ?? null;
            break;
        }

        states.set(data.d?.guild_id, voiceState);
        const {
            op,
            guildId,
            sessionId,
            event,
        } = voiceState;

        if (op && guildId && sessionId && event) {
            player.node.post(voiceState)
            .then(() => states.set(guildId, {}))
            .catch((err: any) => {
                if (err) throw new Error(err);
            });
        }
    }
}
