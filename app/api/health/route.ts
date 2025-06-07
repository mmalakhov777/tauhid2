import { testDatabaseConnection } from '@/lib/db/queries';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const dbConnected = await testDatabaseConnection();
    
    const health = {
      status: dbConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: dbConnected ? 'up' : 'down',
          message: dbConnected ? 'Database connection successful' : 'Database connection failed'
        }
      }
    };

    return NextResponse.json(health, { 
      status: dbConnected ? 200 : 503 
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 