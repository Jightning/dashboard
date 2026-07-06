export function newId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}

export function now(): number {
    return Date.now();
}
