import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { type, subject, message, rating, email } = await req.json();

    if (!type || !subject || !message) {
      return NextResponse.json(
        { error: 'Feedback type, subject, and message are required.' },
        { status: 400 }
      );
    }

    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, 'feedback.json');

    // Create the directory if it doesn't exist
    await fs.mkdir(dataDir, { recursive: true });

    // Read existing feedback
    let feedbacks = [];
    try {
      const fileData = await fs.readFile(filePath, 'utf-8');
      feedbacks = JSON.parse(fileData);
    } catch (err) {
      // File doesn't exist or is empty, start fresh
    }

    // Append new feedback
    const newFeedback = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      type,
      subject,
      message,
      rating: rating || null,
      email: email || null,
    };

    feedbacks.push(newFeedback);

    // Save back to file
    await fs.writeFile(filePath, JSON.stringify(feedbacks, null, 2), 'utf-8');

    return NextResponse.json({ success: true, feedback: newFeedback });
  } catch (err) {
    console.error('Feedback API error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
