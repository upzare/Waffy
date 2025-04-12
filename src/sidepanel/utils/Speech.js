import spoken from "spoken/build/spoken.js";

export default async function speech() {
    let transcript = "";
    await spoken.listen().then(script => transcript += script);
    return transcript;
};