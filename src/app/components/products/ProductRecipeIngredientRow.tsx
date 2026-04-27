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
    <div className="grid grid-cols-1 gap-2 items-center md:grid-cols-[1fr_140px_160px_auto]">
      <Input
        placeholder="Ingrediente"
        value={ingredient.name}
        onChange={(event) => onChange(ingredient.id, 'name', event.target.value)}
      />
      <Input
        type="number"
        min="0"
        step="0.01"
        placeholder="Cantidad"
        value={ingredient.quantity}
        onChange={(event) => onChange(ingredient.id, 'quantity', event.target.value)}
      />
      <Select value={ingredient.unit} onValueChange={(value) => onChange(ingredient.id, 'unit', value)}>
        <SelectTrigger>
          <SelectValue placeholder="Unidad" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="unidad">Unidad</SelectItem>
          <SelectItem value="g">Gramos</SelectItem>
          <SelectItem value="kg">Kilogramos</SelectItem>
          <SelectItem value="ml">Mililitros</SelectItem>
          <SelectItem value="l">Litros</SelectItem>
        </SelectContent>
      </Select>
      <Button
        type="button"
        size="sm"
        variant="destructive"
        onClick={() => onRemove(ingredient.id)}
      >
        Quitar
      </Button>
    </div>
  );
}
