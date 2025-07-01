import { Request, Response } from 'express';
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
      const { client_id, redirect_uri, response_type, scope, state } = req.query;

      // Validate client
      const client = this.clients.get(client_id as string);
      if (!client) {
        res.status(400).json({
          error: 'invalid_client',
          error_description: 'Unknown client',
        });
        return;
      }

      // For simplified implementation, auto-approve the request
      const authCode = generateToken(
        { client_id, scope, redirect_uri },
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
      logError('Authorization failed', error, { query: req.query });
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid authorization request',
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

      // Validate client
      const client = this.clients.get(validatedData.client_id);
      if (!client) {
        logError('OAuth token request failed - unknown client', null, {
          clientId: validatedData.client_id,
          userAgent: req.headers['user-agent']
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
