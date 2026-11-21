import { Request, Response, NextFunction } from 'express';
import { authService, AuthTokenPayload } from './auth.service';

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = await authService.verifyToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    return res.status(401).json({ error: err.message || 'Invalid or expired token.' });
  }
}

export async function optionalAuthenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const payload = await authService.verifyToken(token);
      req.user = payload;
    } catch (e) {
      // Ignore for optional auth
    }
  }
  next();
}
