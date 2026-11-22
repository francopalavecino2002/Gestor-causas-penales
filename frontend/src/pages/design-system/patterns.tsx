import type { ReactNode } from "react";
import {
  CalendarPlus,
  CircleAlert,
  FileText,
  Gavel,
  Hourglass,
  Info,
  Lock,
  MapPin,
  User,
  type LucideIcon,
} from "lucide-react";

import { HearingStatusBadge } from "@/components/hearing/hearing-status-badge";
import type { HearingStatus } from "@/components/hearing/hearing-status";
import { AssistedCalculationNote } from "@/components/legal/assisted-calculation-note";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuideSection, Specimen } from "@/pages/design-system/section";

export function AlertsSection() {
  return (
    <GuideSection
      id="alertas"
      title="Alertas"
      intro="Primero el hecho, después qué hacer. Cada alerta lleva su ícono; el rojo queda para la privación de libertad."
    >
      <div className="grid gap-4">
        <Alert variant="detained">
          <Lock aria-hidden="true" />
          <AlertTitle>Carla Modelo está en prisión preventiva</AlertTitle>
          <AlertDescription>
            <p>
              Tiene audiencia hoy a las <time dateTime="11:00">11:00</time> en la Sala 5.{" "}
              <a href="#tarjetas" className="font-bold text-primary underline underline-offset-4">
                Ver el caso
              </a>
            </p>
          </AlertDescription>
        </Alert>
        <Alert variant="deadline">
          <Hourglass aria-hidden="true" />
          <AlertTitle>Vence un plazo esta semana</AlertTitle>
          <AlertDescription>
            <p>Impugnación ordinaria de Martín Ficticio, el miércoles 25/11.</p>
          </AlertDescription>
        </Alert>
        <Alert>
          <Info aria-hidden="true" />
          <AlertTitle>La agenda se actualizó</AlertTitle>
          <AlertDescription>
            <p>La Oficina Judicial reprogramó una audiencia de mañana.</p>
          </AlertDescription>
        </Alert>
        <Alert variant="error">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>No pudimos guardar la audiencia</AlertTitle>
          <AlertDescription>
            <p>
              El horario se superpone con la de las 11:00 en la Sala 5. Elegí otro horario o
              confirmá la superposición.
            </p>
          </AlertDescription>
        </Alert>
        <Specimen title="Aviso de cálculo asistido (va con cada plazo)">
          <AssistedCalculationNote />
        </Specimen>
      </div>
    </GuideSection>
  );
}

/** A legajo number never breaks at its hyphen. */
function Legajo({ number }: { number: string }) {
  return (
    <>
      Legajo <span className="whitespace-nowrap">{number}</span>
    </>
  );
}

interface MetaRow {
  icon: LucideIcon;
  term: string;
  value: ReactNode;
}

