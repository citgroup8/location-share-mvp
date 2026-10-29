export const MAX_POST_PHOTOS = 5;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_TOTAL_BYTES = 12 * 1024 * 1024;

export type UploadedPostPhoto = { mimeType: string; data: Buffer };

function matchesImageType(bytes: Uint8Array, mimeType: string) {
  if (mimeType === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === 'image/png') return bytes.subarray(0, 8).join(',') === '137,80,78,71,13,10,26,10';
  if (mimeType === 'image/webp') {
    return bytes[0] === 82 && bytes[1] === 73 && bytes[2] === 70 && bytes[3] === 70 &&
      bytes[8] === 87 && bytes[9] === 69 && bytes[10] === 66 && bytes[11] === 80;
  }
  return false;
}

export async function parsePostPhotos(formData: FormData): Promise<UploadedPostPhoto[]> {
  const files = formData.getAll('photos').filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > MAX_POST_PHOTOS) throw new Error(`Add no more than ${MAX_POST_PHOTOS} photos at once.`);

  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > MAX_TOTAL_BYTES) throw new Error('Selected photos must total 12 MB or less.');

  const photos: UploadedPostPhoto[] = [];
  for (const file of files) {
    if (file.size > MAX_PHOTO_BYTES) throw new Error(`${file.name} is larger than 3 MB.`);
    const data = Buffer.from(await file.arrayBuffer());
    if (!matchesImageType(data, file.type)) throw new Error(`${file.name} must be a valid JPG, PNG, or WebP image.`);
    photos.push({ mimeType: file.type, data });
  }
  return photos;
}
