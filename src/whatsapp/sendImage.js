import axios from 'axios';

export default async function sendImage(recipient, base64Image, prompt) {
    try {
        console.log("Recipient:", recipient);

        // Adiciona prefixo base64 se não estiver presente
        const base64Prefix = "data:image/jpeg;base64,";
        const formattedBase64 = base64Image.startsWith("data:image")
            ? base64Image
            : base64Prefix + base64Image;

        const payload = {
            args: {
                to: recipient,
                file: formattedBase64,
                filename: "image.jpg",
                caption: prompt,
                quotedMsgId: null, // Opcional, pode remover se não precisar
                waitForId: false,
                ptt: false,
                withoutPreview: false,
                hideTags: false,
                viewOnce: false,
                requestConfig: null // Opcional, pode remover se não precisar
            }
        };

        const response = await axios.post(`${process.env.WHATSAPP_URL}/sendImage`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'api_key': process.env.WHATSAPP_SECRET,
            }
        });
        console.log("Responase:", response.data);
        return response.data;
    } catch (error) {
        console.error("Error sending image:", error.response ? error.response.data : error.message);
    }
}