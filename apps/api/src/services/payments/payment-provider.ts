import type {
  AuthorizationParams,
  Charge,
  CreateChargeParams,
  ExchangeParams,
  GetChargeParams,
  ProviderCredentials,
  ProviderEvent,
  RawWebhookRequest,
  Refund,
  RefundParams,
  WebhookVerification,
} from './domain';

// The narrow seam between Athelas and a payment processor. One implementation
// per processor, registered in provider-registry.ts. Adding a processor is a
// new adapter file plus a registry entry — never a change to booking logic.
export interface PaymentProvider {
  readonly id: string;

  getAuthorizationUrl(params: AuthorizationParams): string;
  exchangeCode(params: ExchangeParams): Promise<ProviderCredentials>;
  refreshCredentials(credentials: ProviderCredentials): Promise<ProviderCredentials>;
  revoke(credentials: ProviderCredentials): Promise<void>;

  createCharge(params: CreateChargeParams): Promise<Charge>;
  getCharge(params: GetChargeParams): Promise<Charge>;
  refundCharge(params: RefundParams): Promise<Refund>;

  verifyWebhook(request: RawWebhookRequest): WebhookVerification;
  parseWebhook(request: RawWebhookRequest): ProviderEvent;
}
