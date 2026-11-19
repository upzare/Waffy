import { base64ToBytes, bytesToBase64 } from "@/lib/helper";
import type { FileFormat } from "../../types";

export const fileHandler = async (fileList: File[]): Promise<FileFormat[]> => {
  const files: FileFormat[] = [];
  for (const file of fileList) {
    files.push({
      type: "file",
      payload: {
        name: file.name,
        size: file.size,
        mimeType: file.type,
        content: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
      },
    });
  }
  return files;
};

export const fileFormatsToFiles = (fileFormats: FileFormat[]): File[] =>
  fileFormats.map(
    (file) =>
      new File([base64ToBytes(file.payload.content)], file.payload.name, {
        type: file.payload.mimeType,
      })
  );
