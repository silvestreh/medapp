import express from '@feathersjs/express';

// JSON body parser that also keeps the exact bytes on `req.rawBody`, for
// webhook endpoints whose signature covers the raw payload.
export default function rawBodyJson() {
  return (express as any).json({
    verify: (req: any, _res: any, buf: Buffer) => {
      req.rawBody = buf.toString();
    },
  });
}
