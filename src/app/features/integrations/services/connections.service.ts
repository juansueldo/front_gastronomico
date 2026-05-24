import {
  connectWhatsappAccount,
  getCurrentMessagingAccount,
  restartWhatsappAccount,
  type MessagingAccount,
} from '../../chat/services/messaging.service';

export interface ConnectionItem {
  id: string | number;
  description?: string;
  phone?: string;
  network?: string | number;
  network_name?: string;
  instanceId?: string | number;
}

export interface NetworkOption {
  id?: string | number;
  value?: string;
  label?: string;
  name?: string;
  code?: string;
  key?: string;
  status?: number;
  description?: string;
}

export interface LoginInstanceResponse {
  ok?: boolean;
  message?: string;
  instanceId?: number | string;
  provider?: string;
  network_name?: string;
  qr?: string | null;
  status?: string;
  snapshot?: {
    status?: string;
    qr?: string | null;
    qrDataUrl?: string | null;
    connected?: boolean;
    wid?: string | null;
    phone?: string | null;
    pushname?: string | null;
  };
  whatsapp?: {
    status?: string;
    qr?: string | null;
  };
  error?: string;
}

function mapAccountToConnection(account: MessagingAccount): ConnectionItem {
  return {
    id: account.instanceId ?? account.id ?? 'whatsapp',
    instanceId: account.instanceId ?? account.id,
    description: account.displayName ?? account.instance?.name ?? 'WhatsApp',
    phone: account.phone ?? account.instance?.phone ?? '',
    network: 'whatsapp',
    network_name: 'WhatsApp',
  };
}

function mapAccountToLoginResponse(account: MessagingAccount | null): LoginInstanceResponse {
  return {
    ok: Boolean(account),
    instanceId: account?.instanceId ?? account?.id,
    provider: account?.provider ?? 'whatsapp',
    network_name: 'WhatsApp',
    qr: account?.qrCode ?? null,
    status: account?.status ?? 'unknown',
    snapshot: {
      status: account?.status ?? 'unknown',
      qr: account?.qrCode ?? null,
      qrDataUrl: account?.qrCode ?? null,
      connected: account?.status === 'ready' || account?.status === 'authenticated' || account?.status === 'connected',
      phone: account?.phone ?? account?.instance?.phone ?? null,
      pushname: account?.displayName ?? account?.instance?.name ?? null,
    },
    whatsapp: {
      status: account?.status ?? 'unknown',
      qr: account?.qrCode ?? null,
    },
  };
}

export async function listInstances(): Promise<ConnectionItem[]> {
  const account = await getCurrentMessagingAccount();
  return account ? [mapAccountToConnection(account)] : [];
}

export async function createInstance(connectionData: {
  customer_id?: number;
  customerId?: number;
  description: string;
  phone: string;
  network: number | string;
}): Promise<ConnectionItem> {
  const account = await connectWhatsappAccount({
    phone: connectionData.phone,
    displayName: connectionData.description,
  });
  return account
    ? mapAccountToConnection(account)
    : {
      id: 'whatsapp',
      description: connectionData.description,
      phone: connectionData.phone,
      network: 'whatsapp',
      network_name: 'WhatsApp',
    };
}

export async function loginInstance(): Promise<LoginInstanceResponse> {
  const account = await restartWhatsappAccount();
  return mapAccountToLoginResponse(account);
}

export async function listNetworks(): Promise<NetworkOption[]> {
  return [{ id: 'whatsapp', value: '1', label: 'WhatsApp', name: 'WhatsApp', status: 1 }];
}
