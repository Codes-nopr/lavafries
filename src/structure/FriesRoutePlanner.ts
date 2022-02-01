import { request } from "undici";
import type { ResponseData } from "undici/types/dispatcher";
import Node from "./FriesNode";

export default class FriesRoutePlanner {
    public node: Node;

    public async status(): Promise<unknown | undefined> {
        const { body } = await request(`http${this.node.options.secure ? "s" : ""}://${this.node.options.host}:${this.node.options.port}/routeplanner/status`, {
            method: "POST",
            bodyTimeout: this.node.options.requestTimeout!,
            headersTimeout: this.node.options.requestTimeout!,
            headers: {
                Authorization: this.node.options.password,
                "content-type": "application/json",
            },
        }) as ResponseData;
        const json = await body.json();

        return json.class ? json : undefined;
    }

    public async freeAddress(address: string): Promise<boolean> {
        const { statusCode } = await request(`http${this.node.options.secure ? "s" : ""}://${this.node.options.host}:${this.node.options.port}/routeplanner/status`, {
            method: "POST",
            bodyTimeout: this.node.options.requestTimeout!,
            headersTimeout: this.node.options.requestTimeout!,
            headers: {
                Authorization: this.node.options.password,
                "content-type": "application/json",
            },
            body: JSON.stringify({
                address,
            }),
        }) as ResponseData;

        return statusCode === 204;
    }

    public async freeAllAddress(): Promise<boolean> {
        const { statusCode } = await request(`http${this.node.options.secure ? "s" : ""}://${this.node.options.host}:${this.node.options.port}/routeplanner/free/all`, {
            method: "POST",
            bodyTimeout: this.node.options.requestTimeout!,
            headersTimeout: this.node.options.requestTimeout!,
            headers: {
                Authorization: this.node.options.password,
                "content-type": "application/json",
            },
            body: undefined,
        }) as ResponseData;

        return statusCode === 204;
    }
}
