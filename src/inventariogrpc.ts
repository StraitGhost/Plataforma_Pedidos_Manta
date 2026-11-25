
import path from "node:path";
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const INVENTARIO_PROTO_PATH = process.env.INVENTARIO_PROTO_PATH ?? path.join(process.cwd(), "proto", "inventario.proto");
const PLAZO_MS = Number(process.env.PLAZO_MS ?? 1000); 


const definicion = protoLoader.loadSync(INVENTARIO_PROTO_PATH, {
    keepCase: true,
    defaults: true,
});

const paquete = grpc.loadPackageDefinition(definicion) as any;
const inventario= new paquete.inventario.Inventario("localhost:50051", grpc.credentials.createInsecure());

export function llamar<T>(metodo: string, peticion: object): Promise<T> {
    return new Promise((resolve, reject) => {
        const plazo = new Date(Date.now()+PLAZO_MS);
        inventario[metodo](peticion, {deadline: plazo}, (error: grpc.ServiceError | null, respuesta: T) => {
            if (error) reject(error);
            else resolve(respuesta);
        });
    });
}

const HTTP_DE: Record<number, number> = {
[grpc.status.NOT_FOUND]: 404,

};


export function aHttp(e:unknown){
    const error = e as grpc.ServiceError;
    if(typeof error.code === "number"){
        return {status: 500, cuerpo: {error: "ERROR_INTERNO", motivo: String(e)}};
    }
    return {status: HTTP_DE[error.code] ?? 502, cuerpo: {error: grpc.status[error.code], motivo: error.details}};


}