import { NextRequest, NextResponse } from 'next/server';
import client from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Handles PUT requests for updating a race result by ID
export async function PUT(req: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const data = await req.json();
    const db = client.db('racesentinel'); // Use your database name
    const collection = db.collection('race_results');

    // Validate if ObjectId is valid
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid ID format' }, { status: 400 });
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      { $set: data }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Result not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating result:', error);
    return NextResponse.json({ success: false, error: (error as any)?.message || 'Unknown error' }, { status: 500 });
  }
}

// Handles DELETE requests for deleting a race result by ID
export async function DELETE(req: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    const db = client.db('racesentinel'); // Use your database name
    const collection = db.collection('race_results');

    // Validate if ObjectId is valid
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, error: 'Invalid ID format' }, { status: 400 });
    }

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Result not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting result:', error);
    return NextResponse.json({ success: false, error: (error as any)?.message || 'Unknown error' }, { status: 500 });
  }
} 
