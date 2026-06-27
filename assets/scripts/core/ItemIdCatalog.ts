export const ITEM_ID_COUNT = 25;

export const ITEM_ID_GROUPS: string[] = Array.from({ length: ITEM_ID_COUNT }, (_, index) => `${index}`);

const LEGACY_ITEM_NAMES = [
    'cushion',
    'lamp',
    'clock',
    'vase',
    'plant',
    'basket',
    'frame',
    'storagebox',
    'candle',
    'carpet',
    'chair',
    'coasters',
    'bedroom lamp',
    'tissue box',
    'table',
    'book',
    'mirror',
    'shelf',
];

export const LEGACY_ITEM_ID_MAP: Record<string, string> = LEGACY_ITEM_NAMES.reduce((map, name, index) => {
    map[name] = `${index}`;
    return map;
}, {} as Record<string, string>);

export function normalizeItemId(value: string): string {
    if (Object.prototype.hasOwnProperty.call(LEGACY_ITEM_ID_MAP, value)) {
        return LEGACY_ITEM_ID_MAP[value];
    }
    return value;
}

export function isCanonicalItemId(value: string): boolean {
    if (!/^\d+$/.test(value)) return false;
    const id = Number(value);
    return Number.isInteger(id) && id >= 0 && id < ITEM_ID_COUNT;
}
