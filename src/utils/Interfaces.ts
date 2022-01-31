export interface NodeOptions {
    host: string,
    port: number,
    password?: string,
    secure?: boolean,
    retryAmount?: number,
    retryDelay?: number
    requestTimeout?: number,
}

export interface PlayerStats {
    players: number;
    playingPlayers: number;
    uptime: number;
    memory: {
        free: number;
        used: number;
        allocated: number;
        reservable: number;
    };
    cpu: {
        cores: number;
        systemLoad: number;
        lavalinkLoad: number;
    };
    lastUpdated: number;
}

// eslint-disable-next-line no-shadow
enum OpIncoming {
    PlayerUpdate = "playerUpdate",
    Stats = "stats",
    Event = "event"
}

export interface IncomingPayloads {
    op: OpIncoming,
}

export interface PlayOptions {
    startTime?: number,
    endTime?: number,
    volume?: number,
    noReplace?: boolean,
    pause?: boolean,
}
