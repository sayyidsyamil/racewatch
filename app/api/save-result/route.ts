import { NextRequest, NextResponse } from 'next/server';
import client from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const db = client.db('racesentinel');
    const collection = db.collection('race_results');
    const exists = await collection.findOne({ teamName: data.teamName, category: data.category });
    if (exists) {
      return NextResponse.json({ success: false, error: 'A result for this team name already exists in this category.' }, { status: 400 });
    }
    const result = await collection.insertOne({ ...data, createdAt: new Date() });
    return NextResponse.json({ success: true, id: result.insertedId });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as any)?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const db = client.db('racesentinel');
    const collection = db.collection('race_results');
    const rendah = await collection.find({ category: 'rendah' }).sort({ 'time.taken': 1 }).toArray();
    const menengah = await collection.find({ category: 'menengah' }).sort({ 'time.taken': 1 }).toArray();
    return NextResponse.json({ rendah, menengah });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as any)?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teamName = searchParams.get('teamName');
    const category = searchParams.get('category');

    if (!teamName || !category) {
      return NextResponse.json({ success: false, error: 'Missing teamName or category' }, { status: 400 });
    }

    const db = client.db('racesentinel');
    const collection = db.collection('race_results');

    const deleteResult = await collection.deleteOne({ teamName, category });

    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({ success: false, error: 'Result not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as any)?.message || 'Unknown error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const { _id, teamName, category, ...updatedFields } = data;

    if (!_id || !teamName || !category) {
      return NextResponse.json({ success: false, error: 'Missing _id, teamName, or category in request body' }, { status: 400 });
    }

    const db = client.db('racesentinel');
    const collection = db.collection('race_results');

    const existingDocument = await collection.findOne({ _id: new ObjectId(_id) });

    if (!existingDocument) {
      return NextResponse.json({ success: false, error: 'Result not found' }, { status: 404 });
    }

    if (existingDocument.teamName !== teamName) {
      const duplicate = await collection.findOne({
        teamName,
        category,
        _id: { $ne: new ObjectId(_id) }
      });

      if (duplicate) {
        return NextResponse.json({ success: false, error: 'Team name already exists in this category' }, { status: 400 });
      }
    }

    const updateResult = await collection.updateOne(
      { _id: new ObjectId(_id) },
      { $set: { teamName, category, ...updatedFields } }
    );

    if (updateResult.matchedCount === 0) {
      return NextResponse.json({ success: false, error: 'Result not found after validation' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: (error as any)?.message || 'Unknown error' }, { status: 500 });
  }
} 
