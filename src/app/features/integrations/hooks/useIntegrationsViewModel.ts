import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  getOAuthAuthorizeUrl,
  listOAuthProviders,
  type OAuthProvider,
  type OAuthProviderId,
} from '../services/integrations.service';

const providerOrder: OAuthProviderId[] = ['mercadopago', 'mercadolibre', 'google_calendar'];

export function useIntegrationsViewModel() {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connectingProviderId, setConnectingProviderId] = useState<OAuthProviderId | null>(null);

  useEffect(() => {
    const loadProviders = async () => {
      setIsLoading(true);
      try {
        const data = await listOAuthProviders();
        setProviders(data);
      } catch {
        toast.error('No se pudieron cargar las integraciones');
      } finally {
        setIsLoading(false);
      }
    };

    void loadProviders();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth');
    const provider = params.get('provider');

    if (!oauthStatus) {
      return;
    }

    if (oauthStatus === 'success') {
      toast.success(`Integracion ${provider ?? ''} vinculada correctamente`.trim());
    } else if (oauthStatus === 'error') {
      toast.error(`No se pudo vincular ${provider ?? 'la integracion'}`);
    }

    params.delete('oauth');
    params.delete('provider');
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}`;
    window.history.replaceState({}, '', url);
  }, []);

  const orderedProviders = useMemo(() => {
    const map = new Map<OAuthProviderId, OAuthProvider>();
    providers.forEach((provider) => map.set(provider.id, provider));
    return providerOrder.map((id) => map.get(id)).filter((item): item is OAuthProvider => item !== undefined);
  }, [providers]);

  const handleConnect = async (provider: OAuthProvider) => {
    if (!provider.enabled || connectingProviderId) {
      return;
    }

    setConnectingProviderId(provider.id);

    try {
      const url = await getOAuthAuthorizeUrl(provider.id);
      window.location.assign(url);
    } catch {
      toast.error('No se pudo iniciar el flujo OAuth');
      setConnectingProviderId(null);
    }
  };

  return {
    orderedProviders,
    isLoading,
    connectingProviderId,
    handleConnect,
  };
}
