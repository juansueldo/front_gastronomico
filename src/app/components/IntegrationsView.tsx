import { CalendarDays, CreditCard, ExternalLink, Store } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Toaster } from './ui/sonner';
import { useIntegrationsViewModel } from '../hooks/useIntegrationsViewModel';
import type { OAuthProviderId } from '../api';

const providerIconMap: Record<OAuthProviderId, typeof CreditCard> = {
  mercadopago: CreditCard,
  mercadolibre: Store,
  google_calendar: CalendarDays,
};

export function IntegrationsView() {
  const {
    orderedProviders,
    isLoading,
    connectingProviderId,
    handleConnect,
  } = useIntegrationsViewModel();

  return (
    <div className="h-full bg-body overflow-y-auto">
      <Toaster />
      <div className="p-4 md:p-6 space-y-6">
        <div className="mb-6">
          <h1 className="text-white text-2xl mb-1">Integraciones</h1>
          <p className="text-gray-400 text-sm">
            Vincula cuentas externas por OAuth. Puedes empezar con MercadoPago y luego sumar otras plataformas.
          </p>
        </div>

        {isLoading ? (
          <p className="text-gray-400 text-sm">Cargando integraciones...</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {orderedProviders.map((provider) => {
              const Icon = providerIconMap[provider.id] ?? Store;
              const isConnecting = connectingProviderId === provider.id;

              return (
                <Card key={provider.id} className="bg-card border-orange-700 text-white">
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-3">
                      <span className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        <span>{provider.name}</span>
                      </span>
                      {provider.connected ? (
                        <Badge className="bg-emerald-600 text-white">Conectado</Badge>
                      ) : provider.enabled ? (
                        <Badge className="bg-gray-700 text-gray-100">No conectado</Badge>
                      ) : (
                        <Badge className="bg-amber-700 text-white">Proximamente</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-300">{provider.description}</p>

                    {provider.accountLabel ? (
                      <p className="text-xs text-gray-400">Cuenta vinculada: {provider.accountLabel}</p>
                    ) : null}

                    <Button
                      onClick={() => {
                        void handleConnect(provider);
                      }}
                      disabled={!provider.enabled || isConnecting}
                      className="w-full"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {isConnecting
                        ? 'Redirigiendo...'
                        : provider.connected
                        ? 'Reconectar'
                        : provider.enabled
                        ? `Conectar con ${provider.name}`
                        : 'Disponible pronto'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
