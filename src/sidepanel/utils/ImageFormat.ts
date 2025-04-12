export const imageFormat = async (fileList: File[]): Promise<{type: string, image: string}[]> => {
    const files: {type: string, image: string}[] = [];
    for await (const file of fileList) {
        const promise = new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve({
                    type: "image",
                    image: reader.result?.toString().split(",")[1],
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        await promise.then((data: any) => files.push(data));
    };
    return files;
};