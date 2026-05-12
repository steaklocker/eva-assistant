import { NextRequest, NextResponse } from 'next/server';

// This endpoint is called by Vercel Cron
// Schedule defined in vercel.json:
// - 6:00 AM PT: morning brief
// - Every 2 hours: anomaly check
// - 8:30 PM PT: evening review

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hour = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    hour12: false,
  });

  const currentHour = parseInt(hour);

  try {
    if (currentHour === 6) {
      // Morning brief — store results for when Chef opens the app
      // TODO: Generate morning brief via Claude API
      // TODO: Store in Supabase
      // TODO: Send push notification
      console.log('EVA: Morning brief triggered');
    } else if (currentHour === 20 || currentHour === 21) {
      // Evening review
      console.log('EVA: Evening review triggered');
    } else {
      // Anomaly check — inventory, urgent emails, market moves
      console.log('EVA: Anomaly check triggered');
    }

    return NextResponse.json({ status: 'ok', hour: currentHour });
  } catch (error) {
    console.error('EVA cron error:', error);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
