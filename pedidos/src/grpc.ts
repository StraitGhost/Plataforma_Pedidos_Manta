import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const INVENTARIO_GRPC_URL = process.env.INVENTARIO_GRPC_URL ?? '127.0.0.1:50051';
const RETARDO_MS = Number(process.env.RETARDO_MS ?? 0);

const definition = protoLoader.loadSync(
    path.join(__dirname, 'inventario.proto'),
    {
        keepCase: true,
        defaults: true,
    }
);

const paquete = grpc.loadPackageDefinition(definition) as any;
const cliente = new paquete.Inventario.Inventario(
    INVENTARIO_GRPC_URL,
    grpc.credentials.createInsecure()
);

export interface Stock {
    sku: string;
    disponible: number;
}

export interface Reserva {
    sku: string;
    reservado: number;
    restante: number;
}

export type ErrorInventario = grpc.ServiceError;

type Metodo = 'ConsultarStock' | 'Reservar';

function invocar<T>(metodo: Metodo, solicitud: object): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const opciones: grpc.CallOptions = RETARDO_MS > 0
            ? { deadline: Date.now() + RETARDO_MS }
            : {};

        const fn = cliente[metodo].bind(cliente) as (
            solicitud: object,
            opciones: grpc.CallOptions,
            callback: (error: grpc.ServiceError | null, respuesta: T) => void
        ) => void;

        fn(solicitud, opciones, (error, respuesta) => {
            if (error) {
                reject(error);
                return;
            }

            resolve(respuesta);
        });
    });
}

export function consultarStock(sku: string): Promise<Stock> {
    return invocar<Stock>('ConsultarStock', { sku });
}

export function reservar(sku: string, cantidad: number): Promise<Reserva> {
    return invocar<Reserva>('Reservar', { sku, cantidad });
}

export function estadoHTTP(error: ErrorInventario): { status: number; motivo: string } {
    const motivo = error.details || error.message;

    switch (error.code) {
        case grpc.status.NOT_FOUND:
            return { status: 404, motivo };
        case grpc.status.INVALID_ARGUMENT:
            return { status: 400, motivo };
        case grpc.status.FAILED_PRECONDITION:
            return { status: 409, motivo };
        case grpc.status.RESOURCE_EXHAUSTED:
            return { status: 409, motivo };
        case grpc.status.DEADLINE_EXCEEDED:
            return { status: 504, motivo: `Inventario no contestó en ${RETARDO_MS}ms` };
        case grpc.status.UNAVAILABLE:
            return { status: 503, motivo: 'Inventario no disponible' };
        default:
            return { status: 503, motivo };
    }
}
