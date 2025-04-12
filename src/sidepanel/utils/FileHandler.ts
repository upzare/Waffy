type FileFormat = { type: string, data: string, mimeType: string } | { type: string, image: string };

export const fileHandler = async (fileList: File[]): Promise<FileFormat[]> => {
    const files: FileFormat[] = [];
    for await (const file of fileList) {
        const formdata = new FormData();
        formdata.append("file", file);
        const upload = await fetch("http://localhost:8000/upload", {
            method: "POST",
            body: formdata
        }).then(res => res.json());
        if (file.type.startsWith("image/")) {
            files.push({
                type: "image",
                image: upload.url,
            });
        } else {
            files.push({
                type: "file",
                data: upload.url,
                mimeType: file.type,
            });
        }
    };
    return files;
};