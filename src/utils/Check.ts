export default function check(whatTo: any | any[], type?: string, msg?: string): void {
    // eslint-disable-next-line valid-typeof
    if (typeof whatTo !== type) throw new TypeError(msg);
}
