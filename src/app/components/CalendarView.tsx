import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { calendarEvents, type CalendarEvent } from '../data/mockData';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

type ViewMode = 'month' | 'week' | 'day';

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const hours = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

  const previousPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    } else if (viewMode === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 7);
      setCurrentDate(newDate);
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() - 1);
      setCurrentDate(newDate);
      setSelectedDate(newDate);
    }
  };

  const nextPeriod = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    } else if (viewMode === 'week') {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 7);
      setCurrentDate(newDate);
    } else {
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + 1);
      setCurrentDate(newDate);
      setSelectedDate(newDate);
    }
  };

  const getWeekDates = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day;
    const weekStart = new Date(date);
    weekStart.setDate(diff);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates(new Date(currentDate));

  const getEventsForDate = (date: Date) => {
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const getEventsForHour = (date: Date, hour: string) => {
    return getEventsForDate(date).filter(event => event.startTime.startsWith(hour.slice(0, 2)));
  };

  const formatTime = (time: string) => {
    return time;
  };

  const getEventTypeColor = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting':
        return 'bg-blue-500';
      case 'task':
        return 'bg-orange-500';
      case 'reminder':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getEventTypeLabel = (type: CalendarEvent['type']) => {
    switch (type) {
      case 'meeting':
        return 'Reunión';
      case 'task':
        return 'Tarea';
      case 'reminder':
        return 'Recordatorio';
      default:
        return '';
    }
  };

  const getPeriodLabel = () => {
    if (viewMode === 'month') {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewMode === 'week') {
      const start = weekDates[0];
      const end = weekDates[6];
      return `${start.getDate()} ${monthNames[start.getMonth()]} - ${end.getDate()} ${monthNames[end.getMonth()]} ${end.getFullYear()}`;
    } else {
      return currentDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  };

  const selectedDateEvents = getEventsForDate(selectedDate);

  return (
    <div className="h-full bg-body overflow-y-auto">
      <div className="p-4 md:p-6 max-w-7xl mx-auto pb-20">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-white text-2xl mb-1">Calendario</h1>
            <p className="text-gray-400 text-sm">Gestiona tus eventos y tareas</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className=" w-full md:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card text-white border-gray-700">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título</Label>
                  <Input placeholder="Título del evento" className="bg-body border-gray-600" />
                </div>
                <div>
                  <Label>Descripción</Label>
                  <Textarea placeholder="Descripción del evento" className="bg-body border-gray-600" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Hora inicio</Label>
                    <Input type="time" className="bg-body border-gray-600" />
                  </div>
                  <div>
                    <Label>Hora fin</Label>
                    <Input type="time" className="bg-body border-gray-600" />
                  </div>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select>
                    <SelectTrigger className="bg-body border-gray-600">
                      <SelectValue placeholder="Selecciona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Reunión</SelectItem>
                      <SelectItem value="task">Tarea</SelectItem>
                      <SelectItem value="reminder">Recordatorio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full bg-primary hover:bg-indigo-700">
                  Crear Evento
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* View Mode Tabs */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)} className="w-full md:w-auto">
            <TabsList className="bg-card w-full">
              <TabsTrigger value="month" className="flex-1 md:flex-none">Mes</TabsTrigger>
              <TabsTrigger value="week" className="flex-1 md:flex-none">Semana</TabsTrigger>
              <TabsTrigger value="day" className="flex-1 md:flex-none">Día</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="bg-card rounded-lg p-4 md:p-6">
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white font-medium text-lg">
              {getPeriodLabel()}
            </h2>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" onClick={previousPeriod} className="text-white">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={nextPeriod} className="text-white">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          {/* Month View */}
          {viewMode === 'month' && (
            <>
              {/* Calendar Days Header */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {dayNames.map((day) => (
                  <div key={day} className="text-center text-gray-400 text-sm py-2">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Days Grid */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                  <div key={`empty-${index}`} className="aspect-square" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, index) => {
                  const day = index + 1;
                  const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
                  const isToday = date.toDateString() === new Date().toDateString();
                  const isSelected = date.toDateString() === selectedDate.toDateString();
                  const events = getEventsForDate(date);
                  const hasEvents = events.length > 0;

                  return (
                    <button
                      key={day}
                      onClick={() => setSelectedDate(date)}
                      className={`aspect-square p-1 rounded-lg transition-colors relative ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : isToday
                          ? 'bg-indigo-900 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      <span className="text-sm">{day}</span>
                      {hasEvents && (
                        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {events.slice(0, 3).map((event, i) => (
                            <div
                              key={i}
                              className={`w-1 h-1 rounded-full ${getEventTypeColor(event.type)}`}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Week View */}
          {viewMode === 'week' && (
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Week header */}
                <div className="grid grid-cols-8 gap-2 mb-2">
                  <div className="text-center text-gray-400 text-sm py-2"></div>
                  {weekDates.map((date, i) => {
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                      <div
                        key={i}
                        className={`text-center py-2 rounded-lg ${
                          isToday ? 'bg-primary text-white' : 'text-gray-400'
                        }`}
                      >
                        <div className="text-xs">{dayNames[i]}</div>
                        <div className="text-lg">{date.getDate()}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Week grid */}
                <div className="space-y-1">
                  {hours.map((hour) => (
                    <div key={hour} className="grid grid-cols-8 gap-2">
                      <div className="text-gray-400 text-xs py-2">{hour}</div>
                      {weekDates.map((date, i) => {
                        const events = getEventsForHour(date, hour);
                        return (
                          <div
                            key={i}
                            className="min-h-[60px] bg-body rounded p-1 border border-gray-700"
                          >
                            {events.map((event) => (
                              <div
                                key={event.id}
                                className={`${getEventTypeColor(event.type)} text-white text-xs p-1 rounded mb-1`}
                              >
                                <div className="truncate">{event.title}</div>
                                <div className="text-[10px]">{event.startTime}</div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Day View */}
          {viewMode === 'day' && (
            <div className="space-y-2">
              {hours.map((hour) => {
                const events = getEventsForHour(currentDate, hour);
                return (
                  <div key={hour} className="flex gap-4">
                    <div className="w-20 text-gray-400 text-sm py-2">{hour}</div>
                    <div className="flex-1 min-h-[80px] bg-body rounded-lg p-3 border border-gray-700">
                      {events.map((event) => (
                        <div
                          key={event.id}
                          className={`${getEventTypeColor(event.type)} text-white rounded-lg p-3 mb-2`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-medium">{event.title}</h4>
                            <Badge variant="secondary" className="bg-white/20 text-white text-xs">
                              {getEventTypeLabel(event.type)}
                            </Badge>
                          </div>
                          <p className="text-sm opacity-90 mb-1">{event.description}</p>
                          <div className="flex items-center gap-1 text-xs opacity-75">
                            <Clock className="h-3 w-3" />
                            <span>{event.startTime} - {event.endTime}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Events Sidebar for Month View */}
        {viewMode === 'month' && (
          <div className="mt-6 bg-card rounded-lg p-4 md:p-6">
            <div className="flex items-center gap-2 mb-4">
              <CalendarIcon className="h-5 w-5 text-indigo-400" />
              <h3 className="text-white font-medium">
                Eventos del {selectedDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
              </h3>
            </div>

            <div className="space-y-3">
              {selectedDateEvents.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">
                  No hay eventos para este día
                </p>
              ) : (
                selectedDateEvents.map((event) => (
                  <div
                    key={event.id}
                    className="bg-body rounded-lg p-4 border-l-4"
                    style={{ borderLeftColor: getEventTypeColor(event.type).replace('bg-', '#') }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h4 className="text-white font-medium text-sm flex-1">{event.title}</h4>
                      <Badge
                        variant="secondary"
                        className={`${getEventTypeColor(event.type)} text-white text-xs`}
                      >
                        {getEventTypeLabel(event.type)}
                      </Badge>
                    </div>
                    <p className="text-gray-400 text-xs mb-2">{event.description}</p>
                    <div className="flex items-center gap-1 text-gray-400 text-xs">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(event.startTime)} - {formatTime(event.endTime)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
