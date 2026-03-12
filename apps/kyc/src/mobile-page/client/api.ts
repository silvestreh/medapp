export async function uploadFile(
  blob: Blob,
  key: 'idFront' | 'idBack' | 'selfie',
  token: string,
  api: string
): Promise<string> {
  const formData = new FormData();
  const fileName = key === 'selfie' ? 'selfie.webm' : `${key}.jpg`;
  formData.append('file', blob, fileName);

  const res = await fetch(`${api}/upload`, {
    method: 'POST',
    headers: { 'x-session-token': token },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Upload failed');
  }

  const data = await res.json();
  return data.url as string;
}

export async function patchSession(
  token: string,
  api: string,
  body: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${api}/verification-sessions/by-token`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-session-token': token },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message || 'Session update failed');
  }
}
