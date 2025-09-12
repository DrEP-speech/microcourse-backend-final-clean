// utils/cache.js
import { createHash } from 'node:crypto';

export function sendCached(req, res, payload, lastModified) {
  const body = JSON.stringify(payload);
  const etag = '"' + createHash('sha1').update(body).digest('hex') + '"';
  res.set('ETag', etag);
  if (lastModified) res.set('Last-Modified', new Date(lastModified).toUTCString());

  if (req.headers['if-none-match'] === etag) return res.status(304).end();
  const ims = req.headers['if-modified-since'];
  if (ims && lastModified && new Date(ims).getTime() >= new Date(lastModified).getTime()) {
    return res.status(304).end();
  }
  res.type('application/json').send(body);
}
