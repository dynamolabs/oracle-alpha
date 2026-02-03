import { z } from 'zod';

// Signal query parameters
export const signalQuerySchema = z.object({
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxAge: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  includePerformance: z.coerce.boolean().optional()
});

// Pagination
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20)
});

// Signal ID parameter
export const signalIdSchema = z.object({
  id: z.string().uuid()
});

// Token address (Solana base58)
export const tokenAddressSchema = z.string().regex(
  /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  'Invalid Solana address format'
);

// On-chain publish request
export const publishRequestSchema = z.object({
  signalId: z.string().uuid()
});

// Webhook subscription
export const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(['signal.new', 'signal.published', 'signal.win', 'signal.loss'])),
  minScore: z.number().min(0).max(100).optional(),
  secret: z.string().min(16).optional()
});

// Alert configuration
export const alertConfigSchema = z.object({
  minScore: z.number().min(0).max(100).default(70),
  sources: z.array(z.string()).optional(),
  narratives: z.array(z.string()).optional(),
  maxAge: z.number().min(1).default(30),
  enabled: z.boolean().default(true)
});

// Validate request middleware
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      req.validatedQuery = schema.parse(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      req.validatedBody = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

export function validateParams<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      req.validatedParams = schema.parse(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }
      next(error);
    }
  };
}

// Type exports
export type SignalQuery = z.infer<typeof signalQuerySchema>;
export type WebhookConfig = z.infer<typeof webhookSchema>;
export type AlertConfig = z.infer<typeof alertConfigSchema>;
