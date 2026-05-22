import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

export interface RecipeIngredientRowValue {
  id: string;
  name: string;
  quantity: string;
  unit: string;
}

interface ProductRecipeIngredientRowProps {
  ingredient: RecipeIngredientRowValue;
  onChange: (ingredientId: string, field: 'name' | 'quantity' | 'unit', value: string) => void;
  onRemove: (ingredientId: string) => void;
}

export function ProductRecipeIngredientRow({
  ingredient,
  onChange,
  onRemove,
}: ProductRecipeIngredientRowProps) {
  return (
    <div className="grid grid-cols-1 gap-2 items-center md:grid-cols-[minmax(0,1fr)_140px_160px_auto]">
      <Input
        placeholder="Ingrediente"
        value={ingredient.name}
        onChange={(event) => onChange(ingredient.id, 'name', event.target.value)}
        className="h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)]"
      />
      <Input
        type="number"
        min="0"
        step="0.01"
        placeholder="Cantidad"
        value={ingredient.quantity}
        onChange={(event) => onChange(ingredient.id, 'quantity', event.target.value)}
        className="h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)]"
      />
      <Select value={ingredient.unit} onValueChange={(value) => onChange(ingredient.id, 'unit', value)}>
        <SelectTrigger className="h-10 border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] focus:border-[var(--primary)] focus:ring-[var(--primary)]/25">
          <SelectValue placeholder="Unidad" />
        </SelectTrigger>
        <SelectContent className="border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]">
          <SelectItem value="unidad">Unidad</SelectItem>
          <SelectItem value="gr">Gramos</SelectItem>
          <SelectItem value="kg">Kilogramos</SelectItem>
          <SelectItem value="ml">Mililitros</SelectItem>
          <SelectItem value="lt">Litros</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => onRemove(ingredient.id)}
        className="h-10"
      >
        Quitar
      </Button>
    </div>
  );
}
