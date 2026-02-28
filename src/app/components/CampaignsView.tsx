import { FormEvent, useEffect, useState } from 'react';
import { Megaphone, Plus, Send } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Toaster } from './ui/sonner';

interface Campaign {
  id: string;
  name: string;
  channel: string;
  message: string;
  createdAt: string;
}

const CAMPAIGNS_STORAGE_KEY = 'savedCampaigns';

export function CampaignsView() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(CAMPAIGNS_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      setCampaigns(JSON.parse(stored));
    } catch {
      toast.error('No se pudieron cargar las campañas');
    }
  }, []);

  const persistCampaigns = (updatedCampaigns: Campaign[]) => {
    setCampaigns(updatedCampaigns);
    localStorage.setItem(CAMPAIGNS_STORAGE_KEY, JSON.stringify(updatedCampaigns));
  };

  const handleCreateCampaign = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!name.trim() || !message.trim()) {
      toast.error('Completa el nombre y el mensaje de la campaña');
      return;
    }

    const newCampaign: Campaign = {
      id: crypto.randomUUID(),
      name: name.trim(),
      channel,
      message: message.trim(),
      createdAt: new Date().toISOString(),
    };

    persistCampaigns([newCampaign, ...campaigns]);
    setName('');
    setMessage('');
    toast.success('Campaña creada y lista para envío masivo');
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full bg-[#25293c] overflow-y-auto">
      <Toaster />
      <div className="p-4 md:p-6 max-w-4xl mx-auto pb-20">
        <div className="mb-6">
          <h1 className="text-white text-2xl mb-1">Campañas</h1>
          <p className="text-gray-400 text-sm">Crea campañas para enviar mensajes masivos</p>
        </div>

        <div className="bg-[#2f3349] rounded-lg p-6 mb-6">
          <h2 className="text-white font-medium mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nueva campaña
          </h2>

          <form className="space-y-4" onSubmit={handleCreateCampaign}>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-300">Nombre de campaña</Label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="bg-[#25293c] border-gray-600 text-white"
                  placeholder="Promoción de verano"
                />
              </div>

              <div>
                <Label className="text-gray-300">Canal</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="bg-[#25293c] border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-gray-300">Mensaje masivo</Label>
              <Textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                className="bg-[#25293c] border-gray-600 text-white min-h-28"
                placeholder="Escribe el mensaje que se enviará a los contactos..."
              />
            </div>

            <Button type="submit" className="w-full md:w-auto">
              <Send className="h-4 w-4 mr-2" />
              Guardar campaña
            </Button>
          </form>
        </div>

        <div className="bg-[#2f3349] rounded-lg p-6">
          <h2 className="text-white font-medium mb-4 flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Campañas registradas
          </h2>

          {campaigns.length === 0 ? (
            <p className="text-gray-400 text-sm">Todavía no hay campañas registradas.</p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <div key={campaign.id} className="bg-[#25293c] border border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="text-white font-medium truncate">{campaign.name}</p>
                    <Badge variant="secondary" className="bg-indigo-600 text-white uppercase">
                      {campaign.channel}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-300 mb-2">{campaign.message}</p>
                  <p className="text-xs text-gray-500">Creada: {formatDate(campaign.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}