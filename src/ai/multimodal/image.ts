import type { FileUIPart } from "ai";

/**
 * Browser File/Blob → AI SDK file part with a data URL. Data URLs keep v1
 * simple (no fs round-trip); revisit if image-heavy chats bloat the DB.
 */
export async function fileToImagePart(
    file: File | Blob,
    filename?: string,
): Promise<FileUIPart> {
    if (!file.type.startsWith("image/")) {
        throw new Error(
            `expected an image, got ${file.type || "unknown type"}`,
        );
    }
    return {
        type: "file",
        mediaType: file.type,
        filename: filename ?? (file instanceof File ? file.name : undefined),
        url: await blobToDataUrl(file),
    };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () =>
            reject(reader.error ?? new Error("failed to read file"));
        reader.readAsDataURL(blob);
    });
}
