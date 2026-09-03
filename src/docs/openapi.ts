import type { OpenAPIV3 } from 'openapi-types';

export const openApiDocument: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'FinTrace API',
    description:
      'Graph-based AML / transaction-monitoring engine. Ingest transactions, run detection rules, and manage the analyst investigation workflow (alerts, risk scores, cases).',
    version: '0.1.0'
  },
  servers: [{ url: '/' }],
  tags: [
    { name: 'auth' },
    { name: 'accounts' },
    { name: 'transactions' },
    { name: 'detection' },
    { name: 'alerts' },
    { name: 'cases' },
    { name: 'ops' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: { error: { type: 'string' }, details: { type: 'object' } },
        required: ['error']
      },
      Account: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          entityId: { type: 'string', nullable: true },
          entityName: { type: 'string', nullable: true },
          deviceId: { type: 'string', nullable: true },
          ipAddress: { type: 'string', nullable: true }
        }
      },
      AccountInput: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
          entityId: { type: 'string' },
          entityName: { type: 'string' },
          deviceId: { type: 'string' },
          ipAddress: { type: 'string' }
        }
      },
      TransactionInput: {
        type: 'object',
        required: ['id', 'fromAccountId', 'toAccountId', 'amount', 'currency', 'timestamp'],
        properties: {
          id: { type: 'string' },
          fromAccountId: { type: 'string' },
          toAccountId: { type: 'string' },
          amount: { type: 'number', minimum: 0, exclusiveMinimum: true },
          currency: { type: 'string', minLength: 3, maxLength: 3, example: 'USD' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      SubgraphResponse: {
        type: 'object',
        properties: {
          nodes: { type: 'array', items: { type: 'object' } },
          edges: { type: 'array', items: { type: 'object' } }
        }
      },
      RiskScore: {
        type: 'object',
        properties: {
          accountId: { type: 'string' },
          score: { type: 'number', minimum: 0, maximum: 1 },
          contributingRules: { type: 'array', items: { type: 'string' } }
        }
      },
      Alert: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          rule: { type: 'string' },
          score: { type: 'number' },
          accountIds: { type: 'array', items: { type: 'string' } },
          transactionIds: { type: 'array', items: { type: 'string' } },
          details: { type: 'object' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      },
      Case: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['open', 'in_review', 'closed'] },
          accountIds: { type: 'array', items: { type: 'string' } },
          alertIds: { type: 'array', items: { type: 'string' } },
          assignedTo: { type: 'string', nullable: true },
          notes: { type: 'array', items: { type: 'object' } }
        }
      },
      CaseCreateInput: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          accountIds: { type: 'array', items: { type: 'string' } },
          alertIds: { type: 'array', items: { type: 'string' } },
          assignedTo: { type: 'string' }
        }
      },
      CaseUpdateInput: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['open', 'in_review', 'closed'] },
          assignedTo: { type: 'string' }
        }
      },
      CaseNoteInput: {
        type: 'object',
        required: ['body'],
        properties: { body: { type: 'string' } }
      }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['ops'],
        summary: 'Liveness check',
        security: [],
        responses: { '200': { description: 'OK' } }
      }
    },
    '/metrics': {
      get: {
        tags: ['ops'],
        summary: 'Prometheus metrics',
        security: [],
        responses: { '200': { description: 'Prometheus text exposition format' } }
      }
    },
    '/auth/login': {
      post: {
        tags: ['auth'],
        summary: 'Log in and obtain a JWT',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: { username: { type: 'string' }, password: { type: 'string' } }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Authenticated',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { token: { type: 'string' } } }
              }
            }
          },
          '401': { description: 'Invalid credentials' }
        }
      }
    },
    '/accounts': {
      post: {
        tags: ['accounts'],
        summary: 'Create or update an account',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountInput' } } }
        },
        responses: {
          '201': { description: 'Created' },
          '400': {
            description: 'Invalid input',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          }
        }
      }
    },
    '/accounts/risk': {
      get: {
        tags: ['accounts'],
        summary: 'Top accounts by risk score',
        parameters: [
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    scores: { type: 'array', items: { $ref: '#/components/schemas/RiskScore' } }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/accounts/{id}': {
      get: {
        tags: ['accounts'],
        summary: 'Account detail',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Account' } } }
          },
          '404': { description: 'Not found' }
        }
      }
    },
    '/accounts/{id}/subgraph': {
      get: {
        tags: ['accounts'],
        summary: "Account's transaction-graph neighborhood",
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'depth', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 5, default: 2 } }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SubgraphResponse' } }
            }
          },
          '404': { description: 'Not found' }
        }
      }
    },
    '/accounts/{id}/risk': {
      get: {
        tags: ['accounts'],
        summary: "Account's current risk score",
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/RiskScore' } } }
          },
          '404': { description: 'Not found' }
        }
      }
    },
    '/transactions': {
      post: {
        tags: ['transactions'],
        summary: 'Submit a single transaction for async ingestion',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/TransactionInput' } }
          }
        },
        responses: {
          '202': { description: 'Accepted for processing' },
          '400': {
            description: 'Invalid input',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } }
          }
        }
      }
    },
    '/transactions/batch': {
      post: {
        tags: ['transactions'],
        summary: 'Batch-submit transactions via CSV upload',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } }
            }
          }
        },
        responses: {
          '200': {
            description: 'Per-row acceptance/validation results'
          }
        }
      }
    },
    '/transactions/{id}': {
      get: {
        tags: ['transactions'],
        summary: 'Transaction detail',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'OK' }, '404': { description: 'Not found' } }
      }
    },
    '/detection/run': {
      post: {
        tags: ['detection'],
        summary: 'Run all detection rules over the current graph (admin only)',
        responses: {
          '200': { description: 'Per-rule summary of hits' },
          '403': { description: 'Forbidden — admin role required' }
        }
      }
    },
    '/alerts': {
      get: {
        tags: ['alerts'],
        summary: 'List persisted alerts',
        parameters: [
          { name: 'rule', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { alerts: { type: 'array', items: { $ref: '#/components/schemas/Alert' } } }
                }
              }
            }
          }
        }
      }
    },
    '/cases': {
      post: {
        tags: ['cases'],
        summary: 'Open a case',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CaseCreateInput' } } }
        },
        responses: { '201': { description: 'Created' } }
      },
      get: {
        tags: ['cases'],
        summary: 'List cases',
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['open', 'in_review', 'closed'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } }
        ],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { cases: { type: 'array', items: { $ref: '#/components/schemas/Case' } } }
                }
              }
            }
          }
        }
      }
    },
    '/cases/{id}': {
      get: {
        tags: ['cases'],
        summary: 'Case detail including notes',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Case' } } }
          },
          '404': { description: 'Not found' }
        }
      },
      patch: {
        tags: ['cases'],
        summary: 'Update a case',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CaseUpdateInput' } } }
        },
        responses: { '200': { description: 'Updated' }, '404': { description: 'Not found' } }
      }
    },
    '/cases/{id}/notes': {
      post: {
        tags: ['cases'],
        summary: 'Add an analyst note to a case',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CaseNoteInput' } } }
        },
        responses: { '201': { description: 'Created' }, '404': { description: 'Not found' } }
      }
    }
  }
};
