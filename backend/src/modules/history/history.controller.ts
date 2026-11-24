import { Router, Response } from 'express';
import { db } from '../../database';
import { authenticate, AuthenticatedRequest } from '../auth/auth.middleware';

export const historyRouter = Router();

/**
 * GET /api/history/my
 * Returns the authenticated user's personal watch history with pagination,
 * total session durations, user role badges, and participant metrics.
 */
historyRouter.get('/my', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const { sessions, total } = await db.listUserWatchHistory(req.user!.userId, {
      limit,
      offset,
    });

    return res.json({
      success: true,
      history: sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve watch history.' });
  }
});

/**
 * GET /api/history/:sessionId
 * Returns comprehensive details for a specific watch session (including attendee intervals
 * and host transfers), strictly enforcing authorization (requester must have attended or hosted).
 */
historyRouter.get('/:sessionId', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const details = await db.getSessionDetails(sessionId, req.user!.userId);

    if (!details) {
      // Differentiate between non-existent session and unauthorized access
      const sessionExists = await db.findSessionById(sessionId);
      if (!sessionExists) {
        return res.status(404).json({ error: 'Watch session not found.' });
      }
      return res.status(403).json({
        error: 'Access denied: You did not attend this watch party session.',
      });
    }

    return res.json({
      success: true,
      session: details.session,
      attendance: details.attendance,
      transfers: details.transfers,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to retrieve session details.' });
  }
});
