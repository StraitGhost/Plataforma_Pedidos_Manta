
import { Request, Response, NextFunction } from "express";

const UMBRAL_LENTA_MS = Number(process.env.UMBRAL_LENTA_MS ?? 1000);

interface Estadistica {
    peticiones: number;
    totalMs: number;
    maxMs: number;
    lentas: number;
}

const porRuta = new Map<string, Estadistica>();

export function medirLatencia(
    req: Request,
    res: Response,
    next: NextFunction
): void {
    const inicio = performance.now();

    res.on("finish", () => {
        const ms = performance.now() - inicio;

        const clave = `${req.method} ${req.path}`;

        const e = porRuta.get(clave) ?? {
            peticiones: 0,
            totalMs: 0,
            maxMs: 0,
            lentas: 0,
        };

        e.peticiones += 1;
        e.totalMs += ms;

        if (ms > e.maxMs) {
            e.maxMs = ms;
        }

        if (ms > UMBRAL_LENTA_MS) {
            e.lentas += 1;
        }

        porRuta.set(clave, e);
    });

    next();
}

export function resumenMetricas() {
    return {
        umbralLentaMs: UMBRAL_LENTA_MS,
        rutas: [...porRuta].map(([ruta, e]) => ({
            ruta,
            peticiones: e.peticiones,
            promedioMs: Math.round(e.totalMs / e.peticiones),
            maxMs: Math.round(e.maxMs),
            lentas: e.lentas,
        })),
    };
}
