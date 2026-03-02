export const lrsHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': 'Basic ' + Buffer.from(
        `${process.env.LRS_USERNAME}:${process.env.LRS_PASSWORD}`
    ).toString('base64'),
    'X-Experience-API-Version': '1.0.3',
});