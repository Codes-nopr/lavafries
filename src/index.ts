import { join } from "path";
import { readFileSync } from "fs";

export { default as FriesLava } from "./structure/FriesLava";
export { default as FriesNode } from "./structure/FriesNode"
export { default as FriesPlayer } from "./structure/FriesPlayer";
export { default as FriesQueue } from "./structure/FriesQueue";
export { default as FriesRoutePlanner } from "./structure/FriesRoutePlanner";
export { default as Utils } from "./utils/Utils";
export { default as loadTypes } from "./utils/Constants";

export const { version } = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
