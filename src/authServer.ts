import { Request, Response } from 'express';
import crypto from 'crypto';
import {
  ClientRegistration,
  ClientRegistrationResponse,
  TokenRequest,
  TokenResponse,
  OAuthDiscovery,
  ClientRegistrationSchema,
  TokenRequestSchema,
} from './types.js';
import {
  generateClientId,
  generateToken,
  verifyToken,
  logInfo,
  logError,
} from './utils.js';

/**
 * OAuth-compatible authentication server for MCP integration
 */
export class AuthServer {
  private clients: Map<string, ClientRegistrationResponse> = new Map();
  private accessTokens: Map<string, object> = new Map();
  private config: {
    clientIdPrefix: string;
    jwtSecret: string;
    tokenExpiry: number;
    baseUrl: string;
  };

    // Pre-configured clients for stable integrations
  private static readonly WELL_KNOWN_CLIENTS = {
    'claude-mcp-client': {
      client_id: 'claude-mcp-client',
      client_secret: 'not-required-for-public-client',
      client_id_issued_at: Math.floor(Date.now() / 1000),
      scope: 'mcp:read mcp:write',
    },
    'claude-web-client': {
      client_id: 'claude-web-client',
      client_secret: 'not-required-for-public-client',
      client_id_issued_at: Math.floor(Date.now() / 1000),
      scope: 'mcp:read mcp:write',
    },
    'anthropic-claude-client': {
      client_id: 'anthropic-claude-client',
      client_secret: 'not-required-for-public-client',
      client_id_issued_at: Math.floor(Date.now() / 1000),
      scope: 'mcp:read mcp:write',
    },
    'claude-desktop': {
      client_id: 'claude-desktop',
      client_secret: 'not-required-for-public-client',
      client_id_issued_at: Math.floor(Date.now() / 1000),
      scope: 'mcp:read mcp:write',
    },
    'default-mcp-client': {
      client_id: 'default-mcp-client',
      client_secret: 'not-required-for-public-client',
      client_id_issued_at: Math.floor(Date.now() / 1000),
      scope: 'mcp:read mcp:write',
    }
  };

  constructor(
    clientIdPrefix: string,
    jwtSecret: string,
    tokenExpiry: number,
    baseUrl: string
  ) {
    this.config = {
      clientIdPrefix,
      jwtSecret,
      tokenExpiry,
      baseUrl,
    };
  }

  /**
   * OAuth discovery endpoint - /.well-known/oauth-authorization-server
   */
  getDiscoveryDocument(): OAuthDiscovery {
    return {
      authorization_endpoint: `${this.config.baseUrl}/oauth/authorize`,
      token_endpoint: `${this.config.baseUrl}/oauth/token`,
      registration_endpoint: `${this.config.baseUrl}/oauth/register`,
      scopes_supported: ['mcp:read', 'mcp:write'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'client_credentials'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'none'],
      code_challenge_methods_supported: ['S256'],
    };
  }

  /**
   * OAuth discovery endpoint with dynamic base URL
   */
  getDiscoveryDocumentWithBaseUrl(baseUrl: string): OAuthDiscovery {
    return {
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      registration_endpoint: `${baseUrl}/oauth/register`,
      scopes_supported: ['mcp:read', 'mcp:write'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'client_credentials'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'none'],
      code_challenge_methods_supported: ['S256'],
    };
  }