function HearingCard({
  title,
  article,
  status,
  people,
  detained = false,
  meta,
  note,
}: {
  title: string;
  article: string;
  status: HearingStatus;
  people: string;
  detained?: boolean;
  meta: MetaRow[];
  note?: ReactNode;
}) {
  return (
    <Card edge={detained ? "detained" : "none"} asChild>
      <article>
        <CardHeader>
          <div className="grid">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{article}</CardDescription>
          </div>
          <HearingStatusBadge status={status} />
        </CardHeader>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-semibold">
          {people}
          {detained ? (
            <Badge variant="detained">
              <Lock aria-hidden="true" />
              En prisión preventiva
            </Badge>
          ) : null}
        </p>
        {note ? <p className="text-meta text-muted-foreground">{note}</p> : null}
        <CardContent asChild>
          <dl className="text-meta text-muted-foreground">
            {meta.map(({ icon: Icon, term, value }) => (
              <div key={term} className="flex items-start gap-2">
                <dt className="sr-only">{term}</dt>
                <Icon aria-hidden="true" className="mt-0.75 size-4.5 shrink-0" />
                <dd className="text-foreground tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </article>
    </Card>
  );
}

function RailSlot({ time, children }: { time: string; children: ReactNode }) {
  return (
    <li className="relative grid grid-cols-[3.25rem_1fr] gap-x-7 before:absolute before:top-4.75 before:left-15 before:size-3 before:rounded-full before:border-2 before:border-border-strong before:bg-card before:content-[''] md:grid-cols-[3.75rem_1fr] md:before:left-17">
      <time dateTime={time} className="pt-3.5 text-right text-time font-bold">
        {time}
      </time>
      {children}
    </li>
  );
}

export function CardsSection() {
  return (
    <GuideSection
      id="tarjetas"
      title="Tarjetas y riel del día"
      intro="Una tarjeta por audiencia, con borde de 1 px y sin sombra. El riel ordena el día y la línea «Ahora» responde qué sigue. Un defendido detenido suma el borde rojo y su etiqueta."
    >
      <ol className="relative grid gap-3.5 before:absolute before:top-1.5 before:bottom-1.5 before:left-16.25 before:w-0.5 before:bg-border before:content-[''] md:before:left-18.25">
        <li
          aria-label="Ahora son las 10:20"
          className="relative grid grid-cols-[3.25rem_1fr] items-center gap-x-7 text-small font-bold text-primary after:absolute after:top-1/2 after:left-14.75 after:size-3.5 after:-translate-y-1/2 after:rounded-full after:bg-primary after:content-[''] md:grid-cols-[3.75rem_1fr] md:after:left-16.75"
        >
          <span className="text-right tabular-nums">10:20</span>
          <span className="flex items-center gap-2.5">
            Ahora
            <span aria-hidden="true" className="h-0.5 flex-1 bg-primary" />
          </span>
        </li>
        <RailSlot time="11:00">
          <HearingCard
            title="Revisión de prisión preventiva"
            article="CPP art. 118 [validar]"
            status="programada"
            people="Carla Modelo"
            detained
            meta={[
              { icon: MapPin, term: "Sala", value: "Sala 5, Ciudad Judicial" },
              { icon: Gavel, term: "Jueza", value: "Dra. Silvia Muestra" },
              { icon: FileText, term: "Legajo", value: <Legajo number="DEMO-0098/2026" /> },
              { icon: User, term: "Abogado", value: "Dr. Hugo Prueba" },
            ]}
          />
        </RailSlot>
        <RailSlot time="12:30">
          <HearingCard
            title="Control de acusación"
            article="CPP arts. 167 a 169 [validar]"
            status="reprogramada"
            people="Diego Ejemplar y Nora Ficticia"
            note="Antes: jueves 19/11 a las 09:00."
            meta={[
              { icon: MapPin, term: "Sala", value: "Sala 3, Ciudad Judicial" },
              { icon: FileText, term: "Legajo", value: <Legajo number="DEMO-0117/2026" /> },
            ]}
          />
        </RailSlot>
      </ol>

      <Card edge="deadline" className="gap-1">
        <Badge variant="deadline">
          <Hourglass aria-hidden="true" />
          Vence el miércoles 25/11
        </Badge>
        <p className="font-bold">Impugnación ordinaria</p>
        <p className="text-meta text-muted-foreground tabular-nums">
          Martín Ficticio, legajo <span className="whitespace-nowrap">DEMO-0142/2026</span>. CPP
          art. 242{" "}
          <span className="font-bold whitespace-nowrap text-deadline">[no verificado]</span>.
        </p>
        <AssistedCalculationNote className="mt-2" />
      </Card>
    </GuideSection>
  );
}

export function NavigationSection() {
  return (
    <GuideSection
      id="pestanas"
      title="Pestañas y diálogo"
      intro="Las pestañas cambian la vista sin salir de la pantalla. El diálogo confirma lo que importa; acá no se borra nada, se archiva."
    >
      <Specimen title="Pestañas" className="block">
        <Tabs defaultValue="day">
          <TabsList aria-label="Vista de la agenda">
            <TabsTrigger value="day">Día</TabsTrigger>
            <TabsTrigger value="week">Semana</TabsTrigger>
            <TabsTrigger value="month">Mes</TabsTrigger>
          </TabsList>
          <TabsContent value="day" className="text-meta text-muted-foreground">
            Hoy tenés 5 audiencias; la próxima es a las 11:00.
          </TabsContent>
          <TabsContent value="week" className="text-meta text-muted-foreground">
            Esta semana tenés 14 audiencias y 2 plazos que vencen.
          </TabsContent>
          <TabsContent value="month" className="text-meta text-muted-foreground">
            En noviembre tenés 41 audiencias cargadas.
          </TabsContent>
        </Tabs>
      </Specimen>

      <Specimen title="Diálogo de confirmación">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Archivá el caso</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>¿Archivás el caso DEMO-0098/2026?</DialogTitle>
              <DialogDescription>
                Deja de aparecer en la agenda y en las búsquedas. Podés recuperarlo cuando quieras
                desde Archivados.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button>Archivá el caso</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Specimen>
    </GuideSection>
  );
}

export function StatesSection() {
  return (
    <GuideSection
      id="carga"
      title="Carga y vacío"
      intro="Mientras carga, la forma de lo que viene. Si no hay nada, una invitación a cargar lo primero."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div
          aria-busy="true"
          aria-label="Cargando audiencias"
          role="status"
          className="grid gap-2.5 rounded-xl border bg-card px-4 pt-3.5 pb-4"
        >
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-6 w-3/5" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
          <Skeleton className="h-5 w-2/5" />
          <Separator className="my-1" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>

        <div className="grid justify-items-start gap-3 rounded-xl border border-dashed border-border-strong bg-card p-6">
          <CalendarPlus aria-hidden="true" className="size-6 text-primary" />
          <p className="text-card-title font-bold">No tenés audiencias esta semana</p>
          <p className="max-w-prose text-meta text-muted-foreground">
            Todavía no cargaste audiencias para esta semana. Cargá la primera y te avisamos el día
            anterior.
          </p>
          <Button>Cargá la primera</Button>
        </div>
      </div>
    </GuideSection>
  );
}
