import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Mock session creation - just return a session ID
    const sessionId = `SESSION-${Date.now()}`;
    
    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Session created successfully',
      data: {
        ...body,
        id: sessionId,
        status: 'active',
        created_at: new Date().toISOString(),
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}
