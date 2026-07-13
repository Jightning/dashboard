const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/**
 * Minimal {{var}} templating for pipeline prompts. Unknown variables throw:
 * a typo'd {{step3}} must fail the run, not silently inject an empty string.
 */
export function renderTemplate(
    template: string,
    vars: Record<string, string>,
): string {
    return template.replace(PLACEHOLDER, (_, key: string) => {
        const value = vars[key];
        if (value === undefined)
            throw new Error(`unknown template variable: {{${key}}}`);
        return value;
    });
}
