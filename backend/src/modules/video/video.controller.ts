import { Router, Request, Response } from 'express';
import { videoService } from './video.service';

export const videoRouter = Router();

// POST /api/video/resolve
videoRouter.post('/resolve', (req: Request, res: Response) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL string is required in request body.' });
  }

  const resolved = videoService.resolveUrl(url);
  return res.json({
    success: resolved.isSupported,
    ...resolved,
  });
});
