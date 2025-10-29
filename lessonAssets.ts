import { Router } from 'express'

const router = Router()

type Asset = {
  id: string
  lessonId: string
  type: 'video'
  url: string
  title?: string
  durationMs?: number
  thumbnailUrl?: string
  jobId?: string
  provider?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

const assets: Asset[] = [] // TODO: replace with DB

router.post('/api/lessons/:lessonId/assets', (req, res) => {
  const { lessonId } = req.params
  const {
    type, url, title, durationMs, thumbnailUrl, jobId, provider, metadata
  } = req.body || {}

  if (type !== 'video' || !url) {
    return res.status(400).json({ message: 'Expected { type:"video", url }' })
  }

  const asset: Asset = {
    id: 'asset_' + Math.random().toString(36).slice(2, 9),
    lessonId,
    type: 'video',
    url,
    title,
    durationMs,
    thumbnailUrl,
    jobId,
    provider,
    metadata,
    createdAt: new Date().toISOString(),
  }
  assets.push(asset)
  return res.status(201).json(asset)
})

export default router
