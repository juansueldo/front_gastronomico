import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '../../shared/ui/components/badge';
import { Button } from '../../shared/ui/components/button';
import { Checkbox } from '../../shared/ui/components/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../shared/ui/components/dialog';
import { PackagePlus } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '../../shared/ui/components/dropdown-menu';
import { Input } from '../../shared/ui/components/input';
import type { ProductCategory } from '../../features/products';

type CreateStep = 'basic' | 'image' | 'categories';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProductId: string | null;
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  price: string;
  onPriceChange: (value: string) => void;
  imagePreviewUrl: string | null;
  onProductImageChange: (file: File | null) => Promise<void>;
  onClearProductImage: () => void;
  categories: ProductCategory[];
  selectedCategoryIds: string[];
  onToggleCategory: (categoryId: string) => void;
  onRemoveCategorySelection: (categoryId: string) => void;
  onSaveProduct: () => Promise<void>;
  isSaving?: boolean;
}

const CREATE_STEPS: CreateStep[] = ['basic', 'image', 'categories'];
const WIDE_DIALOG_CONTENT_CLASS =
  'max-h-[90vh] w-[calc(100vw-2rem)] !max-w-[calc(100vw-2rem)] overflow-visible p-0 sm:w-[70vw] sm:!max-w-[70vw]';
const FORM_CONTROL_CLASS =
  'h-10 rounded-md border-[var(--app-line)] bg-[var(--app-panel-subtle)] text-[var(--app-strong)] placeholder:text-[var(--app-muted)] focus:border-[var(--primary)] focus-visible:border-[var(--primary)] focus-visible:ring-[var(--primary)]/25';

