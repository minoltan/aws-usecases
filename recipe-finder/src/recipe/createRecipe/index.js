import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { s3Client } from "./s3Client.js";

export const handler = async (event) => {
    try {
        const payload = JSON.parse(event.body);

        const recipeId = await createRecipe(payload);

        return {
            statusCode: 201,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ recipeId }),
        };

    } catch (error) {
        console.error({ level: 'ERROR', message: 'Handler error', error });
        return {
            statusCode: 500,
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: error.message }),
        };
    }
};


async function createRecipe(payload) {
    const recipeId = randomUUID();
    const key = `recipes/${recipeId}-${slugify(payload.name)}.txt`;
    const body = `Recipe: ${payload.name}\n\n${payload.content}`;

    const command = new PutObjectCommand({
        Bucket: process.env.DOCUMENTS_BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: 'text/plain'
    });

    await s3Client.send(command);
    return recipeId;
}

function slugify(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