  /**
   * Handle client registration - POST /oauth/register
   */
  async registerClient(req: Request, res: Response): Promise<void> {
    try {
      logInfo('OAuth client registration requested', {
        userAgent: req.headers['user-agent'],
        body: req.body
      });

      const validatedData = ClientRegistrationSchema.parse(req.body);

      const clientId = generateClientId(this.config.clientIdPrefix);
      const clientSecret = 'not-required-for-public-client'; // Simplified for MCP

      const registration: ClientRegistrationResponse = {
        client_id: clientId,
        client_secret: clientSecret,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        scope: validatedData.scope,
      };

      this.clients.set(clientId, registration);

      logInfo('Client registered successfully', {
        clientId,
        clientName: validatedData.client_name
      });

      res.json(registration);
    } catch (error) {
      logError('Client registration failed', error, {
        body: req.body,
        userAgent: req.headers['user-agent']
      });
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid client registration data',
      });
    }
  }

  /**
   * Handle authorization requests - GET /oauth/authorize
   */
  async authorize(req: Request, res: Response): Promise<void> {
    try {
      const {
        client_id,
        redirect_uri,
        response_type,
        scope,
        state,
        code_challenge,
        code_challenge_method
      } = req.query;

      logInfo('OAuth authorization requested', {
        clientId: client_id,
        responseType: response_type,
        scope: scope,
        redirectUri: redirect_uri,
        state: state,
        codeChallenge: code_challenge ? '[PRESENT]' : '[MISSING]',
        codeChallengeMethod: code_challenge_method,
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin,
        referer: req.headers.referer,
        allQueryParams: req.query
      });

      // Validate required parameters
      if (!client_id) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing required parameter: client_id',
        });
        return;
      }

      if (!response_type) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing required parameter: response_type',
        });
        return;
      }

      if (response_type !== 'code') {
        res.status(400).json({
          error: 'unsupported_response_type',
          error_description: 'Only response_type=code is supported',
        });
        return;
      }

      // PKCE validation (required for OAuth 2.1 and MCP)
      if (!code_challenge) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing required parameter: code_challenge (PKCE required)',
        });
        return;
      }

      if (!code_challenge_method) {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Missing required parameter: code_challenge_method',
        });
        return;
      }

      if (code_challenge_method !== 'S256') {
        res.status(400).json({
          error: 'invalid_request',
          error_description: 'Only code_challenge_method=S256 is supported',
        });
        return;
      }

                  // Validate client (check both dynamic registrations and well-known clients)
      let client = this.clients.get(client_id as string);
      if (!client) {
        // Check well-known clients
        client = (AuthServer.WELL_KNOWN_CLIENTS as any)[client_id as string];
      }

      if (!client) {
        // Auto-register clients that follow our expected pattern (for cached Claude clients)
        if (typeof client_id === 'string' && client_id.startsWith(this.config.clientIdPrefix)) {
          logInfo('Auto-registering cached client', {
            clientId: client_id,
            userAgent: req.headers['user-agent']
          });

          client = {
            client_id: client_id,
            client_secret: 'not-required-for-public-client',
            client_id_issued_at: Math.floor(Date.now() / 1000),
            scope: 'mcp:read mcp:write',
          };

          this.clients.set(client_id, client);
        }
      }

      if (!client) {
        logInfo('Client not found in any registry', {
          requestedClientId: client_id,
          dynamicClientsCount: this.clients.size,
          dynamicClientIds: Array.from(this.clients.keys()),
          wellKnownClientIds: Object.keys(AuthServer.WELL_KNOWN_CLIENTS),
          userAgent: req.headers['user-agent']
        });

        res.status(400).json({
          error: 'invalid_client',
          error_description: 'Client not registered. Please register client first using Dynamic Client Registration at /oauth/register',
          hint: 'Client registrations are temporary and may be lost on server restart. Re-register if needed. Well-known clients: ' + Object.keys(AuthServer.WELL_KNOWN_CLIENTS).join(', '),
        });
        return;
      }

      logInfo('Client validated successfully', {
        clientId: client_id,
        clientType: this.clients.has(client_id as string) ? 'dynamic' : 'well-known'
      });

      // For simplified implementation, auto-approve the request
      const authCode = generateToken(
        {
          client_id,
          scope,
          redirect_uri,
          code_challenge,
          code_challenge_method
        },
        this.config.jwtSecret,
        300 // 5 minutes
      );

      if (redirect_uri) {
        const redirectUrl = new URL(redirect_uri as string);
        redirectUrl.searchParams.set('code', authCode);
        if (state) redirectUrl.searchParams.set('state', state as string);

        res.redirect(redirectUrl.toString());
      } else {
        res.json({
          code: authCode,
          state,
        });
      }

      logInfo('Authorization code issued', {
        clientId: client_id,
        scope
      });
    } catch (error) {
      logError('Authorization failed', error, {
        query: req.query,
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin
      });
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during authorization',
      });
    }
  }

  /**
   * Handle token requests - POST /oauth/token
   */
  async token(req: Request, res: Response): Promise<void> {
    try {
      logInfo('OAuth token requested', {
        userAgent: req.headers['user-agent'],
        body: req.body
      });

      const validatedData = TokenRequestSchema.parse(req.body);

            // Validate client (check both dynamic registrations and well-known clients)
      let client = this.clients.get(validatedData.client_id);
      if (!client) {
        // Check well-known clients
        client = (AuthServer.WELL_KNOWN_CLIENTS as any)[validatedData.client_id];
      }

      if (!client) {
        // Auto-register clients that follow our expected pattern (for cached Claude clients)
        if (validatedData.client_id.startsWith(this.config.clientIdPrefix)) {
          logInfo('Auto-registering cached client for token exchange', {
            clientId: validatedData.client_id,
            userAgent: req.headers['user-agent']
          });

          client = {
            client_id: validatedData.client_id,
            client_secret: 'not-required-for-public-client',
            client_id_issued_at: Math.floor(Date.now() / 1000),
            scope: 'mcp:read mcp:write',
          };

          this.clients.set(validatedData.client_id, client);
        }
      }

      if (!client) {
        logError('OAuth token request failed - unknown client', null, {
          clientId: validatedData.client_id,
          userAgent: req.headers['user-agent'],
          dynamicClientsCount: this.clients.size,
          wellKnownClientIds: Object.keys(AuthServer.WELL_KNOWN_CLIENTS)
        });
        res.status(401).json({
          error: 'invalid_client',
          error_description: 'Unknown client',
        });
        return;
      }

      let accessToken: string;

      if (validatedData.grant_type === 'client_credentials') {
        // Client credentials grant
        accessToken = generateToken(
          {
            client_id: validatedData.client_id,
            scope: validatedData.scope || 'mcp:read mcp:write',
            token_type: 'access_token',
          },
          this.config.jwtSecret,
          this.config.tokenExpiry
        );
      } else if (validatedData.grant_type === 'authorization_code') {
        // Authorization code grant
        if (!validatedData.code) {
          res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing authorization code',
          });
          return;
        }

        try {
          const codeData = verifyToken(validatedData.code, this.config.jwtSecret);

          // PKCE verification (required for OAuth 2.1)
          if (codeData.code_challenge) {
            const codeVerifier = (req.body as any).code_verifier;
            if (!codeVerifier) {
              res.status(400).json({
                error: 'invalid_request',
                error_description: 'Missing code_verifier for PKCE verification',
              });
              return;
            }

            // Verify code_challenge
            const expectedChallenge = crypto
              .createHash('sha256')
              .update(codeVerifier)
              .digest('base64url');

            if (expectedChallenge !== codeData.code_challenge) {
              res.status(400).json({
                error: 'invalid_grant',
                error_description: 'PKCE verification failed',
              });
              return;
            }
          }

          accessToken = generateToken(
            {
              client_id: validatedData.client_id,
              scope: codeData.scope || 'mcp:read mcp:write',
              token_type: 'access_token',
            },
            this.config.jwtSecret,
            this.config.tokenExpiry
          );
        } catch (error) {
          res.status(400).json({
            error: 'invalid_grant',
            error_description: 'Invalid authorization code',
          });
          return;
        }
      } else {
        res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: 'Grant type not supported',
        });
        return;
      }

      // Store token for validation
      this.accessTokens.set(accessToken, {
        client_id: validatedData.client_id,
        scope: validatedData.scope || 'mcp:read mcp:write',
        issued_at: Date.now(),
      });

      const tokenResponse: TokenResponse = {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: this.config.tokenExpiry,
        scope: validatedData.scope || 'mcp:read mcp:write',
      };

      logInfo('Access token issued', {
        clientId: validatedData.client_id,
        grantType: validatedData.grant_type,
      });

      res.json(tokenResponse);
    } catch (error) {
      logError('Token request failed', error, { body: req.body });
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid token request',
      });
    }
  }

  /**
   * Validate access token
   */
  validateToken(token: string): boolean {
    try {
      const decoded = verifyToken(token, this.config.jwtSecret);
      const tokenData = this.accessTokens.get(token);

      return tokenData !== undefined && decoded.token_type === 'access_token';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get token information
   */
  getTokenInfo(token: string): object | null {
    try {
      const decoded = verifyToken(token, this.config.jwtSecret);
      const tokenData = this.accessTokens.get(token);

      if (tokenData) {
        return {
          ...decoded,
          ...tokenData,
        };
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Middleware to protect MCP endpoints
   */
  authenticateToken = (req: Request, res: Response, next: Function): void => {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({
        error: 'unauthorized',
        error_description: 'Missing access token',
      });
      return;
    }

    if (!this.validateToken(token)) {
      res.status(401).json({
        error: 'invalid_token',
        error_description: 'Invalid or expired token',
      });
      return;
    }

    // Add token info to request
    (req as any).tokenInfo = this.getTokenInfo(token);
    next();
  };

  /**
   * Get registered clients count
   */
  getClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get well-known clients count
   */
  getWellKnownClientsCount(): number {
    return Object.keys(AuthServer.WELL_KNOWN_CLIENTS).length;
  }

  /**
   * Get total clients count (dynamic + well-known)
   */
  getTotalClientsCount(): number {
    return this.clients.size + this.getWellKnownClientsCount();
  }

  /**
   * Get active tokens count
   */
  getActiveTokensCount(): number {
    return this.accessTokens.size;
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens(): void {
    const now = Date.now();
    const expiredTokens: string[] = [];

    for (const [token, tokenData] of this.accessTokens.entries()) {
      const issuedAt = (tokenData as any).issued_at || 0;
      const expiresAt = issuedAt + (this.config.tokenExpiry * 1000);

      if (now > expiresAt) {
        expiredTokens.push(token);
      }
    }

    for (const token of expiredTokens) {
      this.accessTokens.delete(token);
    }

    if (expiredTokens.length > 0) {
      logInfo('Cleaned up expired tokens', { count: expiredTokens.length });
    }
  }
}
