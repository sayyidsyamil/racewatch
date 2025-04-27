import { NextRequest, NextResponse } from 'next/server';
import client from '@/lib/mongodb';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const db = client.db('test');
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
    const db = client.db('test');
    const collection = db.collection('race_results');
    const rendah = await collection.find({ category: 'rendah' }).sort({ 'time.taken': 1 }).toArray();
    const menengah = await collection.find({ category: 'menengah' }).sort({ 'time.taken': 1 }).toArray();
    return NextResponse.json({ rendah, menengah });
  } catch (error) {
    return NextResponse.json({ success: false, error: (error as any)?.message || 'Unknown error' }, { status: 500 });
  }
} 