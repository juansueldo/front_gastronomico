import { useEffect, useState } from 'react';
import { getAgentConfig, upsertAgentConfig } from '../api';
import { Bot, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';


// Solo para UI, la config real se guarda en backend
interface AgentConfigUI {
  geminiApiKey: string;
  context: string;
}


const defaultConfig: AgentConfigUI = {
  geminiApiKey: '',
  context: '',
};


export function AgentConfigView() {
  const [config, setConfig] = useState<AgentConfigUI>(defaultConfig);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getAgentConfig()
      .then((data) => {
        if (data) {
          setConfig({
            geminiApiKey: data.geminiApiKey || '',
            context: data.context || '',
          });
        }
      })
      .catch(() => toast.error('No se pudo cargar la configuración del agente'))
      .finally(() => setLoading(false));
  }, []);

  const saveConfig = async () => {
    setLoading(true);
    try {
      await upsertAgentConfig({
        geminiApiKey: config.geminiApiKey,
        context: config.context,
      });
      toast.success('Configuración del agente guardada');
    } catch {
      toast.error('No se pudo guardar la configuración');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full bg-body overflow-y-auto">
      <Toaster />
      <div className="p-4 md:p-6 max-w-3xl mx-auto pb-20">
        <div className="mb-6">
          <h1 className="text-white text-2xl mb-1">Agente IA</h1>
          <p className="text-gray-400 text-sm">Configura el proveedor y parámetros del asistente</p>
        </div>

        <div className="bg-card rounded-lg p-6 space-y-5">
          <h2 className="text-white font-medium flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Configuración del agente
          </h2>

          <div>
            <Label className="text-gray-300">Gemini API Key</Label>
            <Input
              type="password"
              value={config.geminiApiKey}
              onChange={(event) => setConfig({ ...config, geminiApiKey: event.target.value })}
              className="bg-body border-gray-600 text-white"
              disabled={loading}
            />
          </div>

          <div>
            <Label className="text-gray-300">Contexto (opcional)</Label>
            <Input
              value={config.context}
              onChange={(event) => setConfig({ ...config, context: event.target.value })}
              className="bg-body border-gray-600 text-white"
              disabled={loading}
            />
          </div>

          <Button onClick={saveConfig} className="w-full md:w-auto" disabled={loading}>
            <Save className="h-4 w-4 mr-2" />
            Guardar configuración
          </Button>
        </div>
      </div>
    </div>
  );
}