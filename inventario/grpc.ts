import path from 'node:path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const GRPC_PORT = Number(process.env.GRPC_PORT ?? 50051);

const definition = protoLoader.loadSync(
    path.join(__dirname, 'inventario.proto'),
    {
        keepCase: true,
        defaults: true,
    }
);

const paquete = grpc.loadPackageDefinition(definition) as any;

interface SolicitudStock {
    sku: string;
}

interface Stock {
    sku: string;
    disponible: number;
}

interface SolicitudReserva {
    sku: string;
    cantidad: number;
}

interface Reserva {
    sku: string;
    reservado: number;
    restante: number;
}

const esperar = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

export function iniciarGRPC(stock: Map<string, number>, retardoMs = 0): void {
    async function consultarStock(
        call: grpc.ServerUnaryCall<SolicitudStock, Stock>,
        callback: grpc.sendUnaryData<Stock>
    ) {
        if (retardoMs > 0) await esperar(retardoMs);

        const sku = call.request.sku;
        const disponible = stock.get(sku);

        if (disponible === undefined) {
            callback({
                code: grpc.status.NOT_FOUND,
                details: `El producto con SKU ${sku} no existe`,
            });
            return;
        }

        callback(null, { sku, disponible });
    }

    async function reservar(
        call: grpc.ServerUnaryCall<SolicitudReserva, Reserva>,
        callback: grpc.sendUnaryData<Reserva>
    ) {
        if (retardoMs > 0) await esperar(retardoMs);

        const { sku, cantidad } = call.request;

        if (!Number.isInteger(cantidad) || cantidad <= 0) {
            callback({
                code: grpc.status.INVALID_ARGUMENT,
                details: 'La cantidad debe ser un entero mayor que 0',
            });
            return;
        }

        const disponible = stock.get(sku);

        if (disponible === undefined) {
            callback({
                code: grpc.status.NOT_FOUND,
                details: `El producto con SKU ${sku} no existe`,
            });
            return;
        }

        if (disponible < cantidad) {
            callback({
                code: grpc.status.FAILED_PRECONDITION,
                details: 'No hay stock suficiente',
            });
            return;
        }

        const restante = disponible - cantidad;
        stock.set(sku, restante);

        callback(null, { sku, reservado: cantidad, restante });
    }

    const servidor = new grpc.Server();

    servidor.addService(paquete.Inventario.Inventario.service, {
        ConsultarStock: consultarStock,
        Reservar: reservar,
    });

    servidor.bindAsync(
        `0.0.0.0:${GRPC_PORT}`,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
            if (error) {
                console.error(`No se pudo iniciar gRPC: ${error.message}`);
                return;
            }

            console.log(`Servidor gRPC escuchando en el puerto ${port}`);
        }
    );
}
