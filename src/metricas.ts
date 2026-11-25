import os from "node:os";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { Request, Response, NextFunction } from "express";

const UMBRAL_LENTA_MS = Number(process.env.UMBRAL_LENTA_MS ?? 1000);

const retardoBucle = monitorEventLoopDelay({ resolution: 10 });
retardoBucle.enable();

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
        const ms = performance.now() - inicio;
        const clave = `${req.method} ${req.path}`;
        const e = porRuta.get(clave) ?? { peticiones: 0, totalMs: 0, maxMs: 0, lentas: 0 };

        e.peticiones += 1;
        e.totalMs += ms;
        if (ms > e.maxMs) e.maxMs = ms;
        if (ms > UMBRAL_LENTA_MS) e.lentas += 1;

        porRuta.set(clave, e);
    });

    next();
}

const aMs = (ns: number) => Math.round(ns / 1e6);

export function resumenMetricas() {
    return {
        umbralLentaMs: UMBRAL_LENTA_MS,
        nucleos: os.availableParallelism(),
        bucle: {
            p50Ms: aMs(retardoBucle.percentile(50)),
            p99Ms: aMs(retardoBucle.percentile(99)),
            maxMs: aMs(retardoBucle.max),
        },
        rutas: [...porRuta].map(([ruta, e]) => ({
            ruta,
            peticiones: e.peticiones,
            promedioMs: Math.round(e.totalMs / e.peticiones),
            maxMs: Math.round(e.maxMs),
            lentas: e.lentas,
        })),
    };
}