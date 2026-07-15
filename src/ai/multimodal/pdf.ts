import { extractText, getDocumentProxy } from "unpdf";
import { insertDocument } from "@/db/repo/documents";
import type { Document } from "@/lib/schemas";

/**
 * PDF → documents table (+FTS via triggers). Content becomes retrievable by the
 * knowledge agent instead of being stuffed into the chat context.
 */
export async function ingestPdf(opts: {
    data: Uint8Array;
    fileName: string;
    folder?: string;
    projectId?: string | null;
}): Promise<Document> {
    const pdf = await getDocumentProxy(opts.data);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    const content = text.trim();
    if (!content) {
        throw new Error(
            `No extractable text in "${opts.fileName}" — scanned/image-only PDFs are not supported yet.`,
        );
    }
    return insertDocument({
        title: opts.fileName.replace(/\.pdf$/i, ""),
        sourceName: opts.fileName,
        contentText: content,
        mimeType: "application/pdf",
        folder: opts.folder ?? "/",
        byteSize: opts.data.byteLength,
        pageCount: totalPages,
        projectId: opts.projectId ?? null,
    });
}
