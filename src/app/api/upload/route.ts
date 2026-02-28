import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, rmdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Supported image types
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/webm'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const type = formData.get('type') as string || 'avatar'; // avatar, background, sprite, etc.
    const collection = formData.get('collection') as string | null; // For sprites: collection name

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP, WebM' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    const ext = file.name.split('.').pop() || 'png';
    const filename = `${timestamp}-${randomString}.${ext}`;

    // Determine upload directory based on type
    let uploadDir: string;
    let publicUrl: string;

    if (type === 'sprite' && collection) {
      // Upload to sprites collection
      uploadDir = path.join(process.cwd(), 'public', 'sprites', collection);
      publicUrl = `/sprites/${collection}/${filename}`;
    } else {
      // Default upload location
      uploadDir = path.join(process.cwd(), 'public', 'uploads', type);
      publicUrl = `/uploads/${type}/${filename}`;
    }

    // Create upload directory if it doesn't exist
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Write file
    const filePath = path.join(uploadDir, filename);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Determine if it's an animation
    const isAnimation = /\.(gif|webm|apng)$/i.test(filename);

    return NextResponse.json({
      success: true,
      url: publicUrl,
      filename,
      size: file.size,
      type: file.type,
      isAnimation
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = searchParams.get('url');

    if (!url || !url.startsWith('/uploads/')) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'public', url);
    
    // Check if file exists and delete
    if (existsSync(filePath)) {
      const { unlink } = await import('fs/promises');
      await unlink(filePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
