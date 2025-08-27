# MNEE SDK V2 Implementation Strategy

## Executive Summary

This document outlines the comprehensive strategy for implementing MNEE V2 API support in the current SDK while maintaining full backward compatibility with existing V1 implementations. The strategy ensures zero disruption to current production users while providing a clear migration path to leverage V2's enhanced capabilities.

## 1. Architecture Overview

### 1.1 Core Principles
- **Full Backward Compatibility**: All existing V1 methods remain functional without modification
- **Progressive Enhancement**: V2 features are opt-in through configuration or explicit method calls
- **Type Safety**: Maintain TypeScript type safety across both API versions
- **Single SDK Interface**: Users interact with one unified SDK regardless of API version

### 1.2 Versioning Strategy
```typescript
// SDK will internally route to appropriate API version
const mnee = new Mnee({
  environment: 'production',
  apiKey: 'key',
  apiVersion: 'v2' // Optional, defaults to 'v1' for backward compatibility
});
```

## 2. Implementation Phases

### Phase 1: Foundation (Week 1-2)
**Objective**: Establish V2 infrastructure without disrupting V1

#### 2.1.1 API Version Management
- Create `ApiVersionManager` class to handle version routing
- Implement version detection in `MNEEService` constructor
- Add `apiVersion` field to `SdkConfig` type

#### 2.1.2 Response Type Updates
```typescript
// New types for V2 responses
export interface TransferResponseV2 extends TransferResponse {
  ticketId: string;
  status?: 'pending' | 'processing' | 'success' | 'failure';
}

export interface MNEEUtxoV2 extends MNEEUtxo {
  senders?: string[];
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}
```

### Phase 2: Core V2 Features (Week 2-3)
**Objective**: Implement new V2 endpoints while maintaining V1 compatibility

#### 2.2.1 UTXO API with Pagination
```typescript
// Backward compatible method signature
async getUtxos(
  address: string | string[], 
  options?: { 
    pagination?: PaginationParams,
    version?: 'v1' | 'v2' 
  }
): Promise<MNEEUtxo[]>

// New V2-specific method for clarity
async getUtxosV2(
  address: string | string[],
  pagination?: PaginationParams
): Promise<{ utxos: MNEEUtxoV2[], hasMore: boolean, nextOffset?: number }>
```

#### 2.2.2 Asynchronous Transfer API
```typescript
// Enhanced transfer method with V2 support
async transfer(
  request: SendMNEE[], 
  wif: string, 
  options?: {
    broadcast?: boolean,
    async?: boolean,        // V2: Enable async mode
    callbackUrl?: string    // V2: Webhook for status updates
  }
): Promise<TransferResponse | TransferResponseV2>

// Ticket status checking
async getTransferStatus(ticketId: string): Promise<TransferStatusResponse>
```

#### 2.2.3 Balance API Enhancement
The existing `balance` and `balances` methods already support the V2 requirements. Internal implementation will route to V2 endpoints when configured:
```typescript
// Already supports single and multiple addresses
async balance(address: string): Promise<MNEEBalance>
async balances(addresses: string[]): Promise<MNEEBalance[]>
```

### Phase 3: Advanced Features (Week 3-4)
**Objective**: Implement callback handling and protocol updates

#### 2.3.1 Callback Handler
```typescript
export class CallbackHandler {
  validateCallback(payload: any, signature?: string): boolean
  processCallback(payload: CallbackPayload): void
}

// Usage example
mnee.onTransferUpdate((update: TransferUpdate) => {
  console.log(`Transfer ${update.ticketId}: ${update.status}`);
});
```

#### 2.3.2 Protocol Metadata Support
```typescript
export interface ProtocolMetadataV2 {
  currentSupply?: number;
  version?: string;
  action?: 'mint' | 'redeem' | 'transfer';
}

// Enhanced inscription parsing
parseInscription(script: Script): Inscription & { metadata?: ProtocolMetadataV2 }
```

## 3. Migration Path

### 3.1 Deprecation Strategy
```typescript
// V1 methods will log deprecation warnings in development
if (isDevelopment && this.apiVersion === 'v1') {
  console.warn('[MNEE SDK] Using V1 API. Consider migrating to V2 for improved performance.');
}
```

### 3.2 Migration Timeline
- **Months 1-3**: V2 available as opt-in beta
- **Months 4-6**: V2 becomes default for new SDK instances
- **Months 7-12**: V1 deprecated with warnings
- **Month 13+**: V1 support maintained but not enhanced

### 3.3 Migration Guide for Users
```typescript
// Step 1: Update SDK configuration
const mnee = new Mnee({
  environment: 'production',
  apiKey: 'key',
  apiVersion: 'v2'  // Explicit V2 adoption
});

// Step 2: Update transfer calls for async support
const result = await mnee.transfer(
  transfers, 
  wif,
  { 
    async: true,
    callbackUrl: 'https://myapp.com/webhook/mnee'
  }
);

if ('ticketId' in result) {
  // Handle V2 async response
  const status = await mnee.getTransferStatus(result.ticketId);
}

// Step 3: Leverage pagination for large wallets
const { utxos, hasMore } = await mnee.getUtxosV2(
  address, 
  { limit: 100, order: 'desc' }
);
```

