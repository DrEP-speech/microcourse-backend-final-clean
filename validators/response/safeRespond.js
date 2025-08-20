import { ZodError } from 'zod';

export function sendJson(res, schema, payload, status = 200) {
  try {
    const data = schema.parse(payload);
    return res.status(status).json(data);
  } catch (err) {
    if (err instanceof ZodError) {
      // In prod: avoid leaking internals. Log details; return generic.
      console.error('Response schema violation:', JSON.stringify(err.issues, null, 2));
      return res.status(500).json({ success: false, message: 'Internal response shape error' });
    }
    throw err;
  }
}
