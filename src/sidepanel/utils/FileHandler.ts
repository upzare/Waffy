import type { FileFormat } from "../../types";

export const fileHandler = async (fileList: File[]): Promise<FileFormat[]> => {
    const files: FileFormat[] = [];
    for await (const file of fileList) {
        const buffer = await file.arrayBuffer();
        const base64String = btoa(
            new Uint8Array(buffer).reduce(
                (data, byte) => data + String.fromCharCode(byte),
                ''
            )
        );
        files.push({
            type: "file",
            payload: {
                name: file.name,
                size: file.size,
                mimeType: file.type,
                content: base64String
            }
        });
    };
    return files;
};