## 4. Testing Strategy

### 4.1 Test Coverage Requirements
- **Unit Tests**: 100% coverage for new V2 methods
- **Integration Tests**: Parallel V1/V2 testing to ensure consistency
- **Regression Tests**: Automated testing of all V1 methods
- **Performance Tests**: Benchmark V2 improvements

### 4.2 Test Environment Setup
```typescript
describe('MNEE V2 API Tests', () => {
  const v1Client = new Mnee({ apiVersion: 'v1', ...config });
  const v2Client = new Mnee({ apiVersion: 'v2', ...config });
  
  it('should maintain backward compatibility', async () => {
    const v1Result = await v1Client.balance(address);
    const v2Result = await v2Client.balance(address);
    expect(v1Result).toEqual(v2Result);
  });
});
```

## 5. Error Handling & Monitoring

### 5.1 Enhanced Error Types
```typescript
export class MNEEApiError extends Error {
  constructor(
    message: string,
    public code: string,
    public apiVersion: 'v1' | 'v2',
    public details?: any
  ) {
    super(message);
  }
}

export class TicketNotFoundError extends MNEEApiError {
  constructor(ticketId: string) {
    super(`Ticket ${ticketId} not found`, 'TICKET_NOT_FOUND', 'v2');
  }
}
```

### 5.2 Monitoring & Telemetry
```typescript
interface ApiMetrics {
  version: 'v1' | 'v2';
  endpoint: string;
  responseTime: number;
  success: boolean;
  error?: string;
}

// Internal telemetry collection
private collectMetrics(metrics: ApiMetrics): void {
  if (this.telemetryEnabled) {
    this.telemetryProvider.track('api_call', metrics);
  }
}
```

## 6. Documentation Requirements

### 6.1 Documentation Updates
- **API Reference**: Comprehensive documentation for all V2 methods
- **Migration Guide**: Step-by-step migration instructions
- **Code Examples**: Real-world usage examples for V2 features
- **Changelog**: Detailed changelog for each release

### 6.2 Developer Resources
```typescript
// Auto-generated TypeScript definitions
export interface MneeV2Methods {
  getUtxosV2(address: string, pagination?: PaginationParams): Promise<PaginatedUtxos>;
  getTransferStatus(ticketId: string): Promise<TransferStatus>;
  subscribeToCallbacks(handler: CallbackHandler): void;
}
```

## 7. Performance Considerations

### 7.1 Optimization Strategies
- **Connection Pooling**: Reuse HTTP connections for V2 endpoints
- **Response Caching**: Cache immutable data (config, completed transfers)
- **Batch Processing**: Leverage V2's improved batch capabilities
- **Pagination**: Automatic pagination for large result sets

### 7.2 Performance Metrics
```typescript
interface PerformanceTarget {
  avgResponseTime: number;  // Target: <200ms for balance, <500ms for transfer
  p95ResponseTime: number;  // Target: <1000ms
  errorRate: number;        // Target: <0.1%
}
```

## 8. Security Considerations

### 8.1 Callback Security
```typescript
// Webhook signature validation
class WebhookValidator {
  validateSignature(payload: string, signature: string, secret: string): boolean {
    const expected = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
  }
}
```

### 8.2 API Key Management
- Maintain separate API keys for V1 and V2 if needed
- Implement key rotation capabilities
- Add rate limiting awareness for V2 endpoints

## 9. Rollout Plan

### 9.1 Beta Program (Weeks 1-4)
- Internal testing with staging environment
- Selected partner integration testing
- Performance benchmarking and optimization

### 9.2 Production Rollout (Weeks 5-8)
- **Week 5**: Soft launch with 5% traffic
- **Week 6**: Expand to 25% traffic
- **Week 7**: Expand to 50% traffic
- **Week 8**: Full production availability

### 9.3 Success Metrics
- Zero V1 functionality regression
- <5ms additional latency for V2 routing
- >90% successful async transfer completions
- >95% developer satisfaction score

## 10. Risk Mitigation

### 10.1 Identified Risks
1. **Breaking Changes**: Mitigated through comprehensive testing
2. **Performance Degradation**: Mitigated through gradual rollout
3. **Adoption Friction**: Mitigated through clear documentation

### 10.2 Rollback Strategy
```typescript
// Feature flags for instant rollback
const featureFlags = {
  enableV2Api: process.env.ENABLE_V2_API === 'true',
  enableAsyncTransfers: process.env.ENABLE_ASYNC_TRANSFERS === 'true',
  enableCallbacks: process.env.ENABLE_CALLBACKS === 'true'
};
```

## 11. Long-term Roadmap

### Q1 2025
- V2 API implementation complete
- Beta testing and optimization

### Q2 2025
- Production rollout
- Migration tooling and documentation

### Q3 2025
- V2 adoption monitoring
- Performance optimization based on production data

### Q4 2025
- V1 deprecation warnings
- Planning for V3 features based on user feedback

## Conclusion

This implementation strategy ensures a smooth transition to MNEE V2 APIs while maintaining production stability. The phased approach minimizes risk, provides clear migration paths, and enables users to adopt V2 features at their own pace. Regular monitoring and feedback loops will ensure the implementation meets performance and reliability targets throughout the rollout process.