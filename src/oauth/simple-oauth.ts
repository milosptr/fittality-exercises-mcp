// Simple OAuth 2.0 implementation for Claude Web integration
import crypto from 'crypto';

// In-memory storage
const tokens = new Map<string, { expires: number; client: string }>();
const codes = new Map<string, { expires: number; client: string }>();

const CLIENT_SECRET = process.env.CLAUDE_CLIENT_SECRET || 'demo-secret-change-in-production';
const BASE_URL = process.env.BASE_URL || 'https://fittality-exercises-mcp-production.up.railway.app';

export const oauthHandlers = {
  // OAuth metadata endpoint
  metadata: (req: any, res: any) => {
    res.json({
      issuer: BASE_URL,
      authorization_endpoint: `${BASE_URL}/authorize`,
      token_endpoint: `${BASE_URL}/token`,
      revocation_endpoint: `${BASE_URL}/revoke`,
      supported_response_types: ['code'],
      supported_grant_types: ['authorization_code'],
      supported_scopes: ['mcp:read', 'mcp:write'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post']
    });
  },

  // Authorization endpoint
  authorize: (req: any, res: any) => {
    const { client_id, redirect_uri, response_type, state } = req.query;

    if (!client_id || response_type !== 'code') {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    if (client_id !== 'claude-web') {
      res.status(400).json({ error: 'invalid_client' });
      return;
    }

    // Generate authorization code
    const code = crypto.randomBytes(32).toString('hex');
    codes.set(code, {
      expires: Date.now() + 600000, // 10 minutes
      client: client_id
    });

    // Redirect with code
    const redirectUrl = new URL(redirect_uri || 'https://claude.ai/oauth/callback');
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);

    res.redirect(redirectUrl.toString());
  },

  // Token endpoint
  token: (req: any, res: any) => {
    const { grant_type, code, client_id, client_secret } = req.body;

    if (grant_type !== 'authorization_code' || !code || !client_id) {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    if (client_id !== 'claude-web' || client_secret !== CLIENT_SECRET) {
      res.status(401).json({ error: 'invalid_client' });
      return;
    }

    const codeData = codes.get(code);
    if (!codeData || Date.now() > codeData.expires) {
      res.status(400).json({ error: 'invalid_grant' });
      return;
    }

    // Generate access token
    const accessToken = crypto.randomBytes(32).toString('hex');
    tokens.set(accessToken, {
      expires: Date.now() + 3600000, // 1 hour
      client: client_id
    });

    codes.delete(code); // Remove used code

    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600
    });
  },

  // Token revocation
  revoke: (req: any, res: any) => {
    const { token } = req.body;
    if (token) {
      tokens.delete(token);
      codes.delete(token);
    }
    res.json({});
  },

  // Middleware to validate tokens
  validateToken: (req: any, res: any, next: any) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    const token = auth.slice(7);
    const tokenData = tokens.get(token);

    if (!tokenData || Date.now() > tokenData.expires) {
      res.status(401).json({ error: 'invalid_token' });
      return;
    }

    req.oauth = tokenData;
    next();
  }
};
