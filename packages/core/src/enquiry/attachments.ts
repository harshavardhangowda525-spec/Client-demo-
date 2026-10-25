import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { prisma, type Db } from '@studio/db';
import type { Actor, RequestContext } from '../actor';
import { recordAudit } from '../audit';
import { DomainError, invalid, notFound } from '../errors';
import { getEnquiryForViewer } from './service';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_ENQUIRY = 5;

const TYPES = [
  { mime: 'application/pdf', ext: 'pdf', test: (b: Buffer) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { mime: 'image/png', ext: 'png', test: (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: 'image/jpeg', ext: 'jpg', test: (b: Buffer) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', ext: 'webp', test: (b: Buffer) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
];

/** Private upload directory (never served publicly). Override with UPLOAD_DIR. */
export function uploadDir(): string {
  if (process.env.UPLOAD_DIR) return resolve(process.env.UPLOAD_DIR);
  const cwd = process.cwd();
  return /apps[\\/][^\\/]+$/.test(cwd) ? resolve(cwd, '../../storage/uploads') : resolve(cwd, 'storage/uploads');
}

/** Detect the real file type from its content; the browser-supplied type is ignored. */
export function detectFileType(data: Buffer) {
  return TYPES.find((t) => t.test(data)) ?? null;
}

export function safeFileName(name: string): string {
  // Replace control characters and characters unsafe in file names.
  const cleaned = [...basename(name)].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 || '<>:"/\\|?*'.includes(ch) ? '_' : ch)).join('').trim();
  return (cleaned || 'file').slice(0, 120);
}

export async function saveEnquiryAttachment(
  reference: string,
  viewer: { actor: Actor | null; accessToken?: string | null },
  file: { filename: string; data: Buffer },
  ctx: RequestContext = {},
  db: Db = prisma,
) {
  const enquiry = await getEnquiryForViewer(reference, viewer, db);
  if (['CONVERTED', 'CLOSED', 'DECLINED'].includes(enquiry.status)) throw new DomainError('INVALID_TRANSITION', 'Files can no longer be added to this enquiry.');
  const existing = await db.enquiryAttachment.count({ where: { enquiryId: enquiry.id } });
  if (existing >= MAX_ATTACHMENTS_PER_ENQUIRY) throw invalid(`You can attach up to ${MAX_ATTACHMENTS_PER_ENQUIRY} files.`);
  if (file.data.length === 0) throw invalid('The file is empty.');
  if (file.data.length > MAX_ATTACHMENT_BYTES) throw invalid('Files must be 10 MB or smaller.');
  const type = detectFileType(file.data);
  if (!type) throw invalid('Only PDF, JPG, PNG and WebP files can be attached.');

  const storedName = `${randomUUID()}.${type.ext}`;
  const dir = uploadDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  await writeFile(join(dir, storedName), file.data, { flag: 'wx', mode: 0o600 });
  const record = await db.enquiryAttachment.create({
    data: { enquiryId: enquiry.id, fileName: safeFileName(file.filename), storedName, mimeType: type.mime, sizeBytes: file.data.length },
  });
  await recordAudit(viewer.actor, { action: 'enquiry.attachment_added', entityType: 'EventEnquiry', entityId: enquiry.id, summary: `${record.fileName} (${type.mime}, ${file.data.length} bytes)` }, ctx, db);
  return { id: record.id, fileName: record.fileName, mimeType: record.mimeType, sizeBytes: record.sizeBytes };
}

/** Staff-only: resolve an attachment to its private file path. */
export async function getAttachmentForStaff(id: string, db: Db = prisma) {
  const record = await db.enquiryAttachment.findUnique({ where: { id } });
  if (!record) throw notFound('Attachment');
  return { record, path: join(uploadDir(), record.storedName) };
}
