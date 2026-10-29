'use client';

import type { ChangeEvent } from 'react';
import Image from 'next/image';
import { useState } from 'react';

export type PostPhoto = { id: string; mimeType: string; url: string };

const MAX_PHOTOS = 5;
const MAX_BYTES = 3 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function PhotoPicker({
  files,
  onChange,
  existingCount = 0
}: {
  files: File[];
  onChange: (files: File[]) => void;
  existingCount?: number;
}) {
  const [error, setError] = useState('');

  function updateFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (selected.some((file) => !IMAGE_TYPES.includes(file.type))) {
      setError('Use JPG, PNG, or WebP photos.');
      return;
    }
    if (selected.some((file) => file.size > MAX_BYTES)) {
      setError('Each photo must be 3 MB or smaller.');
      return;
    }
    if (existingCount + files.length + selected.length > MAX_PHOTOS) {
      setError(`A memory can have up to ${MAX_PHOTOS} photos.`);
      return;
    }
    setError('');
    onChange([...files, ...selected]);
  }

  return (
    <div className="space-y-2">
      <label className="inline-flex cursor-pointer items-center rounded-full border border-black/15 bg-white px-4 py-2 text-sm font-bold">
        Add memory photos
        <input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={updateFiles} />
      </label>
      <p className="text-xs text-black/55">Up to {MAX_PHOTOS} photos, 3 MB each. JPG, PNG, or WebP.</p>
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li key={`${file.name}-${file.lastModified}-${index}`} className="flex items-center gap-2 rounded-full bg-[#F3F3F3] px-3 py-1 text-xs">
              <span className="max-w-48 truncate">{file.name}</span>
              <button type="button" aria-label={`Remove ${file.name}`} className="font-black" onClick={() => onChange(files.filter((_, fileIndex) => fileIndex !== index))}>×</button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function PostPhotoGallery({
  photos,
  onDelete,
  deletingId = null
}: {
  photos: PostPhoto[];
  onDelete?: (photo: PostPhoto) => void;
  deletingId?: string | null;
}) {
  if (!photos.length) return null;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {photos.map((photo) => (
        <figure key={photo.id} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#F3F3F3]">
          <Image src={photo.url} alt="Memory from this place" fill unoptimized className="object-cover" sizes="(max-width: 640px) 50vw, 220px" />
          {onDelete && (
            <button type="button" aria-label="Remove photo" title="Remove photo" disabled={deletingId === photo.id} onClick={() => onDelete(photo)} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/75 text-lg font-bold text-white disabled:opacity-50">×</button>
          )}
        </figure>
      ))}
    </div>
  );
}
