import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { diskStorage } from 'multer';
import { open, unlink } from 'fs/promises';
import { join } from 'path';
import { JwtAuthGuard, StaffGuard } from '../auth/guards';
import { API_BASE_URL, UPLOAD_DIR } from '../config/env';
import {
  bufferMatchesMime,
  extensionForMime,
} from './image-validation';

// Only authenticated restaurant staff may upload, capped per account to prevent
// disk-filling abuse. JwtAuthGuard authenticates (populates req.user); StaffGuard
// authorizes. Admins upload via impersonation (which mints a staff token).
@UseGuards(JwtAuthGuard, StaffGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
@Controller('upload')
export class UploadController {
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        // Filename is fully server-generated; the extension comes from the
        // validated MIME type, never from the client-supplied originalname
        // (which could carry ../, null bytes, or a .svg/.html extension).
        filename: (_req, file, cb) => {
          const ext = extensionForMime(file.mimetype);
          if (!ext) return cb(new Error('Unsupported image type'), '');
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
          cb(null, `${unique}.${ext}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 }, // 5 MB, single file
      fileFilter: (_req, file, cb) => {
        // Allowlist raster types only; reject SVG and everything else.
        if (!extensionForMime(file.mimetype)) {
          return cb(
            new BadRequestException('Only PNG, JPEG, WebP or GIF images are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');

    // Verify the bytes actually match the claimed type (the MIME header is
    // client-controlled). Reject + delete anything that lied about its type.
    const path = join(UPLOAD_DIR, file.filename);
    let header = Buffer.alloc(0);
    const handle = await open(path, 'r');
    try {
      const buf = Buffer.alloc(16);
      const { bytesRead } = await handle.read(buf, 0, 16, 0);
      header = buf.subarray(0, bytesRead);
    } finally {
      await handle.close();
    }

    if (!bufferMatchesMime(file.mimetype, header)) {
      await unlink(path).catch(() => undefined);
      throw new BadRequestException('File content does not match a supported image type');
    }

    return { url: `${API_BASE_URL}/uploads/${file.filename}` };
  }
}
