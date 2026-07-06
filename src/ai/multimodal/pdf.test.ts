import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { createTestDbClient } from "@/db/testClient";
import { setDb } from "@/db/client";
import { searchDocuments } from "@/db/repo/documents";
import { ingestPdf } from "./pdf";

let db: ReturnType<typeof createTestDbClient>;

beforeEach(() => {
    db = createTestDbClient();
    setDb(db);
});

afterEach(() => {
    db.close();
});

/** A minimal, valid single-page PDF containing the text "Carnot cycle notes". */
function fixturePdf(): Uint8Array {
    const objects = [
        "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
        "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
        "4 0 obj\n<< /Length 60 >>\nstream\nBT /F1 12 Tf 72 720 Td (Carnot cycle notes) Tj ET\nendstream\nendobj\n",
        "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    ];
    let body = "%PDF-1.4\n";
    const offsets: number[] = [];
    for (const obj of objects) {
        offsets.push(body.length);
        body += obj;
    }
    const xrefStart = body.length;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) {
        xref += `${String(off).padStart(10, "0")} 00000 n \n`;
    }
    body += `${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
    return new TextEncoder().encode(body);
}

describe("PDF ingestion", () => {
    it("extracts text into a searchable document", async () => {
        const doc = await ingestPdf({
            data: fixturePdf(),
            fileName: "thermo-notes.pdf",
            folder: "/school",
        });

        expect(doc.title).toBe("thermo-notes");
        expect(doc.folder).toBe("/school");
        expect(doc.page_count).toBe(1);
        expect(doc.content_text).toContain("Carnot cycle notes");

        // Retrievable by the knowledge agent through FTS.
        const hits = await searchDocuments("carnot");
        expect(hits[0]?.id).toBe(doc.id);
    });

    it("fails fast on PDFs without extractable text", async () => {
        // Same structure, empty content stream.
        const empty = fixturePdf();
        const text = new TextDecoder()
            .decode(empty)
            .replace("(Carnot cycle notes) Tj", "");
        await expect(
            ingestPdf({
                data: new TextEncoder().encode(text),
                fileName: "blank.pdf",
            }),
        ).rejects.toThrow(/No extractable text/);
    });
});
