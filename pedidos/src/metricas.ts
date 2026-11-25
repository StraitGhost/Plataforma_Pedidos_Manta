// Interceptor que mide cada petición.
import { Request, Response, NextFunction } from "express";

const UMBRAL_LENTA_MS = Number(process.env.UMBRAL_LENTA_MS ?? 1000);

interface Estadistica {
  peticiones: number;
  totalMs: number;
  maxMs: number;
  lentas: number;
}

const porRuta = new Map<string, Estadistica>();

export function medirLatencia(req: Request, res: Response, next: NextFunction): void {
  const inicio = performance.now();
  res.on("finish", () => {
    const duracionMs = performance.now() - inicio;
    const clave = `${req.method} ${req.path}`;
    const est = porRuta.get(clave) ?? { peticiones: 0, totalMs: 0, maxMs: 0, lentas: 0 };
    est.peticiones += 1;
    est.totalMs += duracionMs;
    if (duracionMs > est.maxMs) est.maxMs = duracionMs;
    if (duracionMs > UMBRAL_LENTA_MS) est.lentas += 1;
    porRuta.set(clave, est);
  });
  next(); // sin next(), la petición nunca llega a la ruta
}

export function resumenMetricas() {
  const rutas = [...porRuta].map(([ruta, e]) => ({
    ruta,
    peticiones: e.peticiones,
    promedioMs: e.peticiones > 0 ? Math.round((e.totalMs / e.peticiones) * 100) / 100 : 0,
    maxMs: Math.round(e.maxMs * 100) / 100,
    lentas: e.lentas,
  }));
  return { umbralLentaMs: UMBRAL_LENTA_MS, rutas };
}