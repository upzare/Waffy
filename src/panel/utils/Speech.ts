// @ts-ignore
import spoken from "spoken/build/spoken.js";

export default async function speech() {
    let transcript = "";
    await spoken.listen().then((script: any) => transcript += script);
    return transcript;
};