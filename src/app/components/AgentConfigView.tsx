import { useEffect, useState } from 'react';
import { Bot, Save } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';

interface AgentConfig {
  name: string;
  provider: string;
  model: string;
  endpoint: string;
  apiKey: string;
  temperature: number;
}

const AGENT_STORAGE_KEY = 'agentConfig';

const defaultConfig: AgentConfig = {
  name: 'Asistente Tomatina',
  provider: 'openai',
  model: 'gpt-5.3-codex',
  endpoint: 'https://api.openai.com/v1',
  apiKey: '',
  temperature: 0.7,
};

export function AgentConfigView() {
  const [config, setConfig] = useState<AgentConfig>(defaultConfig);

  useEffect(() => {
    const stored = localStorage.getItem(AGENT_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setConfig({ ...defaultConfig, ...parsed });
    } catch {
      toast.error('No se pudo cargar la configuración del agente');
    }
  }, []);

  const saveConfig = () => {
    localStorage.setItem(AGENT_STORAGE_KEY, JSON.stringify(config));
    toast.success('Configuración del agente guardada');
  };

  return (
    <div className="h-full bg-[#25293c] overflow-y-auto">
      <Toaster />
      <div className="p-4 md:p-6 max-w-3xl mx-auto pb-20">
        <div className="mb-6">
          <h1 className="text-white text-2xl mb-1">Agente IA</h1>
          <p className="text-gray-400 text-sm">Configura el proveedor y parámetros del asistente</p>
        </div>

        <div className="bg-[#2f3349] rounded-lg p-6 space-y-5">
          <h2 className="text-white font-medium flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Configuración del agente
          </h2>

          <div>
            <Label className="text-gray-300">Nombre del agente</Label>
            <Input
              value={config.name}
              onChange={(event) => setConfig({ ...config, name: event.target.value })}
              className="bg-[#25293c] border-gray-600 text-white"
            />
          </div>

          <div>
            <Label className="text-gray-300">Proveedor</Label>
            <Select value={config.provider} onValueChange={(value) => setConfig({ ...config, provider: value })}>
              <SelectTrigger className="bg-[#25293c] border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="azure-openai">Azure OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-gray-300">Modelo</Label>
            <Input
              value={config.model}
              onChange={(event) => setConfig({ ...config, model: event.target.value })}
              className="bg-[#25293c] border-gray-600 text-white"
            />
          </div>

          <div>
            <Label className="text-gray-300">Endpoint</Label>
            <Input
              value={config.endpoint}
              onChange={(event) => setConfig({ ...config, endpoint: event.target.value })}
              className="bg-[#25293c] border-gray-600 text-white"
            />
          </div>

          <div>
            <Label className="text-gray-300">API Key</Label>
            <Input
              type="password"
              value={config.apiKey}
              onChange={(event) => setConfig({ ...config, apiKey: event.target.value })}
              className="bg-[#25293c] border-gray-600 text-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-gray-300">Temperatura</Label>
              <span className="text-sm text-gray-400">{config.temperature.toFixed(1)}</span>
            </div>
            <Slider
              value={[config.temperature]}
              min={0}
              max={1}
              step={0.1}
              onValueChange={(value) => setConfig({ ...config, temperature: value[0] ?? 0.7 })}
            />
          </div>

          <Button onClick={saveConfig} className="w-full md:w-auto">
            <Save className="h-4 w-4 mr-2" />
            Guardar configuración
          </Button>
        </div>
      </div>
    </div>
  );
}