function StepIndicator({ current, steps }: { current: CreateStep; steps: CreateStep[] }) {
  const idx = steps.indexOf(current);

  return (
    <div className="flex items-center gap-1 mb-4">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-1">
          <div
            className={`h-1.5 w-6 rounded-full transition-all duration-300 ${
              i <= idx ? 'bg-orange-500' : 'bg-gray-700'
            }`}
          />
        </div>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs font-semibold text-[var(--app-strong)]">{children}</p>;
}

export function ProductDialog({
  open,
  onOpenChange,
  editingProductId,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  price,
  onPriceChange,
  imagePreviewUrl,
  onProductImageChange,
  onClearProductImage,
  categories,
  selectedCategoryIds,
  onToggleCategory,
  onRemoveCategorySelection,
  onSaveProduct,
  isSaving = false,
}: Props) {
  const [step, setStep] = useState<CreateStep>('basic');
  const isCreateMode = !editingProductId;

  useEffect(() => {
    if (open) {
      setStep('basic');
    }
  }, [open]);

  const stepLabels = useMemo<Record<CreateStep, string>>(
    () => ({
      basic: 'Datos',
      image: 'Imagen',
      categories: 'Categorías',
    }),
    [],
  );

  const handleDialogOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setStep('basic');
    }
  };

  const goNext = () => {
    if (step === 'basic') {
      const trimmedName = name.trim();
      const parsedPrice = Number(price.replace(',', '.'));

      if (!trimmedName) {
        toast.error('Ingresá el nombre del producto');
        return;
      }

      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
        toast.error('Ingresá un precio válido');
        return;
      }
    }

    const index = CREATE_STEPS.indexOf(step);
    if (index < CREATE_STEPS.length - 1) {
      setStep(CREATE_STEPS[index + 1]);
    }
  };

  const goBack = () => {
    const index = CREATE_STEPS.indexOf(step);
    if (index > 0) {
      setStep(CREATE_STEPS[index - 1]);
    }
  };

  const renderBasicStep = () => (
    <div className="space-y-3">
      <div>
        <FieldLabel>Nombre</FieldLabel>
        <Input
          placeholder="Nombre"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          className={FORM_CONTROL_CLASS}
        />
      </div>
      <div>
        <FieldLabel>Descripción (opcional)</FieldLabel>
        <Input
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          className={FORM_CONTROL_CLASS}
        />
      </div>
      <div>
        <FieldLabel>Precio</FieldLabel>
        <Input
          type="number"
          min="0"
          step="0.01"
          placeholder="Precio"
          value={price}
          onChange={(event) => onPriceChange(event.target.value)}
          className={FORM_CONTROL_CLASS}
        />
      </div>
    </div>
  );

  const renderImageStep = () => (
    <div className="space-y-2">
      <p className="text-sm text-gray-300">Imagen del producto (opcional)</p>
      <Input
        type="file"
        accept="image/*"
        className={FORM_CONTROL_CLASS}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          void onProductImageChange(file);
        }}
      />

      {imagePreviewUrl ? (
        <div className="space-y-2">
          <div className="h-40 w-full overflow-hidden rounded-md border border-[var(--app-line)] bg-[var(--app-panel-subtle)]">
            <img
              src={imagePreviewUrl}
              alt="Vista previa del producto"
              className="h-full w-full object-cover"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
            onClick={onClearProductImage}
          >
            Quitar imagen
          </Button>
        </div>
      ) : (
        <p className="text-xs text-gray-500">No hay imagen seleccionada</p>
      )}
    </div>
  );

  const renderCategoriesStep = () => (
    <div className="space-y-3 rounded-md border border-[var(--app-line)] bg-[var(--app-panel-subtle)] p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-gray-300">Categorías</p>
        {categories.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline" className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]">
                Seleccionar categorías
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 w-64 overflow-y-auto border-[var(--app-line)] bg-[var(--app-panel)] text-[var(--app-strong)]">
              {categories.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category.id}
                  checked={selectedCategoryIds.includes(category.id)}
                  onCheckedChange={() => onToggleCategory(category.id)}
                  className="cursor-pointer"
                >
                  {category.name}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      {categories.length === 0 ? (
        <p className="text-xs text-gray-500">Primero creá categorías</p>
      ) : selectedCategoryIds.length === 0 ? (
        <p className="text-xs text-gray-500">Seleccioná al menos una categoría</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selectedCategoryIds.map((categoryId) => {
            const category = categories.find((item) => item.id === categoryId);

            if (!category) {
              return null;
            }

            return (
              <Badge
                key={category.id}
                variant="secondary"
                className="cursor-pointer bg-label-secondary text-white"
                onClick={() => onRemoveCategorySelection(category.id)}
              >
                {category.name}
              </Badge>
            );
          })}
        </div>
      )}

      <div className="space-y-2 border-t border-[var(--app-line)] pt-3">
        {categories.map((category) => (
          <label key={category.id} className="flex items-center gap-2 text-sm text-white cursor-pointer">
            <Checkbox
              checked={selectedCategoryIds.includes(category.id)}
              onCheckedChange={() => onToggleCategory(category.id)}
            />
            <span>{category.name}</span>
          </label>
        ))}
      </div>
    </div>
  );

  const renderFooter = () => (
    <DialogFooter className="border-t border-[var(--app-line)] px-5 py-4">
      <Button
        type="button"
        variant="outline"
        className="border-[var(--app-line)] bg-transparent text-[var(--app-strong)] hover:bg-[var(--app-soft)]"
        onClick={goBack}
        disabled={step === 'basic' || isSaving}
      >
        Atrás
      </Button>

      {step !== 'categories' ? (
        <Button type="button" className="flex-1 sm:flex-none" onClick={goNext}>
          Continuar →
        </Button>
      ) : (
        <Button type="button" className="flex-1 sm:flex-none" onClick={() => { void onSaveProduct(); }} disabled={isSaving}>
          {isSaving ? 'Guardando...' : isCreateMode ? 'Crear producto' : 'Guardar cambios'}
        </Button>
      )}
    </DialogFooter>
  );

  const renderWizardContent = () => (
    <>
      <StepIndicator current={step} steps={CREATE_STEPS} />
      {step === 'basic' && renderBasicStep()}
      {step === 'image' && renderImageStep()}
      {step === 'categories' && renderCategoriesStep()}
    </>
  );

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className={WIDE_DIALOG_CONTENT_CLASS}>
        <DialogHeader className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-[var(--app-line)] px-5 pb-4 pt-5 pr-16 text-left">
          <div className="row-span-2 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--primary)]/45 bg-[var(--primary)]/10 text-[var(--primary)]">
            <PackagePlus size={18} />
          </div>
          <DialogTitle>{editingProductId ? 'Editar producto' : 'Nuevo producto'}</DialogTitle>
          <DialogDescription>{stepLabels[step]}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-150px)] space-y-4 overflow-y-auto px-5 py-4">
          {renderWizardContent()}
        </div>
        {renderFooter()}
      </DialogContent>
    </Dialog>
  );
}
