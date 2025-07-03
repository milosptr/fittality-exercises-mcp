// Simple OAuth 2.0 implementation for Claude Web integration
import crypto from 'crypto';

// In-memory storage
const tokens = new Map<string, { expires: number; client: string }>();
const codes = new Map<string, { expires: number; client: string; codeChallenge?: string; codeChallengeMethod?: string }>();

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
      supported_scopes: ['claudeai', 'mcp:read', 'mcp:write'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post']
    });
  },

  // Authorization endpoint
  authorize: (req: any, res: any) => {
    try {
      console.log('Authorization endpoint query params:', JSON.stringify(req.query, null, 2));

      const { client_id, redirect_uri, response_type, state, code_challenge, code_challenge_method } = req.query;

    if (!client_id || response_type !== 'code') {
      res.status(400).json({ error: 'invalid_request' });
      return;
    }

    // Accept any Claude Web client ID (they seem to generate unique IDs)
    if (!client_id.toString().startsWith('exercise-mcp-client-') && client_id !== 'claude-web') {
      res.status(400).json({ error: 'invalid_client' });
      return;
    }

    // Generate authorization code
    const code = crypto.randomBytes(32).toString('hex');
    codes.set(code, {
      expires: Date.now() + 600000, // 10 minutes
      client: client_id,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method
    });

        // Redirect with code - use Claude Web's actual callback URI
    const defaultRedirectUri = 'https://claude.ai/api/mcp/auth_callback';
    const redirectUrl = new URL(redirect_uri || defaultRedirectUri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);

    res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('Authorization endpoint error:', error);
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
    }
  },

    // Token endpoint
  token: (req: any, res: any) => {
    try {
      console.log('Token endpoint request body:', JSON.stringify(req.body, null, 2));

      // Ensure request body exists and is properly parsed
      if (!req.body || typeof req.body !== 'object') {
        console.error('Invalid request body:', req.body);
        res.status(400).json({ error: 'invalid_request', error_description: 'Invalid request body' });
        return;
      }

      const { grant_type, code, client_id, client_secret, code_verifier } = req.body;

      if (grant_type !== 'authorization_code' || !code || !client_id) {
        console.error('Missing required parameters:', { grant_type, code: !!code, client_id: !!client_id });
        res.status(400).json({ error: 'invalid_request', error_description: 'Missing required parameters' });
        return;
      }

      // Accept Claude Web client IDs
      const isValidClient = client_id === 'claude-web' || client_id.toString().startsWith('exercise-mcp-client-');
      if (!isValidClient) {
        res.status(401).json({ error: 'invalid_client' });
        return;
      }

      const codeData = codes.get(code);
      if (!codeData || Date.now() > codeData.expires) {
        res.status(400).json({ error: 'invalid_grant' });
        return;
      }

      // Validate authentication: either client_secret or PKCE
      if (codeData.codeChallenge) {
        // PKCE flow - validate code_verifier
        if (!code_verifier) {
          res.status(400).json({ error: 'invalid_request', error_description: 'code_verifier required for PKCE' });
          return;
        }

        // For S256, we need to hash the verifier and compare with challenge
        if (codeData.codeChallengeMethod === 'S256') {
          try {
            const hash = crypto.createHash('sha256').update(code_verifier, 'utf8').digest();

            // Use base64url encoding with fallback for older Node.js versions
            let challengeFromVerifier: string;
            try {
              challengeFromVerifier = hash.toString('base64url');
            } catch (base64urlError) {
              // Fallback: manual base64url conversion
              challengeFromVerifier = hash.toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=/g, '');
            }

            console.log('PKCE Debug - Expected challenge:', codeData.codeChallenge);
            console.log('PKCE Debug - Computed challenge:', challengeFromVerifier);
            console.log('PKCE Debug - Code verifier:', code_verifier);

            if (challengeFromVerifier !== codeData.codeChallenge) {
              res.status(400).json({ error: 'invalid_grant', error_description: 'invalid code_verifier' });
              return;
            }
          } catch (cryptoError) {
            console.error('PKCE validation error:', cryptoError);
            res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE validation failed' });
            return;
          }
        } else if (codeData.codeChallengeMethod === 'plain') {
          if (code_verifier !== codeData.codeChallenge) {
            res.status(400).json({ error: 'invalid_grant', error_description: 'invalid code_verifier' });
            return;
          }
        }
      } else {
        // Traditional client_secret flow
        if (client_secret !== CLIENT_SECRET) {
          res.status(401).json({ error: 'invalid_client' });
          return;
        }
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
    } catch (error) {
      console.error('Token endpoint error:', error);
      res.status(500).json({ error: 'server_error', error_description: 'Internal server error' });
    }
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
