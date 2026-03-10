import { Hook, HookContext } from '@feathersjs/feathers';

/**
 * After a verification is approved or rejected, delete the uploaded
 * encrypted files (ID front, ID back, selfie) from disk.
 *
 * These files contain sensitive identity documents and should not be
 * retained after the verification decision is made.
 */
export const cleanupFiles = (): Hook => {
  return async (context: HookContext): Promise<HookContext> => {
    const { status } = context.result || {};
    if (status !== 'verified' && status !== 'rejected') return context;

    const verification = context.result;
    const fileUrls = [
      verification.idFrontUrl,
      verification.idBackUrl,
      verification.selfieUrl,
    ].filter(Boolean);

    for (const fileUrl of fileUrls) {
      try {
        // Extract filename from URL like /api/uploads/uuid.jpg.enc
        const filename = fileUrl.replace(/^\/api\/uploads\//, '');
        if (!filename || filename.includes('/') || filename.includes('..')) continue;

        await context.app.service('file-uploads').remove(filename, {
          provider: undefined,
        } as any);
      } catch (err: unknown) {
        // Log but don't fail — the verification decision is more important
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[cleanup-files] Failed to delete ${fileUrl}:`, message);
      }
    }

    return context;
  };
};
