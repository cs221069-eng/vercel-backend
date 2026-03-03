const ImageKit = require('@imagekit/nodejs');

const publicKey = process.env.IMAGE_KIT_PUBLIC_KEY;
const privateKey = process.env.IMAGE_KIT_PRIVATE_KEY;
const urlEndpoint = process.env.IMAGE_KIT_URL_ENDPOINT;

function validateImageKitConfig() {
    const missing = [];
    if (!publicKey) missing.push('IMAGE_KIT_PUBLIC_KEY');
    if (!privateKey) missing.push('IMAGE_KIT_PRIVATE_KEY');
    if (!urlEndpoint) missing.push('IMAGE_KIT_URL_ENDPOINT');

    if (missing.length > 0) {
        throw new Error(`ImageKit env vars missing: ${missing.join(', ')}`);
    }

    if (publicKey.startsWith('private_')) {
        throw new Error('IMAGE_KIT_PUBLIC_KEY is invalid (looks like private key). Use your public key here.');
    }
}

function getImageKitClient() {
    validateImageKitConfig();
    return new ImageKit({
        publicKey,
        privateKey,
        urlEndpoint
    });
}

async function uploadFileToImageKit(file, folder = '/fyp/projects') {
    const imagekit = getImageKitClient();

    const uploaded = await imagekit.files.upload({
        file: file.buffer.toString('base64'),
        fileName: file.originalname,
        folder,
        useUniqueFileName: true
    });

    return {
        originalName: file.originalname,
        fileName: uploaded.name,
        filePath: uploaded.filePath,
        mimeType: file.mimetype,
        size: file.size,
        url: uploaded.url,
        thumbnailUrl: uploaded.thumbnailUrl || '',
        fileId: uploaded.fileId,
        downloadUrl: `${uploaded.url}?download=${encodeURIComponent(file.originalname)}`
    };
}

module.exports = {
    uploadFileToImageKit
};
