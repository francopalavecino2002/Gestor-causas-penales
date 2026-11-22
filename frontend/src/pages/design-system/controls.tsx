import { ChevronLeft, Download, ChevronRight, Hourglass, Lock, Plus, Search } from "lucide-react";

import { HEARING_STATUSES } from "@/components/hearing/hearing-status";
import { HearingStatusBadge } from "@/components/hearing/hearing-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GuideSection, Specimen } from "@/pages/design-system/section";

export function ButtonsSection() {
  return (
    <GuideSection
      id="botones"
      title="Botones"
      intro="El texto dice lo que pasa, en imperativo con vos. Todos miden al menos 44 px de alto. Nunca un «+» solo como acción principal."
    >
      <Specimen title="Variantes">
        <Button>Guardá</Button>
        <Button variant="secondary">Ver la semana</Button>
        <Button variant="outline">Abrí el caso</Button>
        <Button variant="ghost">Cancelar</Button>
        <Button variant="link">Verificá con la norma</Button>
      </Specimen>
      <Specimen title="Con ícono, grande y deshabilitado">
        <Button>
          <Plus aria-hidden="true" />
          Cargá una audiencia
        </Button>
        <Button variant="outline">
          <Download aria-hidden="true" />
          Descargá el listado
        </Button>
        <Button size="lg">Guardá la audiencia</Button>
        <Button disabled>Guardando…</Button>
      </Specimen>
      <Specimen title="Botón flotante (teléfono) y botones de ícono con nombre accesible">
        <Button size="fab">
          <Plus aria-hidden="true" />
          Cargá una audiencia
        </Button>
        <div className="flex gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Día anterior">
                <ChevronLeft aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Día anterior</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Día siguiente">
                <ChevronRight aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Día siguiente</TooltipContent>
          </Tooltip>
          <Button variant="ghost" size="icon" aria-label="Buscar">
            <Search aria-hidden="true" />
          </Button>
        </div>
      </Specimen>
    </GuideSection>
  );
}

export function FormsSection() {
  return (
    <GuideSection
      id="formularios"
      title="Formularios"
      intro="Cada campo tiene su etiqueta visible. Los errores dicen qué pasó y cómo arreglarlo, con ícono y texto, sin pintar la pantalla de rojo."
    >
      <div className="grid gap-6 rounded-xl border bg-card p-4 sm:p-6 lg:grid-cols-2">
        <Field>
          <Label htmlFor="ds-legajo">Número de legajo</Label>
          <Input
            id="ds-legajo"
            defaultValue="DEMO-0098/2026"
            aria-describedby="ds-legajo-help"
            className="tabular-nums"
          />
          <FieldDescription id="ds-legajo-help">
            Como figura en la Oficina Judicial.
          </FieldDescription>
        </Field>

        <Field>
          <Label htmlFor="ds-time">Horario</Label>
          <Input
            id="ds-time"
            type="time"
            defaultValue="11:00"
            aria-invalid="true"
            aria-describedby="ds-time-error"
          />
          <FieldError id="ds-time-error">
            Se superpone con la audiencia de las 11:00 en la Sala 5. Elegí otro horario o confirmá
            la superposición.
          </FieldError>
        </Field>

        <Field>
          <Label htmlFor="ds-type">Tipo de audiencia</Label>
          <Select id="ds-type" defaultValue="revision">
            <option value="formulacion">Formulación de cargos (CPP art. 133) [validar]</option>
            <option value="revision">
              Revisión de prisión preventiva (CPP art. 118) [validar]
            </option>
            <option value="control">Control de acusación (CPP arts. 167 a 169) [validar]</option>
          </Select>
        </Field>

        <Field>
          <Label htmlFor="ds-room">Sala</Label>
          <Input id="ds-room" placeholder="Por ejemplo, Sala 5" disabled />
          <FieldDescription>
            Se completa cuando la Oficina Judicial asigna la sala.
          </FieldDescription>
        </Field>

        <Field className="lg:col-span-2">
          <Label htmlFor="ds-notes">Notas</Label>
          <Textarea
            id="ds-notes"
            placeholder="Lo que tenés que recordar para la audiencia"
            defaultValue="Pedir copia del informe del Servicio Penitenciario antes de entrar."
          />
        </Field>

        <div className="grid gap-1 lg:col-span-2">
          <div className="flex min-h-11 items-center gap-3">
            <Checkbox id="ds-remind" defaultChecked />
            <Label htmlFor="ds-remind" className="font-normal">
              Avisarme un día antes
            </Label>
          </div>
          <div className="flex min-h-11 items-center gap-3">
            <Checkbox id="ds-remind-disabled" disabled />
            <Label htmlFor="ds-remind-disabled" className="font-normal">
              Avisar al defendido (no disponible)
            </Label>
          </div>
          <div className="flex min-h-11 items-center gap-3">
            <Switch id="ds-past" defaultChecked />
            <Label htmlFor="ds-past" className="font-normal">
              Mostrar las audiencias que ya pasaron
            </Label>
          </div>
        </div>
      </div>
    </GuideSection>
  );
}

export function StatusesSection() {
  return (
    <GuideSection
      id="estados"
      title="Estados y etiquetas"
      intro="Las palabras de la OFIJU, siempre escritas. El color acompaña, nunca va solo."
    >
      <Specimen title="Estados de audiencia">
        {HEARING_STATUSES.map((status) => (
          <HearingStatusBadge key={status} status={status} />
        ))}
      </Specimen>
      <Specimen title="Detenido, plazo y fuente sin verificar">
        <Badge variant="detained">
          <Lock aria-hidden="true" />
          En prisión preventiva
        </Badge>
        <Badge variant="deadline">
          <Hourglass aria-hidden="true" />
          Vence el miércoles 25/11
        </Badge>
        <Badge variant="outline">CPP art. 242 [no verificado]</Badge>
        <Badge>Archivado</Badge>
      </Specimen>
    </GuideSection>
  );
}
