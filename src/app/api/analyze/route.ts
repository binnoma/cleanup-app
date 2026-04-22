import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    // Use sharp for image analysis
    let sharp: typeof import('sharp') | null = null
    try {
      sharp = (await import('sharp')).default
    } catch {
      // sharp not available, return basic info
      return NextResponse.json({
        width: 0,
        height: 0,
        size: file.size,
        type: file.type,
        avgColor: '#888888',
        hash: `${file.size}_${file.name}`,
      })
    }

    const metadata = await sharp(buffer).metadata()
    
    // Get average color by resizing to 1x1 pixel
    const stats = await sharp(buffer)
      .resize(1, 1)
      .raw()
      .toBuffer()

    const r = stats[0] || 0
    const g = stats[1] || 0
    const b = stats[2] || 0
    const avgColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`

    const hash = `${metadata.width}x${metadata.height}_${file.size}_${avgColor}`

    return NextResponse.json({
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: file.size,
      type: file.type,
      avgColor,
      hash,
    })
  } catch (error) {
    console.error('Image analysis error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze image' },
      { status: 500 }
    )
  }
}
