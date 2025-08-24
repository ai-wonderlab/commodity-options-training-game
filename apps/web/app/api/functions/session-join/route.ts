import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    return NextResponse.json({
      success: true,
      message: 'Joined session successfully',
      data: {
        sessionId: body.sessionId,
        participantId: `PLAYER-${Date.now()}`,
        display_name: body.display_name,
        joined_at: new Date().toISOString(),
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to join session' },
      { status: 500 }
    );
  }
}
