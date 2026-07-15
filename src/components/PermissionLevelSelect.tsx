import { Select } from "@/components/ui/select";
import type { PermissionLevel } from "@/lib/schemas";

/**
 * The one place "no permission level" (null) is rendered as an option.
 * Levels come from the DB; the null option is synthetic — so "Ask everything"
 * can never appear twice again.
 */
export function PermissionLevelSelect({
    levels,
    value,
    onChange,
    nullLabel = "Ask everything",
    className,
    "aria-label": ariaLabel,
}: {
    levels: PermissionLevel[];
    value: string | null;
    onChange: (levelId: string | null) => void;
    /** Automations deny instead of asking — callers override the null copy. */
    nullLabel?: string;
    className?: string;
    "aria-label"?: string;
}) {
    return (
        <Select
            className={className}
            aria-label={ariaLabel}
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
        >
            <option value="">{nullLabel}</option>
            {levels.map((l) => (
                <option key={l.id} value={l.id}>
                    {l.name}
                </option>
            ))}
        </Select>
    );
}
