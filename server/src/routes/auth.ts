import { Router, Request, Response } from 'express';
import { logger } from '../config/logger';

const router = Router();

// Verify password
router.post('/verify', (req: Request, res: Response) => {
  try {
    const { password } = req.body as { password: string };
    const appPassword = process.env.APP_PASSWORD;

    // If no password is set, allow access (development mode)
    if (!appPassword) {
      logger.warn('APP_PASSWORD not set - authentication disabled');
      res.json({ success: true, message: 'Authentication disabled' });
      return;
    }

    if (!password) {
      res.status(400).json({ success: false, error: 'Password required' });
      return;
    }

    if (password === appPassword) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: 'Invalid password' });
    }
  } catch (error) {
    logger.error('Auth error:', error);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
});

// Check if authentication is required
router.get('/status', (_req: Request, res: Response) => {
  const appPassword = process.env.APP_PASSWORD;
  res.json({
    success: true,
    authRequired: !!appPassword,
  });
});

export default router;
