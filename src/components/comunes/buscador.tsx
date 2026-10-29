"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

/** Campo de búsqueda que notifica el texto con una demora (debounce) para no consultar en cada tecla. */
export function Buscador({ onBuscar, placeholder = "Buscar…", demoraMs = 300 }: {
  onBuscar: (texto: string) => void;
  placeholder?: string;
  demoraMs?: number;
}) {
  const [texto, setTexto] = useState("");

  useEffect(() => {
    const temporizador = setTimeout(() => onBuscar(texto.trim()), demoraMs);
    return () => clearTimeout(temporizador);
  }, [texto, demoraMs, onBuscar]);

  return (
    <div className="relative w-full max-w-sm">
      <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={texto} onChange={(evento) => setTexto(evento.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  );
}
